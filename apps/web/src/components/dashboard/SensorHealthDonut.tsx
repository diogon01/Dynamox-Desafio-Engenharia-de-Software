import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { EmptyState } from '@dynamox/ui';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { formatNumber } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { chartTooltipStyles } from './chartTheme';

/**
 * Saúde/disponibilidade dos sensores — este painel é sobre RECÊNCIA e presença de dado,
 * nunca sobre condição (Normal/Observação/Atenção não aparecem aqui).
 */
export function SensorHealthDonut({
  view,
  loading,
}: {
  view: DashboardView;
  loading: boolean;
}): JSX.Element {
  const muiTheme = useTheme();
  const noSensor = view.cells.filter((cell) => cell.condition === 'no-sensor').length;

  const slices = [
    {
      key: 'current',
      label: 'Atualizados',
      value: view.distribution.find((item) => item.key === 'current')?.value ?? 0,
      color: muiTheme.palette.condition.normal,
    },
    {
      key: 'stale',
      label: 'Desatualizados',
      value: view.distribution.find((item) => item.key === 'stale')?.value ?? 0,
      color: muiTheme.palette.condition.stale,
    },
    {
      key: 'future',
      label: 'Relógio divergente',
      value: view.distribution.find((item) => item.key === 'future')?.value ?? 0,
      color: muiTheme.palette.condition.attention,
    },
    {
      key: 'no-data',
      label: 'Sem dados',
      value: view.distribution.find((item) => item.key === 'no-data')?.value ?? 0,
      color: muiTheme.palette.condition.noData,
    },
    {
      key: 'no-sensor',
      label: 'Não instalado',
      value: noSensor,
      color: muiTheme.palette.condition.unclassified,
    },
  ].filter((slice) => slice.value > 0);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const tooltip = chartTooltipStyles(muiTheme);

  return (
    <DashboardCard
      title="Saúde dos sensores"
      titleId="sensor-health-title"
      subtitle="Disponibilidade e recência das leituras — não é condição."
      info="Atualizado = leitura nas últimas 24 h. Condição (Normal/Atenção) vive nos painéis de condição."
    >
      {loading ? <Skeleton variant="circular" width={150} height={150} sx={{ mx: 'auto' }} /> : null}

      {!loading && total === 0 ? (
        <EmptyState
          title="Nenhum sensor"
          description="Associe sensores aos pontos para acompanhar a disponibilidade."
        />
      ) : null}

      {!loading && total > 0 ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ flexGrow: 1, minHeight: 0 }}
        >
          <Box
            sx={{ position: 'relative', width: 138, height: '100%', minHeight: 116, flexShrink: 0 }}
            role="img"
            aria-label={slices.map((slice) => `${slice.label}: ${slice.value}`).join('; ')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="96%"
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} sensor(es) · ${formatNumber((value / total) * 100, 1)}%`,
                    name,
                  ]}
                  {...tooltip}
                />
              </PieChart>
            </ResponsiveContainer>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '1.35rem', fontWeight: 750, lineHeight: 1.05 }}>
                  {total}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {total === 1 ? 'sensor' : 'sensores'}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Stack spacing={0.6} sx={{ flexGrow: 1, minWidth: 0 }}>
            {slices.map((slice) => (
              <Stack key={slice.key} direction="row" alignItems="center" spacing={0.75}>
                <Box
                  aria-hidden="true"
                  sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: slice.color, flexShrink: 0 }}
                />
                <Typography variant="caption" sx={{ flexGrow: 1 }} noWrap>
                  {slice.label}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {slice.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ width: 44, textAlign: 'right' }}>
                  {formatNumber((slice.value / total) * 100, 1)}%
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      ) : null}
    </DashboardCard>
  );
}
