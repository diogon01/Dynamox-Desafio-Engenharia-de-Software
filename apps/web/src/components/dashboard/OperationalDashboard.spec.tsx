import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimeSeriesSampleDto, TimeSeriesSummary } from '@dynamox/domain';

import { renderWithProviders } from '../../test/renderWithProviders';
import { OperationalDashboard } from './OperationalDashboard';

const USER = { id: 'u1', email: 'operador@dynamox.local', name: 'Operador', role: 'ADMIN' as const };
const baseMs = Date.now() - 2 * 24 * 60 * 60 * 1000;

function windowAt(offsetMs: number, value: number): TimeSeriesSampleDto[] {
  return [0, 1, 2].map((second) => ({
    timestamp: new Date(baseMs + offsetMs + second * 1000).toISOString(),
    value,
  }));
}

const samplesBySeries: Record<string, TimeSeriesSampleDto[]> = {
  s1y: [...windowAt(0, 1), ...windowAt(60 * 60 * 1000, 1)],
  s1z: [...windowAt(0, 1), ...windowAt(60 * 60 * 1000, 1)],
  s2y: [...windowAt(0, 1), ...windowAt(60 * 60 * 1000, 3)],
  s2z: [...windowAt(0, 1), ...windowAt(60 * 60 * 1000, 3)],
  s2x: [...windowAt(0, 0.008), ...windowAt(60 * 60 * 1000, 0.008)],
};

function series(
  id: string,
  serial: string,
  machine: string,
  point: string,
  axis: 'y' | 'z' | 'x',
): TimeSeriesSummary {
  const data = samplesBySeries[id] ?? [];
  return {
    id,
    sensorSerialNumber: serial,
    sensorModel: 'HF+',
    machineName: machine,
    machineType: 'Pump',
    monitoringPointName: point,
    physicalQuantity: 'acceleration',
    axis,
    unit: 'g',
    displayName: null,
    sampleCount: data.length || 6,
    lastValue: data.at(-1)?.value ?? 0.008,
    lastTimestamp: data.at(-1)?.timestamp ?? new Date(baseMs).toISOString(),
  };
}

const SERIES = [
  series('s1y', 'SIM-HF-001', 'P-101', 'Mancal lado acoplamento', 'y'),
  series('s1z', 'SIM-HF-001', 'P-101', 'Mancal lado acoplamento', 'z'),
  series('s2y', 'SIM-HF-002', 'P-102', 'Mancal lado oposto ao acoplamento', 'y'),
  series('s2z', 'SIM-HF-002', 'P-102', 'Mancal lado oposto ao acoplamento', 'z'),
  // Eixo X do sensor em atenção: mesmo instante das radiais e valor sem relação com a
  // condição. Existe para provar que a evidência exibida não cai nele.
  series('s2x', 'SIM-HF-002', 'P-102', 'Mancal lado oposto ao acoplamento', 'x'),
];

const MACHINES = [
  { id: 'm1', name: 'P-101', type: 'Pump', createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'm2', name: 'P-102', type: 'Pump', createdAt: '2026-08-01', updatedAt: '2026-08-01' },
] as const;

const POINTS = [
  {
    id: 'p1',
    name: 'Mancal lado acoplamento',
    machine: { id: 'm1', name: 'P-101', type: 'Pump' },
    sensor: { id: 'sn1', serialNumber: 'SIM-HF-001', model: 'HF+' },
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  },
  {
    id: 'p2',
    name: 'Mancal lado oposto ao acoplamento',
    machine: { id: 'm2', name: 'P-102', type: 'Pump' },
    sensor: { id: 'sn2', serialNumber: 'SIM-HF-002', model: 'HF+' },
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  },
  {
    id: 'p3',
    name: 'Carcaça',
    machine: { id: 'm2', name: 'P-102', type: 'Pump' },
    sensor: null,
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  },
] as const;

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200 });
}

function fixtureFetch(
  options: {
    pointsFail?: boolean;
    emptyInventory?: boolean;
    seriesEmpty?: boolean;
  } = {},
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/health')) {
      return okJson({
        status: 'ok',
        database: 'up',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      });
    }
    if (url.endsWith('/machines')) return okJson(options.emptyInventory ? [] : MACHINES);
    if (url.includes('/monitoring-points')) {
      if (options.pointsFail) {
        return new Response(JSON.stringify({ message: 'Pontos indisponíveis' }), { status: 503 });
      }
      return okJson({
        items: options.emptyInventory ? [] : POINTS,
        total: options.emptyInventory ? 0 : POINTS.length,
        page: 1,
        pageSize: 50,
        sortBy: 'machineName',
        sortDir: 'asc',
      });
    }
    if (url.endsWith('/time-series')) return okJson(options.emptyInventory || options.seriesEmpty ? [] : SERIES);
    const metric = url.match(/time-series\/(s\d[xyz])\/metrics/);
    if (metric) {
      const data = samplesBySeries[metric[1]];
      return okJson({
        count: data.length,
        min: Math.min(...data.map((item) => item.value)),
        max: Math.max(...data.map((item) => item.value)),
        avg: data.reduce((sum, item) => sum + item.value, 0) / data.length,
        last: data.at(-1)?.value ?? null,
        firstTimestamp: data[0].timestamp,
        lastTimestamp: data.at(-1)?.timestamp ?? null,
      });
    }
    const sample = url.match(/time-series\/(s\d[xyz])\/samples/);
    if (sample) {
      const data = samplesBySeries[sample[1]];
      return okJson({ items: data, total: data.length, limit: 5000, offset: 0 });
    }
    return new Response(JSON.stringify({ message: `Rota não simulada: ${url}` }), { status: 404 });
  });
}

function renderDashboard(fetcher = fixtureFetch()) {
  vi.stubGlobal('fetch', fetcher);
  return renderWithProviders(<OperationalDashboard />, {
    preloadedState: { auth: { status: 'authenticated', user: USER, error: null } },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverMock {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element): void {
        this.callback(
          [
            {
              target,
              contentRect: { width: 900, height: 320 },
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
      }
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

describe('OperationalDashboard', () => {
  it('renderiza loading inicial com skeletons sem derrubar as seções', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    renderDashboard(vi.mocked(fetch));
    expect(screen.getByRole('heading', { name: /Visão geral operacional/i })).toBeDefined();
    expect(screen.getByLabelText(/Carregando matriz de sensores/i)).toBeDefined();
    expect(screen.getByLabelText(/Ativos em atenção: carregando/i)).toBeDefined();
  });

  it('os quatro KPIs separam condição, magnitude, cobertura e recência', async () => {
    renderDashboard();
    // Condição: apenas o sensor com desvio.
    expect(await screen.findByLabelText('Ativos em atenção: 1')).toBeDefined();
    // Magnitude: o maior desvio atual, com a grandeza que o sustenta.
    const desvio = screen.getByLabelText('Maior desvio: 3×');
    expect(within(desvio).getByText(/Aceleração radial \(Y\/Z\)/i)).toBeDefined();
    // Cobertura: instrumentados e reportando sobre o total de pontos.
    expect(screen.getByLabelText('Cobertura monitorada: 66,7%')).toBeDefined();
    // Recência: leituras de 2 dias atrás estão fora da janela de 24 h.
    expect(screen.getByLabelText('Leituras atuais: 0%')).toBeDefined();
  });

  it('a carga inicial não busca métricas série a série', async () => {
    const fetcher = fixtureFetch();
    renderDashboard(fetcher);
    await screen.findByLabelText('Ativos em atenção: 1');
    await waitFor(() => expect(screen.getAllByText(/3×/).length).toBeGreaterThan(0));

    const urls = fetcher.mock.calls.map(([input]) => String(input));
    // O resumo das séries já traz a última leitura: nenhuma chamada de métricas.
    expect(urls.filter((url) => url.includes('/metrics'))).toHaveLength(0);
    // Inventário: máquinas + pontos + séries. As amostras vêm da segunda etapa.
    const inventario = urls.filter(
      (url) => !url.includes('/samples') && !url.endsWith('/health') && !url.includes('/auth/'),
    );
    expect(inventario).toHaveLength(3);
  });

  it('a prioridade lista exceções primeiro, com valor e desvio da medição que classificou', async () => {
    renderDashboard();
    const fila = await screen.findByRole('region', { name: /Prioridade de inspeção/i });
    expect(within(fila).getByText(/Mostrando 2 de 2 avaliados/i)).toBeDefined();

    const linhas = within(fila).getAllByRole('row').slice(1); // sem o cabeçalho
    // Exceção antes do normal.
    expect(linhas[0].textContent).toContain('SIM-HF-002');
    expect(within(linhas[0]).getByText('Atenção')).toBeDefined();
    // Valor atual = RMS radial (3 g), nunca o eixo X (0,008 g).
    expect(within(linhas[0]).getByText('3 g')).toBeDefined();
    expect(within(linhas[0]).getByText('3×')).toBeDefined();
    expect(within(linhas[0]).queryByText(/0,008/)).toBeNull();
    expect(linhas[1].textContent).toContain('SIM-HF-001');
  });

  it('investigar leva à evidência temporal com o contexto selecionado', async () => {
    renderDashboard();
    const fila = await screen.findByRole('region', { name: /Prioridade de inspeção/i });
    const investigar = within(fila).getAllByRole('button', { name: /Investigar/i })[0];
    await userEvent.click(investigar);

    const investigacao = await screen.findByRole('heading', { name: /Investigação — SIM-HF-002/i });
    // O drill-down entrega o foco: o caminho também existe no teclado.
    await waitFor(() => expect(document.activeElement).toBe(investigacao));
    // O painel de tendência crítica declara o contexto completo.
    const trend = screen.getByRole('region', { name: /Tendência crítica/i });
    expect(trend.textContent).toContain('SIM-HF-002');
  });

  it('a matriz da frota leva ao mesmo painel de investigação', async () => {
    renderDashboard();
    const cell = await screen.findByRole('button', {
      name: /P-102, Mancal lado oposto ao acoplamento, SIM-HF-002/i,
    });
    await userEvent.click(cell);
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {
            name: /P-102, Mancal lado oposto ao acoplamento, SIM-HF-002/i,
          })
          .getAttribute('aria-pressed'),
      ).toBe('true'),
    );
    expect(await screen.findByRole('heading', { name: /Investigação — SIM-HF-002/i })).toBeDefined();
  });

  it('as ocorrências recentes derivam das leituras reais, sem inventar eventos', async () => {
    renderDashboard();
    const painel = await screen.findByRole('region', { name: /Ocorrências recentes/i });
    // Uma linha por sensor com leitura, a mais crítica identificável.
    expect(within(painel).getByText(/P-102 · NDE · SIM-HF-002/i)).toBeDefined();
    expect(within(painel).getByText(/não há alarmes persistidos/i)).toBeDefined();
  });

  it('o mapa semanal e o perfil 24 h são mestre/detalhe pelo dia selecionado', async () => {
    renderDashboard();
    await screen.findByLabelText('Ativos em atenção: 1');
    const heatmap = await screen.findByRole('region', { name: /Mapa de calor semanal/i });
    const perfil = screen.getByRole('region', { name: /Horários de pico/i });

    // O dia com atividade abre selecionado e o perfil mostra barras.
    const diaAtivo = new Date(baseMs).getDay();
    const rotulos = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const tabAtiva = within(perfil).getByRole('button', { name: rotulos[diaAtivo] });
    expect(tabAtiva.getAttribute('aria-pressed')).toBe('true');

    // Selecionar outro dia pelo heatmap troca o detalhe.
    const outroDia = rotulos[(diaAtivo + 1) % 7];
    await userEvent.click(
      within(heatmap).getByRole('button', { name: new RegExp(`Selecionar ${outroDia}`) }),
    );
    await waitFor(() =>
      expect(
        within(perfil).getByRole('button', { name: outroDia }).getAttribute('aria-pressed'),
      ).toBe('true'),
    );
    expect(within(perfil).getByText(/Sem leituras neste dia/i)).toBeDefined();
  });

  it('quando o período não alcança o dado, oferece o período disponível', async () => {
    renderDashboard();
    await screen.findByLabelText('Ativos em atenção: 1');
    await userEvent.click(screen.getByRole('button', { name: /^24 h$/i }));
    expect(await screen.findByText(/Sem dados em 24 horas/i)).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: /Ver período disponível/i }));
    await waitFor(() => expect(screen.queryByText(/Sem dados em/i)).toBeNull());
    expect(screen.getByRole('button', { name: /^Tudo$/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('mantém dados parciais e orienta nova tentativa quando pontos falham', async () => {
    renderDashboard(fixtureFetch({ pointsFail: true }));
    expect(await screen.findByText(/Dados parciais/i)).toBeDefined();
    expect(screen.getByText(/Pontos indisponíveis/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeDefined();
  });

  it('orienta o primeiro cadastro quando não há máquinas', async () => {
    renderDashboard(fixtureFetch({ emptyInventory: true }));
    expect(await screen.findByText(/Nenhuma máquina cadastrada/i)).toBeDefined();
    expect(screen.getByLabelText('Ativos em atenção: 0')).toBeDefined();
    expect(screen.getByText(/Cadastre uma máquina e seus pontos/i)).toBeDefined();
  });

  it('mantém sensores instalados como sem dados quando não existem séries', async () => {
    renderDashboard(fixtureFetch({ seriesEmpty: true }));
    expect(await screen.findByLabelText('Cobertura monitorada: 0%')).toBeDefined();
    expect(screen.getAllByText(/Sem dados/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Nenhuma série persistida/i)).toBeDefined();
  });

  it('abre o explorador com quatro filtros hierárquicos e métricas da série', async () => {
    renderDashboard();
    await screen.findByLabelText('Ativos em atenção: 1');
    await userEvent.click(screen.getByRole('button', { name: /Explorar série temporal/i }));
    const explorer = document.getElementById('series-explorer-content');
    expect(explorer).not.toBeNull();
    expect(within(explorer!).getByLabelText('1. Máquina')).toBeDefined();
    expect(within(explorer!).getByLabelText('2. Ponto')).toBeDefined();
    expect(within(explorer!).getByLabelText('3. Sensor')).toBeDefined();
    expect(within(explorer!).getByLabelText('4. Eixo / métrica')).toBeDefined();
    expect(within(explorer!).getByText('Amostras')).toBeDefined();
    expect(within(explorer!).getByText('Unidade')).toBeDefined();
  });

  it('expõe a hierarquia da página na ordem da decisão operacional', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { level: 1, name: /Visão geral operacional/i })).toBeDefined();
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent ?? '');
    const iFila = titulos.findIndex((t) => /Prioridade de inspeção/.test(t));
    const iTendencia = titulos.findIndex((t) => /Tendência crítica/.test(t));
    const iMatriz = titulos.findIndex((t) => /Matriz de condição da frota/.test(t));
    // Prioridade antes da evidência; a matriz fecha a exploração.
    expect(iFila).toBeGreaterThanOrEqual(0);
    expect(iFila).toBeLessThan(iTendencia);
    expect(iTendencia).toBeLessThan(iMatriz);
    expect(screen.getByRole('button', { name: /7 dias/i }).getAttribute('aria-pressed')).toBe('true');
  });
});
