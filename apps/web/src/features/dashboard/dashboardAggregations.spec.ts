import { describe, expect, it } from 'vitest';

import type { TimeSeriesSampleDto, TimeSeriesSummary } from '@dynamox/domain';

import type { MachineDto, MonitoringPointDto } from '../../api/client';
import {
  aggregateSamplesForDetail,
  buildDashboardView,
  buildTrendView,
  classifyFreshness,
  computeSampleStats,
  computeSyntheticAssessment,
  filterSamplesByPeriod,
  groupAcquisitionWindows,
  SYNTHETIC_ATTENTION_RATIO,
} from './dashboardAggregations';
import { initialDashboardState, type DashboardState } from './dashboardSlice';

const NOW = Date.parse('2026-08-29T12:00:00.000Z');

function samples(start: string, values: number[], stepMs = 1000): TimeSeriesSampleDto[] {
  const startMs = Date.parse(start);
  return values.map((value, index) => ({
    timestamp: new Date(startMs + index * stepMs).toISOString(),
    value,
  }));
}

const machine: MachineDto = {
  id: 'm1',
  name: 'P-101',
  type: 'Pump',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const points: MonitoringPointDto[] = [
  {
    id: 'p-de',
    name: 'Mancal lado acoplamento',
    machine: { id: machine.id, name: machine.name, type: machine.type },
    sensor: { id: 'sensor-1', serialNumber: 'SIM-HF-001', model: 'HF+' },
    createdAt: machine.createdAt,
    updatedAt: machine.updatedAt,
  },
  {
    id: 'p-nde',
    name: 'Mancal lado oposto ao acoplamento',
    machine: { id: machine.id, name: machine.name, type: machine.type },
    sensor: { id: 'sensor-2', serialNumber: 'SIM-HF-002', model: 'HF+' },
    createdAt: machine.createdAt,
    updatedAt: machine.updatedAt,
  },
  {
    id: 'p-free',
    name: 'Carcaça',
    machine: { id: machine.id, name: machine.name, type: machine.type },
    sensor: null,
    createdAt: machine.createdAt,
    updatedAt: machine.updatedAt,
  },
];

function summary(id: string, serial: string, axis: 'y' | 'z'): TimeSeriesSummary {
  return {
    id,
    sensorSerialNumber: serial,
    sensorModel: 'HF+',
    machineName: machine.name,
    machineType: machine.type,
    monitoringPointName:
      serial === 'SIM-HF-001' ? points[0].name : points[1].name,
    physicalQuantity: 'acceleration',
    axis,
    unit: 'g',
    displayName: null,
    sampleCount: 6,
  };
}

const series = [
  summary('s1y', 'SIM-HF-001', 'y'),
  summary('s1z', 'SIM-HF-001', 'z'),
  summary('s2y', 'SIM-HF-002', 'y'),
  summary('s2z', 'SIM-HF-002', 'z'),
];

function dashboardState(): DashboardState {
  const baseline = samples('2026-08-29T08:00:00.000Z', [1, 1, 1]);
  const normal = samples('2026-08-29T09:00:00.000Z', [1, 1, 1]);
  const attention = samples('2026-08-29T09:00:00.000Z', [3, 3, 3]);
  return {
    ...initialDashboardState,
    machines: { status: 'succeeded', data: [machine], error: null },
    points: { status: 'succeeded', data: points, error: null },
    series: { status: 'succeeded', data: series, error: null },
    metricsStatus: 'succeeded',
    metricsBySeries: Object.fromEntries(
      series.map((item) => [
        item.id,
        {
          count: 6,
          min: 1,
          max: item.sensorSerialNumber === 'SIM-HF-002' ? 3 : 1,
          avg: 1,
          last: item.sensorSerialNumber === 'SIM-HF-002' ? 3 : 1,
          firstTimestamp: baseline[0].timestamp,
          lastTimestamp: '2026-08-29T11:30:00.000Z',
        },
      ]),
    ),
    radialSamplesBySeries: {
      s1y: [...baseline, ...normal],
      s1z: [...baseline, ...normal],
      s2y: [...baseline, ...attention],
      s2z: [...baseline, ...attention],
    },
  };
}

describe('agregações puras do dashboard operacional', () => {
  it('agrupa aquisições por lacuna temporal sem preencher valores', () => {
    const grouped = groupAcquisitionWindows([
      ...samples('2026-08-29T08:00:00.000Z', [1, 2]),
      ...samples('2026-08-29T09:00:00.000Z', [3, 4]),
    ]);
    expect(grouped.map((group) => group.map((sample) => sample.value))).toEqual([[1, 2], [3, 4]]);
  });

  it('calcula o índice radial do twin apenas com Y/Z pareados', () => {
    const baseline = samples('2026-08-29T08:00:00.000Z', [1, 1, 1]);
    const condition = samples('2026-08-29T09:00:00.000Z', [3, 3, 3]);
    const assessment = computeSyntheticAssessment(
      'SIM-HF-002',
      [...baseline, ...condition],
      [...baseline, ...condition],
    );
    expect(assessment?.baseline).toBeCloseTo(1);
    expect(assessment?.condition).toBeCloseTo(3);
    expect(assessment?.deviationRatio).toBeCloseTo(3);
    expect(assessment!.deviationRatio).toBeGreaterThan(SYNTHETIC_ATTENTION_RATIO);
  });

  it('não cria baseline para sensor não demonstrativo ou janela incompleta', () => {
    const observed = samples('2026-08-29T08:00:00.000Z', [1, 1, 1]);
    expect(computeSyntheticAssessment('REAL-001', observed, observed)).toBeNull();
    expect(computeSyntheticAssessment('SIM-HF-001', observed, observed)).toBeNull();
  });

  it('monta KPIs reais, condição, DE/NDE e ranking determinístico', () => {
    const view = buildDashboardView(dashboardState(), NOW);
    expect(view.kpis).toMatchObject({ machines: 1, points: 3, sensors: 2, stale: 0 });
    expect(view.cells.map((cell) => cell.positionLabel)).toEqual(['DE', 'NDE', 'Carcaça']);
    expect(view.cells.find((cell) => cell.sensorSerial === 'SIM-HF-002')?.condition).toBe('attention');
    expect(view.ranking.map((cell) => cell.sensorSerial)).toEqual(['SIM-HF-002', 'SIM-HF-001']);
    expect(view.ranking[0].assessment?.deviationRatio).toBeCloseTo(3);
  });

  it('ignora aquisições isoladas ao escolher as janelas compartilhadas da frota', () => {
    const state = dashboardState();
    state.radialSamplesBySeries.s1y = [
      ...samples('2026-08-27T08:00:00.000Z', [1, 1, 1]),
      ...samples('2026-08-27T09:00:00.000Z', [4, 4, 4]),
      ...state.radialSamplesBySeries.s1y,
    ];
    state.radialSamplesBySeries.s1z = [
      ...samples('2026-08-27T08:00:00.000Z', [1, 1, 1]),
      ...samples('2026-08-27T09:00:00.000Z', [4, 4, 4]),
      ...state.radialSamplesBySeries.s1z,
    ];
    const view = buildDashboardView(state, NOW);
    expect(view.cells.find((cell) => cell.sensorSerial === 'SIM-HF-001')?.condition).toBe('normal');
    expect(view.cells.find((cell) => cell.sensorSerial === 'SIM-HF-002')?.condition).toBe('attention');
  });

  it('sinaliza ponto sem sensor e não inventa série', () => {
    const view = buildDashboardView(dashboardState(), NOW);
    const emptyPoint = view.cells.find((cell) => cell.pointId === 'p-free');
    expect(emptyPoint?.condition).toBe('no-sensor');
    expect(emptyPoint?.preferredSeriesId).toBeNull();
    expect(view.signals.some((signal) => signal.reason.includes('sem sensor associado'))).toBe(true);
  });

  it('mantém máquina sem pontos como uma linha vazia da matriz', () => {
    const state = dashboardState();
    state.machines.data.push({ ...machine, id: 'm2', name: 'F-201', type: 'Fan' });
    const view = buildDashboardView(state, NOW);
    expect(view.rows.find((row) => row.machine.id === 'm2')?.cells).toEqual([]);
  });

  it('classifica leitura atual, desatualizada, futura e ausente com texto', () => {
    expect(classifyFreshness('2026-08-29T11:30:00.000Z', NOW).kind).toBe('current');
    expect(classifyFreshness('2026-08-28T11:00:00.000Z', NOW)).toEqual({
      kind: 'stale',
      label: 'Desatualizado',
    });
    expect(classifyFreshness('2026-08-29T13:00:00.000Z', NOW).kind).toBe('future');
    expect(classifyFreshness(null, NOW).kind).toBe('unknown');
  });

  it('conta dado desatualizado e gera um sinal orientado à inspeção', () => {
    const state = dashboardState();
    state.metricsBySeries.s1y.lastTimestamp = '2026-08-27T08:00:00.000Z';
    state.metricsBySeries.s1z.lastTimestamp = '2026-08-27T08:00:00.000Z';
    const view = buildDashboardView(state, NOW);
    expect(view.kpis.stale).toBe(1);
    expect(view.signals.some((signal) => signal.reason.includes('mais de 24 horas'))).toBe(true);
  });

  it('filtra 24 h, 7 dias e 30 dias pelos timestamps reais', () => {
    const input = [
      ...samples('2026-08-29T11:00:00.000Z', [1]),
      ...samples('2026-08-25T11:00:00.000Z', [2]),
      ...samples('2026-08-10T11:00:00.000Z', [3]),
      ...samples('2026-07-01T11:00:00.000Z', [4]),
    ];
    expect(filterSamplesByPeriod(input, '24h', NOW).map((sample) => sample.value)).toEqual([1]);
    expect(filterSamplesByPeriod(input, '7d', NOW).map((sample) => sample.value)).toEqual([2, 1]);
    expect(filterSamplesByPeriod(input, '30d', NOW).map((sample) => sample.value)).toEqual([3, 2, 1]);
  });

  it('preserva lacuna semanal como null em vez de zero', () => {
    const input = [
      ...samples('2026-08-25T08:00:00.000Z', [1, 2]),
      ...samples('2026-08-29T08:00:00.000Z', [3, 4]),
    ];
    const trend = buildTrendView(input, '7d', NOW);
    expect(trend.mode).toBe('raw');
    expect(trend.points.some((point) => point.value === null)).toBe(true);
    expect(trend.points.some((point) => point.value === 0)).toBe(false);
  });

  it('agrega muitas amostras por média e deixa buckets vazios nulos', () => {
    const input = samples(
      '2026-08-29T08:00:00.000Z',
      Array.from({ length: 300 }, (_, index) => index),
      1000,
    );
    const trend = buildTrendView(input, '7d', NOW, 20);
    expect(trend.mode).toBe('average');
    expect(trend.points.some((point) => point.value === null)).toBe(true);
    expect(trend.points.filter((point) => point.value !== null)).toHaveLength(1);
  });

  it('informa intervalo disponível quando os dados estão fora do período', () => {
    const trend = buildTrendView(samples('2026-07-01T08:00:00.000Z', [1, 2]), '7d', NOW);
    expect(trend.filteredSamples).toEqual([]);
    expect(trend.availableStart).toBe('2026-07-01T08:00:00.000Z');
    expect(trend.availableEnd).toBe('2026-07-01T08:00:01.000Z');
  });

  it('calcula amostras, mínimo, máximo, média e último valor', () => {
    const stats = computeSampleStats(samples('2026-08-29T08:00:00.000Z', [2, 4, 8]));
    expect(stats).toMatchObject({ count: 3, min: 2, max: 8, avg: 14 / 3, last: 8 });
  });

  it('retorna métricas vazias sem NaN quando a série está vazia', () => {
    expect(computeSampleStats([])).toMatchObject({
      count: 0,
      min: null,
      max: null,
      avg: null,
      last: null,
    });
  });

  it('agrega o detalhe extenso sem ultrapassar o orçamento de pontos', () => {
    const detail = aggregateSamplesForDetail(
      samples('2026-08-29T08:00:00.000Z', Array.from({ length: 1000 }, (_, index) => index)),
      100,
    );
    expect(detail.aggregated).toBe(true);
    expect(detail.points).toHaveLength(100);
    expect(detail.points[0].value).toBe(4.5);
  });
});
