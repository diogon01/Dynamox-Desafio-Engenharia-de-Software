import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

import { authReducer } from '../features/auth/authSlice';
import { diagnosticsReducer } from '../features/diagnostics/diagnosticsSlice';

const rootReducer = {
  auth: authReducer,
  diagnostics: diagnosticsReducer,
};

export function createStore(preloadedState?: Partial<RootState>) {
  const store = configureStore({ reducer: rootReducer });
  if (preloadedState) {
    return configureStore({
      reducer: rootReducer,
      preloadedState: { ...store.getState(), ...preloadedState },
    });
  }
  return store;
}

export const store = createStore();

export type AppStore = ReturnType<typeof createStore>;
export type RootState = {
  [K in keyof typeof rootReducer]: ReturnType<(typeof rootReducer)[K]>;
};
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
