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
};

function series(id: string, serial: string, machine: string, point: string, axis: 'y' | 'z'): TimeSeriesSummary {
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
    sampleCount: 6,
  };
}

const SERIES = [
  series('s1y', 'SIM-HF-001', 'P-101', 'Mancal lado acoplamento', 'y'),
  series('s1z', 'SIM-HF-001', 'P-101', 'Mancal lado acoplamento', 'z'),
  series('s2y', 'SIM-HF-002', 'P-102', 'Mancal lado oposto ao acoplamento', 'y'),
  series('s2z', 'SIM-HF-002', 'P-102', 'Mancal lado oposto ao acoplamento', 'z'),
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
    const metric = url.match(/time-series\/(s\dy|s\dz)\/metrics/);
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
    const sample = url.match(/time-series\/(s\dy|s\dz)\/samples/);
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
    expect(screen.getByLabelText(/Máquinas: carregando/i)).toBeDefined();
  });

  it('calcula KPIs, matriz, ranking, recência e sinais com dados reais da API', async () => {
    renderDashboard();
    expect(await screen.findByLabelText('Máquinas: 2')).toBeDefined();
    expect(screen.getByLabelText('Pontos: 3')).toBeDefined();
    expect(screen.getByLabelText('Sensores: 2')).toBeDefined();
    expect(screen.getByLabelText('Desatualizados: 2')).toBeDefined();
    expect(screen.getByRole('grid', { name: /Máquinas, pontos, sensores e condição/i })).toBeDefined();
    expect(screen.getByText('Sensor não instalado')).toBeDefined();
    expect(screen.getByText('3×')).toBeDefined();
    expect(screen.getAllByText(/Última leitura há mais de 24 horas/i).length).toBeGreaterThan(0);
  });

  it('seleciona uma célula da matriz e atualiza a série operacional', async () => {
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
    expect(screen.getAllByDisplayValue('P-102').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('SIM-HF-002').length).toBeGreaterThan(0);
  });

  it('aplica o filtro global e comunica dados fora das últimas 24 horas', async () => {
    renderDashboard();
    await screen.findByLabelText('Máquinas: 2');
    await userEvent.click(screen.getByRole('button', { name: /^24 h$/i }));
    expect(await screen.findByText(/Sem dados no período de 24 horas/i)).toBeDefined();
    expect(screen.getByText(/Nenhum ponto foi simulado para preencher a lacuna/i)).toBeDefined();
  });

  it('mantém dados parciais e orienta nova tentativa quando pontos falham', async () => {
    renderDashboard(fixtureFetch({ pointsFail: true }));
    expect(await screen.findByText(/Dados parciais/i)).toBeDefined();
    expect(screen.getByText(/Pontos indisponíveis/i)).toBeDefined();
    expect(screen.getByLabelText('Máquinas: 2')).toBeDefined();
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeDefined();
  });

  it('orienta o primeiro cadastro quando não há máquinas', async () => {
    renderDashboard(fixtureFetch({ emptyInventory: true }));
    expect(await screen.findByText(/Nenhuma máquina cadastrada/i)).toBeDefined();
    expect(screen.getByLabelText('Máquinas: 0')).toBeDefined();
    expect(screen.getByText(/Cadastre uma máquina e seus pontos/i)).toBeDefined();
  });

  it('mantém sensores instalados como sem dados quando não existem séries', async () => {
    renderDashboard(fixtureFetch({ seriesEmpty: true }));
    expect(await screen.findByLabelText('Sensores: 2')).toBeDefined();
    expect(screen.getAllByText('Sem dados').length).toBeGreaterThan(0);
    expect(screen.getByText(/Nenhuma série persistida/i)).toBeDefined();
  });

  it('abre o explorador com quatro filtros hierárquicos e métricas da série', async () => {
    renderDashboard();
    await screen.findByLabelText('Máquinas: 2');
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

  it('expõe uma hierarquia acessível e não recria o cabeçalho removido', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { level: 1, name: /Visão geral operacional/i })).toBeDefined();
    expect(screen.queryByText('MONITORAMENTO DE ATIVOS')).toBeNull();
    expect(screen.getByRole('region', { name: /Matriz de condição dos sensores/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /7 dias/i }).getAttribute('aria-pressed')).toBe('true');
  });
});
