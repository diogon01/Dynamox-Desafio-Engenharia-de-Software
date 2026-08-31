import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { RequestStatus } from '../../store/requestStatus';

/**
 * Consulta analítica de uma página de investigação.
 *
 * Estado local, não global: cada página vive do seu recorte, e o contexto de navegação
 * mora na URL. Uma resposta atrasada de um recorte anterior é descartada — a mesma
 * proteção que o painel já aplicava ao detalhe da série.
 */
export interface AnalyticsQuery<T> {
  status: RequestStatus;
  data: T | null;
  error: string | null;
  reload: () => void;
}

export function useAnalyticsQuery<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AnalyticsQuery<T> {
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setStatus('loading');
    setError(null);
    fetcher()
      .then((result) => {
        if (!current) return;
        setData(result);
        setStatus('succeeded');
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setError(reason instanceof Error ? reason.message : 'Erro desconhecido.');
        setStatus('failed');
      });
    return () => {
      current = false;
    };
    // As dependências são declaradas por quem chama (o recorte da consulta): a lista é
    // dinâmica por natureza, e o `fetcher` é recriado a cada render.
     
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { status, data, error, reload };
}

/** Janela temporal lida da URL; sem `from/to` explícitos, os últimos 7 dias. */
export function useTimeRange(): { from: string; to: string; search: URLSearchParams } {
  const [search] = useSearchParams();
  return useMemo(() => {
    const to = search.get('to') ?? new Date().toISOString();
    const from =
      search.get('from') ?? new Date(Date.parse(to) - 7 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to, search };
  }, [search]);
}

/** Preserva o contexto temporal ao navegar entre níveis da investigação. */
export function withRange(path: string, range: { from: string; to: string }, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams({ from: range.from, to: range.to, ...extra });
  return `${path}?${query.toString()}`;
}
