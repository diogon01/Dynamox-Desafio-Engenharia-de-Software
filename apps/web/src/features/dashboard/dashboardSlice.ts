import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  SeriesMetrics,
  TimeSeriesSampleDto,
  TimeSeriesSummary,
} from '@dynamox/domain';

import {
  api,
  type MachineDto,
  type MonitoringPointDto,
} from '../../api/client';
import type { RequestStatus } from '../../store/requestStatus';

export type DashboardPeriod = '24h' | '7d' | '30d';

export interface ResourceState<T> {
  status: RequestStatus;
  data: T;
  error: string | null;
}

export interface DashboardState {
  machines: ResourceState<MachineDto[]>;
  points: ResourceState<MonitoringPointDto[]>;
  series: ResourceState<TimeSeriesSummary[]>;
  metricsStatus: RequestStatus;
  metricsBySeries: Record<string, SeriesMetrics>;
  metricErrors: Record<string, string>;
  radialSamplesBySeries: Record<string, TimeSeriesSampleDto[]>;
  radialSampleErrors: Record<string, string>;
  period: DashboardPeriod;
  selectedSeriesId: string | null;
  detailStatus: RequestStatus;
  detailSamples: TimeSeriesSampleDto[];
  detailError: string | null;
  activeDetailRequestId: string | null;
  loadedAt: string | null;
}

const emptyResource = <T,>(data: T): ResourceState<T> => ({
  status: 'idle',
  data,
  error: null,
});

export const initialDashboardState: DashboardState = {
  machines: emptyResource([]),
  points: emptyResource([]),
  series: emptyResource([]),
  metricsStatus: 'idle',
  metricsBySeries: {},
  metricErrors: {},
  radialSamplesBySeries: {},
  radialSampleErrors: {},
  period: '7d',
  selectedSeriesId: null,
  detailStatus: 'idle',
  detailSamples: [],
  detailError: null,
  activeDetailRequestId: null,
  loadedAt: null,
};

interface ResourceResult<T> {
  data: T;
  error: string | null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido.';
}

function fromSettled<T>(result: PromiseSettledResult<T>, fallback: T): ResourceResult<T> {
  return result.status === 'fulfilled'
    ? { data: result.value, error: null }
    : { data: fallback, error: messageOf(result.reason) };
}

export interface OperationalDashboardPayload {
  machines: ResourceResult<MachineDto[]>;
  points: ResourceResult<MonitoringPointDto[]>;
  series: ResourceResult<TimeSeriesSummary[]>;
  metricsBySeries: Record<string, SeriesMetrics>;
  metricErrors: Record<string, string>;
  radialSamplesBySeries: Record<string, TimeSeriesSampleDto[]>;
  radialSampleErrors: Record<string, string>;
  loadedAt: string;
}

/**
 * As três fontes de inventário são independentes. Promise.allSettled mantém o painel
 * utilizável quando, por exemplo, as séries falham mas máquinas/pontos respondem.
 */
export const fetchOperationalDashboard = createAsyncThunk(
  'dashboard/fetchOperationalDashboard',
  async (): Promise<OperationalDashboardPayload> => {
    const [machinesSettled, pointsSettled, seriesSettled] = await Promise.allSettled([
      api.machines(),
      api.allMonitoringPoints(),
      api.timeSeries(),
    ]);

    const machines = fromSettled(machinesSettled, []);
    const points = fromSettled(pointsSettled, []);
    const series = fromSettled(seriesSettled, []);
    const metricsBySeries: Record<string, SeriesMetrics> = {};
    const metricErrors: Record<string, string> = {};
    const radialSamplesBySeries: Record<string, TimeSeriesSampleDto[]> = {};
    const radialSampleErrors: Record<string, string> = {};

    if (!series.error) {
      const metrics = await Promise.allSettled(series.data.map((item) => api.metrics(item.id)));
      metrics.forEach((result, index) => {
        const id = series.data[index].id;
        if (result.status === 'fulfilled') metricsBySeries[id] = result.value;
        else metricErrors[id] = messageOf(result.reason);
      });

      // O baseline didático só é calculável para sensores sintéticos com eixos Y/Z.
      const radialSeries = series.data.filter(
        (item) =>
          item.sensorSerialNumber.startsWith('SIM-') &&
          item.physicalQuantity === 'acceleration' &&
          (item.axis === 'y' || item.axis === 'z'),
      );
      const samples = await Promise.allSettled(
        radialSeries.map((item) => api.allSamples(item.id)),
      );
      samples.forEach((result, index) => {
        const id = radialSeries[index].id;
        if (result.status === 'fulfilled') radialSamplesBySeries[id] = result.value;
        else radialSampleErrors[id] = messageOf(result.reason);
      });
    }

    return {
      machines,
      points,
      series,
      metricsBySeries,
      metricErrors,
      radialSamplesBySeries,
      radialSampleErrors,
      loadedAt: new Date().toISOString(),
    };
  },
);

export const fetchDashboardSeriesDetail = createAsyncThunk<
  { seriesId: string; samples: TimeSeriesSampleDto[] },
  string,
  { state: { dashboard: DashboardState } }
>(
  'dashboard/fetchSeriesDetail',
  async (seriesId: string, { getState }) => {
    const state = getState();
    const cached = state.dashboard.radialSamplesBySeries[seriesId];
    const samples = cached ?? (await api.allSamples(seriesId));
    return { seriesId, samples };
  },
);

function preferredSeries(series: TimeSeriesSummary[]): string | null {
  return (
    series.find(
      (item) =>
        item.sampleCount > 0 && item.physicalQuantity === 'acceleration' && item.axis === 'y',
    ) ??
    series.find((item) => item.sampleCount > 0) ??
    series[0] ??
    null
  )?.id ?? null;
}

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: initialDashboardState,
  reducers: {
    periodChanged(state, action: PayloadAction<DashboardPeriod>) {
      state.period = action.payload;
    },
    dashboardSeriesSelected(state, action: PayloadAction<string | null>) {
      if (state.selectedSeriesId === action.payload) return;
      state.selectedSeriesId = action.payload;
      state.activeDetailRequestId = null;
      state.detailSamples = [];
      state.detailError = null;
      state.detailStatus = action.payload ? 'loading' : 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOperationalDashboard.pending, (state) => {
        for (const resource of [state.machines, state.points, state.series]) {
          resource.status = 'loading';
          resource.error = null;
        }
        state.metricsStatus = 'loading';
      })
      .addCase(fetchOperationalDashboard.fulfilled, (state, action) => {
        const apply = <T,>(target: ResourceState<T>, result: ResourceResult<T>) => {
          target.status = result.error ? 'failed' : 'succeeded';
          target.data = result.data;
          target.error = result.error;
        };
        apply(state.machines, action.payload.machines);
        apply(state.points, action.payload.points);
        apply(state.series, action.payload.series);
        state.metricsStatus = action.payload.series.error ? 'failed' : 'succeeded';
        state.metricsBySeries = action.payload.metricsBySeries;
        state.metricErrors = action.payload.metricErrors;
        state.radialSamplesBySeries = action.payload.radialSamplesBySeries;
        state.radialSampleErrors = action.payload.radialSampleErrors;
        state.loadedAt = action.payload.loadedAt;

        const selectionStillExists = action.payload.series.data.some(
          (item) => item.id === state.selectedSeriesId,
        );
        if (!selectionStillExists) {
          state.selectedSeriesId = preferredSeries(action.payload.series.data);
          state.detailSamples = [];
          state.detailError = null;
          state.detailStatus = state.selectedSeriesId ? 'loading' : 'idle';
          state.activeDetailRequestId = null;
        }
      })
      .addCase(fetchOperationalDashboard.rejected, (state, action) => {
        const message = action.error.message ?? 'Não foi possível carregar o dashboard.';
        for (const resource of [state.machines, state.points, state.series]) {
          resource.status = 'failed';
          resource.error = message;
        }
        state.metricsStatus = 'failed';
      })
      .addCase(fetchDashboardSeriesDetail.pending, (state, action) => {
        state.activeDetailRequestId = action.meta.requestId;
        state.detailStatus = 'loading';
        state.detailError = null;
      })
      .addCase(fetchDashboardSeriesDetail.fulfilled, (state, action) => {
        if (
          state.activeDetailRequestId !== action.meta.requestId ||
          state.selectedSeriesId !== action.payload.seriesId
        ) {
          return;
        }
        state.detailStatus = 'succeeded';
        state.detailSamples = action.payload.samples;
      })
      .addCase(fetchDashboardSeriesDetail.rejected, (state, action) => {
        if (
          state.activeDetailRequestId !== action.meta.requestId ||
          state.selectedSeriesId !== action.meta.arg
        ) {
          return;
        }
        state.detailStatus = 'failed';
        state.detailSamples = [];
        state.detailError = action.error.message ?? 'Não foi possível carregar as amostras.';
      });
  },
});

export const { dashboardSeriesSelected, periodChanged } = dashboardSlice.actions;
export const dashboardReducer = dashboardSlice.reducer;
