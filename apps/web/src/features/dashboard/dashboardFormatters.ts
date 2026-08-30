import type { Axis, PhysicalQuantity } from '@dynamox/domain';

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
});

const shortDateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const chartTick = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

export const QUANTITY_LABELS: Record<PhysicalQuantity, string> = {
  acceleration: 'Aceleração',
  velocity: 'Velocidade',
  temperature: 'Temperatura',
  rotationalSpeed: 'Rotação',
};

export function formatDateTime(value: string | number | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data inválida' : dateTime.format(date);
}

export function formatShortDateTime(value: string | number | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data inválida' : shortDateTime.format(date);
}

export function formatChartTick(value: number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : chartTick.format(date);
}

export function formatNumber(value: number | null, maximumFractionDigits = 3): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(value);
}

export function formatMeasurement(value: number | null, unit: string | null): string {
  if (value === null) return 'Sem leitura';
  return `${number.format(value)}${unit ? ` ${unit}` : ''}`;
}

export function seriesMetricLabel(quantity: PhysicalQuantity, axis: Axis | null): string {
  return `${QUANTITY_LABELS[quantity]}${axis ? ` · eixo ${axis.toUpperCase()}` : ''}`;
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'Sem intervalo disponível';
  return `${formatShortDateTime(start)} – ${formatShortDateTime(end)}`;
}

export function formatRelativeTime(value: string | null, nowMs = Date.now()): string {
  if (!value) return 'sem leitura';
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return 'timestamp inválido';
  const delta = nowMs - at;
  if (delta < -5 * 60 * 1000) return `no futuro (${formatShortDateTime(value)})`;
  const absolute = Math.max(0, delta);
  if (absolute < 60_000) return 'agora';
  if (absolute < 3_600_000) return `há ${Math.floor(absolute / 60_000)} min`;
  if (absolute < 86_400_000) return `há ${Math.floor(absolute / 3_600_000)} h`;
  return `há ${Math.floor(absolute / 86_400_000)} dias`;
}
