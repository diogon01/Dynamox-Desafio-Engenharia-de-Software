import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { MachineType } from '@dynamox/domain';

import { api, type MachineDto } from '../../api/client';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface MachinesState {
  items: MachineDto[];
  listStatus: RequestStatus;
  listError: string | null;
  createStatus: RequestStatus;
  createError: string | null;
}

export const initialMachinesState: MachinesState = {
  items: [],
  listStatus: 'idle',
  listError: null,
  createStatus: 'idle',
  createError: null,
};

/** Mesma ordenação da API (por nome), para a lista local não divergir do servidor. */
const byName = (a: MachineDto, b: MachineDto): number => a.name.localeCompare(b.name, 'pt-BR');

export const fetchMachines = createAsyncThunk('machines/fetch', async () => api.machines());

export const createMachine = createAsyncThunk(
  'machines/create',
  async (input: { name: string; type: MachineType }) =>
    api.createMachine(input.name, input.type),
);

const machinesSlice = createSlice({
  name: 'machines',
  initialState: initialMachinesState,
  reducers: {
    createErrorDismissed(state) {
      state.createError = null;
      if (state.createStatus === 'failed') state.createStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMachines.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchMachines.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.items = [...action.payload].sort(byName);
      })
      .addCase(fetchMachines.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.error.message ?? 'Não foi possível carregar as máquinas.';
      })

      .addCase(createMachine.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createMachine.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.createError = null;
        // Nada de item otimista: só entra na lista o registro devolvido pela API.
        state.items = [...state.items, action.payload].sort(byName);
      })
      .addCase(createMachine.rejected, (state, action) => {
        // A lista já carregada é preservada: falhar ao cadastrar não pode esvaziar a tela.
        state.createStatus = 'failed';
        state.createError = action.error.message ?? 'Não foi possível cadastrar a máquina.';
      });
  },
});

export const { createErrorDismissed } = machinesSlice.actions;
export const machinesReducer = machinesSlice.reducer;
