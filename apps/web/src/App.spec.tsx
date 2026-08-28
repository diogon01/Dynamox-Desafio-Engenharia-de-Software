import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { getToken, setToken } from './api/client';
import { createStore, type RootState } from './store';
import { theme } from './theme';

const USER = { id: 'u1', email: 'analista@dynamox.local', name: 'Analista' };

function renderApp(preloaded?: Partial<RootState>) {
  return render(
    <Provider store={createStore(preloaded)}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  setToken(null);
});

describe('App — autenticação e proteção de rotas', () => {
  it('sem sessão, acesso direto à rota privada cai no login', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: /Entrar/i })).toBeDefined();
    expect(screen.queryByRole('heading', { name: /Estado da API/i })).toBeNull();
  });

  it('reload em rota privada com token restaura a sessão via /auth/me com Bearer', async () => {
    setToken('jwt-valido');
    let meAuthorization: string | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/auth/me')) {
          meAuthorization = (init?.headers as Record<string, string>)?.Authorization ?? null;
          return new Response(JSON.stringify(USER), { status: 200 });
        }
        if (url.endsWith('/health'))
          return new Response(
            JSON.stringify({ status: 'ok', database: 'up', version: 'x', timestamp: 't' }),
            { status: 200 },
          );
        if (url.includes('/monitoring-points'))
          return new Response(
            JSON.stringify({
              items: [],
              total: 0,
              page: 1,
              pageSize: 5,
              sortBy: 'machineName',
              sortDir: 'asc',
            }),
            { status: 200 },
          );
        return new Response('[]', { status: 200 });
      }),
    );

    renderApp();

    expect(await screen.findByRole('heading', { name: /Estado da API/i })).toBeDefined();
    expect(await screen.findByText(USER.email)).toBeDefined();
    expect(meAuthorization).toBe('Bearer jwt-valido');
  });

  it('login pelo formulário → rota privada → logout → retorno bloqueado', async () => {
    // Sessão começa vazia: o fluxo inteiro passa pelo formulário, sem token pré-instalado.
    let loginCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/login')) {
          loginCalls += 1;
          return new Response(JSON.stringify({ token: 'jwt-do-form', user: USER }), {
            status: 200,
          });
        }
        if (url.endsWith('/health'))
          return new Response(
            JSON.stringify({ status: 'ok', database: 'up', version: 'x', timestamp: 't' }),
            { status: 200 },
          );
        if (url.includes('/monitoring-points'))
          return new Response(
            JSON.stringify({
              items: [],
              total: 0,
              page: 1,
              pageSize: 5,
              sortBy: 'machineName',
              sortDir: 'asc',
            }),
            { status: 200 },
          );
        return new Response('[]', { status: 200 });
      }),
    );

    renderApp();
    await screen.findByRole('heading', { name: /Entrar/i });

    await userEvent.type(screen.getByLabelText(/E-mail/i), USER.email);
    await userEvent.type(screen.getByLabelText(/Senha/i), 'Dynamox@2026');
    await userEvent.click(screen.getByRole('button', { name: /^Entrar$/i }));

    expect(await screen.findByRole('heading', { name: /Série temporal/i })).toBeDefined();
    expect(loginCalls).toBe(1);
    expect(getToken()).toBe('jwt-do-form');

    await userEvent.click(screen.getByRole('button', { name: /Sair/i }));

    // De volta ao login, token limpo, e a rota privada não renderiza mais.
    expect(await screen.findByRole('heading', { name: /Entrar/i })).toBeDefined();
    await waitFor(() => expect(getToken()).toBeNull());
    expect(screen.queryByRole('heading', { name: /Série temporal/i })).toBeNull();
  });

  it('formulário de login autentica contra a API e entra no painel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/login'))
          return new Response(JSON.stringify({ token: 'jwt-novo', user: USER }), { status: 200 });
        if (url.endsWith('/health'))
          return new Response(
            JSON.stringify({ status: 'ok', database: 'up', version: 'x', timestamp: 't' }),
            { status: 200 },
          );
        if (url.includes('/monitoring-points'))
          return new Response(
            JSON.stringify({
              items: [],
              total: 0,
              page: 1,
              pageSize: 5,
              sortBy: 'machineName',
              sortDir: 'asc',
            }),
            { status: 200 },
          );
        return new Response('[]', { status: 200 });
      }),
    );

    renderApp();
    await screen.findByRole('heading', { name: /Entrar/i });

    await userEvent.type(screen.getByLabelText(/E-mail/i), USER.email);
    await userEvent.type(screen.getByLabelText(/Senha/i), 'Dynamox@2026');
    await userEvent.click(screen.getByRole('button', { name: /^Entrar$/i }));

    expect(await screen.findByRole('heading', { name: /Estado da API/i })).toBeDefined();
    expect(getToken()).toBe('jwt-novo');
  });

  it('erro de credencial aparece no formulário', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ message: 'Credenciais inválidas.' }), { status: 401 }),
      ),
    );

    renderApp();
    await screen.findByRole('heading', { name: /Entrar/i });

    await userEvent.type(screen.getByLabelText(/E-mail/i), USER.email);
    await userEvent.type(screen.getByLabelText(/Senha/i), 'errada');
    await userEvent.click(screen.getByRole('button', { name: /^Entrar$/i }));

    expect(await screen.findByText(/Credenciais inválidas/i)).toBeDefined();
  });
});
