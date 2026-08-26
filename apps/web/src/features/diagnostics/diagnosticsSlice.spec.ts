import { describe, expect, it } from 'vitest';

import type { TimeSeriesSummary } from '@dynamox/domain';

import {
  diagnosticsReducer,
  fetchHealth,
  fetchSeriesDetail,
  fetchTimeSeries,
  initialState,
  seriesSelected,
} from './diagnosticsSlice';

const summary: TimeSeriesSummary = {
  id: 'series-1',
  sensorSerialNumber: 'SIM-HF-001',
  sensorModel: 'HF+',
  machineName: 'P-101',
  machineType: 'Pump',
  monitoringPointName: 'Mancal lado acoplamento',
  physicalQuantity: 'acceleration',
  axis: 'y',
  unit: 'g',
  displayName: null,
  sampleCount: 30,
};

describe('diagnosticsSlice', () => {
  it('marca carregamento e sucesso do health check', () => {
    const loading = diagnosticsReducer(initialState, fetchHealth.pending('req-1'));
    expect(loading.healthStatus).toBe('loading');

    const succeeded = diagnosticsReducer(
      loading,
      fetchHealth.fulfilled(
        { status: 'ok', database: 'up', version: '0.1.0', timestamp: '2026-08-26T12:00:00.000Z' },
        'req-1',
        undefined,
      ),
    );

    expect(succeeded.healthStatus).toBe('succeeded');
    expect(succeeded.health?.database).toBe('up');
  });

  it('guarda a mensagem de erro quando o health check falha', () => {
    const failed = diagnosticsReducer(
      initialState,
      fetchHealth.rejected(new Error('API fora do ar'), 'req-1'),
    );

    expect(failed.healthStatus).toBe('failed');
    expect(failed.healthError).toBe('API fora do ar');
    expect(failed.health).toBeNull();
  });

  it('seleciona automaticamente a primeira série carregada', () => {
    const state = diagnosticsReducer(
      initialState,
      fetchTimeSeries.fulfilled([summary], 'req-2', undefined),
    );

    expect(state.seriesStatus).toBe('succeeded');
    expect(state.selectedSeriesId).toBe('series-1');
  });

  it('mantém a seleção do usuário quando a série ainda existe na lista', () => {
    const withSelection = diagnosticsReducer(initialState, seriesSelected('series-1'));
    const state = diagnosticsReducer(
      withSelection,
      fetchTimeSeries.fulfilled([summary], 'req-3', undefined),
    );

    expect(state.selectedSeriesId).toBe('series-1');
  });

  it('descarta a seleção que sumiu da lista recarregada', () => {
    const withSelection = diagnosticsReducer(initialState, seriesSelected('series-removida'));
    const state = diagnosticsReducer(
      withSelection,
      fetchTimeSeries.fulfilled([summary], 'req-3b', undefined),
    );

    expect(state.selectedSeriesId).toBe('series-1');
    expect(state.samples).toHaveLength(0);
    expect(state.metrics).toBeNull();
  });

  it('representa o estado vazio quando não há séries', () => {
    const state = diagnosticsReducer(initialState, fetchTimeSeries.fulfilled([], 'req-4', undefined));

    expect(state.series).toHaveLength(0);
    expect(state.selectedSeriesId).toBeNull();
  });

  it('armazena amostras e métricas da série selecionada', () => {
    const detail = {
      seriesId: 'series-1',
      samples: [{ timestamp: '2026-08-26T12:00:00.000Z', value: 0.02 }],
      metrics: {
        count: 1,
        min: 0.02,
        max: 0.02,
        avg: 0.02,
        last: 0.02,
        firstTimestamp: '2026-08-26T12:00:00.000Z',
        lastTimestamp: '2026-08-26T12:00:00.000Z',
      },
    };

    // A resposta só é aceita como parte do ciclo completo: seleção, requisição em voo e
    // então a conclusão daquela requisição.
    let state = diagnosticsReducer(initialState, seriesSelected('series-1'));
    state = diagnosticsReducer(state, fetchSeriesDetail.pending('req-5', 'series-1'));
    state = diagnosticsReducer(state, fetchSeriesDetail.fulfilled(detail, 'req-5', 'series-1'));

    expect(state.detailStatus).toBe('succeeded');
    expect(state.samples).toHaveLength(1);
    expect(state.metrics?.count).toBe(1);
  });

  it('ignora uma resposta de detalhe que não pertence a nenhuma requisição em voo', () => {
    const state = diagnosticsReducer(
      initialState,
      fetchSeriesDetail.fulfilled(
        {
          seriesId: 'series-1',
          samples: [{ timestamp: '2026-08-26T12:00:00.000Z', value: 0.02 }],
          metrics: {
            count: 1,
            min: 0.02,
            max: 0.02,
            avg: 0.02,
            last: 0.02,
            firstTimestamp: '2026-08-26T12:00:00.000Z',
            lastTimestamp: '2026-08-26T12:00:00.000Z',
          },
        },
        'req-orfa',
        'series-1',
      ),
    );

    expect(state.detailStatus).toBe('idle');
    expect(state.samples).toHaveLength(0);
  });
});

describe('corrida entre requisições de detalhe', () => {
  const metricsOf = (value: number) => ({
    count: 1,
    min: value,
    max: value,
    avg: value,
    last: value,
    firstTimestamp: '2026-08-26T12:00:00.000Z',
    lastTimestamp: '2026-08-26T12:00:00.000Z',
  });

  function detailFulfilled(seriesId: string, requestId: string, value: number) {
    return fetchSeriesDetail.fulfilled(
      {
        seriesId,
        samples: [{ timestamp: '2026-08-26T12:00:00.000Z', value }],
        metrics: metricsOf(value),
      },
      requestId,
      seriesId,
    );
  }

  it('ignora a resposta tardia da série A depois que B foi selecionada', () => {
    // A é selecionada e sua requisição parte.
    let state = diagnosticsReducer(initialState, seriesSelected('series-A'));
    state = diagnosticsReducer(state, fetchSeriesDetail.pending('req-A', 'series-A'));

    // O usuário troca para B antes de A responder; a requisição de B também parte.
    state = diagnosticsReducer(state, seriesSelected('series-B'));
    state = diagnosticsReducer(state, fetchSeriesDetail.pending('req-B', 'series-B'));

    // B responde primeiro e depois chega a resposta atrasada de A.
    state = diagnosticsReducer(state, detailFulfilled('series-B', 'req-B', 0.2));
    state = diagnosticsReducer(state, detailFulfilled('series-A', 'req-A', 0.9));

    expect(state.selectedSeriesId).toBe('series-B');
    expect(state.samples).toHaveLength(1);
    expect(state.samples[0].value).toBe(0.2);
    expect(state.metrics?.last).toBe(0.2);
  });

  it('ignora a falha tardia da série A e preserva os dados de B', () => {
    let state = diagnosticsReducer(initialState, seriesSelected('series-A'));
    state = diagnosticsReducer(state, fetchSeriesDetail.pending('req-A', 'series-A'));
    state = diagnosticsReducer(state, seriesSelected('series-B'));
    state = diagnosticsReducer(state, fetchSeriesDetail.pending('req-B', 'series-B'));
    state = diagnosticsReducer(state, detailFulfilled('series-B', 'req-B', 0.2));

    state = diagnosticsReducer(
      state,
      fetchSeriesDetail.rejected(new Error('timeout em A'), 'req-A', 'series-A'),
    );

    expect(state.detailStatus).toBe('succeeded');
    expect(state.detailError).toBeNull();
    expect(state.samples[0].value).toBe(0.2);
  });

  it('limpa os dados anteriores ao trocar de série', () => {
    let state = diagnosticsReducer(initialState, seriesSelected('series-A'));
    state = diagnosticsReducer(state, fetchSeriesDetail.pending('req-A', 'series-A'));
    state = diagnosticsReducer(state, detailFulfilled('series-A', 'req-A', 0.9));

    state = diagnosticsReducer(state, seriesSelected('series-B'));

    expect(state.samples).toHaveLength(0);
    expect(state.metrics).toBeNull();
    expect(state.detailStatus).toBe('loading');
  });
});
