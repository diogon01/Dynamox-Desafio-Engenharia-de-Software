import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

import { diagnosticsReducer } from '../features/diagnostics/diagnosticsSlice';

export function createStore() {
  return configureStore({
    reducer: {
      diagnostics: diagnosticsReducer,
    },
  });
}

export const store = createStore();

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
