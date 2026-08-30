import Box from '@mui/material/Box';
import { alpha, useTheme, type Theme } from '@mui/material/styles';

import type { ConditionKind } from '../../features/dashboard/dashboardAggregations';

export type StatusTagKind = ConditionKind | 'stale' | 'future';

const LABELS: Record<StatusTagKind, string> = {
  normal: 'Normal',
  observation: 'Observação',
  attention: 'Atenção',
  unclassified: 'Sem classificação',
  'no-data': 'Sem dados',
  'no-sensor': 'Sem sensor',
  stale: 'Desatualizado',
  future: 'Relógio divergente',
};

export function statusColor(kind: StatusTagKind, palette: Theme['palette']): string {
  switch (kind) {
    case 'normal':
      return palette.condition.normal;
    case 'observation':
      return palette.condition.observation;
    case 'attention':
      return palette.condition.attention;
    case 'no-data':
      return palette.condition.noData;
    case 'stale':
      return palette.condition.stale;
    case 'future':
      return palette.condition.attention;
    default:
      return palette.condition.unclassified;
  }
}

/**
 * Rótulo de estado — é informação, não ação: nunca parece um botão. Cor + texto sempre
 * juntos (cor não é o único canal).
 */
export function StatusTag({
  kind,
  label,
}: {
  kind: StatusTagKind;
  label?: string;
}): JSX.Element {
  const muiTheme = useTheme();
  const color = statusColor(kind, muiTheme.palette);
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 0.9,
        py: 0.2,
        borderRadius: 1,
        bgcolor: alpha(color, 0.12),
        color,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? LABELS[kind]}
    </Box>
  );
}
