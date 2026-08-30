import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { EmptyState } from '@dynamox/ui';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { formatShortDateTime } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { StatusTag } from './StatusTag';

/**
 * Ocorrências recentes — derivadas honestamente do estado disponível: cada linha é a
 * última leitura real de um sensor com a classificação atual. O domínio não persiste
 * eventos, e o painel não finge que persiste.
 */
export function RecentOccurrences({
  view,
  loading,
  onInvestigate,
}: {
  view: DashboardView;
  loading: boolean;
  onInvestigate: (seriesId: string) => void;
}): JSX.Element {
  return (
    <DashboardCard
      title="Ocorrências recentes"
      titleId="occurrences-title"
      subtitle="Últimas leituras e a classificação atual de cada sensor."
      info="Derivado das leituras persistidas — o domínio não possui eventos/alarmes persistidos."
    >
      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} variant="rounded" height={44} />
          ))}
        </Stack>
      ) : null}

      {!loading && view.occurrences.length === 0 ? (
        <EmptyState
          title="Sem leituras registradas"
          description="As ocorrências aparecem quando os sensores começam a reportar."
        />
      ) : null}

      {!loading && view.occurrences.length > 0 ? (
        <Stack divider={<Divider flexItem />}>
          {view.occurrences.map((row) => (
            <ButtonBase
              key={row.id}
              disabled={!row.seriesId}
              onClick={() => {
                if (row.seriesId) onInvestigate(row.seriesId);
              }}
              aria-label={`${row.machineName} ${row.pointLabel} ${row.sensorSerial}: ${row.statusLabel} — ${row.message}`}
              sx={(muiTheme) => ({
                display: 'block',
                textAlign: 'left',
                width: '100%',
                py: 0.9,
                px: 0.5,
                borderRadius: 1,
                '&:hover': { bgcolor: alpha(muiTheme.palette.primary.main, 0.04) },
                '&:focus-visible': {
                  outline: `2px solid ${alpha(muiTheme.palette.primary.main, 0.5)}`,
                },
                '&.Mui-disabled': { opacity: 1 },
              })}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {formatShortDateTime(row.timestamp)}
                </Typography>
                <StatusTag kind={row.statusKind} label={row.statusLabel} />
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }} noWrap>
                {row.machineName} · {row.pointLabel} · {row.sensorSerial}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {row.message}
              </Typography>
            </ButtonBase>
          ))}
        </Stack>
      ) : null}
      {!loading && view.occurrences.length > 0 ? (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Derivado das leituras persistidas; não há alarmes persistidos no domínio.
          </Typography>
        </Box>
      ) : null}
    </DashboardCard>
  );
}
