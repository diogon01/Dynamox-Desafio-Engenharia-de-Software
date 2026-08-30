import { describe, expect, it } from 'vitest';

import type { TimeSeriesSummary } from '@dynamox/domain';

import {
  dashboardReducer,
  dashboardSeriesSelected,
  fetchDashboardSeriesDetail,
  fetchOperationalDashboard,
  initialDashboardState,
  periodChanged,
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
};

const ySeries: TimeSeriesSummary = { ...xSeries, id: 'series-y', axis: 'y' };

function payload(overrides: Partial<OperationalDashboardPayload> = {}): OperationalDashboardPayload {
  return {
    machines: { data: [], error: null },
    points: { data: [], error: null },
    series: { data: [xSeries, ySeries], error: null },
    metricsBySeries: {},
    metricErrors: {},
    radialSamplesBySeries: {},
    radialSampleErrors: {},
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

  it('marca inventário e métricas como loading no carregamento inicial', () => {
    const state = dashboardReducer(
      initialDashboardState,
      fetchOperationalDashboard.pending('load-1'),
    );
    expect(state.machines.status).toBe('loading');
    expect(state.points.status).toBe('loading');
    expect(state.series.status).toBe('loading');
    expect(state.metricsStatus).toBe('loading');
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

  it('preserva erros granulares de métricas e amostras radiais', () => {
    const state = dashboardReducer(
      initialDashboardState,
      fetchOperationalDashboard.fulfilled(
        payload({
          metricErrors: { 'series-x': 'sem métrica' },
          radialSampleErrors: { 'series-y': 'sem amostras' },
        }),
        'load-5',
      ),
    );
    expect(state.metricErrors).toEqual({ 'series-x': 'sem métrica' });
    expect(state.radialSampleErrors).toEqual({ 'series-y': 'sem amostras' });
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
