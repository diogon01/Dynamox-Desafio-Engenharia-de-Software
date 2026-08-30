import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@dynamox/ui';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { formatNumber } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { axisTickStyle, chartGridStroke, chartTooltipStyles } from './chartTheme';

/**
 * Atividade de aquisição nas últimas 24 h: amostras radiais persistidas por hora.
 * É aquisição de telemetria — nunca "produção", "ocupação" ou OEE, que o domínio
 * não possui.
 */
export function AcquisitionActivity({
  view,
  loading,
}: {
  view: DashboardView;
  loading: boolean;
}): JSX.Element {
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);
  const data = view.activity24h;
  const hasSamples = data.some((bucket) => bucket.samples > 0);

  return (
    <DashboardCard
      title="Atividade de aquisição (24 h)"
      titleId="acquisition-activity-title"
      subtitle="Amostras radiais persistidas por hora, nas últimas 24 horas."
      info="Contagem das amostras já carregadas para a avaliação de condição (séries radiais dos sensores demonstrativos)."
    >
      {loading ? <Skeleton variant="rounded" height={200} /> : null}
      {!loading && !hasSamples ? (
        <EmptyState
          title="Sem aquisições nas últimas 24 h"
          description="As barras aparecem quando houver leituras persistidas na janela."
        />
      ) : null}
      {!loading && hasSamples ? (
        <Box sx={{ width: '100%', flexGrow: 1, minHeight: 132 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke={chartGridStroke(muiTheme)} />
              <XAxis
                dataKey="label"
                tick={axisTickStyle(muiTheme)}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                tick={axisTickStyle(muiTheme)}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(value: number) => formatNumber(value, 0)}
              />
              <Tooltip
                {...tooltip}
                cursor={{ fill: chartGridStroke(muiTheme) }}
                labelFormatter={(label) => `Janela ${String(label)}`}
                formatter={(value: number, _name, entry) => {
                  const reporting =
                    (entry?.payload as { sensorsReporting?: number } | undefined)
                      ?.sensorsReporting ?? 0;
                  return [
                    `${formatNumber(value, 0)} amostra(s) · ${reporting} sensor(es) reportando`,
                    'Aquisição',
                  ];
                }}
              />
              <Bar
                dataKey="samples"
                name="Amostras"
                fill={muiTheme.palette.primary.main}
                radius={[3, 3, 0, 0]}
                maxBarSize={30}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      ) : null}
    </DashboardCard>
  );
}
