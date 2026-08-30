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

import { EmptyState } from '@dynamox/ui';

import type { WeekHeatmap } from '../../features/dashboard/dashboardAggregations';
import { formatNumber } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { axisTickStyle, chartGridStroke, chartTooltipStyles } from './chartTheme';

/**
 * Perfil 24 h do dia selecionado — o detalhe (master/detail) do mapa de calor semanal.
 * Barras verticais de % de sensores com leitura por hora; mesma métrica do heatmap.
 */
export function DayProfilePanel({
  weekMap,
  loading,
  selectedDay,
  onSelectDay,
}: {
  weekMap: WeekHeatmap;
  loading: boolean;
  selectedDay: number;
  onSelectDay: (day: number) => void;
}): JSX.Element {
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);
  const dayRow = weekMap.days[selectedDay];
  const data =
    dayRow?.hours.map((hour) => ({
      label: `${String(hour.hour).padStart(2, '0')}`,
      share: hour.share * 100,
      sensorsReporting: hour.sensorsReporting,
      samples: hour.samples,
    })) ?? [];
  const hasData = data.some((entry) => entry.samples > 0);

  // Faixa de maior atividade do DIA selecionado, só quando derivável.
  let peakLabel: string | null = null;
  if (dayRow && hasData) {
    const best = Math.max(...dayRow.hours.map((hour) => hour.share));
    if (best > 0) {
      const first = dayRow.hours.findIndex((hour) => hour.share >= best * 0.75 && hour.share > 0);
      let last = first;
      while (last + 1 < 24 && dayRow.hours[last + 1].share >= best * 0.75) last += 1;
      peakLabel = `${String(first).padStart(2, '0')}h–${String(last + 1).padStart(2, '0')}h`;
    }
  }

  return (
    <DashboardCard
      title="Horários de pico (visão semanal)"
      titleId="day-profile-title"
      subtitle="% de sensores com leitura por hora, no dia selecionado."
      info="Detalhe do mapa de calor: mesmo cálculo, um dia por vez. Aquisição do período carregado — não é tempo real."
    >
      {loading ? <Skeleton variant="rounded" height={210} /> : null}

      {!loading ? (
        <>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={selectedDay}
            aria-label="Dia da semana"
            onChange={(_event, next: number | null) => {
              if (next !== null) onSelectDay(next);
            }}
            sx={{
              mb: 1,
              display: 'flex',
              '& .MuiToggleButton-root': { flex: 1, px: 0.25, fontSize: 11 },
            }}
          >
            {weekMap.days.map((day) => (
              <ToggleButton key={day.day} value={day.day} aria-label={day.label}>
                {day.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {!hasData ? (
            <EmptyState
              title="Sem leituras neste dia"
              description="Selecione um dia com atividade no mapa de calor."
            />
          ) : (
            <>
              <Box sx={{ width: '100%', height: 158 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: -14 }}>
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
                      tickFormatter={(value: number) => `${formatNumber(value, 0)}%`}
                    />
                    <Tooltip
                      {...tooltip}
                      cursor={{ fill: chartGridStroke(muiTheme) }}
                      labelFormatter={(label) => `${String(label)}h`}
                      formatter={(value: number, _name, entry) => {
                        const payload = entry?.payload as
                          | { sensorsReporting?: number; samples?: number }
                          | undefined;
                        return [
                          `${formatNumber(value, 1)}% · ${payload?.sensorsReporting ?? 0}/${weekMap.totalSensors} sensor(es) · ${formatNumber(payload?.samples ?? 0, 0)} amostra(s)`,
                          'Cobertura',
                        ];
                      }}
                    />
                    <Bar
                      dataKey="share"
                      name="Cobertura"
                      fill={muiTheme.palette.primary.main}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={16}
                      isAnimationActive={false}
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
          )}
        </>
      ) : null}
    </DashboardCard>
  );
}
