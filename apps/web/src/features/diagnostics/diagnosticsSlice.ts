import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { SeriesMetrics, TimeSeriesSampleDto, TimeSeriesSummary } from '@dynamox/domain';

import { api, type HealthStatus } from '../../api/client';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface DiagnosticsState {
  healthStatus: RequestStatus;
  health: HealthStatus | null;
  healthError: string | null;

  seriesStatus: RequestStatus;
  series: TimeSeriesSummary[];
  seriesError: string | null;

  selectedSeriesId: string | null;
  detailStatus: RequestStatus;
  samples: TimeSeriesSampleDto[];
  metrics: SeriesMetrics | null;
  detailError: string | null;
  /**
   * Identifica a requisição de detalhe em voo. Sem isso, a resposta atrasada de uma
   * série antiga sobrescreveria os dados da série que o usuário acabou de escolher.
   */
  activeDetailRequestId: string | null;
}

export const initialState: DiagnosticsState = {
  healthStatus: 'idle',
  health: null,
  healthError: null,

  seriesStatus: 'idle',
  series: [],
  seriesError: null,

  selectedSeriesId: null,
  detailStatus: 'idle',
  samples: [],
  metrics: null,
  detailError: null,
  activeDetailRequestId: null,
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

/**
 * Uma resposta só é aceita se pertencer à requisição em voo e à série ainda selecionada.
 * Assim, a resposta tardia da série A é descartada em vez de substituir a série B.
 */
function isCurrentDetailRequest(
  state: DiagnosticsState,
  requestId: string,
  seriesId: string,
): boolean {
  return state.activeDetailRequestId === requestId && state.selectedSeriesId === seriesId;
}

export const fetchHealth = createAsyncThunk('diagnostics/fetchHealth', async () => api.health());

export const fetchTimeSeries = createAsyncThunk('diagnostics/fetchTimeSeries', async () =>
  api.timeSeries(),
);

export const fetchSeriesDetail = createAsyncThunk(
  'diagnostics/fetchSeriesDetail',
  async (seriesId: string) => {
    const [samplesPage, metrics] = await Promise.all([
      api.samples(seriesId),
      api.metrics(seriesId),
    ]);
    return { seriesId, samples: samplesPage.items, metrics };
  },
);

const diagnosticsSlice = createSlice({
  name: 'diagnostics',
  initialState,
  reducers: {
    seriesSelected(state, action: PayloadAction<string>) {
      if (state.selectedSeriesId === action.payload) {
        return;
      }
      state.selectedSeriesId = action.payload;
      // A troca invalida qualquer detalhe em voo e os dados da série anterior.
      state.activeDetailRequestId = null;
      state.detailStatus = 'loading';
      state.samples = [];
      state.metrics = null;
      state.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHealth.pending, (state) => {
        state.healthStatus = 'loading';
        state.healthError = null;
      })
      .addCase(fetchHealth.fulfilled, (state, action) => {
        state.healthStatus = 'succeeded';
        state.health = action.payload;
      })
      .addCase(fetchHealth.rejected, (state, action) => {
        state.healthStatus = 'failed';
        state.health = null;
        state.healthError = action.error.message ?? 'Erro desconhecido';
      })

      .addCase(fetchTimeSeries.pending, (state) => {
        state.seriesStatus = 'loading';
        state.seriesError = null;
      })
      .addCase(fetchTimeSeries.fulfilled, (state, action) => {
        state.seriesStatus = 'succeeded';
        state.series = action.payload;

        // A seleção só sobrevive se a série ainda existir na lista recarregada;
        // caso contrário o estado apontaria para uma entidade ausente.
        const stillExists =
          state.selectedSeriesId !== null &&
          action.payload.some((item) => item.id === state.selectedSeriesId);

        if (!stillExists) {
          state.selectedSeriesId = action.payload[0]?.id ?? null;
          state.activeDetailRequestId = null;
          state.samples = [];
          state.metrics = null;
          state.detailError = null;
          state.detailStatus = state.selectedSeriesId ? 'loading' : 'idle';
        }
      })
      .addCase(fetchTimeSeries.rejected, (state, action) => {
        state.seriesStatus = 'failed';
        state.series = [];
        state.seriesError = action.error.message ?? 'Erro desconhecido';
      })

      .addCase(fetchSeriesDetail.pending, (state, action) => {
        state.activeDetailRequestId = action.meta.requestId;
        state.detailStatus = 'loading';
        state.detailError = null;
      })
      .addCase(fetchSeriesDetail.fulfilled, (state, action) => {
        if (!isCurrentDetailRequest(state, action.meta.requestId, action.payload.seriesId)) {
          return;
        }
        state.detailStatus = 'succeeded';
        state.samples = action.payload.samples;
        state.metrics = action.payload.metrics;
      })
      .addCase(fetchSeriesDetail.rejected, (state, action) => {
        if (!isCurrentDetailRequest(state, action.meta.requestId, action.meta.arg)) {
          return;
        }
        state.detailStatus = 'failed';
        state.samples = [];
        state.metrics = null;
        state.detailError = action.error.message ?? 'Erro desconhecido';
      });
  },
});

export const { seriesSelected } = diagnosticsSlice.actions;
export const diagnosticsReducer = diagnosticsSlice.reducer;
export { messageOf };
