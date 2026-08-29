/**
 * Fleet Assessment + Deliberative Confirmation (F5/F6).
 *
 * REGRA CENTRAL: o supervisor NUNCA enxerga rótulos de cenário do simulador. A única
 * entrada da análise são as SÉRIES PERSISTIDAS, lidas pela API real, nas janelas
 * canônicas da planta. O núcleo de decisão é puro e determinístico — priorização
 * determinística baseada em observação da API, não "descoberta" nem diagnóstico.
 *
 * O limiar é DIDÁTICO/SINTÉTICO: separa os cenários normal/imbalance DESTE gerador.
 * Não é threshold industrial da Dynamox, não representa ISO nem limite real de alarme.
 */
import { fetchAllSamples, fetchSeries, type TwinApiConfig } from './ingest';
import { PLANT, plantSensors, type PlantManifest, type PlantSensor } from './plant';

export const SYNTHETIC_ATTENTION_RATIO = 2.0;

export type SensorState = 'STABLE' | 'SUSPECT' | 'CONFIRMED_ATTENTION';

/** Janela observada de UM sensor: apenas números vindos do banco — sem rótulos. */
export interface ObservedWindows {
  sensorSerial: string;
  machineName: string;
  monitoringPointName: string;
  shortLabel: string;
  /** RMS radiais por janela (60 valores esperados por snapshot). */
  baselineRadial: number[];
  conditionRadial: number[];
  /** Contexto (não participa do score). */
  baselineTemperatureMeanC: number | null;
  conditionTemperatureMeanC: number | null;
}

export interface SensorAssessment {
  sensorSerial: string;
  machineName: string;
  monitoringPointName: string;
  shortLabel: string;
  baselineRadialRms: number;
  conditionRadialRms: number;
  deviationRatio: number;
  state: SensorState;
  temperatureContextC: { baseline: number | null; condition: number | null };
}

export interface FleetAssessment {
  evaluatedAt: string;
  baselineWindow: string;
  conditionWindow: string;
  thresholdRatio: number;
  sensors: SensorAssessment[];
  /** Ordenado por deviationRatio DESC (desempate: serial ASC). */
  ranked: SensorAssessment[];
  selected: SensorAssessment | null;
  selectedAction: 'CONFIRM_ACQUISITION' | 'NONE';
}

/** Medida radial explícita por janela: sqrt((rmsY² + rmsZ²)/2). */
export function radialRms(rmsY: number, rmsZ: number): number {
  return Math.sqrt((rmsY * rmsY + rmsZ * rmsZ) / 2);
}

export function meanOf(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Núcleo PURO do assessment: recebe apenas observações numéricas (nenhum rótulo de
 * cenário existe no tipo de entrada) e produz ranking + decisão. Determinístico.
 */
export function computeAssessment(
  observations: ObservedWindows[],
  options: {
    evaluatedAt: string;
    baselineWindow: string;
    conditionWindow: string;
    thresholdRatio?: number;
    expectedWindowCount?: number;
  },
): FleetAssessment {
  const threshold = options.thresholdRatio ?? SYNTHETIC_ATTENTION_RATIO;
  const expected = options.expectedWindowCount ?? 60;

  const sensors: SensorAssessment[] = observations.map((observation) => {
    // Política de dados: janela incompleta é erro alto — nunca ranquear no escuro.
    for (const [label, values] of [
      ['baseline', observation.baselineRadial],
      ['condition', observation.conditionRadial],
    ] as const) {
      if (values.length !== expected) {
        throw new Error(
          `Observação incompleta para ${observation.sensorSerial}: janela ${label} tem ` +
            `${values.length} valores (esperado ${expected}). Rode os snapshots da planta.`,
        );
      }
    }

    const baselineRadialRms = meanOf(observation.baselineRadial);
    const conditionRadialRms = meanOf(observation.conditionRadial);
    const deviationRatio = conditionRadialRms / baselineRadialRms;

    return {
      sensorSerial: observation.sensorSerial,
      machineName: observation.machineName,
      monitoringPointName: observation.monitoringPointName,
      shortLabel: observation.shortLabel,
      baselineRadialRms,
      conditionRadialRms,
      deviationRatio,
      state: deviationRatio >= threshold ? 'SUSPECT' : 'STABLE',
      temperatureContextC: {
        baseline: observation.baselineTemperatureMeanC,
        condition: observation.conditionTemperatureMeanC,
      },
    };
  });

  const ranked = [...sensors].sort(
    (a, b) => b.deviationRatio - a.deviationRatio || a.sensorSerial.localeCompare(b.sensorSerial),
  );
  const top = ranked[0];
  const selected = top && top.deviationRatio >= threshold ? top : null;

  return {
    evaluatedAt: options.evaluatedAt,
    baselineWindow: options.baselineWindow,
    conditionWindow: options.conditionWindow,
    thresholdRatio: threshold,
    sensors,
    ranked,
    selected,
    selectedAction: selected ? 'CONFIRM_ACQUISITION' : 'NONE',
  };
}

// ————— Observação pela API real —————

export interface SeriesIds {
  y: string;
  z: string;
  temperature: string | null;
}

function windowRange(startIso: string, windowCount: number): { start: string; end: string } {
  const startMs = Date.parse(startIso);
  return {
    start: startIso,
    end: new Date(startMs + (windowCount - 1) * 1000).toISOString(),
  };
}

function inWindow(samples: Array<{ timestamp: string; value: number }>, startIso: string) {
  const { start, end } = windowRange(startIso, 60);
  return samples.filter((s) => s.timestamp >= start && s.timestamp <= end);
}

export async function seriesIdsForPlant(
  config: TwinApiConfig,
  token: string,
  sensors: PlantSensor[],
): Promise<Map<string, SeriesIds>> {
  const series = await fetchSeries(config, token);
  const map = new Map<string, SeriesIds>();
  for (const sensor of sensors) {
    const mine = series.filter((s) => s.sensorSerialNumber === sensor.sensorSerial);
    const y = mine.find((s) => s.physicalQuantity === 'acceleration' && s.axis === 'y');
    const z = mine.find((s) => s.physicalQuantity === 'acceleration' && s.axis === 'z');
    const temperature = mine.find((s) => s.physicalQuantity === 'temperature');
    if (!y || !z) {
      throw new Error(
        `Séries radiais ausentes para ${sensor.sensorSerial} — rode os snapshots da planta.`,
      );
    }
    map.set(sensor.sensorSerial, { y: y.id, z: z.id, temperature: temperature?.id ?? null });
  }
  return map;
}

/**
 * Lê pela API os RMS radiais de UMA janela do sensor, pareando Y e Z por timestamp.
 * Falha alto se a janela não tiver exatamente `windowCount` pares.
 */
export async function observeWindowRadial(
  config: TwinApiConfig,
  token: string,
  ids: SeriesIds,
  windowStart: string,
  sensorSerial: string,
  windowLabel: string,
): Promise<number[]> {
  const [ySamples, zSamples] = [
    inWindow(await fetchAllSamples(config, token, ids.y), windowStart),
    inWindow(await fetchAllSamples(config, token, ids.z), windowStart),
  ];
  const zByTimestamp = new Map(zSamples.map((s) => [s.timestamp, s.value]));

  const radial: number[] = [];
  for (const y of ySamples) {
    const z = zByTimestamp.get(y.timestamp);
    if (z !== undefined) radial.push(radialRms(y.value, z));
  }
  if (radial.length !== 60) {
    throw new Error(
      `Janela ${windowLabel} de ${sensorSerial} tem ${radial.length}/60 pares Y-Z no banco.`,
    );
  }
  return radial;
}

async function observeTemperatureMean(
  config: TwinApiConfig,
  token: string,
  seriesId: string | null,
  windowStart: string,
): Promise<number | null> {
  if (!seriesId) return null;
  const samples = inWindow(await fetchAllSamples(config, token, seriesId), windowStart);
  return samples.length > 0 ? meanOf(samples.map((s) => s.value)) : null;
}

/** OBSERVE + RANK: assessment completo da frota lendo somente o que está persistido. */
export async function assessFleet(
  config: TwinApiConfig,
  token: string,
  plant: PlantManifest = PLANT,
): Promise<FleetAssessment> {
  const sensors = plantSensors(plant);
  const ids = await seriesIdsForPlant(config, token, sensors);

  const observations: ObservedWindows[] = [];
  for (const sensor of sensors) {
    const seriesIds = ids.get(sensor.sensorSerial)!;
    observations.push({
      sensorSerial: sensor.sensorSerial,
      machineName: sensor.machineName,
      monitoringPointName: sensor.pointName,
      shortLabel: sensor.shortLabel,
      baselineRadial: await observeWindowRadial(
        config, token, seriesIds, plant.windows.baseline, sensor.sensorSerial, 'baseline',
      ),
      conditionRadial: await observeWindowRadial(
        config, token, seriesIds, plant.windows.condition, sensor.sensorSerial, 'condition',
      ),
      baselineTemperatureMeanC: await observeTemperatureMean(
        config, token, seriesIds.temperature, plant.windows.baseline,
      ),
      conditionTemperatureMeanC: await observeTemperatureMean(
        config, token, seriesIds.temperature, plant.windows.condition,
      ),
    });
  }

  return computeAssessment(observations, {
    evaluatedAt: new Date().toISOString(),
    baselineWindow: plant.windows.baseline,
    conditionWindow: plant.windows.condition,
  });
}
