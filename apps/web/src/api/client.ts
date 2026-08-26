import type { SeriesMetrics, TimeSeriesSampleDto, TimeSeriesSummary } from '@dynamox/domain';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  version: string;
  timestamp: string;
}

const DEFAULT_BASE_URL = 'http://localhost:3000/api';

/**
 * O frontend nunca pode falar com a plataforma produtiva da Dynamox: os dados deste
 * projeto são sintéticos e a API de destino é sempre o backend local do desafio.
 */
export function assertLocalApiBaseUrl(baseUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`VITE_API_BASE_URL inválida: "${baseUrl}".`);
  }

  if (/(^|\.)dynamox\.(solutions|net)$/i.test(parsed.hostname)) {
    throw new Error(
      `VITE_API_BASE_URL aponta para um domínio da Dynamox ("${parsed.hostname}"). Esta aplicação só pode consumir a API local.`,
    );
  }

  return baseUrl.replace(/\/$/, '');
}

export const API_BASE_URL = assertLocalApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL,
);

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => getJson<HealthStatus>('/health'),
  timeSeries: () => getJson<TimeSeriesSummary[]>('/time-series'),
  samples: (id: string) => getJson<TimeSeriesSampleDto[]>(`/time-series/${id}/samples`),
  metrics: (id: string) => getJson<SeriesMetrics>(`/time-series/${id}/metrics`),
};
