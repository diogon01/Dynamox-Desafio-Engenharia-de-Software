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

/**
 * MAC-03 — edição e exclusão. O mock roteia por método/URL e responde também
 * /monitoring-points: após editar/excluir, o painel recarrega a outra tabela para
 * manter as telas coerentes.
 */
function stubMac03(options: {
  machines?: unknown[];
  patchResponse?: Response;
  deleteResponse?: Response;
}) {
  const machines = options.machines ?? [
    P101,
    { ...P101, id: '2', name: 'V-200', type: 'Fan' },
  ];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/monitoring-points')) {
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
    }
    if (init?.method === 'PATCH') {
      return (
        options.patchResponse ??
        new Response(JSON.stringify({ ...P101, name: 'P-101-B' }), { status: 200 })
      );
    }
    if (init?.method === 'DELETE') {
      return options.deleteResponse ?? new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify(machines), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('MachinesPanel — edição e exclusão (MAC-03)', () => {
  it('11. editar preenche o formulário, envia o PATCH e atualiza a linha', async () => {
    const fetchMock = stubMac03({});

    renderPanel();
    const table = await screen.findByRole('table', { name: /Máquinas cadastradas/i });
    const row = within(table).getByText('P-101').closest('tr') as HTMLElement;

    await userEvent.click(within(row).getByRole('button', { name: /Editar/i }));

    // Formulário pré-preenchido com os dados atuais.
    const nameField = screen.getByRole('textbox', { name: /Novo nome/i });
    expect((nameField as HTMLInputElement).value).toBe('P-101');

    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'P-101-B');
    await userEvent.click(screen.getByRole('button', { name: /^Salvar$/i }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find((call) => call[1]?.method === 'PATCH');
      expect(patch).toBeDefined();
      expect(String(patch?.[0])).toMatch(/\/machines\/1$/);
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ name: 'P-101-B', type: 'Pump' });
    });
    // O formulário fecha e a linha reflete o registro devolvido pela API.
    await waitFor(() => expect(screen.queryByText(/Editar máquina/i)).toBeNull());
    expect(within(table).getByText('P-101-B')).toBeDefined();
  });

  it('12. erro da API na edição fica visível e mantém o formulário aberto', async () => {
    stubMac03({
      patchResponse: new Response(
        JSON.stringify({
          code: 'MACHINE_TYPE_SENSOR_CONFLICT',
          message: 'A máquina não pode virar Pump: sensor(es) TcAg/TcAs associado(s).',
        }),
        { status: 409 },
      ),
    });

    renderPanel();
    const table = await screen.findByRole('table', { name: /Máquinas cadastradas/i });
    const row = within(table).getByText('V-200').closest('tr') as HTMLElement;

    await userEvent.click(within(row).getByRole('button', { name: /Editar/i }));
    await userEvent.click(screen.getByRole('button', { name: /^Salvar$/i }));

    expect(await screen.findByText(/não pode virar Pump/i)).toBeDefined();
    // O formulário continua aberto com o que estava preenchido.
    expect(screen.getByRole('textbox', { name: /Novo nome/i })).toBeDefined();
    expect(within(table).getByText('V-200')).toBeDefined();
  });

  it('13. excluir exige confirmação, envia o DELETE e remove a linha', async () => {
    const fetchMock = stubMac03({});

    renderPanel();
    const table = await screen.findByRole('table', { name: /Máquinas cadastradas/i });
    const row = within(table).getByText('V-200').closest('tr') as HTMLElement;

    await userEvent.click(within(row).getByRole('button', { name: /Excluir/i }));

    // A confirmação avisa sobre a cascata nos pontos de monitoramento.
    expect(await screen.findByText(/pontos de monitoramento dela/i)).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: /Confirmar exclusão/i }));

    await waitFor(() => {
      const del = fetchMock.mock.calls.find((call) => call[1]?.method === 'DELETE');
      expect(del).toBeDefined();
      expect(String(del?.[0])).toMatch(/\/machines\/2$/);
    });
    await waitFor(() => expect(within(table).queryByText('V-200')).toBeNull());
    expect(within(table).getByText('P-101')).toBeDefined();
  });

  it('14. cancelar a exclusão não dispara nenhum DELETE', async () => {
    const fetchMock = stubMac03({});

    renderPanel();
    const table = await screen.findByRole('table', { name: /Máquinas cadastradas/i });
    const row = within(table).getByText('V-200').closest('tr') as HTMLElement;

    await userEvent.click(within(row).getByRole('button', { name: /Excluir/i }));
    await userEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));

    await waitFor(() => expect(screen.queryByText(/Confirmar exclusão/i)).toBeNull());
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(false);
    expect(within(table).getByText('V-200')).toBeDefined();
  });
});
