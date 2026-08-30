import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';

import { createStore, type AppStore, type RootState } from '../store';
import { theme } from '../theme';

interface ProviderRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
}

export function renderWithProviders(
  ui: ReactElement,
  { preloadedState, store = createStore(preloadedState), ...renderOptions }: ProviderRenderOptions = {},
): RenderResult & { store: AppStore } {
  function Providers({ children }: { children: ReactNode }): JSX.Element {
    return (
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Providers, ...renderOptions }) };
}
