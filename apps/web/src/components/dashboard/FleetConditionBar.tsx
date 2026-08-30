import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { EmptyState } from '@dynamox/ui';

import type {
  ConditionKind,
  DashboardView,
} from '../../features/dashboard/dashboardAggregations';
import { formatNumber } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { statusColor } from './StatusTag';

/** Ordem canônica dos segmentos: do melhor para o pior, depois os não medidos. */
const SEGMENTS: Array<{ kind: ConditionKind; label: string }> = [
  { kind: 'normal', label: 'Normal demonstrativo' },
  { kind: 'observation', label: 'Observação demonstrativa' },
  { kind: 'attention', label: 'Atenção demonstrativa' },
  { kind: 'unclassified', label: 'Sem classificação' },
  { kind: 'no-data', label: 'Sem dados' },
  { kind: 'no-sensor', label: 'Sem sensor' },
];

/**
 * Distribuição da condição dos pontos monitorados — barra horizontal segmentada.
 * Responde: como está distribuída a condição da frota? (Recência NÃO entra aqui;
 * ela tem o próprio painel.)
 */
export function FleetConditionBar({
  view,
  loading,
}: {
  view: DashboardView;
  loading: boolean;
}): JSX.Element {
  const muiTheme = useTheme();
  const counts = new Map<ConditionKind, number>();
  for (const cell of view.cells) {
    counts.set(cell.condition, (counts.get(cell.condition) ?? 0) + 1);
  }
  const total = view.cells.length;
  const present = SEGMENTS.map((segment) => ({
    ...segment,
    count: counts.get(segment.kind) ?? 0,
  })).filter((segment) => segment.count > 0);

  return (
    <DashboardCard
      title="Condição da frota"
      titleId="fleet-condition-title"
      subtitle={`${total} ponto(s) monitorado(s)`}
      info="Distribuição da classificação demonstrativa por ponto. Recência e cobertura têm painéis próprios."
    >
      {loading ? <Skeleton variant="rounded" height={120} /> : null}

      {!loading && total === 0 ? (
        <EmptyState
          title="Nenhum ponto monitorado"
          description="Cadastre máquinas e pontos para acompanhar a condição."
        />
      ) : null}

      {!loading && total > 0 ? (
        <>
          <Stack
            direction="row"
            role="img"
            aria-label={present
              .map((segment) => `${segment.label}: ${segment.count} de ${total}`)
              .join('; ')}
            sx={{ height: 26, borderRadius: 1.5, overflow: 'hidden' }}
          >
            {present.map((segment) => {
              const share = segment.count / total;
              return (
                <Tooltip
                  key={segment.kind}
                  arrow
                  title={`${segment.label} — ${segment.count} ponto(s) · ${formatNumber(share * 100, 1)}%`}
                >
                  <Box
                    sx={{
                      width: `${share * 100}%`,
                      minWidth: 14,
                      bgcolor: statusColor(segment.kind, muiTheme.palette),
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {share >= 0.12 ? (
                      <Typography
                        sx={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}
                      >
                        {formatNumber(share * 100, 0)}%
                      </Typography>
                    ) : null}
                  </Box>
                </Tooltip>
              );
            })}
          </Stack>

          <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.8} sx={{ mt: 1.1 }}>
            {present.map((segment) => (
              <Stack key={segment.kind} direction="row" alignItems="center" spacing={0.55} sx={{ minWidth: '29%' }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    flexShrink: 0,
                    bgcolor: statusColor(segment.kind, muiTheme.palette),
                  }}
                />
                <Typography variant="caption" noWrap>
                  {segment.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      ) : null}
    </DashboardCard>
  );
}
