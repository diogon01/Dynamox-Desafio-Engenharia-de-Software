import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MachinesPanel } from './MachinesPanel';
import { setToken } from '../api/client';
import { createStore } from '../store';
import { theme } from '../theme';

const P101 = {
  id: '1',
  name: 'P-101',
  type: 'Pump' as const,
  createdAt: '2026-08-27T12:00:00.000Z',
  updatedAt: '2026-08-27T12:00:00.000Z',
};

function renderPanel() {
  return render(
    <Provider store={createStore()}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MachinesPanel />
      </ThemeProvider>
    </Provider>,
  );
}

/** Deferred permite manter o POST pendente e observar o estado de envio. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setToken(null);
});

describe('MachinesPanel', () => {
  it('1. mostra carregamento enquanto a lista não chega', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise),
    );

    renderPanel();

    expect(await screen.findByText(/Carregando máquinas/i)).toBeDefined();
    pending.resolve(new Response('[]', { status: 200 }));
  });

  it('2. mostra o estado vazio quando não há máquinas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    );

    renderPanel();

    expect(await screen.findByText(/Nenhuma máquina cadastrada/i)).toBeDefined();
  });

  it('3. renderiza as máquinas retornadas pela API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([P101, { ...P101, id: '2', name: 'V-200', type: 'Fan' }]),
            { status: 200 },
          ),
      ),
    );

    renderPanel();

    const table = await screen.findByRole('table', { name: /Máquinas cadastradas/i });
    expect(within(table).getByText('P-101')).toBeDefined();
    expect(within(table).getByText('V-200')).toBeDefined();
    expect(within(table).getByText('Fan')).toBeDefined();
  });

  it('4. não envia com nome vazio e mostra validação', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();
    await screen.findByText(/Nenhuma máquina cadastrada/i);
    const callsAfterList = fetchMock.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: /Cadastrar máquina/i }));

    expect(await screen.findByText(/Informe o nome da máquina/i)).toBeDefined();
    // Nenhuma requisição adicional: o POST não chegou a sair.
    expect(fetchMock.mock.calls).toHaveLength(callsAfterList);
  });

  it('5. permite escolher entre Pump e Fan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    );

    renderPanel();
    await screen.findByText(/Nenhuma máquina cadastrada/i);

    await userEvent.click(screen.getByRole('combobox', { name: /Tipo/i }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Pump', 'Fan']);

    await userEvent.click(screen.getByRole('option', { name: 'Fan' }));
    expect(screen.getByRole('combobox', { name: /Tipo/i }).textContent).toBe('Fan');
  });

  it('6 e 7. cadastro bem-sucedido adiciona à lista e limpa o formulário', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ ...P101, id: '9', name: 'P-102' }), {
            status: 201,
          });
        }
        return new Response('[]', { status: 200 });
      }),
    );

    renderPanel();
    await screen.findByText(/Nenhuma máquina cadastrada/i);

    const nameField = screen.getByRole('textbox', { name: 'Nome' });
    await userEvent.type(nameField, 'P-102');
    await userEvent.click(screen.getByRole('button', { name: /Cadastrar máquina/i }));

    const table = await screen.findByRole('table', { name: /Máquinas cadastradas/i });
    expect(within(table).getByText('P-102')).toBeDefined();
    // Formulário limpo somente após o sucesso.
    await waitFor(() => expect((nameField as HTMLInputElement).value).toBe(''));
  });

  it('8 e 9. erro de nome duplicado fica visível e preserva o que foi digitado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              code: 'MACHINE_NAME_CONFLICT',
              message: 'Já existe uma máquina com o nome "P-101".',
            }),
            { status: 409 },
          );
        }
        return new Response(JSON.stringify([P101]), { status: 200 });
      }),
    );

    renderPanel();
    await screen.findByRole('table', { name: /Máquinas cadastradas/i });

    const nameField = screen.getByRole('textbox', { name: 'Nome' });
    await userEvent.type(nameField, 'P-101');
    await userEvent.click(screen.getByRole('button', { name: /Cadastrar máquina/i }));

    // A mensagem da API chega ao usuário, sem virar erro genérico.
    expect(await screen.findByText(/Já existe uma máquina com o nome "P-101"/i)).toBeDefined();
    expect((nameField as HTMLInputElement).value).toBe('P-101');
    // A lista carregada continua na tela.
    expect(screen.getByRole('table', { name: /Máquinas cadastradas/i })).toBeDefined();
  });

  it('10. botão fica desabilitado durante o envio', async () => {
    const pendingPost = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') return pendingPost.promise;
        return new Response('[]', { status: 200 });
      }),
    );

    renderPanel();
    await screen.findByText(/Nenhuma máquina cadastrada/i);

    await userEvent.type(screen.getByRole('textbox', { name: 'Nome' }), 'P-103');
    await userEvent.click(screen.getByRole('button', { name: /Cadastrar máquina/i }));

    const submitting = await screen.findByRole('button', { name: /Cadastrando/i });
    expect(submitting).toHaveProperty('disabled', true);

    pendingPost.resolve(
      new Response(JSON.stringify({ ...P101, id: '9', name: 'P-103' }), { status: 201 }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Cadastrar máquina/i })).toHaveProperty(
        'disabled',
        false,
      ),
    );
  });
});
