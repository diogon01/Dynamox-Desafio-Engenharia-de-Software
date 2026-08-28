import type {
  MachineType,
  SensorModel,
  SeriesMetrics,
  TimeSeriesSampleDto,
  TimeSeriesSummary,
} from '@dynamox/domain';

export interface MachineDto {
  id: string;
  name: string;
  type: MachineType;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringPointDto {
  id: string;
  name: string;
  machine: { id: string; name: string; type: MachineType };
  sensor: { id: string; serialNumber: string; model: SensorModel } | null;
  createdAt: string;
  updatedAt: string;
}

export type MonitoringPointSortColumn =
  | 'machineName'
  | 'machineType'
  | 'pointName'
  | 'sensorModel';

export interface MonitoringPointPageDto {
  items: MonitoringPointDto[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: MonitoringPointSortColumn;
  sortDir: 'asc' | 'desc';
}

export interface MonitoringPointListParams {
  page: number;
  sortBy: MonitoringPointSortColumn;
  sortDir: 'asc' | 'desc';
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  version: string;
  timestamp: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
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

/**
 * Token em sessionStorage: sobrevive a reload da aba (sessão restaurável via /auth/me),
 * mas não a fechar o navegador. Trade-off aceito: mais simples que cookie httpOnly e
 * menos persistente que localStorage; sem refresh token, a sessão dura o JWT_EXPIRES_IN.
 */
const TOKEN_KEY = 'dynamox.jwt';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // sessionStorage indisponível (ex.: modo privado restrito): sessão vive só em memória.
  }
}

/** Tratamento central de 401: registrado uma vez pelo bootstrap da aplicação. */
let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class UnauthorizedError extends Error {}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** O login trata o próprio 401 (credencial inválida ≠ sessão expirada). */
  skipUnauthorizedHandler?: boolean;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    // Só derruba a sessão se o token desta requisição ainda for o atual: um 401 atrasado
    // de uma chamada feita com token antigo não pode apagar o token de um login novo.
    if (!options.skipUnauthorizedHandler && token === getToken()) onUnauthorized?.();
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new UnauthorizedError(payload?.message ?? 'Não autorizado.');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Falha ao consultar ${path}: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => requestJson<HealthStatus>('/health'),
  login: (email: string, password: string) =>
    requestJson<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipUnauthorizedHandler: true,
    }),
  me: () => requestJson<SessionUser>('/auth/me'),
  machines: () => requestJson<MachineDto[]>('/machines'),
  createMachine: (name: string, type: MachineType) =>
    requestJson<MachineDto>('/machines', { method: 'POST', body: { name, type } }),
  monitoringPoints: (params: MonitoringPointListParams) => {
    const query = new URLSearchParams({
      page: String(params.page),
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    });
    return requestJson<MonitoringPointPageDto>(`/monitoring-points?${query.toString()}`);
  },
  createMonitoringPoint: (machineId: string, name: string) =>
    requestJson<MonitoringPointDto>('/monitoring-points', {
      method: 'POST',
      body: { machineId, name },
    }),
  assignSensor: (pointId: string, serialNumber: string, model: SensorModel) =>
    requestJson<MonitoringPointDto>(`/monitoring-points/${pointId}/sensor`, {
      method: 'POST',
      body: { serialNumber, model },
    }),
  timeSeries: () => requestJson<TimeSeriesSummary[]>('/time-series'),
  samples: (id: string) => requestJson<TimeSeriesSampleDto[]>(`/time-series/${id}/samples`),
  metrics: (id: string) => requestJson<SeriesMetrics>(`/time-series/${id}/metrics`),
};
