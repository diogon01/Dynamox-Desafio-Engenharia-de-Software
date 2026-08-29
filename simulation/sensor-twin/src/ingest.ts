/**
 * Cliente da API REAL (B4): login com a credencial de demonstração já documentada pelo
 * projeto, guarda anti-produção e POST no endpoint de ingestão existente — o twin
 * consome o P0, nunca o contorna.
 *
 * Configuração (nesta ordem): TWIN_API_URL / TWIN_EMAIL / TWIN_PASSWORD do ambiente →
 * SEED_USER_EMAIL / SEED_USER_PASSWORD do `.env` da raiz → defaults públicos de
 * demonstração do README. Nenhum segredo real vive aqui.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findRepositoryRoot } from '@dynamox/contracts';

import type { BuiltCycle } from './payload';

export interface TwinApiConfig {
  baseUrl: string;
  email: string;
  password: string;
}

/** Parser mínimo de .env (KEY=VALUE, sem interpolação) — só para ler a credencial demo. */
function readRootDotEnv(): Record<string, string> {
  try {
    const path = join(findRepositoryRoot(), '.env');
    if (!existsSync(path)) return {};
    const entries: Record<string, string> = {};
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) entries[match[1]] = match[2];
    }
    return entries;
  } catch {
    return {};
  }
}

/**
 * O twin só fala com a API local do desafio: recusa fatalmente domínios da Dynamox e
 * qualquer host que não seja loopback. Dados sintéticos jamais tocam produção.
 */
export function assertLocalBaseUrl(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`TWIN_API_URL inválida: "${baseUrl}".`);
  }
  if (/(^|\.)dynamox\.(solutions|net)$/i.test(parsed.hostname)) {
    throw new Error(
      `TWIN_API_URL aponta para um domínio da Dynamox ("${parsed.hostname}"). O gêmeo só pode falar com a API local.`,
    );
  }
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error(
      `TWIN_API_URL precisa ser local (localhost/127.0.0.1); recebido "${parsed.hostname}".`,
    );
  }
  return baseUrl.replace(/\/$/, '');
}

export function loadTwinConfig(env: NodeJS.ProcessEnv = process.env): TwinApiConfig {
  const dotEnv = readRootDotEnv();
  return {
    baseUrl: assertLocalBaseUrl(env.TWIN_API_URL ?? 'http://localhost:3000/api'),
    email: env.TWIN_EMAIL ?? dotEnv.SEED_USER_EMAIL ?? 'analista@dynamox.local',
    password: env.TWIN_PASSWORD ?? dotEnv.SEED_USER_PASSWORD ?? 'Dynamox@2026',
  };
}

async function parseJson(response: Response, context: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`${context}: resposta não é JSON válido (HTTP ${response.status}).`);
  }
}

export async function login(config: TwinApiConfig): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: config.email, password: config.password }),
    });
  } catch {
    throw new Error(
      `API indisponível em ${config.baseUrl}. Suba com: npm run db:up && npm run dev:api`,
    );
  }
  if (response.status === 401) {
    throw new Error('Credencial inválida. Rode o seed primeiro: npm run seed');
  }
  if (!response.ok) {
    throw new Error(`Login falhou: HTTP ${response.status}.`);
  }
  const body = (await parseJson(response, 'Login')) as { token?: string };
  if (typeof body.token !== 'string' || body.token.length === 0) {
    throw new Error('Login respondeu sem token — contrato inesperado.');
  }
  return body.token;
}

/** Forma real da resposta de POST /api/telemetry-cycles (TS-06). */
export interface IngestionResponse {
  duplicate: boolean;
  cycleId: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  measurementCount: number;
  sampleCount: number;
  timeSeriesIds: string[];
}

export async function ingestCycle(
  config: TwinApiConfig,
  token: string,
  cycle: BuiltCycle,
): Promise<{ status: number; body: IngestionResponse }> {
  const response = await fetch(`${config.baseUrl}/telemetry-cycles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': cycle.idempotencyKey,
    },
    body: JSON.stringify(cycle.payload),
  });

  // 201 = aquisição nova; 200 = repetição legítima. Qualquer outro status interrompe.
  if (response.status !== 200 && response.status !== 201) {
    const detail = JSON.stringify(await parseJson(response, 'Ingestão').catch(() => null));
    throw new Error(`Ingestão recusada: HTTP ${response.status} — ${detail}`);
  }
  const body = (await parseJson(response, 'Ingestão')) as IngestionResponse;
  return { status: response.status, body };
}

export interface SeriesSummary {
  id: string;
  sensorSerialNumber: string;
  physicalQuantity: string;
  axis: string | null;
  unit: string;
  sampleCount: number;
}

export async function fetchSeries(config: TwinApiConfig, token: string): Promise<SeriesSummary[]> {
  const response = await fetch(`${config.baseUrl}/time-series`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`GET /time-series falhou: HTTP ${response.status}.`);
  return (await parseJson(response, 'Séries')) as SeriesSummary[];
}

export interface SamplesPage {
  items: Array<{ timestamp: string; value: number }>;
  total: number;
  limit: number;
  offset: number;
}

export async function fetchSamples(
  config: TwinApiConfig,
  token: string,
  seriesId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<SamplesPage> {
  const query = new URLSearchParams();
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.offset !== undefined) query.set('offset', String(options.offset));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const response = await fetch(`${config.baseUrl}/time-series/${seriesId}/samples${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`GET samples falhou: HTTP ${response.status}.`);
  return (await parseJson(response, 'Amostras')) as SamplesPage;
}
