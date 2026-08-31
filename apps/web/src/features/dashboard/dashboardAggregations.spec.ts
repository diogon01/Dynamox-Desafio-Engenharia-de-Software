import { describe, expect, it } from 'vitest';

import { EMPTY_CONDITION_COUNTS } from '@dynamox/domain';
import type {
  ConditionKind,
  FleetConditionResponseDto,
  TimeSeriesSampleDto,
  TimeSeriesSummary,
} from '@dynamox/domain';

import type { MachineDto, MonitoringPointDto } from '../../api/client';
import {
  aggregateSamplesForDetail,
  buildAcquisitionActivity,
  buildDashboardView,
  buildOccurrences,
  buildPriorityList,
  buildWeeklyAcquisitionMap,
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

const LAST_READING = '2026-08-29T11:30:00.000Z';

function summary(
  id: string,
  serial: string,
  axis: 'y' | 'z' | 'x' | null,
  overrides: Partial<TimeSeriesSummary> = {},
): TimeSeriesSummary {
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
    lastValue: 1,
    lastTimestamp: LAST_READING,
    ...overrides,
  };
}

const series = [
  summary('s1y', 'SIM-HF-001', 'y'),
  summary('s1z', 'SIM-HF-001', 'z'),
  summary('s2y', 'SIM-HF-002', 'y', { lastValue: 3 }),
  summary('s2z', 'SIM-HF-002', 'z', { lastValue: 3 }),
];

function dashboardState(): DashboardState {
  const baseline = samples('2026-08-29T08:00:00.000Z', [1, 1, 1]);
  const normal = samples('2026-08-29T09:00:00.000Z', [1, 1, 1]);
  const attention = samples('2026-08-29T09:00:00.000Z', [3, 3, 3]);
  return {
    ...initialDashboardState,
    machines: { status: 'succeeded', data: [machine], error: null },
    points: { status: 'succeeded', data: points, error: null },
    series: { status: 'succeeded', data: series.map((item) => ({ ...item })), error: null },
    conditionStatus: 'succeeded',
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

  it('separa os KPIs por conceito: condição, recência e cobertura não se somam', () => {
    const view = buildDashboardView(dashboardState(), NOW);

    // Inventário é contexto.
    expect(view.kpis).toMatchObject({ machines: 1, points: 3, sensors: 2 });
    // Só o sensor com desvio entra em "em atenção" — não a frota inteira.
    expect(view.kpis.attention).toBe(1);
    // Recência e cobertura são eixos independentes.
    expect(view.kpis.stale).toBe(0);
    expect(view.kpis.coverage).toBe(1);
    // O KPI de condição NÃO pode coincidir com o total de pontos só porque há um ponto
    // sem sensor: era exatamente esse o defeito da versão anterior.
    expect(view.kpis.attention).toBeLessThan(view.kpis.points);

    expect(view.cells.map((cell) => cell.positionLabel)).toEqual(['DE', 'NDE', 'Carcaça']);
    expect(view.cells.find((cell) => cell.sensorSerial === 'SIM-HF-002')?.condition).toBe('attention');
  });

  it('o ranking de inspeção lista apenas exceções, não a frota inteira', () => {
    const view = buildDashboardView(dashboardState(), NOW);
    expect(view.ranking.map((cell) => cell.sensorSerial)).toEqual(['SIM-HF-002']);
    expect(view.ranking[0].assessment?.deviationRatio).toBeCloseTo(3);
  });

  it('a evidência da célula é a medição que classificou, não uma série qualquer', () => {
    const state = dashboardState();
    // Eixo X com o mesmo instante das radiais: no modelo antigo, o desempate caía nele e
    // a célula "em atenção" exibia 0,008 g — um número sem relação com a classificação.
    state.series.data.push(
      summary('s2x', 'SIM-HF-002', 'x', { lastValue: 0.008, lastTimestamp: LAST_READING }),
    );

    const view = buildDashboardView(state, NOW);
    const attention = view.cells.find((cell) => cell.sensorSerial === 'SIM-HF-002');

    expect(attention?.condition).toBe('attention');
    expect(attention?.evidence?.label).toBe('Aceleração radial (Y/Z)');
    expect(attention?.evidence?.unit).toBe('g');
    // O valor exibido é o RMS radial da aquisição mais recente (3 em Y e Z ⇒ 3), e não o
    // último valor do eixo X.
    expect(attention?.evidence?.value).toBeCloseTo(3);
    expect(attention?.evidence?.deviationRatio).toBeCloseTo(3);
    expect(attention?.evidence?.baseline).toBeCloseTo(1);
    // Investigar leva à série que sustenta a evidência.
    expect(attention?.preferredSeriesId).toBe('s2y');
  });

  it('sem avaliação, a evidência nomeia a grandeza e o eixo da leitura exibida', () => {
    const state = dashboardState();
    state.radialSamplesBySeries = {};
    const view = buildDashboardView(state, NOW);
    const cell = view.cells.find((item) => item.sensorSerial === 'SIM-HF-001');
    expect(cell?.condition).toBe('unclassified');
    expect(cell?.evidence?.label).toBe('Aceleração · eixo Y');
    expect(cell?.evidence?.deviationRatio).toBeNull();
  });

  it('agrupa os motivos do mesmo ponto em um sinal só, com a severidade mais alta', () => {
    const state = dashboardState();
    // O sensor em atenção também está com leitura velha: antes isso gerava DUAS linhas.
    for (const item of state.series.data) {
      if (item.sensorSerialNumber === 'SIM-HF-002') item.lastTimestamp = '2026-08-27T08:00:00.000Z';
    }
    const view = buildDashboardView(state, NOW);
    const doSensor = view.signals.filter((signal) => signal.pointAndSensor.includes('SIM-HF-002'));
    expect(doSensor).toHaveLength(1);
    expect(doSensor[0].severity).toBe('high');
    expect(doSensor[0].reason).toContain('baseline');
    expect(doSensor[0].reason).toContain('24 horas');
    expect(doSensor[0].evidenceLabel).toBe('Aceleração radial (Y/Z)');
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
    for (const item of state.series.data) {
      if (item.sensorSerialNumber === 'SIM-HF-001') item.lastTimestamp = '2026-08-27T08:00:00.000Z';
    }
    const view = buildDashboardView(state, NOW);
    expect(view.kpis.stale).toBe(1);
    // Recência não contamina o KPI de condição.
    expect(view.kpis.attention).toBe(1);
    expect(view.signals.some((signal) => signal.reason.includes('mais de 24 horas'))).toBe(true);
  });

  it('"Tudo" mostra o histórico inteiro quando a janela móvel não alcança o dado', () => {
    const antigo = samples('2026-06-01T08:00:00.000Z', [1, 2, 3]);
    expect(filterSamplesByPeriod(antigo, '30d', NOW)).toHaveLength(0);
    expect(filterSamplesByPeriod(antigo, 'all', NOW)).toHaveLength(3);
    const trend = buildTrendView(antigo, 'all', NOW);
    expect(trend.filteredSamples).toHaveLength(3);
    expect(trend.points.some((point) => point.value !== null)).toBe(true);
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

  it('rajadas viram uma média por aquisição em vez de traços verticais ilegíveis', () => {
    // Três aquisições de 60 amostras separadas por uma hora — a forma real do dado.
    const rajada = (offsetMs: number, valor: number) =>
      samples(
        new Date(NOW - 3 * 60 * 60 * 1000 + offsetMs).toISOString(),
        Array.from({ length: 60 }, () => valor),
      );
    const input = [
      ...rajada(0, 1),
      ...rajada(60 * 60 * 1000, 1),
      ...rajada(2 * 60 * 60 * 1000, 3),
    ];

    const trend = buildTrendView(input, '7d', NOW);
    expect(trend.mode).toBe('acquisition');
    expect(trend.points).toHaveLength(3);
    expect(trend.points.map((point) => point.value)).toEqual([1, 1, 3]);
    // Nenhum ponto inventado: cada um resume amostras que existem.
    expect(trend.points.every((point) => point.samples === 60)).toBe(true);
    expect(trend.filteredSamples).toHaveLength(180);
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


describe('painéis derivados do dashboard v2', () => {
  it('a manchete separa condição, magnitude, cobertura e recência', () => {
    const view = buildDashboardView(dashboardState(), NOW);
    expect(view.headline.attention.count).toBe(1);
    expect(view.headline.attention.top?.sensorSerial).toBe('SIM-HF-002');
    expect(view.headline.maxDeviation?.ratio).toBeCloseTo(3);
    // Cobertura: 2 sensores reportando em 3 pontos; recência independente.
    expect(view.headline.coverage).toEqual({ reporting: 2, instrumented: 2, points: 3 });
    expect(view.headline.recency).toEqual({ current: 2, installed: 2 });
  });

  it('a fila de prioridade ordena exceções antes dos normais', () => {
    const view = buildDashboardView(dashboardState(), NOW);
    const priority = buildPriorityList(view.cells);
    expect(priority.map((cell) => cell.sensorSerial)).toEqual(['SIM-HF-002', 'SIM-HF-001']);
    // A miniatura de tendência da exceção vem das aquisições radiais reais.
    expect(view.sparklines[priority[0].key].length).toBeGreaterThanOrEqual(2);
  });

  it('a linha do explorador não se quebra em série já bucketizada', () => {
    // REGRESSÃO: com o painel consumindo buckets de 1 h, o limiar fixo de 5 min separava
    // todo ponto do seguinte — o gráfico virava segmentos de um ponto só e, sem `dot`,
    // não desenhava nada. A lacuna tem de ser relativa ao espaçamento da própria série.
    const bucketizada = samples('2026-08-29T00:00:00.000Z', [1, 2, 3, 4, 5], 60 * 60 * 1000);
    const { points } = aggregateSamplesForDetail(bucketizada);

    expect(points.filter((point) => point.value === null)).toHaveLength(0);
    expect(points.map((point) => point.value)).toEqual([1, 2, 3, 4, 5]);
  });

  it('mas ainda quebra a linha numa lacuna de verdade', () => {
    const comLacuna = [
      ...samples('2026-08-29T00:00:00.000Z', [1, 2, 3], 60 * 60 * 1000),
      // Três dias de silêncio: muito além do espaçamento típico da série.
      ...samples('2026-09-01T00:00:00.000Z', [4, 5], 60 * 60 * 1000),
    ];
    const { points } = aggregateSamplesForDetail(comLacuna);
    expect(points.filter((point) => point.value === null)).toHaveLength(1);
  });

  it('ocorrências derivam das leituras reais, uma por sensor, mais recente primeiro', () => {
    const view = buildDashboardView(dashboardState(), NOW);
    const occurrences = buildOccurrences(view.cells);
    // Só sensores com leitura entram; o ponto sem sensor não vira "evento".
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].statusLabel).toBeDefined();
    const attention = occurrences.find((row) => row.sensorSerial === 'SIM-HF-002');
    expect(attention?.statusLabel).toBe('Atenção');
    expect(attention?.message).toContain('referência');
  });

  it('a atividade de 24 h conta amostras e sensores por hora, sem inventar buckets', () => {
    const state = dashboardState();
    const activity = buildAcquisitionActivity(state.series.data, state.radialSamplesBySeries, NOW);
    expect(activity).toHaveLength(24);
    const total = activity.reduce((sum, bucket) => sum + bucket.samples, 0);
    // 4 séries × 6 amostras dentro das últimas 24 h.
    expect(total).toBe(24);
    const withSensors = activity.filter((bucket) => bucket.sensorsReporting > 0);
    expect(withSensors.length).toBeGreaterThan(0);
    expect(Math.max(...withSensors.map((bucket) => bucket.sensorsReporting))).toBe(2);
  });

  it('o mapa semanal agrega por dia × hora com a fração de sensores reportando', () => {
    const state = dashboardState();
    const weekMap = buildWeeklyAcquisitionMap(state.series.data, state.radialSamplesBySeries);
    expect(weekMap.totalSensors).toBe(2);
    expect(weekMap.days).toHaveLength(7);
    // O balde é dia × hora LOCAIS da primeira janela do fixture — o cálculo não pode
    // depender do fuso da máquina que roda o teste.
    const firstWindow = new Date('2026-08-29T08:00:00.000Z');
    const day = firstWindow.getDay();
    const hour = firstWindow.getHours();
    expect(weekMap.days[day].hours[hour].sensorsReporting).toBe(2);
    expect(weekMap.days[day].hours[hour].share).toBe(1);
    expect(weekMap.days[day].hours[hour].samples).toBe(12);
    // Dias sem leitura permanecem zerados — nada é interpolado.
    const otherDay = (day + 3) % 7;
    expect(weekMap.days[otherDay].hours.every((entry) => entry.samples === 0)).toBe(true);
    expect(weekMap.peak?.day).toBe(day);
  });
});

/**
 * CHARACTERIZATION: o caminho de PRODUÇÃO é a resposta do servidor. Estes testes congelam
 * como o cliente classifica a partir dela nas fronteiras exatas — antes de a regra ser
 * centralizada, para que a centralização seja provadamente neutra.
 */
describe('fronteiras da condição a partir da resposta do servidor', () => {
  function serverPoint(
    serial: string,
    pointId: string,
    pointName: string,
    ratio: number,
    condition: ConditionKind,
  ): FleetConditionResponseDto['points'][number] {
    return {
      machineName: machine.name,
      machineType: machine.type,
      monitoringPointId: pointId,
      monitoringPointName: pointName,
      sensorSerialNumber: serial,
      sensorModel: 'HF+',
      condition,
      freshness: 'current',
      currentValue: ratio,
      baselineValue: 1,
      deviationRatio: ratio,
      currentAt: LAST_READING,
      baselineAt: '2026-08-29T10:00:00.000Z',
      currentSampleCount: 60,
      currentCycleId: `cycle-${serial}-current`,
      baselineCycleId: `cycle-${serial}-baseline`,
      unit: 'g',
      trend: [],
    };
  }

  function stateWithServerRatio(ratio: number, condition: ConditionKind): DashboardState {
    return {
      ...initialDashboardState,
      machines: { status: 'succeeded', data: [machine], error: null },
      points: { status: 'succeeded', data: points, error: null },
      series: { status: 'succeeded', data: series.map((item) => ({ ...item })), error: null },
      conditionStatus: 'succeeded',
      // Produção: nenhuma amostra bruta no cliente — só a resposta agregada.
      radialSamplesBySeries: {},
      fleetCondition: {
        from: '2026-08-22T12:00:00.000Z',
        to: '2026-08-29T12:00:00.000Z',
        generatedAt: '2026-08-29T12:00:00.000Z',
        counts: { ...EMPTY_CONDITION_COUNTS, total: 2 },
        condition: null,
        points: [
          serverPoint('SIM-HF-001', 'p-de', points[0].name, 1, 'normal'),
          serverPoint('SIM-HF-002', 'p-nde', points[1].name, ratio, condition),
        ],
      },
    };
  }

  it.each([
    [1.4999, 'normal'],
    [1.5, 'observation'],
    [1.9999, 'observation'],
    [2.0, 'attention'],
    [3.49, 'attention'],
  ] as const)('razão %s do servidor vira condição %s na célula', (ratio, expected) => {
    const view = buildDashboardView(stateWithServerRatio(ratio, expected), NOW);
    const cell = view.cells.find((item) => item.sensorSerial === 'SIM-HF-002');
    expect(cell?.condition).toBe(expected);
    expect(cell?.assessment?.deviationRatio).toBeCloseTo(ratio, 10);
    // A evidência exibida é a mesma medição que classificou.
    expect(cell?.evidence?.deviationRatio).toBeCloseTo(ratio, 10);
  });

  it('a manchete e a fila seguem a mesma fronteira que a célula', () => {
    const observation = buildDashboardView(stateWithServerRatio(1.5, 'observation'), NOW);
    expect(observation.headline.attention.count).toBe(1);
    expect(observation.priority[0]?.sensorSerial).toBe('SIM-HF-002');

    const normal = buildDashboardView(stateWithServerRatio(1.4999, 'normal'), NOW);
    expect(normal.headline.attention.count).toBe(0);
    expect(normal.ranking).toHaveLength(0);
  });
});
