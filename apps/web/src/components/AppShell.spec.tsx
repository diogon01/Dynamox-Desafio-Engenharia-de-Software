import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/renderWithProviders';
import { AppShell } from './AppShell';

/** O shell só precisa do health para o cabeçalho; a página em si não é o objeto deste teste. */
function stubHealth() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({ status: 'ok', database: 'up', version: '0.1.0', timestamp: '2026-08-31T12:00:00.000Z' }),
        { status: 200 },
      ),
    ),
  );
}

/**
 * No viewport do jsdom o shell usa o drawer temporário (o mesmo do celular), então cada
 * teste abre o menu antes de olhar para ele — o que também cobre o caminho mobile: ele
 * consome exatamente a mesma configuração de navegação do desktop.
 */
async function renderShell(route: string) {
  const rendered = renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="*" element={<div>conteúdo</div>} />
      </Route>
    </Routes>,
    { route },
  );
  await userEvent.click(screen.getByRole('button', { name: /Abrir menu de navegação/i }));
  return rendered;
}

const nav = () => screen.getByRole('navigation', { name: /Navegação principal/i });

beforeEach(stubHealth);
afterEach(() => vi.unstubAllGlobals());

describe('AppShell — menu lateral', () => {
  it('agrupa os destinos por monitoramento e cadastro, sem listar rotas contextuais', async () => {
    await renderShell('/');
    const menu = nav();
    // Os rótulos de seção nomeiam as listas: quem usa leitor de tela ouve o grupo.
    expect(within(menu).getByRole('heading', { name: 'Monitoramento' })).toBeDefined();
    expect(within(menu).getByRole('heading', { name: 'Cadastro' })).toBeDefined();
    expect(within(menu).getAllByRole('list')).toHaveLength(2);
    expect(within(menu).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/alerts',
      '/machines',
      '/monitoring-points',
    ]);
  });

  it('a raiz destaca "Visão geral" e apenas ela', async () => {
    await renderShell('/');
    const links = within(nav()).getAllByRole('link');
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links.slice(1).every((link) => link.getAttribute('aria-current') === null)).toBe(true);
  });

  it.each([
    ['/alerts/1554cd5d-3588-41c5-b90d-97b94fb52452', 'Alertas'],
    ['/machines/P-101/points/mancal-lado-acoplamento', 'Máquinas'],
    // A investigação vive fora do prefixo da rota e ainda assim pertence ao ramo da máquina.
    ['/sensors/SIM-HF-002', 'Máquinas'],
    ['/acquisitions/abc/samples', 'Máquinas'],
  ])('a subrota %s mantém "%s" como ramo ativo', async (route, label) => {
    await renderShell(route);
    const active = within(nav()).getByRole('link', { name: new RegExp(`^${label}`) });
    expect(active.className).toContain('active');
    // "true" e não "page": o item é o ramo que contém a página, não a página em si.
    expect(active.getAttribute('aria-current')).toBe('true');
  });

  it('a página do destino em si é "page", não apenas o ramo', async () => {
    await renderShell('/machines');
    expect(within(nav()).getByRole('link', { name: /^Máquinas/ }).getAttribute('aria-current')).toBe('page');
  });

  it('o Swagger fica fora da navegação de operação e declara que abre em outra aba', async () => {
    await renderShell('/');
    const swagger = screen.getByRole('link', { name: /API \(Swagger\).*nova aba/i });
    expect(within(nav()).queryByRole('link', { name: /Swagger/i })).toBeNull();
    expect(swagger.getAttribute('target')).toBe('_blank');
    expect(swagger.getAttribute('rel')).toContain('noopener');
  });

  it('a marca volta para o início', async () => {
    await renderShell('/machines');
    expect(screen.getByRole('link', { name: /Desafio Dynamox/i }).getAttribute('href')).toBe('/');
  });
});
