import { machineSlug, pointSlug } from '@dynamox/domain';

import { hourWindow } from '../time/instant';

/**
 * Geração central dos links da investigação.
 *
 * Existe porque os pontos de entrada se multiplicaram — prioridade, matriz, ocorrências,
 * KPIs, breadcrumbs, tabelas — e cada um montando a própria URL é como o produto acaba com
 * dois caminhos que deveriam ser o mesmo. Aqui a regra é única: identificador natural no
 * caminho, recorte temporal na query, sempre preservado ao descer ou subir um nível.
 */
export interface AnalyticsRange {
  from: string;
  to: string;
}

/** Caminho + recorte na query. `extra` só entra quando tem valor. */
function withQuery(
  path: string,
  range: AnalyticsRange,
  extra: Record<string, string | undefined> = {},
): string {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) query.set(key, value);
  }
  return `${path}?${query.toString()}`;
}

export const links = {
  /** Página analítica do ativo. O segmento é a etiqueta da máquina ("P-101"). */
  asset(machineName: string, range: AnalyticsRange): string {
    return withQuery(`/assets/${encodeURIComponent(machineSlug(machineName))}`, range);
  },

  /** Página analítica do ponto, dentro do ativo. */
  point(machineName: string, pointName: string, range: AnalyticsRange): string {
    return withQuery(
      `/assets/${encodeURIComponent(machineSlug(machineName))}/points/${encodeURIComponent(pointSlug(pointName))}`,
      range,
    );
  },

  /** Página analítica do sensor; `bucket` acompanha quando a origem sabe a granularidade útil. */
  sensor(serialNumber: string, range: AnalyticsRange, bucket?: string): string {
    return withQuery(`/sensors/${encodeURIComponent(serialNumber)}`, range, { bucket });
  },

  /** Janela de uma hora a partir de um instante qualquer dentro dela. */
  window(instant: string): string {
    const period = hourWindow(instant);
    if (!period) return '/';
    const day = period.from.slice(0, 10);
    const hour = period.from.slice(11, 13);
    return withQuery(`/monitoring/windows/${day}/${hour}`, period);
  },


  acquisition(cycleId: string, range: AnalyticsRange): string {
    return withQuery(`/acquisitions/${cycleId}`, range);
  },

  samples(cycleId: string, range: AnalyticsRange): string {
    return withQuery(`/acquisitions/${cycleId}/samples`, range);
  },
};
