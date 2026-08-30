import type { Theme } from '@mui/material/styles';
import type { CSSProperties } from 'react';

/**
 * Configuração comum dos gráficos Recharts, derivada do theme. Todos os gráficos do
 * dashboard usam os mesmos ticks, a mesma grade e o mesmo tooltip branco — em vez de
 * cada painel redecidir tipografia e cor.
 */

export function axisTickStyle(theme: Theme): { fontSize: number; fill: string } {
  return {
    fontSize: theme.dashboard.chart.tickFontSize,
    fill: theme.dashboard.chart.axisColor,
  };
}

export function chartGridStroke(theme: Theme): string {
  return theme.dashboard.chart.gridColor;
}

/** Estilos do tooltip Recharts (contentStyle/labelStyle/itemStyle) — nunca o preto padrão. */
export function chartTooltipStyles(theme: Theme): {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
} {
  const tokens = theme.dashboard.chart.tooltip;
  return {
    contentStyle: {
      background: tokens.background,
      border: `1px solid ${tokens.border}`,
      borderRadius: tokens.radius,
      boxShadow: tokens.shadow,
      fontSize: tokens.fontSize,
      padding: '8px 10px',
    },
    labelStyle: {
      color: theme.palette.text.primary,
      fontWeight: 600,
      fontSize: tokens.fontSize,
      marginBottom: 4,
    },
    itemStyle: {
      color: theme.palette.text.secondary,
      fontSize: tokens.fontSize,
      padding: 0,
    },
  };
}

/** Ordem e rótulos canônicos das condições nos gráficos empilhados e legendas. */
export const CONDITION_STACK_ORDER = [
  'normal',
  'observation',
  'attention',
  'unclassified',
  'noData',
] as const;

export const CONDITION_STACK_LABELS: Record<(typeof CONDITION_STACK_ORDER)[number], string> = {
  normal: 'Normal',
  observation: 'Observação',
  attention: 'Atenção',
  unclassified: 'Sem classificação',
  noData: 'Sem dados',
};
