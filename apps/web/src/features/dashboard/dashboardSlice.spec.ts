import { describe, expect, it } from 'vitest';

import type { TimeSeriesSummary } from '@dynamox/domain';

import {
  dashboardReducer,
  dashboardSeriesSelected,
  fetchConditionEvidence,
  fetchDashboardSeriesDetail,
  fetchOperationalDashboard,
  initialDashboardState,
  periodChanged,
  radialSeriesForCondition,
  type OperationalDashboardPayload,
} from './dashboardSlice';

const xSeries: TimeSeriesSummary = {
  id: 'series-x',
  sensorSerialNumber: 'SIM-HF-001',
  sensorModel: 'HF+',
  machineName: 'P-101',
  machineType: 'Pump',
  monitoringPointName: 'DE',
  physicalQuantity: 'acceleration',
  axis: 'x',
  unit: 'g',
  displayName: null,
  sampleCount: 10,
  lastValue: 0.008,
  lastTimestamp: '2026-08-29T11:59:00.000Z',
};

const ySeries: TimeSeriesSummary = { ...xSeries, id: 'series-y', axis: 'y' };

function payload(overrides: Partial<OperationalDashboardPayload> = {}): OperationalDashboardPayload {
  return {
    machines: { data: [], error: null },
    points: { data: [], error: null },
    series: { data: [xSeries, ySeries], error: null },
    loadedAt: '2026-08-29T12:00:00.000Z',
    ...overrides,
  };
}

describe('dashboardSlice', () => {
  it('usa 7 dias como período padrão e permite trocar o filtro global', () => {
    expect(initialDashboardState.period).toBe('7d');
    expect(dashboardReducer(initialDashboardState, periodChanged('24h')).period).toBe('24h');
    expect(dashboardReducer(initialDashboardState, periodChanged('30d')).period).toBe('30d');
  });

  it('marca o inventário como loading no carregamento inicial', () => {
    const state = dashboardReducer(
      initialDashboardState,
      fetchOperationalDashboard.pending('load-1'),
    );
    expect(state.machines.status).toBe('loading');
    expect(state.points.status).toBe('loading');
    expect(state.series.status).toBe('loading');
    // A avaliação de condição é uma segunda etapa: não bloqueia o primeiro render.
    expect(state.conditionStatus).toBe('idle');
  });

  it('seleciona primeiro a aceleração Y com amostras', () => {
    const state = dashboardReducer(
      initialDashboardState,
      fetchOperationalDashboard.fulfilled(payload(), 'load-2'),
    );
    expect(state.selectedSeriesId).toBe('series-y');
    expect(state.detailStatus).toBe('loading');
  });

  it('preserva a seleção se a série continuar no catálogo recarregado', () => {
    const selected = dashboardReducer(initialDashboardState, dashboardSeriesSelected('series-x'));
    const state = dashboardReducer(
      selected,
      fetchOperationalDashboard.fulfilled(payload(), 'load-3'),
    );
    expect(state.selectedSeriesId).toBe('series-x');
  });

  it('isola erro parcial de pontos sem apagar séries disponíveis', () => {
    const state = dashboardReducer(
      initialDashboardState,
      fetchOperationalDashboard.fulfilled(
        payload({ points: { data: [], error: 'Pontos indisponíveis' } }),
        'load-4',
      ),
    );
    expect(state.points).toMatchObject({ status: 'failed', error: 'Pontos indisponíveis' });
    expect(state.series.status).toBe('succeeded');
    expect(state.series.data).toHaveLength(2);
  });

  it('preserva erros granulares da avaliação de condição', () => {
    const state = dashboardReducer(
      initialDashboardState,
      fetchConditionEvidence.fulfilled(
        { radialSamplesBySeries: {}, radialSampleErrors: { 'series-y': 'sem amostras' } },
        'cond-1',
        undefined,
      ),
    );
    expect(state.conditionStatus).toBe('succeeded');
    expect(state.radialSampleErrors).toEqual({ 'series-y': 'sem amostras' });
  });

  it('a carga inicial não traz amostras: elas são da segunda etapa', () => {
    const state = dashboardReducer(
      initialDashboardState,
      fetchOperationalDashboard.fulfilled(payload(), 'load-5b'),
    );
    expect(state.radialSamplesBySeries).toEqual({});
    expect(state.conditionStatus).toBe('idle');

    const avaliado = dashboardReducer(
      state,
      fetchConditionEvidence.fulfilled(
        {
          radialSamplesBySeries: { 'series-y': [{ timestamp: '2026-08-29T12:00:00.000Z', value: 1 }] },
          radialSampleErrors: {},
        },
        'cond-2',
        undefined,
      ),
    );
    expect(avaliado.conditionStatus).toBe('succeeded');
    expect(avaliado.radialSamplesBySeries['series-y']).toHaveLength(1);
  });

  it('a segunda etapa só busca o par radial avaliável, não a planta inteira', () => {
    const radialY = { ...ySeries, sampleCount: 180 };
    const radialZ = { ...ySeries, id: 'series-z', axis: 'z' as const, sampleCount: 180 };
    // Eixo X não entra: o índice demonstrativo é radial (Y/Z).
    const axialX = { ...ySeries, id: 'series-x-axial', axis: 'x' as const, sampleCount: 180 };
    const temperatura = {
      ...ySeries,
      id: 'series-temp',
      axis: null,
      physicalQuantity: 'temperature' as const,
      sampleCount: 180,
    };
    // Uma única aquisição não permite comparar com baseline: fica de fora.
    const curta = { ...ySeries, id: 'series-curta', sampleCount: 3 };
    const externa = { ...radialY, id: 'series-externa', sensorSerialNumber: 'DYNA-9000' };

    const escolhidas = radialSeriesForCondition([
      xSeries,
      axialX,
      radialY,
      radialZ,
      temperatura,
      curta,
      externa,
    ]);

    // Só Y/Z de sensores demonstrativos com histórico suficiente para duas aquisições.
    expect(escolhidas.map((item) => item.id).sort()).toEqual(['series-y', 'series-z']);
  });

  it('descarta resposta atrasada da série anterior', () => {
    let state = dashboardReducer(initialDashboardState, dashboardSeriesSelected('series-x'));
    state = dashboardReducer(state, fetchDashboardSeriesDetail.pending('detail-x', 'series-x'));
    state = dashboardReducer(state, dashboardSeriesSelected('series-y'));
    state = dashboardReducer(state, fetchDashboardSeriesDetail.pending('detail-y', 'series-y'));
    state = dashboardReducer(
      state,
      fetchDashboardSeriesDetail.fulfilled(
        { seriesId: 'series-y', samples: [{ timestamp: '2026-08-29T12:00:00.000Z', value: 2 }] },
        'detail-y',
        'series-y',
      ),
    );
    state = dashboardReducer(
      state,
      fetchDashboardSeriesDetail.fulfilled(
        { seriesId: 'series-x', samples: [{ timestamp: '2026-08-29T12:00:00.000Z', value: 9 }] },
        'detail-x',
        'series-x',
      ),
    );
    expect(state.selectedSeriesId).toBe('series-y');
    expect(state.detailSamples[0].value).toBe(2);
  });

  it('mostra erro do detalhe somente para a requisição ainda ativa', () => {
    let state = dashboardReducer(initialDashboardState, dashboardSeriesSelected('series-y'));
    state = dashboardReducer(state, fetchDashboardSeriesDetail.pending('detail-y', 'series-y'));
    state = dashboardReducer(
      state,
      fetchDashboardSeriesDetail.rejected(new Error('Série indisponível'), 'detail-y', 'series-y'),
    );
    expect(state.detailStatus).toBe('failed');
    expect(state.detailError).toBe('Série indisponível');
    expect(state.detailSamples).toEqual([]);
  });

  it('marca todos os recursos como falhos numa rejeição inesperada do thunk', () => {
    const state = dashboardReducer(
      initialDashboardState,
      fetchOperationalDashboard.rejected(new Error('Falha geral'), 'load-6'),
    );
    expect(state.machines.status).toBe('failed');
    expect(state.points.status).toBe('failed');
    expect(state.series.status).toBe('failed');
    expect(state.machines.error).toBe('Falha geral');
  });
});
