import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { TimeSeriesSampleDto, TimeSeriesSummary } from '@dynamox/domain';

import { MIN_BASELINE_SAMPLES } from './dashboardAggregations';

import {
  api,
  type MachineDto,
  type MonitoringPointDto,
} from '../../api/client';
import type { RequestStatus } from '../../store/requestStatus';

/**
 * Períodos da tendência. `all` existe para que a tela NUNCA fique sem resposta quando o
 * histórico está fora da janela escolhida: o estado vazio oferece "ver período disponível"
 * em vez de só informar que não há dados.
 */
export type DashboardPeriod = '24h' | '7d' | '30d' | 'all';

export interface ResourceState<T> {
  status: RequestStatus;
  data: T;
  error: string | null;
}

export interface DashboardState {
  machines: ResourceState<MachineDto[]>;
  points: ResourceState<MonitoringPointDto[]>;
  series: ResourceState<TimeSeriesSummary[]>;
  /** Avaliação de condição (segunda etapa, fora do caminho crítico do primeiro render). */
  conditionStatus: RequestStatus;
  radialSamplesBySeries: Record<string, TimeSeriesSampleDto[]>;
  radialSampleErrors: Record<string, string>;
  period: DashboardPeriod;
  selectedSeriesId: string | null;
  /**
   * Quem escolheu a série exibida. Uma seleção automática pode ser substituída quando a
   * avaliação de condição chega e revela a exceção; a escolha da pessoa, não.
   */
  selectionSource: 'auto' | 'user';
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
  conditionStatus: 'idle',
  radialSamplesBySeries: {},
  radialSampleErrors: {},
  period: '7d',
  selectedSeriesId: null,
  selectionSource: 'auto',
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
  loadedAt: string;
}

export interface ConditionEvidencePayload {
  radialSamplesBySeries: Record<string, TimeSeriesSampleDto[]>;
  radialSampleErrors: Record<string, string>;
}

/**
 * Comparar condição com baseline exige DUAS janelas de aquisição; cada janela precisa do
 * mínimo de amostras que a agregação já define. A regra é derivada dali para que o filtro
 * de rede e o cálculo não possam divergir.
 */
const MIN_SAMPLES_FOR_BASELINE = 2 * MIN_BASELINE_SAMPLES;

/**
 * Séries que sustentam o índice demonstrativo: par radial Y/Z de sensores sintéticos com
 * histórico suficiente. Filtrar aqui é o que mantém a segunda etapa proporcional ao que
 * é realmente avaliável, em vez de varrer a planta inteira.
 */
export function radialSeriesForCondition(series: TimeSeriesSummary[]): TimeSeriesSummary[] {
  return series.filter(
    (item) =>
      item.sensorSerialNumber.startsWith('SIM-') &&
      item.physicalQuantity === 'acceleration' &&
      (item.axis === 'y' || item.axis === 'z') &&
      item.sampleCount >= MIN_SAMPLES_FOR_BASELINE,
  );
}

/**
 * PRIMEIRA ETAPA — inventário. Três requisições, independentes entre si: `allSettled`
 * mantém o painel utilizável quando uma delas falha.
 *
 * O resumo das séries já traz a última leitura de cada uma (valor e instante), então esta
 * etapa desenha a matriz inteira sem uma chamada por série — o padrão anterior custava
 * dezenas de requisições antes do primeiro render.
 */
export const fetchOperationalDashboard = createAsyncThunk(
  'dashboard/fetchOperationalDashboard',
  async (): Promise<OperationalDashboardPayload> => {
    const [machinesSettled, pointsSettled, seriesSettled] = await Promise.allSettled([
      api.machines(),
      api.allMonitoringPoints(),
      api.timeSeries(),
    ]);

    return {
      machines: fromSettled(machinesSettled, []),
      points: fromSettled(pointsSettled, []),
      series: fromSettled(seriesSettled, []),
      loadedAt: new Date().toISOString(),
    };
  },
);

/**
 * SEGUNDA ETAPA — condição. O índice demonstrativo compara duas aquisições radiais, o que
 * exige as amostras: é a única parte que não cabe no resumo. Roda depois do primeiro
 * render e só para as séries avaliáveis; a tela já está utilizável enquanto ela chega.
 */
export const fetchConditionEvidence = createAsyncThunk<
  ConditionEvidencePayload,
  void,
  { state: { dashboard: DashboardState } }
>('dashboard/fetchConditionEvidence', async (_, { getState }) => {
  const radialSeries = radialSeriesForCondition(getState().dashboard.series.data);
  const radialSamplesBySeries: Record<string, TimeSeriesSampleDto[]> = {};
  const radialSampleErrors: Record<string, string> = {};

  const settled = await Promise.allSettled(radialSeries.map((item) => api.allSamples(item.id)));
  settled.forEach((result, index) => {
    const id = radialSeries[index].id;
    if (result.status === 'fulfilled') radialSamplesBySeries[id] = result.value;
    else radialSampleErrors[id] = messageOf(result.reason);
  });

  return { radialSamplesBySeries, radialSampleErrors };
});

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
    /** Seleção automática: só troca enquanto a pessoa não escolheu nada. */
    dashboardSeriesAutoSelected(state, action: PayloadAction<string>) {
      if (state.selectionSource === 'user' || state.selectedSeriesId === action.payload) return;
      state.selectedSeriesId = action.payload;
      state.activeDetailRequestId = null;
      state.detailSamples = [];
      state.detailError = null;
      state.detailStatus = 'loading';
    },
    dashboardSeriesSelected(state, action: PayloadAction<string | null>) {
      state.selectionSource = 'user';
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
        state.conditionStatus = 'failed';
      })
      .addCase(fetchConditionEvidence.pending, (state) => {
        state.conditionStatus = 'loading';
      })
      .addCase(fetchConditionEvidence.fulfilled, (state, action) => {
        state.conditionStatus = 'succeeded';
        state.radialSamplesBySeries = action.payload.radialSamplesBySeries;
        state.radialSampleErrors = action.payload.radialSampleErrors;
      })
      .addCase(fetchConditionEvidence.rejected, (state) => {
        state.conditionStatus = 'failed';
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

export const { dashboardSeriesAutoSelected, dashboardSeriesSelected, periodChanged } =
  dashboardSlice.actions;
export const dashboardReducer = dashboardSlice.reducer;
