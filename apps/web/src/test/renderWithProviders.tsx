import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';

import type { UserRole } from '@dynamox/domain';

import { initialAuthState } from '../features/auth/authSlice';
import { createStore, type AppStore, type RootState } from '../store';
import { theme } from '../theme';

interface ProviderRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
  /**
   * Perfil da sessão simulada. Telas privadas só são alcançadas por quem está autenticado,
   * então o padrão é uma sessão ADMIN; passar 'VIEWER' exercita o modo somente leitura.
   */
  role?: UserRole;
}

function authStateFor(role: UserRole): RootState['auth'] {
  return {
    ...initialAuthState,
    status: 'authenticated',
    user: { id: 'test-user', email: 'teste@dynamox.local', name: 'Teste', role },
  };
}

export function renderWithProviders(
  ui: ReactElement,
  { preloadedState, role = 'ADMIN', store, ...renderOptions }: ProviderRenderOptions = {},
): RenderResult & { store: AppStore } {
  // Um estado de auth explícito no preloadedState tem precedência: é assim que os testes
  // do fluxo de login partem de uma sessão ausente.
  const resolvedStore =
    store ?? createStore({ auth: authStateFor(role), ...preloadedState });
  function Providers({ children }: { children: ReactNode }): JSX.Element {
    return (
      <Provider store={resolvedStore}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </Provider>
    );
  }

  return { store: resolvedStore, ...render(ui, { wrapper: Providers, ...renderOptions }) };
}
