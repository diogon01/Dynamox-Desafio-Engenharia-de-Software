/**
 * Consultas analíticas — o PostgreSQL faz o trabalho relacional e devolve o RESULTADO,
 * não a tabela. Cada função recebe um recorte (janela temporal, sensor, ciclo) e produz
 * poucas linhas: nenhuma delas pode crescer com o tamanho do histórico.
 *
 * Convenções: `Prisma.sql` sempre parametrizado; `count(*)::bigint` convertido com
 * `Number()` no serviço (BigInt vazado quebraria o JSON da resposta).
 */
import { Prisma } from '@prisma/client';

/** Recência máxima considerada na avaliação de condição (igual ao limiar de "desatualizado"). */
export const CONDITION_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** Amostras mínimas para uma aquisição valer como janela (MIN_BASELINE_SAMPLES do painel). */
const MIN_WINDOW_SAMPLES = 3;
/** Aquisições recentes inspecionadas por sensor ao procurar janelas sincronizadas. */
const RECENT_CYCLES_PER_SENSOR = 4;

/**
 * Condição da frota — a MESMA semântica que o painel derivava no cliente, agora no banco.
 *
 * Como o painel classificava: agrupava as amostras radiais em janelas de aquisição, mantinha
 * os instantes de início compartilhados por pelo menos dois sensores e comparava **as duas
 * últimas janelas sincronizadas** (`sharedStarts.slice(-2)`); a mais recente é a condição, a
 * anterior é a referência. Isso descarta, de propósito, a aquisição confirmatória — que
 * existe para um sensor só e não serve de comparação de frota.
 *
 * O que muda aqui: a janela de aquisição é o `ingestionCycleId` (o banco já sabe a que
 * aquisição cada amostra pertence; o cliente precisava inferir por lacuna de 5 min), e a
 * busca é limitada às últimas 24 h da janela consultada — mais velho que isso o próprio
 * painel já trata como desatualizado.
 *
 * RMS radial = `sqrt(avg((y² + z²)/2))` sobre as amostras Y e Z pareadas pelo MESMO instante,
 * idêntico ao cálculo por instante seguido de média que o cliente fazia.
 *
 * A referência é sempre uma aquisição concreta — nunca a média do período, que já embutiria
 * a própria degradação.
 */
export function fleetConditionSql(from: Date, to: Date): Prisma.Sql {
  const evaluationFrom = new Date(Math.max(from.getTime(), to.getTime() - CONDITION_LOOKBACK_MS));

  return Prisma.sql`
    WITH radial AS (
      SELECT s."serialNumber" AS serial, ts.id AS series_id, ts.axis AS axis
      FROM time_series ts
      JOIN sensors s ON s.id = ts."sensorId"
      WHERE ts."physicalQuantity" = 'ACCELERATION' AND ts.axis IN ('Y', 'Z')
    ),
    anchor AS (SELECT serial, series_id FROM radial WHERE axis = 'Y'),
    -- Aquisições recentes de cada sensor (poucas linhas por sensor, por índice).
    recent AS (
      SELECT a.serial, a.series_id, c.cycle_id, c.started_at
      FROM anchor a
      CROSS JOIN LATERAL (
        SELECT p."ingestionCycleId" AS cycle_id, min(p."timestamp") AS started_at
        FROM time_series_samples p
        WHERE p."timeSeriesId" = a.series_id
          AND p."ingestionCycleId" IS NOT NULL
          AND p."timestamp" >= ${evaluationFrom} AND p."timestamp" < ${to}
        GROUP BY 1
        HAVING count(*) >= ${MIN_WINDOW_SAMPLES}
        ORDER BY 2 DESC
        LIMIT ${RECENT_CYCLES_PER_SENSOR}
      ) c
    ),
    -- Aquisições SINCRONIZADAS: instantes em que pelo menos dois sensores adquiriram
    -- juntos. Descarta a confirmatória (existe para um sensor só e não serve de
    -- comparação), sem exigir que a frota inteira compartilhe o mesmo instante — no
    -- histórico cada máquina tem sua própria fase de aquisição.
    shared AS (
      SELECT started_at
      FROM recent
      GROUP BY started_at
      HAVING count(DISTINCT serial) >= 2
    ),
    -- Por sensor, as duas últimas aquisições sincronizadas: a mais recente classifica, a
    -- anterior é a referência.
    ranked AS (
      SELECT
        r.serial, r.series_id, r.cycle_id, r.started_at,
        row_number() OVER (PARTITION BY r.serial ORDER BY r.started_at DESC) AS position
      FROM recent r
      JOIN shared sh ON sh.started_at = r.started_at
    ),
    sensor_pair AS (
      SELECT
        serial,
        max(series_id) AS series_id,
        max(CASE WHEN position = 1 THEN cycle_id END) AS current_cycle_id,
        max(CASE WHEN position = 2 THEN cycle_id END) AS baseline_cycle_id
      FROM ranked
      WHERE position <= 2
      GROUP BY serial
    )
    SELECT
      m.name             AS machine_name,
      m.type             AS machine_type,
      mp.id              AS monitoring_point_id,
      mp.name            AS monitoring_point_name,
      sen."serialNumber" AS sensor_serial,
      sen.model          AS sensor_model,
      sp.current_cycle_id,
      sp.baseline_cycle_id,
      cur.rms            AS current_rms,
      cur.ended_at       AS current_at,
      cur.samples        AS current_samples,
      base.rms           AS baseline_rms,
      base.started_at    AS baseline_at,
      seen.last_at       AS last_seen_at
    FROM machines m
    JOIN monitoring_points mp ON mp."machineId" = m.id
    LEFT JOIN sensors sen ON sen."monitoringPointId" = mp.id
    LEFT JOIN sensor_pair sp ON sp.serial = sen."serialNumber"
    -- Recência independe do pareamento: um sensor fora das janelas ainda tem última leitura.
    LEFT JOIN LATERAL (
      SELECT max(last.at) AS last_at
      FROM radial r
      CROSS JOIN LATERAL (
        SELECT max(p."timestamp") AS at
        FROM time_series_samples p
        WHERE p."timeSeriesId" = r.series_id
      ) last
      WHERE r.serial = sen."serialNumber"
    ) seen ON true
    LEFT JOIN LATERAL (
      SELECT sqrt(avg((y.value * y.value + z.value * z.value) / 2)) AS rms,
             max(y."timestamp") AS ended_at,
             count(*)::bigint AS samples
      FROM time_series_samples y
      JOIN radial rz ON rz.serial = sp.serial AND rz.axis = 'Z'
      JOIN time_series_samples z
        ON z."timeSeriesId" = rz.series_id AND z."timestamp" = y."timestamp"
      WHERE y."timeSeriesId" = sp.series_id AND y."ingestionCycleId" = sp.current_cycle_id
    ) cur ON true
    LEFT JOIN LATERAL (
      SELECT sqrt(avg((y.value * y.value + z.value * z.value) / 2)) AS rms,
             min(y."timestamp") AS started_at
      FROM time_series_samples y
      JOIN radial rz ON rz.serial = sp.serial AND rz.axis = 'Z'
      JOIN time_series_samples z
        ON z."timeSeriesId" = rz.series_id AND z."timestamp" = y."timestamp"
      WHERE y."timeSeriesId" = sp.series_id AND y."ingestionCycleId" = sp.baseline_cycle_id
    ) base ON true
    ORDER BY m.name ASC, mp.name ASC
  `;
}

/** Buckets aceitos na série agregada; o rótulo é fechado e vira intervalo aqui, nunca SQL do cliente. */
export const SERIES_BUCKETS = ['15m', '1h', '4h', '1d'] as const;
export type SeriesBucket = (typeof SERIES_BUCKETS)[number];

const BUCKET_SECONDS: Record<SeriesBucket, number> = {
  '15m': 900,
  '1h': 3_600,
  '4h': 14_400,
  '1d': 86_400,
};

/**
 * Série agregada por bucket temporal: o gráfico recebe dezenas ou centenas de pontos, não
 * as centenas de milhares de amostras da janela.
 *
 * `to_timestamp(floor(extract(epoch ...) / N) * N)` alinha os buckets a múltiplos absolutos
 * do intervalo — assim dois períodos diferentes concordam nas bordas, e o `date_trunc` não
 * precisa de um caso especial para 4 h.
 */
export function seriesPointsSql(
  seriesId: string,
  from: Date,
  to: Date,
  bucket: SeriesBucket,
): Prisma.Sql {
  const seconds = BUCKET_SECONDS[bucket];
  return Prisma.sql`
    SELECT
      to_timestamp(floor(extract(epoch FROM p."timestamp") / ${seconds}) * ${seconds}) AS bucket_start,
      count(*)::bigint AS samples,
      avg(p.value)     AS avg,
      min(p.value)     AS min,
      max(p.value)     AS max,
      max(p."timestamp") AS last_at,
      count(DISTINCT p."ingestionCycleId")::bigint AS acquisitions
    FROM time_series_samples p
    WHERE p."timeSeriesId" = ${seriesId}::text
      AND p."timestamp" >= ${from} AND p."timestamp" < ${to}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
}

/** Estatísticas da janela inteira: uma passada agregada, sem trazer amostra alguma. */
export function seriesStatsSql(seriesId: string, from: Date, to: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT
      count(*)::bigint AS samples,
      count(DISTINCT p."ingestionCycleId")::bigint AS acquisitions,
      min(p.value) AS min,
      max(p.value) AS max,
      avg(p.value) AS avg,
      min(p."timestamp") AS first_at,
      max(p."timestamp") AS last_at
    FROM time_series_samples p
    WHERE p."timeSeriesId" = ${seriesId}::text
      AND p."timestamp" >= ${from} AND p."timestamp" < ${to}
  `;
}

export const HEATMAP_BUCKETS = ['hour', 'day'] as const;
export type HeatmapBucket = (typeof HEATMAP_BUCKETS)[number];

/**
 * Mapa de atividade por bucket: quantas aquisições e quantos sensores reportaram em cada
 * (dia, hora) da janela. É a pergunta que o painel faz — cobertura temporal, não amplitude.
 *
 * Duas decisões medidas (EXPLAIN ANALYZE, 10 M amostras):
 *  - a série ÂNCORA de cada sensor (aceleração Y) representa a aquisição: usar as 24 séries
 *    radiais dobraria a leitura sem mudar a resposta;
 *  - agregação em DOIS níveis (por série, depois por bucket) em vez de `count(distinct)`:
 *    o distinct sobre milhões de linhas forçava sort em disco (1,98 s → 0,98 s em 30 dias);
 *  - sem tocar em `value`, a consulta cabe no índice `(timeSeriesId, timestamp)` e roda como
 *    Index Only Scan com zero heap fetches (30 d: 975 ms · 7 d: 239 ms).
 */
export function heatmapSql(
  seriesIds: string[],
  from: Date,
  to: Date,
  bucket: HeatmapBucket,
): Prisma.Sql {
  const ids = Prisma.join(seriesIds.map((id) => Prisma.sql`${id}`));
  // UTC EXPLÍCITO: `date_trunc`/`extract` sobre timestamptz seguem o fuso da SESSÃO. O
  // produto inteiro fala UTC (banco, API, URL e tela), então a consulta declara o fuso em
  // vez de depender da configuração do servidor.
  const hourExpression =
    bucket === 'hour'
      ? Prisma.sql`extract(hour from p."timestamp" AT TIME ZONE 'UTC')::int`
      : Prisma.sql`0::int`;

  return Prisma.sql`
    SELECT
      por_serie.day  AS day,
      por_serie.hour AS hour,
      sum(por_serie.samples)::bigint      AS samples,
      sum(por_serie.acquisitions)::bigint AS acquisitions,
      count(*)::bigint                    AS sensors
    FROM (
      SELECT
        date_trunc('day', p."timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day,
        ${hourExpression}                AS hour,
        p."timeSeriesId"                 AS series_id,
        count(*)                         AS samples,
        -- 60 janelas de 1 s por aquisição: dividir evita o count(distinct) caro.
        (count(*) / 60.0)                AS acquisitions
      FROM time_series_samples p
      WHERE p."timeSeriesId" IN (${ids})
        AND p."timestamp" >= ${from} AND p."timestamp" < ${to}
      GROUP BY 1, 2, 3
    ) por_serie
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
}

/**
 * Resumo de uma JANELA temporal por sensor: o que cada ponto fez naquele intervalo.
 * Uma linha por sensor — o custo não cresce com o tamanho do histórico, só com a janela.
 */
export function timeWindowSql(from: Date, to: Date): Prisma.Sql {
  return Prisma.sql`
    WITH anchor AS (
      SELECT s.id AS sensor_id, s."serialNumber" AS serial, s.model AS model,
             ts.id AS series_id, mp.name AS point_name, mp.id AS point_id,
             m.name AS machine_name, m.type AS machine_type
      FROM time_series ts
      JOIN sensors s ON s.id = ts."sensorId"
      LEFT JOIN monitoring_points mp ON mp.id = s."monitoringPointId"
      LEFT JOIN machines m ON m.id = mp."machineId"
      WHERE ts."physicalQuantity" = 'ACCELERATION' AND ts.axis = 'Y'
    )
    SELECT
      a.serial, a.model, a.series_id, a.point_name, a.point_id, a.machine_name, a.machine_type,
      w.samples, w.acquisitions, w.min, w.max, w.avg, w.last_at, w.last_value
    FROM anchor a
    LEFT JOIN LATERAL (
      SELECT
        count(*)::bigint AS samples,
        count(DISTINCT p."ingestionCycleId")::bigint AS acquisitions,
        min(p.value) AS min, max(p.value) AS max, avg(p.value) AS avg,
        max(p."timestamp") AS last_at,
        (SELECT value FROM time_series_samples q
          WHERE q."timeSeriesId" = a.series_id AND q."timestamp" >= ${from} AND q."timestamp" < ${to}
          ORDER BY q."timestamp" DESC LIMIT 1) AS last_value
      FROM time_series_samples p
      WHERE p."timeSeriesId" = a.series_id
        AND p."timestamp" >= ${from} AND p."timestamp" < ${to}
    ) w ON true
    ORDER BY a.machine_name ASC, a.point_name ASC
  `;
}

/**
 * Página de aquisições de um sensor.
 *
 * A consulta parte das AMOSTRAS da série âncora dentro da janela (índice
 * `(timeSeriesId, timestamp)`) e agrupa por ciclo — não do outro lado. Partir de
 * `ingestion_cycles` obrigava a calcular os limites de TODOS os ciclos do sensor antes de
 * filtrar pela janela: 1,04 s medidos contra ~60 ms desta forma.
 */
export function sensorAcquisitionsSql(
  serialNumber: string,
  from: Date,
  to: Date,
  limit: number,
  offset: number,
): Prisma.Sql {
  return Prisma.sql`
    WITH anchor AS (
      SELECT ts.id
      FROM time_series ts
      JOIN sensors s ON s.id = ts."sensorId"
      WHERE s."serialNumber" = ${serialNumber}
        AND ts."physicalQuantity" = 'ACCELERATION' AND ts.axis = 'Y'
      LIMIT 1
    ),
    cycles AS (
      SELECT
        p."ingestionCycleId" AS cycle_id,
        min(p."timestamp")   AS started_at,
        max(p."timestamp")   AS ended_at,
        count(*)::bigint     AS samples,
        min(p.value)         AS min,
        max(p.value)         AS max,
        avg(p.value)         AS avg
      FROM time_series_samples p
      JOIN anchor a ON a.id = p."timeSeriesId"
      WHERE p."ingestionCycleId" IS NOT NULL
        AND p."timestamp" >= ${from} AND p."timestamp" < ${to}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT ${limit} OFFSET ${offset}
    )
    SELECT
      c.cycle_id, ic."cycleId" AS external_cycle_id, ic."sampleCount" AS sample_count,
      ic."measurementCount" AS measurement_count, ic.configuration AS configuration,
      ic.metadata AS metadata, ic.tags AS tags, ic."createdAt" AS ingested_at,
      c.started_at, c.ended_at, c.min, c.max, c.avg, c.samples
    FROM cycles c
    JOIN ingestion_cycles ic ON ic.id = c.cycle_id
    ORDER BY c.started_at DESC
  `;
}

/** Total de aquisições do sensor na janela — só quando o cliente pede (`includeTotal`). */
export function sensorAcquisitionsCountSql(serialNumber: string, from: Date, to: Date): Prisma.Sql {
  return Prisma.sql`
    WITH anchor AS (
      SELECT ts.id
      FROM time_series ts
      JOIN sensors s ON s.id = ts."sensorId"
      WHERE s."serialNumber" = ${serialNumber}
        AND ts."physicalQuantity" = 'ACCELERATION' AND ts.axis = 'Y'
      LIMIT 1
    )
    SELECT count(*)::bigint AS count FROM (
      SELECT p."ingestionCycleId"
      FROM time_series_samples p
      JOIN anchor a ON a.id = p."timeSeriesId"
      WHERE p."ingestionCycleId" IS NOT NULL
        AND p."timestamp" >= ${from} AND p."timestamp" < ${to}
      GROUP BY 1
    ) ciclos
  `;
}

/** Resumo estatístico de uma aquisição, uma linha por série. Universo pequeno por natureza. */
export function acquisitionSeriesSql(cycleId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      ts.id AS series_id, ts."physicalQuantity" AS physical_quantity, ts.axis AS axis,
      ts.unit AS unit,
      count(*)::bigint AS samples,
      min(p.value) AS min, max(p.value) AS max, avg(p.value) AS avg,
      sqrt(avg(p.value * p.value)) AS rms,
      min(p."timestamp") AS started_at, max(p."timestamp") AS ended_at
    FROM time_series_samples p
    JOIN time_series ts ON ts.id = p."timeSeriesId"
    WHERE p."ingestionCycleId" = ${cycleId}
    GROUP BY 1, 2, 3, 4
    ORDER BY ts."physicalQuantity" ASC, ts.axis ASC
  `;
}

/**
 * Amostras de uma aquisição por KEYSET (timestamp, id): a página seguinte continua de onde
 * a anterior parou, sem `OFFSET` profundo. É o único lugar do sistema que devolve
 * telemetria bruta, e mesmo assim recortada por aquisição.
 */
export function acquisitionSamplesSql(
  cycleId: string,
  limit: number,
  cursor: { timestamp: Date; id: string } | null,
  filters: { quantity: string | null; axis: string | null },
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`p."ingestionCycleId" = ${cycleId}`];
  if (cursor) {
    conditions.push(
      Prisma.sql`(p."timestamp", p.id) > (${cursor.timestamp}, ${cursor.id})`,
    );
  }
  if (filters.quantity) {
    conditions.push(Prisma.sql`ts."physicalQuantity"::text = ${filters.quantity}`);
  }
  if (filters.axis) {
    conditions.push(Prisma.sql`ts.axis::text = ${filters.axis}`);
  }

  return Prisma.sql`
    SELECT p.id, p."timestamp", p.value,
           ts."physicalQuantity" AS physical_quantity, ts.axis AS axis, ts.unit AS unit
    FROM time_series_samples p
    JOIN time_series ts ON ts.id = p."timeSeriesId"
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY p."timestamp" ASC, p.id ASC
    LIMIT ${limit}
  `;
}
