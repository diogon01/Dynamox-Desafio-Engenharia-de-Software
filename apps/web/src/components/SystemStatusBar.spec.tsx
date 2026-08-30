import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/renderWithProviders';
import { SystemStatusBar } from './SystemStatusBar';

const USER = { id: 'u1', email: 'operador@dynamox.local', name: 'Operador' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SystemStatusBar', () => {
  it('mantém sessão e recuperação acessíveis quando o health check falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ message: 'API fora do ar' }), { status: 503 }),
      ),
    );

    renderWithProviders(<SystemStatusBar />, {
      preloadedState: { auth: { status: 'authenticated', user: USER, error: null } },
    });

    const heading = await screen.findByRole('heading', { name: /Estado do sistema/i });
    const status = heading.closest('section');
    expect(status).not.toBeNull();
    expect(within(status!).getByText(/API indisponível/i)).toBeDefined();
    expect(within(status!).getByText(USER.email)).toBeDefined();
    expect(within(status!).getByRole('button', { name: /Atualizar estado do sistema/i })).toBeDefined();
    expect(within(status!).getByRole('button', { name: /Sair da sessão/i })).toBeDefined();
  });
});
