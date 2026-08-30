import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { EmptyState } from '@dynamox/ui';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';

/**
 * Recência da frota — visão secundária, ao lado da matriz.
 *
 * Condição e recência continuam eixos distintos: um sensor pode estar dentro do baseline e
 * mesmo assim ter parado de reportar. Este painel responde só à segunda pergunta; a
 * primeira é do KPI "Em atenção" e da fila de inspeção.
 */
export interface FleetFreshnessProps {
  view: DashboardView;
  loading: boolean;
}

export function FleetFreshness({ view, loading }: FleetFreshnessProps): JSX.Element {
  const total = view.distribution.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card variant="outlined" component="section" aria-labelledby="freshness-title" sx={{ minWidth: 0 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <BarChartOutlinedIcon color="primary" aria-hidden="true" />
          <Box>
            <Typography id="freshness-title" variant="h2" component="h2">
              Recência das leituras
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Quando cada sensor instalado reportou pela última vez.
            </Typography>
          </Box>
        </Stack>

        {loading ? <Skeleton variant="rounded" height={160} sx={{ mt: 2 }} /> : null}

        {!loading && total === 0 ? (
          <EmptyState
            title="Nenhum sensor instalado"
            description="A distribuição aparece depois da associação de sensores aos pontos."
          />
        ) : null}

        {!loading && total > 0 ? (
          <Stack spacing={1.25} sx={{ mt: 2 }}>
            {view.distribution.map((item) => {
              const percentage = (item.value / total) * 100;
              const tone =
                item.key === 'current' ? 'success' : item.key === 'no-data' ? 'neutral' : 'warning';
              return (
                <Box key={item.key}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {item.value}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      height: 7,
                      borderRadius: 999,
                      bgcolor: 'action.hover',
                      overflow: 'hidden',
                      mt: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: `${percentage}%`,
                        height: '100%',
                        bgcolor: tone === 'neutral' ? 'text.disabled' : `${tone}.main`,
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}
