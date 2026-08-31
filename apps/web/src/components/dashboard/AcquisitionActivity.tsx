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

import type { HeatmapResponseDto } from '@dynamox/domain';
import { formatNumber } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { axisTickStyle, chartGridStroke, chartTooltipStyles } from './chartTheme';

/**
 * Atividade de aquisição nas últimas 24 h: amostras radiais persistidas por hora.
 * É aquisição de telemetria — nunca "produção", "ocupação" ou OEE, que o domínio
 * não possui.
 */
export function AcquisitionActivity({
  heatmap,
  loading,
}: {
  heatmap: HeatmapResponseDto | null;
  loading: boolean;
}): JSX.Element {
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);

  // Últimas 24 células horárias do mapa — os mesmos buckets, sem consulta adicional.
  const buckets = [...(heatmap?.buckets ?? [])]
    .sort((a, b) => Date.parse(a.bucketStart) - Date.parse(b.bucketStart))
    .slice(-24);
  const data = buckets.map((bucket) => ({
    label: `${String(bucket.hour).padStart(2, '0')}h`,
    samples: bucket.sampleCount,
    sensors: bucket.reportingSensors,
    acquisitions: bucket.acquisitionCount,
  }));
  const hasData = data.some((entry) => entry.samples > 0);

  return (
    <DashboardCard
      title="Atividade de aquisição (24 h)"
      titleId="acquisition-activity-title"
      size="chart"
      subtitle="Amostras persistidas por hora, nas últimas 24 horas registradas."
      info="Derivado do mesmo mapa agregado no banco."
    >
      {loading ? <Skeleton variant="rounded" height={132} /> : null}
      {!loading && !hasData ? (
        <EmptyState
          title="Sem aquisições recentes"
          description="As barras aparecem conforme as leituras chegam."
        />
      ) : null}
      {!loading && hasData ? (
        <Box sx={{ width: '100%', flexGrow: 1, minHeight: 132 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke={chartGridStroke(muiTheme)} />
              <XAxis
                dataKey="label"
                tick={axisTickStyle(muiTheme)}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis tick={axisTickStyle(muiTheme)} tickLine={false} axisLine={false} width={46} />
              <Tooltip
                {...tooltip}
                cursor={{ fill: chartGridStroke(muiTheme) }}
                formatter={(value: number, _name, entry) => {
                  const payload = entry?.payload as { sensors: number; acquisitions: number };
                  return [
                    `${formatNumber(value, 0)} amostras · ${payload.acquisitions} aquisição(ões) · ${payload.sensors} sensor(es)`,
                    'Hora',
                  ];
                }}
              />
              <Bar
                dataKey="samples"
                fill={muiTheme.palette.primary.main}
                isAnimationActive={false}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      ) : null}
    </DashboardCard>
  );
}
