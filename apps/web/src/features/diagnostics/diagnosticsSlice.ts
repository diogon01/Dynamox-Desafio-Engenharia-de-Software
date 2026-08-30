import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { api, type HealthStatus } from '../../api/client';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface DiagnosticsState {
  healthStatus: RequestStatus;
  health: HealthStatus | null;
  healthError: string | null;
}

export const initialState: DiagnosticsState = {
  healthStatus: 'idle',
  health: null,
  healthError: null,
};

export const fetchHealth = createAsyncThunk('diagnostics/fetchHealth', async () => api.health());

const diagnosticsSlice = createSlice({
  name: 'diagnostics',
  initialState,
  reducers: {},
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
      });
  },
});

export const diagnosticsReducer = diagnosticsSlice.reducer;
