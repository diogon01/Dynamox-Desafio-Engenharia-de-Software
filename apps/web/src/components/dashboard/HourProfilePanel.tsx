import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
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

import type { HeatmapResponseDto } from '@dynamox/domain';
import { EmptyState } from '@dynamox/ui';

import { formatNumber } from '../../features/dashboard/dashboardFormatters';
import { formatDayKey, formatHourLabel } from '../../features/time/instant';
import { DashboardCard } from './DashboardCard';
import { axisTickStyle, chartGridStroke, chartTooltipStyles } from './chartTheme';

/**
 * Perfil de 24 h do dia escolhido — o detalhe (mestre/detalhe) do mapa de atividade.
 *
 * Consome os mesmos buckets agregados do mapa: trocar de dia não dispara consulta nova, e
 * clicar numa hora abre a janela correspondente na investigação.
 */
export interface HourProfilePanelProps {
  data: HeatmapResponseDto | null;
  loading: boolean;
  /** Dia (YYYY-MM-DD) exibido; sem escolha, o mais recente com atividade. */
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  onSelectWindow: (bucketStart: string) => void;
}

export function HourProfilePanel({
  data,
  loading,
  selectedDay,
  onSelectDay,
  onSelectWindow,
}: HourProfilePanelProps): JSX.Element {
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);

  const days = [...new Set((data?.buckets ?? []).map((bucket) => bucket.day))].sort().reverse();
  const day = selectedDay && days.includes(selectedDay) ? selectedDay : (days[0] ?? null);
  const buckets = (data?.buckets ?? []).filter((bucket) => bucket.day === day);
  const byHour = new Map(buckets.map((bucket) => [bucket.hour, bucket]));

  const chart = Array.from({ length: 24 }, (_, hour) => {
    const bucket = byHour.get(hour);
    return {
      label: String(hour).padStart(2, '0'),
      hour,
      coverage: bucket?.coveragePercent ?? 0,
      acquisitions: bucket?.acquisitionCount ?? 0,
      bucketStart: bucket?.bucketStart ?? null,
    };
  });
  const hasData = chart.some((entry) => entry.acquisitions > 0);

  // Faixa de maior atividade do dia, quando derivável dos próprios buckets.
  let peakLabel: string | null = null;
  if (hasData) {
    const best = Math.max(...chart.map((entry) => entry.coverage));
    const first = chart.findIndex((entry) => entry.coverage >= best * 0.75 && entry.coverage > 0);
    let last = first;
    while (last + 1 < 24 && chart[last + 1].coverage >= best * 0.75) last += 1;
    peakLabel = `${formatHourLabel(first)}–${formatHourLabel(last + 1)}`;
  }

  return (
    <DashboardCard
      title="Horários de pico (24 h)"
      titleId="hour-profile-title"
      size="chart"
      subtitle="% de sensores com leitura por hora, no dia selecionado."
      info="Mesmos buckets do mapa de atividade: trocar de dia não faz nova consulta."
      action={
        days.length > 0 ? (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={day}
            onChange={(_event, next: string | null) => {
              if (next) onSelectDay(next);
            }}
            sx={{ '& .MuiToggleButton-root': { flex: 1, px: 0.5, py: 0.35, minHeight: 26, fontSize: 10.5 } }}
          >
            {days.slice(0, 5).map((value) => (
              <ToggleButton key={value} value={value} aria-label={formatDayKey(value)}>
                {formatDayKey(value)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        ) : undefined
      }
    >
      {loading ? <Skeleton variant="rounded" height={150} /> : null}

      {!loading && !hasData ? (
        <EmptyState title="Sem leituras neste dia" description="Escolha outro dia no mapa de atividade." />
      ) : null}

      {!loading && hasData ? (
        <>
          <Box sx={{ width: '100%', flexGrow: 1, minHeight: 118 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke={chartGridStroke(muiTheme)} />
                <XAxis
                  dataKey="label"
                  tick={axisTickStyle(muiTheme)}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  tick={axisTickStyle(muiTheme)}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <Tooltip
                  {...tooltip}
                  cursor={{ fill: chartGridStroke(muiTheme) }}
                  formatter={(value: number, _name, entry) => [
                    `${formatNumber(value, 0)}% · ${(entry?.payload as { acquisitions: number }).acquisitions} aquisição(ões)`,
                    'Cobertura',
                  ]}
                  labelFormatter={(label) => `${label}h`}
                />
                <Bar
                  dataKey="coverage"
                  fill={muiTheme.palette.primary.main}
                  isAnimationActive={false}
                  maxBarSize={16}
                  cursor="pointer"
                  onClick={(entry: { bucketStart: string | null }) => {
                    if (entry.bucketStart) onSelectWindow(entry.bucketStart);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          {peakLabel ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              • Maior concentração entre {peakLabel} no dia selecionado.
            </Typography>
          ) : null}
        </>
      ) : null}
    </DashboardCard>
  );
}
