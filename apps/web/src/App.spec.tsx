import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { createStore } from './store';
import { theme } from './theme';

function renderApp() {
  return render(
    <Provider store={createStore()}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </Provider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renderiza o cabeçalho e os painéis de diagnóstico', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    );

    renderApp();

    expect(
      await screen.findByRole('heading', { name: /Monitoramento de Ativos/i }),
    ).toBeDefined();
    expect(await screen.findByRole('heading', { name: /Estado da API/i })).toBeDefined();
    expect(await screen.findByRole('heading', { name: /Série temporal/i })).toBeDefined();
  });

  it('mostra o estado de erro quando a API local não responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('conexão recusada');
      }),
    );

    renderApp();

    expect(await screen.findAllByText(/conexão recusada/i)).not.toHaveLength(0);
  });
});
