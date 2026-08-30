import type {
  SensorModel,
  SeriesMetrics,
  TimeSeriesSampleDto,
  TimeSeriesSummary,
} from '@dynamox/domain';

import type { MachineDto, MonitoringPointDto } from '../../api/client';
import type { DashboardPeriod, DashboardState } from './dashboardSlice';

export const SYNTHETIC_ATTENTION_RATIO = 2;
export const SYNTHETIC_OBSERVATION_RATIO = 1.5;
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const ACQUISITION_GAP_MS = 5 * 60 * 1000;
/** Amostras mínimas para uma janela de aquisição valer como baseline. */
export const MIN_BASELINE_SAMPLES = 3;
const MIN_SERIES_BASELINE_SAMPLES = 60;

export const PERIOD_MS: Record<Exclude<DashboardPeriod, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export type ConditionKind =
  | 'normal'
  | 'observation'
  | 'attention'
  | 'unclassified'
  | 'no-data'
  | 'no-sensor';

export type FreshnessKind = 'current' | 'stale' | 'future' | 'unknown';

export interface SyntheticAssessment {
  serialNumber: string;
  baseline: number;
  condition: number;
  deviationRatio: number;
  baselineStart: string;
  conditionStart: string;
  sampleCount: number;
}

/**
 * A medição que SUSTENTA o estado exibido. Existe porque a matriz antes mostrava o último
 * valor de uma série qualquer do sensor (o desempate caía no eixo X) enquanto a condição
 * vinha do RMS radial Y/Z: o número na tela não era o número que classificava.
 */
export interface ConditionEvidence {
  /** Série que o usuário abre ao investigar (eixo Y do par radial, quando há avaliação). */
  seriesId: string | null;
  /** Rótulo da grandeza medida — "Aceleração radial (Y/Z)", "Temperatura"… */
  label: string;
  value: number | null;
  unit: string | null;
  timestamp: string | null;
  /** Índice em relação ao baseline demonstrativo; null quando não há avaliação. */
  deviationRatio: number | null;
  baseline: number | null;
}

export interface SensorCellView {
  key: string;
  machineId: string;
  machineName: string;
  machineType: MachineDto['type'];
  pointId: string;
  pointName: string;
  positionLabel: string;
  sensorSerial: string | null;
  sensorModel: SensorModel | null;
  series: TimeSeriesSummary[];
  preferredSeriesId: string | null;
  lastValue: number | null;
  lastUnit: string | null;
  lastTimestamp: string | null;
  evidence: ConditionEvidence | null;
  condition: ConditionKind;
  conditionLabel: string;
  freshness: FreshnessKind;
  freshnessLabel: string;
  assessment: SyntheticAssessment | null;
  demonstrative: boolean;
}

export interface MachineMatrixRow {
  machine: MachineDto;
  cells: SensorCellView[];
}

export type AttentionSeverity = 'high' | 'medium' | 'info';

export interface AttentionSignal {
  id: string;
  severity: AttentionSeverity;
  machineName: string;
  pointAndSensor: string;
  reason: string;
  lastTimestamp: string | null;
  seriesId: string | null;
  /** Evidência que sustenta a linha — a mesma medição que classificou a célula. */
  evidenceLabel: string | null;
  evidenceValue: number | null;
  evidenceUnit: string | null;
  deviationRatio: number | null;
  baseline: number | null;
}

export interface DashboardView {
  rows: MachineMatrixRow[];
  cells: SensorCellView[];
  assessments: SyntheticAssessment[];
  ranking: SensorCellView[];
  signals: AttentionSignal[];
  /**
   * Um KPI = um conceito. Antes havia um único "sinais de atenção" somando condição,
   * ausência de sensor, ausência de dados e recência — o número resultante era sempre
   * igual ao total de pontos e não distinguia nada.
   */
  kpis: {
    /** Inventário: contexto, não mensagem operacional. */
    machines: number;
    points: number;
    sensors: number;
    /** Condição: pontos cuja MEDIÇÃO desviou do baseline demonstrativo. */
    attention: number;
    /** Recência: leitura antiga ou instante à frente do relógio. */
    stale: number;
    /** Cobertura: ponto sem sensor ou sensor sem leitura. */
    coverage: number;
  };
  distribution: Array<{ key: FreshnessKind | 'no-data'; label: string; value: number }>;
  latestTimestamp: string | null;
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Agrupa aquisições separadas por mais de cinco minutos, sem criar pontos ausentes. */
export function groupAcquisitionWindows(
  samples: TimeSeriesSampleDto[],
  gapMs = ACQUISITION_GAP_MS,
): TimeSeriesSampleDto[][] {
  const sorted = samples
    .filter((sample) => parseTimestamp(sample.timestamp) !== null)
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const groups: TimeSeriesSampleDto[][] = [];

  for (const sample of sorted) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (!current || !previous || Date.parse(sample.timestamp) - Date.parse(previous.timestamp) > gapMs) {
      groups.push([sample]);
    } else {
      current.push(sample);
    }
  }
  return groups;
}

/**
 * Espelha o supervisor do sensor twin: pareia Y/Z pelo timestamp, calcula
 * sqrt((y²+z²)/2) e compara a segunda aquisição completa com a primeira.
 */
export function computeSyntheticAssessment(
  serialNumber: string,
  ySamples: TimeSeriesSampleDto[],
  zSamples: TimeSeriesSampleDto[],
): SyntheticAssessment | null {
  if (!serialNumber.startsWith('SIM-')) return null;

  const zByTimestamp = new Map(zSamples.map((sample) => [sample.timestamp, sample.value]));
  const radial = ySamples.flatMap((sample) => {
    const z = zByTimestamp.get(sample.timestamp);
    return z === undefined
      ? []
      : [{ timestamp: sample.timestamp, value: Math.sqrt((sample.value ** 2 + z ** 2) / 2) }];
  });
  const completeWindows = groupAcquisitionWindows(radial).filter(
    (window) => window.length >= MIN_BASELINE_SAMPLES,
  );
  if (completeWindows.length < 2) return null;

  const baselineWindow = completeWindows[0];
  const conditionWindow = completeWindows[1];
  const baseline = mean(baselineWindow.map((sample) => sample.value));
  const condition = mean(conditionWindow.map((sample) => sample.value));
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(condition)) return null;

  return {
    serialNumber,
    baseline,
    condition,
    deviationRatio: condition / baseline,
    baselineStart: baselineWindow[0].timestamp,
    conditionStart: conditionWindow[0].timestamp,
    sampleCount: Math.min(baselineWindow.length, conditionWindow.length),
  };
}

interface ObservedRadialWindows {
  serialNumber: string;
  windows: TimeSeriesSampleDto[][];
}

function observedRadialWindows(
  serialNumber: string,
  ySamples: TimeSeriesSampleDto[],
  zSamples: TimeSeriesSampleDto[],
): ObservedRadialWindows | null {
  if (!serialNumber.startsWith('SIM-')) return null;
  const zByTimestamp = new Map(zSamples.map((sample) => [sample.timestamp, sample.value]));
  const radial = ySamples.flatMap((sample) => {
    const z = zByTimestamp.get(sample.timestamp);
    return z === undefined
      ? []
      : [{ timestamp: sample.timestamp, value: Math.sqrt((sample.value ** 2 + z ** 2) / 2) }];
  });
  const windows = groupAcquisitionWindows(radial).filter(
    (window) => window.length >= MIN_BASELINE_SAMPLES,
  );
  return windows.length > 0 ? { serialNumber, windows } : null;
}

function assessmentFromWindows(
  serialNumber: string,
  baselineWindow: TimeSeriesSampleDto[],
  conditionWindow: TimeSeriesSampleDto[],
): SyntheticAssessment | null {
  const baseline = mean(baselineWindow.map((sample) => sample.value));
  const condition = mean(conditionWindow.map((sample) => sample.value));
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(condition)) return null;
  return {
    serialNumber,
    baseline,
    condition,
    deviationRatio: condition / baseline,
    baselineStart: baselineWindow[0].timestamp,
    conditionStart: conditionWindow[0].timestamp,
    sampleCount: Math.min(baselineWindow.length, conditionWindow.length),
  };
}

/**
 * Seleciona as duas aquisições compartilhadas pela frota. Assim, ciclos isolados de
 * desenvolvimento e a confirmação posterior de um único sensor não viram baseline.
 * Em uma demonstração mínima com um único sensor, duas janelas dele são suficientes.
 */
export function computeFleetSyntheticAssessments(
  series: TimeSeriesSummary[],
  samplesBySeries: Record<string, TimeSeriesSampleDto[]>,
): Map<string, SyntheticAssessment> {
  const serials = [...new Set(
    series
      .filter((item) => item.sensorSerialNumber.startsWith('SIM-'))
      .map((item) => item.sensorSerialNumber),
  )];
  const observed = serials.flatMap((serialNumber) => {
    const mine = series.filter((item) => item.sensorSerialNumber === serialNumber);
    const y = mine.find((item) => item.physicalQuantity === 'acceleration' && item.axis === 'y');
    const z = mine.find((item) => item.physicalQuantity === 'acceleration' && item.axis === 'z');
    if (!y || !z) return [];
    const windows = observedRadialWindows(
      serialNumber,
      samplesBySeries[y.id] ?? [],
      samplesBySeries[z.id] ?? [],
    );
    return windows ? [windows] : [];
  });
  if (observed.length === 0) return new Map();

  const occurrences = new Map<string, number>();
  for (const sensor of observed) {
    for (const start of new Set(sensor.windows.map((window) => window[0].timestamp))) {
      occurrences.set(start, (occurrences.get(start) ?? 0) + 1);
    }
  }
  const minimumFleetAgreement = observed.length === 1 ? 1 : 2;
  const sharedStarts = [...occurrences.entries()]
    .filter(([, count]) => count >= minimumFleetAgreement)
    .map(([start]) => start)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  if (sharedStarts.length < 2) return new Map();
  const [baselineStart, conditionStart] = sharedStarts.slice(-2);

  const assessments = new Map<string, SyntheticAssessment>();
  for (const sensor of observed) {
    const baselineWindow = sensor.windows.find((window) => window[0].timestamp === baselineStart);
    const conditionWindow = sensor.windows.find((window) => window[0].timestamp === conditionStart);
    if (!baselineWindow || !conditionWindow) continue;
    const assessment = assessmentFromWindows(
      sensor.serialNumber,
      baselineWindow,
      conditionWindow,
    );
    if (assessment) assessments.set(sensor.serialNumber, assessment);
  }
  return assessments;
}

export function computeDemonstrativeSeriesBaseline(
  serialNumber: string,
  samples: TimeSeriesSampleDto[],
): number | null {
  if (!serialNumber.startsWith('SIM-')) return null;
  const first = groupAcquisitionWindows(samples).find(
    (window) => window.length >= MIN_SERIES_BASELINE_SAMPLES,
  );
  return first ? mean(first.map((sample) => sample.value)) : null;
}

export function classifyFreshness(
  lastTimestamp: string | null,
  nowMs: number,
): { kind: FreshnessKind; label: string } {
  if (!lastTimestamp) return { kind: 'unknown', label: 'Sem leitura' };
  const timestamp = parseTimestamp(lastTimestamp);
  if (timestamp === null) return { kind: 'unknown', label: 'Timestamp inválido' };
  const age = nowMs - timestamp;
  if (age < -FUTURE_TOLERANCE_MS) {
    return { kind: 'future', label: 'Relógio divergente' };
  }
  if (age > STALE_AFTER_MS) return { kind: 'stale', label: 'Desatualizado' };
  return { kind: 'current', label: 'Atual' };
}

function preferredSeries(series: TimeSeriesSummary[]): TimeSeriesSummary | null {
  return (
    series.find((item) => item.physicalQuantity === 'acceleration' && item.axis === 'y') ??
    series.find((item) => item.physicalQuantity === 'acceleration') ??
    series.find((item) => item.physicalQuantity === 'temperature') ??
    series[0] ??
    null
  );
}

function positionLabel(name: string): string {
  const normalized = name.toLocaleLowerCase('pt-BR');
  if (normalized.includes('nde') || normalized.includes('oposto')) return 'NDE';
  if (normalized.includes(' de') || normalized === 'de' || normalized.includes('acoplamento')) {
    return 'DE';
  }
  return name;
}

function conditionFrom(
  hasSensor: boolean,
  hasSamples: boolean,
  assessment: SyntheticAssessment | null,
): { kind: ConditionKind; label: string } {
  if (!hasSensor) return { kind: 'no-sensor', label: 'Sem sensor' };
  if (!hasSamples) return { kind: 'no-data', label: 'Sem dados' };
  if (!assessment) return { kind: 'unclassified', label: 'Sem classificação' };
  if (assessment.deviationRatio >= SYNTHETIC_ATTENTION_RATIO) {
    return { kind: 'attention', label: 'Atenção demonstrativa' };
  }
  if (assessment.deviationRatio >= SYNTHETIC_OBSERVATION_RATIO) {
    return { kind: 'observation', label: 'Observação demonstrativa' };
  }
  return { kind: 'normal', label: 'Normal demonstrativo' };
}

/**
 * Série com a leitura mais recente do sensor. O valor e o instante vêm do RESUMO devolvido
 * por GET /time-series — antes era preciso uma chamada de métricas por série só para isto.
 * O desempate é estável (grandeza, depois eixo) para a tela não trocar de série sozinha
 * quando todas as leituras compartilham o mesmo instante.
 */
function latestSeries(series: TimeSeriesSummary[]): TimeSeriesSummary | null {
  let chosen: TimeSeriesSummary | null = null;
  let latest = Number.NEGATIVE_INFINITY;
  for (const item of series) {
    const at = item.lastTimestamp ? Date.parse(item.lastTimestamp) : Number.NaN;
    if (!Number.isFinite(at)) continue;
    if (at > latest) {
      latest = at;
      chosen = item;
      continue;
    }
    if (at === latest && chosen) {
      const key = (candidate: TimeSeriesSummary) =>
        `${candidate.physicalQuantity}/${candidate.axis ?? ''}`;
      if (key(item) < key(chosen)) chosen = item;
    }
  }
  return chosen;
}

/** RMS radial da aquisição mais recente pareada em Y e Z — o valor que classifica. */
function latestRadialReading(
  ySamples: TimeSeriesSampleDto[],
  zSamples: TimeSeriesSampleDto[],
): { value: number; timestamp: string } | null {
  const zByTimestamp = new Map(zSamples.map((sample) => [sample.timestamp, sample.value]));
  let chosen: { value: number; timestamp: string } | null = null;
  for (const sample of ySamples) {
    const z = zByTimestamp.get(sample.timestamp);
    if (z === undefined) continue;
    if (!chosen || sample.timestamp > chosen.timestamp) {
      chosen = {
        timestamp: sample.timestamp,
        value: Math.sqrt((sample.value ** 2 + z ** 2) / 2),
      };
    }
  }
  return chosen;
}

/** Rótulo legível da grandeza de uma série (mesma nomenclatura da tela de tendência). */
function quantityLabel(series: TimeSeriesSummary): string {
  const QUANTITIES: Record<string, string> = {
    acceleration: 'Aceleração',
    velocity: 'Velocidade',
    temperature: 'Temperatura',
    rotationalSpeed: 'Rotação',
  };
  const base = QUANTITIES[series.physicalQuantity] ?? series.physicalQuantity;
  return series.axis ? `${base} · eixo ${series.axis.toUpperCase()}` : base;
}

/**
 * Evidência da condição: quando existe avaliação demonstrativa, o número exibido é o RMS
 * radial (o mesmo que produziu o índice), com o seu baseline e a sua razão. Sem avaliação,
 * exibe-se a leitura mais recente — sempre nomeando a grandeza e o eixo, para que o valor
 * na tela nunca fique órfão do que ele mede.
 */
function buildEvidence(
  sensorSeries: TimeSeriesSummary[],
  assessment: SyntheticAssessment | null,
  radialSamplesBySeries: Record<string, TimeSeriesSampleDto[]>,
): ConditionEvidence | null {
  const y = sensorSeries.find(
    (item) => item.physicalQuantity === 'acceleration' && item.axis === 'y',
  );
  const z = sensorSeries.find(
    (item) => item.physicalQuantity === 'acceleration' && item.axis === 'z',
  );

  if (assessment && y && z) {
    const reading = latestRadialReading(
      radialSamplesBySeries[y.id] ?? [],
      radialSamplesBySeries[z.id] ?? [],
    );
    return {
      seriesId: y.id,
      label: 'Aceleração radial (Y/Z)',
      value: reading?.value ?? null,
      unit: y.unit,
      timestamp: reading?.timestamp ?? y.lastTimestamp,
      deviationRatio: assessment.deviationRatio,
      baseline: assessment.baseline,
    };
  }

  const latest = latestSeries(sensorSeries);
  if (!latest) return null;
  return {
    seriesId: latest.id,
    label: quantityLabel(latest),
    value: latest.lastValue,
    unit: latest.unit,
    timestamp: latest.lastTimestamp,
    deviationRatio: null,
    baseline: null,
  };
}

function buildCell(
  point: MonitoringPointDto,
  allSeries: TimeSeriesSummary[],
  assessments: Map<string, SyntheticAssessment>,
  radialSamplesBySeries: Record<string, TimeSeriesSampleDto[]>,
  nowMs: number,
): SensorCellView {
  const sensorSeries = point.sensor
    ? allSeries.filter((item) => item.sensorSerialNumber === point.sensor?.serialNumber)
    : [];
  const assessment = point.sensor ? assessments.get(point.sensor.serialNumber) ?? null : null;
  const evidence = buildEvidence(sensorSeries, assessment, radialSamplesBySeries);
  const hasSamples = sensorSeries.some((item) => item.sampleCount > 0);
  const condition = conditionFrom(Boolean(point.sensor), hasSamples, assessment);
  // A recência é do sensor, não da série da evidência: a leitura mais nova de qualquer
  // grandeza prova que o sensor reportou.
  const newest = latestSeries(sensorSeries);
  const freshness = classifyFreshness(newest?.lastTimestamp ?? null, nowMs);
  // Investigar leva à série da evidência; sem evidência, à série preferida do sensor.
  const preferred = preferredSeries(sensorSeries);

  return {
    key: point.id,
    machineId: point.machine.id,
    machineName: point.machine.name,
    machineType: point.machine.type,
    pointId: point.id,
    pointName: point.name,
    positionLabel: positionLabel(point.name),
    sensorSerial: point.sensor?.serialNumber ?? null,
    sensorModel: point.sensor?.model ?? null,
    series: sensorSeries,
    preferredSeriesId: evidence?.seriesId ?? preferred?.id ?? null,
    lastValue: evidence?.value ?? null,
    lastUnit: evidence?.unit ?? null,
    lastTimestamp: newest?.lastTimestamp ?? null,
    evidence,
    condition: condition.kind,
    conditionLabel: condition.label,
    freshness: freshness.kind,
    freshnessLabel: freshness.label,
    assessment,
    demonstrative: point.sensor?.serialNumber.startsWith('SIM-') ?? false,
  };
}

const severityOrder: Record<AttentionSeverity, number> = { high: 3, medium: 2, info: 1 };

/**
 * UMA linha por ponto, não uma por motivo. Antes, um ponto com desvio E relógio divergente
 * aparecia duas vezes na mesma lista, o que inflava a contagem e escondia as exceções
 * distintas; agora os motivos são acumulados e a severidade é a mais alta entre eles.
 */
export function buildAttentionSignals(cells: SensorCellView[]): AttentionSignal[] {
  const signals: AttentionSignal[] = [];

  for (const cell of cells) {
    const reasons: Array<{ severity: AttentionSeverity; text: string }> = [];

    if (cell.condition === 'attention') {
      reasons.push({
        severity: 'high',
        text: `Índice demonstrativo ${cell.assessment?.deviationRatio.toFixed(2)}× o baseline (limiar didático 2,0×).`,
      });
    } else if (cell.condition === 'observation') {
      reasons.push({
        severity: 'medium',
        text: `Desvio demonstrativo de ${cell.assessment?.deviationRatio.toFixed(2)}× o baseline observado.`,
      });
    } else if (cell.condition === 'no-sensor') {
      reasons.push({ severity: 'medium', text: 'Ponto de monitoramento sem sensor associado.' });
    } else if (cell.condition === 'no-data') {
      reasons.push({ severity: 'medium', text: 'Sensor instalado sem leitura disponível.' });
    }

    if (cell.freshness === 'stale') {
      reasons.push({ severity: 'medium', text: 'Última leitura há mais de 24 horas.' });
    } else if (cell.freshness === 'future') {
      reasons.push({
        severity: 'medium',
        text: 'Instante à frente do relógio local; verifique a sincronização.',
      });
    }

    if (reasons.length === 0) continue;

    const severity = reasons.reduce<AttentionSeverity>(
      (worst, item) => (severityOrder[item.severity] > severityOrder[worst] ? item.severity : worst),
      'info',
    );

    signals.push({
      id: cell.key,
      severity,
      machineName: cell.machineName,
      pointAndSensor: `${cell.positionLabel} · ${cell.sensorSerial ?? 'sem sensor'}`,
      reason: reasons.map((item) => item.text).join(' '),
      lastTimestamp: cell.lastTimestamp,
      seriesId: cell.preferredSeriesId,
      evidenceLabel: cell.evidence?.label ?? null,
      evidenceValue: cell.evidence?.value ?? null,
      evidenceUnit: cell.evidence?.unit ?? null,
      deviationRatio: cell.evidence?.deviationRatio ?? null,
      baseline: cell.evidence?.baseline ?? null,
    });
  }

  return signals.sort(
    (a, b) =>
      severityOrder[b.severity] - severityOrder[a.severity] ||
      (b.deviationRatio ?? 0) - (a.deviationRatio ?? 0) ||
      a.machineName.localeCompare(b.machineName, 'pt-BR'),
  );
}

export function buildDashboardView(
  state: DashboardState,
  nowMs = Date.now(),
): DashboardView {
  const fleetAssessments = computeFleetSyntheticAssessments(
    state.series.data,
    state.radialSamplesBySeries,
  );
  const cells = state.points.data.map((point) =>
    buildCell(point, state.series.data, fleetAssessments, state.radialSamplesBySeries, nowMs),
  );
  const rows = state.machines.data.map((machine) => ({
    machine,
    cells: cells.filter((cell) => cell.machineId === machine.id),
  }));
  const assessments = cells
    .flatMap((cell) => (cell.assessment ? [cell.assessment] : []))
    .sort(
      (a, b) =>
        b.deviationRatio - a.deviationRatio ||
        a.serialNumber.localeCompare(b.serialNumber, 'pt-BR'),
    );
  // Ranking de exceções: só entra quem está acima do normal. Uma lista em que 4 dos 5
  // primeiros marcam 1,00× ocupa a área nobre da tela sem informar nada.
  const ranking = cells
    .filter((cell) => cell.condition === 'attention' || cell.condition === 'observation')
    .sort(
      (a, b) =>
        (b.assessment?.deviationRatio ?? 0) - (a.assessment?.deviationRatio ?? 0) ||
        a.machineName.localeCompare(b.machineName, 'pt-BR'),
    );
  const signals = buildAttentionSignals(cells);
  const sensors = cells.filter((cell) => cell.sensorSerial);
  const latestTimestamp = sensors.reduce<string | null>((latest, cell) => {
    if (!cell.lastTimestamp) return latest;
    if (!latest || Date.parse(cell.lastTimestamp) > Date.parse(latest)) return cell.lastTimestamp;
    return latest;
  }, null);
  const distribution = [
    { key: 'current' as const, label: 'Atuais', value: sensors.filter((cell) => cell.freshness === 'current').length },
    { key: 'stale' as const, label: 'Desatualizados', value: sensors.filter((cell) => cell.freshness === 'stale').length },
    { key: 'future' as const, label: 'Relógio divergente', value: sensors.filter((cell) => cell.freshness === 'future').length },
    { key: 'no-data' as const, label: 'Sem dados', value: sensors.filter((cell) => cell.freshness === 'unknown').length },
  ];

  return {
    rows,
    cells,
    assessments,
    ranking,
    signals,
    kpis: {
      machines: state.machines.data.length,
      points: state.points.data.length,
      sensors: sensors.length,
      // Condição: o que a MEDIÇÃO diz. Nunca mistura ausência de sensor nem recência.
      attention: cells.filter(
        (cell) => cell.condition === 'attention' || cell.condition === 'observation',
      ).length,
      // Recência: leitura velha demais ou instante à frente do relógio.
      stale: cells.filter((cell) => cell.freshness === 'stale' || cell.freshness === 'future')
        .length,
      // Cobertura: ponto sem sensor instalado ou sensor que nunca reportou.
      coverage: cells.filter(
        (cell) => cell.condition === 'no-sensor' || cell.condition === 'no-data',
      ).length,
    },
    distribution,
    latestTimestamp,
  };
}

export interface TrendPoint {
  timestamp: number;
  value: number | null;
  samples: number;
}

export interface TrendView {
  points: TrendPoint[];
  /**
   * `acquisition` existe porque o dado real é uma RAJADA: 60 amostras em 60 s, repetidas a
   * cada hora. Plotadas cruas num eixo de horas, cada aquisição vira um traço vertical e a
   * tendência — que é justamente a comparação entre aquisições — some.
   */
  mode: 'raw' | 'average' | 'acquisition';
  filteredSamples: TimeSeriesSampleDto[];
  availableStart: string | null;
  availableEnd: string | null;
  coveredStart: string | null;
  coveredEnd: string | null;
}

export function filterSamplesByPeriod(
  samples: TimeSeriesSampleDto[],
  period: DashboardPeriod,
  nowMs = Date.now(),
): TimeSeriesSampleDto[] {
  const sorted = samples
    .filter((sample) => parseTimestamp(sample.timestamp) !== null)
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  // "Tudo" mostra o histórico como ele está no banco, inclusive fora da janela móvel.
  if (period === 'all') return sorted;

  const start = nowMs - PERIOD_MS[period];
  return sorted.filter((sample) => {
    const at = Date.parse(sample.timestamp);
    return at >= start && at <= nowMs;
  });
}

function sampleRange(samples: TimeSeriesSampleDto[]): [string | null, string | null] {
  const sorted = samples
    .filter((sample) => parseTimestamp(sample.timestamp) !== null)
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return [sorted[0]?.timestamp ?? null, sorted.at(-1)?.timestamp ?? null];
}

function bucketSize(period: DashboardPeriod, spanMs: number): number {
  if (period === '24h') return 15 * 60 * 1000;
  if (period === '7d') return 60 * 60 * 1000;
  if (period === '30d') return 6 * 60 * 60 * 1000;
  // "Tudo": o intervalo vem dos próprios dados, então o balde é derivado deles.
  return Math.max(1, Math.ceil(spanMs / 240));
}

export function buildTrendView(
  samples: TimeSeriesSampleDto[],
  period: DashboardPeriod,
  nowMs = Date.now(),
  rawLimit = 240,
): TrendView {
  const filtered = filterSamplesByPeriod(samples, period, nowMs);
  const [availableStart, availableEnd] = sampleRange(samples);
  const [coveredStart, coveredEnd] = sampleRange(filtered);

  // Rajadas separadas por lacunas: uma média por aquisição mostra a tendência que o
  // traçado cru esconde. Cada ponto continua sendo dado medido, nunca interpolação.
  const acquisitions = groupAcquisitionWindows(filtered);
  const denseAcquisitions =
    acquisitions.length >= 2 &&
    acquisitions.length <= 48 &&
    filtered.length >= acquisitions.length * 10;

  if (denseAcquisitions) {
    return {
      points: acquisitions.map((window) => ({
        timestamp: Date.parse(window[0].timestamp),
        value: mean(window.map((sample) => sample.value)),
        samples: window.length,
      })),
      mode: 'acquisition',
      filteredSamples: filtered,
      availableStart,
      availableEnd,
      coveredStart,
      coveredEnd,
    };
  }

  if (filtered.length <= rawLimit) {
    const points: TrendPoint[] = [];
    const intervals = filtered
      .slice(1)
      .map((sample, index) => Date.parse(sample.timestamp) - Date.parse(filtered[index].timestamp))
      .filter((interval) => interval > 0)
      .sort((a, b) => a - b);
    const typicalInterval = intervals[Math.floor(intervals.length / 2)] ?? 0;
    const breakAfter = Math.max(typicalInterval * 4, ACQUISITION_GAP_MS);

    filtered.forEach((sample, index) => {
      const timestamp = Date.parse(sample.timestamp);
      const previous = filtered[index - 1];
      if (previous && timestamp - Date.parse(previous.timestamp) > breakAfter) {
        points.push({ timestamp: Date.parse(previous.timestamp) + 1, value: null, samples: 0 });
      }
      points.push({ timestamp, value: sample.value, samples: 1 });
    });
    return {
      points,
      mode: 'raw',
      filteredSamples: filtered,
      availableStart,
      availableEnd,
      coveredStart,
      coveredEnd,
    };
  }

  const firstAt = Date.parse(filtered[0].timestamp);
  const lastAt = Date.parse(filtered[filtered.length - 1].timestamp);
  const spanMs = period === 'all' ? Math.max(1, lastAt - firstAt) : PERIOD_MS[period];
  const size = bucketSize(period, spanMs);
  const start = period === 'all' ? firstAt : nowMs - spanMs;
  const buckets = new Map<number, number[]>();
  for (const sample of filtered) {
    const at = Date.parse(sample.timestamp);
    const bucket = Math.floor((at - start) / size);
    const values = buckets.get(bucket) ?? [];
    values.push(sample.value);
    buckets.set(bucket, values);
  }
  const count = Math.ceil(spanMs / size);
  const points = Array.from({ length: count }, (_, bucket) => {
    const values = buckets.get(bucket) ?? [];
    return {
      timestamp: start + bucket * size,
      value: values.length > 0 ? mean(values) : null,
      samples: values.length,
    };
  });
  return {
    points,
    mode: 'average',
    filteredSamples: filtered,
    availableStart,
    availableEnd,
    coveredStart,
    coveredEnd,
  };
}

export function computeSampleStats(samples: TimeSeriesSampleDto[]): SeriesMetrics {
  if (samples.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      avg: null,
      last: null,
      firstTimestamp: null,
      lastTimestamp: null,
    };
  }
  const sorted = samples.slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const values = sorted.map((sample) => sample.value);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: mean(values),
    last: sorted.at(-1)?.value ?? null,
    firstTimestamp: sorted[0]?.timestamp ?? null,
    lastTimestamp: sorted.at(-1)?.timestamp ?? null,
  };
}

/** Agregação temporal do explorador: preserva buckets vazios como null (lacuna). */
export function aggregateSamplesForDetail(
  samples: TimeSeriesSampleDto[],
  maxPoints = 320,
): { points: TrendPoint[]; aggregated: boolean } {
  const sorted = samples
    .filter((sample) => parseTimestamp(sample.timestamp) !== null)
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (sorted.length <= maxPoints) {
    const groups = groupAcquisitionWindows(sorted);
    const points: TrendPoint[] = [];
    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        points.push({ timestamp: Date.parse(group[0].timestamp) - 1, value: null, samples: 0 });
      }
      points.push(
        ...group.map((sample) => ({
          timestamp: Date.parse(sample.timestamp),
          value: sample.value,
          samples: 1,
        })),
      );
    });
    return { points, aggregated: false };
  }

  const start = Date.parse(sorted[0].timestamp);
  const end = Date.parse(sorted[sorted.length - 1].timestamp);
  const bucketMs = Math.max(1, Math.ceil((end - start + 1) / maxPoints));
  const buckets = new Map<number, number[]>();
  for (const sample of sorted) {
    const index = Math.min(maxPoints - 1, Math.floor((Date.parse(sample.timestamp) - start) / bucketMs));
    const values = buckets.get(index) ?? [];
    values.push(sample.value);
    buckets.set(index, values);
  }
  return {
    aggregated: true,
    points: Array.from({ length: maxPoints }, (_, index) => {
      const values = buckets.get(index) ?? [];
      return {
        timestamp: start + index * bucketMs,
        value: values.length > 0 ? mean(values) : null,
        samples: values.length,
      };
    }),
  };
}
