import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { SensorModel } from '@dynamox/domain';

import {
  api,
  type MonitoringPointPageDto,
  type MonitoringPointSortColumn,
} from '../../api/client';
import type { RequestStatus } from '../machines/machinesSlice';

export interface MonitoringPointsState {
  /** Página corrente devolvida pela API; a paginação e a ordenação são do servidor. */
  pageData: MonitoringPointPageDto | null;
  page: number;
  sortBy: MonitoringPointSortColumn;
  sortDir: 'asc' | 'desc';
  listStatus: RequestStatus;
  listError: string | null;
  createStatus: RequestStatus;
  createError: string | null;
  assignStatus: RequestStatus;
  assignError: string | null;
}

export const initialMonitoringPointsState: MonitoringPointsState = {
  pageData: null,
  page: 1,
  sortBy: 'machineName',
  sortDir: 'asc',
  listStatus: 'idle',
  listError: null,
  createStatus: 'idle',
  createError: null,
  assignStatus: 'idle',
  assignError: null,
};

/** Busca a página corrente usando page/sort do próprio estado (fonte única). */
export const fetchMonitoringPoints = createAsyncThunk(
  'monitoringPoints/fetch',
  async (_: void, { getState }) => {
    const { monitoringPoints } = getState() as { monitoringPoints: MonitoringPointsState };
    return api.monitoringPoints({
      page: monitoringPoints.page,
      sortBy: monitoringPoints.sortBy,
      sortDir: monitoringPoints.sortDir,
    });
  },
);

export const createMonitoringPoint = createAsyncThunk(
  'monitoringPoints/create',
  async (input: { machineId: string; name: string }, { dispatch }) => {
    const created = await api.createMonitoringPoint(input.machineId, input.name);
    // Paginação é do servidor: a lista local não sabe em que página o novo ponto cai.
    await dispatch(fetchMonitoringPoints());
    return created;
  },
);

export const assignSensor = createAsyncThunk(
  'monitoringPoints/assignSensor',
  async (
    input: { pointId: string; serialNumber: string; model: SensorModel },
    { dispatch },
  ) => {
    const updated = await api.assignSensor(input.pointId, input.serialNumber, input.model);
    await dispatch(fetchMonitoringPoints());
    return updated;
  },
);

const monitoringPointsSlice = createSlice({
  name: 'monitoringPoints',
  initialState: initialMonitoringPointsState,
  reducers: {
    pageChanged(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    /** Clicar na coluna já ordenada inverte a direção; noutra coluna, recomeça em asc. */
    sortChanged(state, action: PayloadAction<MonitoringPointSortColumn>) {
      if (state.sortBy === action.payload) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = action.payload;
        state.sortDir = 'asc';
      }
      state.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMonitoringPoints.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchMonitoringPoints.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.pageData = action.payload;
        // A última página pode desaparecer (ex.: total caiu): recua para a anterior.
        const lastPage = Math.max(1, Math.ceil(action.payload.total / action.payload.pageSize));
        if (action.payload.items.length === 0 && state.page > lastPage) {
          state.page = lastPage;
        }
      })
      .addCase(fetchMonitoringPoints.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.error.message ?? 'Não foi possível carregar os pontos.';
      })

      .addCase(createMonitoringPoint.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createMonitoringPoint.fulfilled, (state) => {
        state.createStatus = 'succeeded';
      })
      .addCase(createMonitoringPoint.rejected, (state, action) => {
        // A página carregada é preservada: falhar ao criar não pode esvaziar a tabela.
        state.createStatus = 'failed';
        state.createError = action.error.message ?? 'Não foi possível criar o ponto.';
      })

      .addCase(assignSensor.pending, (state) => {
        state.assignStatus = 'loading';
        state.assignError = null;
      })
      .addCase(assignSensor.fulfilled, (state) => {
        state.assignStatus = 'succeeded';
      })
      .addCase(assignSensor.rejected, (state, action) => {
        state.assignStatus = 'failed';
        state.assignError = action.error.message ?? 'Não foi possível associar o sensor.';
      });
  },
});

export const { pageChanged, sortChanged } = monitoringPointsSlice.actions;
export const monitoringPointsReducer = monitoringPointsSlice.reducer;
