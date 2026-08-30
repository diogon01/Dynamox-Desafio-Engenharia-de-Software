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
const MIN_BASELINE_SAMPLES = 3;
const MIN_SERIES_BASELINE_SAMPLES = 60;

export const PERIOD_MS: Record<DashboardPeriod, number> = {
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
}

export interface DashboardView {
  rows: MachineMatrixRow[];
  cells: SensorCellView[];
  assessments: SyntheticAssessment[];
  ranking: SensorCellView[];
  signals: AttentionSignal[];
  kpis: {
    machines: number;
    points: number;
    sensors: number;
    attention: number;
    stale: number;
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

function latestMetric(
  series: TimeSeriesSummary[],
  metricsBySeries: Record<string, SeriesMetrics>,
): { series: TimeSeriesSummary | null; metrics: SeriesMetrics | null } {
  let chosen: TimeSeriesSummary | null = null;
  let metrics: SeriesMetrics | null = null;
  let latest = Number.NEGATIVE_INFINITY;
  for (const item of series) {
    const candidate = metricsBySeries[item.id];
    const at = candidate?.lastTimestamp ? Date.parse(candidate.lastTimestamp) : Number.NaN;
    if (Number.isFinite(at) && at > latest) {
      latest = at;
      chosen = item;
      metrics = candidate;
    }
  }
  return { series: chosen, metrics };
}

function buildCell(
  point: MonitoringPointDto,
  metricsBySeries: Record<string, SeriesMetrics>,
  allSeries: TimeSeriesSummary[],
  assessments: Map<string, SyntheticAssessment>,
  nowMs: number,
): SensorCellView {
  const sensorSeries = point.sensor
    ? allSeries.filter((item) => item.sensorSerialNumber === point.sensor?.serialNumber)
    : [];
  const preferred = preferredSeries(sensorSeries);
  const latest = latestMetric(sensorSeries, metricsBySeries);
  const hasSamples = sensorSeries.some((item) => (metricsBySeries[item.id]?.count ?? item.sampleCount) > 0);
  const assessment = point.sensor ? assessments.get(point.sensor.serialNumber) ?? null : null;
  const condition = conditionFrom(Boolean(point.sensor), hasSamples, assessment);
  const freshness = classifyFreshness(latest.metrics?.lastTimestamp ?? null, nowMs);

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
    preferredSeriesId: preferred?.id ?? null,
    lastValue: latest.metrics?.last ?? null,
    lastUnit: latest.series?.unit ?? null,
    lastTimestamp: latest.metrics?.lastTimestamp ?? null,
    condition: condition.kind,
    conditionLabel: condition.label,
    freshness: freshness.kind,
    freshnessLabel: freshness.label,
    assessment,
    demonstrative: point.sensor?.serialNumber.startsWith('SIM-') ?? false,
  };
}

const severityOrder: Record<AttentionSeverity, number> = { high: 3, medium: 2, info: 1 };

export function buildAttentionSignals(cells: SensorCellView[]): AttentionSignal[] {
  const signals: AttentionSignal[] = [];
  for (const cell of cells) {
    const common = {
      machineName: cell.machineName,
      pointAndSensor: `${cell.positionLabel} · ${cell.sensorSerial ?? 'sem sensor'}`,
      lastTimestamp: cell.lastTimestamp,
      seriesId: cell.preferredSeriesId,
    };
    if (cell.condition === 'attention') {
      signals.push({
        id: `${cell.key}-condition`,
        severity: 'high',
        reason: `Índice demonstrativo ${cell.assessment?.deviationRatio.toFixed(2)}× o baseline (limiar didático 2,0×).`,
        ...common,
      });
    } else if (cell.condition === 'observation') {
      signals.push({
        id: `${cell.key}-condition`,
        severity: 'medium',
        reason: `Desvio demonstrativo de ${cell.assessment?.deviationRatio.toFixed(2)}× o baseline observado.`,
        ...common,
      });
    } else if (cell.condition === 'no-sensor') {
      signals.push({
        id: `${cell.key}-sensor`,
        severity: 'medium',
        reason: 'Ponto de monitoramento sem sensor associado.',
        ...common,
      });
    } else if (cell.condition === 'no-data') {
      signals.push({
        id: `${cell.key}-data`,
        severity: 'medium',
        reason: 'Sensor instalado sem leitura disponível.',
        ...common,
      });
    }

    if (cell.freshness === 'stale') {
      signals.push({
        id: `${cell.key}-stale`,
        severity: 'medium',
        reason: 'Última leitura há mais de 24 horas.',
        ...common,
      });
    } else if (cell.freshness === 'future') {
      signals.push({
        id: `${cell.key}-future`,
        severity: 'medium',
        reason: 'Timestamp à frente do relógio local; verifique sincronização.',
        ...common,
      });
    }
  }
  return signals.sort(
    (a, b) =>
      severityOrder[b.severity] - severityOrder[a.severity] ||
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
    buildCell(
      point,
      state.metricsBySeries,
      state.series.data,
      fleetAssessments,
      nowMs,
    ),
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
  const ranking = assessments
    .slice(0, 5)
    .flatMap((assessment) => {
      const cell = cells.find((candidate) => candidate.sensorSerial === assessment.serialNumber);
      return cell ? [cell] : [];
    });
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
      attention: new Set(
        signals.map((signal) => signal.id.replace(/-(condition|sensor|data|stale|future)$/, '')),
      ).size,
      stale: sensors.filter((cell) => cell.freshness === 'stale').length,
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
  mode: 'raw' | 'average';
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
  const start = nowMs - PERIOD_MS[period];
  return samples
    .filter((sample) => {
      const at = parseTimestamp(sample.timestamp);
      return at !== null && at >= start && at <= nowMs;
    })
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function sampleRange(samples: TimeSeriesSampleDto[]): [string | null, string | null] {
  const sorted = samples
    .filter((sample) => parseTimestamp(sample.timestamp) !== null)
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return [sorted[0]?.timestamp ?? null, sorted.at(-1)?.timestamp ?? null];
}

function bucketSize(period: DashboardPeriod): number {
  if (period === '24h') return 15 * 60 * 1000;
  if (period === '7d') return 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
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

  const size = bucketSize(period);
  const start = nowMs - PERIOD_MS[period];
  const buckets = new Map<number, number[]>();
  for (const sample of filtered) {
    const at = Date.parse(sample.timestamp);
    const bucket = Math.floor((at - start) / size);
    const values = buckets.get(bucket) ?? [];
    values.push(sample.value);
    buckets.set(bucket, values);
  }
  const count = Math.ceil(PERIOD_MS[period] / size);
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
  const end = Date.parse(sorted.at(-1)!.timestamp);
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
