import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useMemo, type RefObject } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { TimeSeriesSampleDto, TimeSeriesSummary } from '@dynamox/domain';
import { EmptyState, ErrorState } from '@dynamox/ui';

import {
  buildTrendView,
  computeDemonstrativeSeriesBaseline,
  computeSampleStats,
} from '../../features/dashboard/dashboardAggregations';
import {
  formatAxisValue,
  formatDateTime,
  formatChartTick,
  formatMeasurement,
  formatNumber,
  formatRange,
  formatRelativeTime,
  seriesMetricLabel,
} from '../../features/dashboard/dashboardFormatters';
import type { DashboardPeriod } from '../../features/dashboard/dashboardSlice';
import type { RequestStatus } from '../../store/requestStatus';
import { DashboardCard } from './DashboardCard';
import { axisTickStyle, chartGridStroke, chartTooltipStyles } from './chartTheme';

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '24h': '24 horas',
  '7d': '7 dias',
  '30d': '30 dias',
  all: 'todo o histórico',
};

export interface TrendPanelProps {
  period: DashboardPeriod;
  series: TimeSeriesSummary[];
  selectedSeriesId: string | null;
  samples: TimeSeriesSampleDto[];
  status: RequestStatus;
  error: string | null;
  nowMs: number;
  onRetry: () => void;
  /** Muda o período global — usado pelo estado vazio para alcançar o dado existente. */
  onPeriodChange: (period: DashboardPeriod) => void;
  /** Alvo do drill-down: o painel recebe foco quando uma exceção é aberta. */
  headingRef?: RefObject<HTMLHeadingElement>;
}

/**
 * Tendência crítica — a evidência temporal do item em investigação. O contexto vem do
 * ranking/matriz (sem seletores em cascata aqui; eles vivem no explorador). Lacunas
 * permanecem null: nada é interpolado nem preenchido com zero.
 */
export function TrendPanel({
  period,
  series,
  selectedSeriesId,
  samples,
  status,
  error,
  nowMs,
  onRetry,
  onPeriodChange,
  headingRef,
}: TrendPanelProps): JSX.Element {
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);
  const selected = series.find((item) => item.id === selectedSeriesId) ?? null;
  const trend = useMemo(() => buildTrendView(samples, period, nowMs), [samples, period, nowMs]);
  const baseline = selected
    ? computeDemonstrativeSeriesBaseline(selected.sensorSerialNumber, samples)
    : null;
  const stats = useMemo(() => computeSampleStats(trend.filteredSamples), [trend.filteredSamples]);

  const metrics = [
    { label: 'Atual', value: stats.last },
    { label: 'Máximo', value: stats.max },
    { label: 'Mínimo', value: stats.min },
    { label: 'Média', value: stats.avg },
  ];

  return (
    <DashboardCard
      title={`Tendência crítica — ${PERIOD_LABELS[period]}`}
      titleId="trend-title"
      subtitle={
        selected
          ? `${selected.machineName ?? 'Máquina não associada'} · ${selected.monitoringPointName ?? 'Sem ponto'} · ${selected.sensorSerialNumber} · ${seriesMetricLabel(selected.physicalQuantity, selected.axis)}`
          : 'Selecione um item na prioridade de inspeção ou na matriz da frota.'
      }
      action={
        selected ? (
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap justifyContent="flex-end">
            <Chip
              label={
                trend.mode === 'raw'
                  ? 'Dado bruto'
                  : trend.mode === 'acquisition'
                    ? 'Média por aquisição'
                    : 'Média agregada'
              }
              size="small"
              variant="outlined"
            />
            <Chip label={`Unidade: ${selected.unit}`} size="small" variant="outlined" />
            <Chip
              label={`Última leitura ${formatRelativeTime(selected.lastTimestamp, nowMs)}`}
              size="small"
              variant="outlined"
            />
          </Stack>
        ) : undefined
      }
    >
      {/* Alvo de foco do drill-down; invisível, não altera o layout. */}
      <Typography
        component="h3"
        ref={headingRef}
        tabIndex={-1}
        sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', m: 0 }}
      >
        {selected ? `Investigação — ${selected.sensorSerialNumber}` : 'Investigação'}
      </Typography>

      {status === 'loading' || status === 'idle' ? (
        <Skeleton variant="rounded" height={300} aria-label="Carregando tendência" />
      ) : null}

      {status === 'failed' ? (
        <ErrorState
          title="Não foi possível carregar a tendência"
          message={error ?? 'A série selecionada não respondeu.'}
          onRetry={onRetry}
        />
      ) : null}

      {status === 'succeeded' && trend.filteredSamples.length === 0 ? (
        <EmptyState
          title={`Sem dados em ${PERIOD_LABELS[period]}`}
          description={`O intervalo disponível desta série é ${formatRange(trend.availableStart, trend.availableEnd)}. Nenhum ponto foi simulado para preencher a lacuna.`}
          action={
            trend.availableStart && period !== 'all' ? (
              <Button size="small" variant="outlined" onClick={() => onPeriodChange('all')}>
                Ver período disponível
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {status === 'succeeded' && trend.filteredSamples.length > 0 && selected ? (
        <>
          <Stack
            direction="row"
            spacing={0}
            divider={<Box sx={{ borderLeft: 1, borderColor: 'divider' }} />}
            sx={{ mb: 1, borderRadius: 1.5, bgcolor: 'background.default', overflow: 'hidden' }}
          >
            {metrics.map((metric) => (
              <Box key={metric.label} sx={{ flex: 1, px: 1.25, py: 0.75, minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary" component="div" noWrap>
                  {metric.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {formatMeasurement(metric.value, selected.unit)}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Box
            role="img"
            aria-label={`Gráfico de ${seriesMetricLabel(selected.physicalQuantity, selected.axis)} em ${selected.unit}`}
            sx={{ width: '100%', height: { xs: 240, md: 280 }, minWidth: 0 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.points} margin={{ top: 10, right: 14, bottom: 4, left: 4 }} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke(muiTheme)} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={formatChartTick}
                  tick={axisTickStyle(muiTheme)}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={axisTickStyle(muiTheme)}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  domain={['auto', 'auto']}
                  tickFormatter={formatAxisValue}
                />
                <Tooltip
                  {...tooltip}
                  labelFormatter={(label) => formatDateTime(Number(label))}
                  formatter={(value) => [
                    `${formatNumber(Number(value), 4)} ${selected.unit}`,
                    trend.mode === 'raw' ? 'Dado bruto' : 'Média da janela',
                  ]}
                />
                {baseline !== null ? (
                  <ReferenceLine
                    y={baseline}
                    stroke={muiTheme.palette.condition.observation}
                    strokeDasharray="5 4"
                    label={{
                      value: `Baseline: ${formatMeasurement(baseline, selected.unit)}`,
                      position: 'insideBottomRight',
                      fontSize: 10.5,
                      fill: muiTheme.palette.condition.observation,
                    }}
                  />
                ) : null}
                {baseline !== null ? (
                  <ReferenceLine
                    y={baseline * 2}
                    stroke={muiTheme.palette.condition.attention}
                    strokeDasharray="5 4"
                    label={{
                      value: `Limiar didático 2×: ${formatMeasurement(baseline * 2, selected.unit)}`,
                      position: 'insideTopRight',
                      fontSize: 10.5,
                      fill: muiTheme.palette.condition.attention,
                    }}
                  />
                ) : null}
                <Line
                  // Entre aquisições não existe medição: a reta liga pontos medidos sem
                  // sugerir uma curva contínua que ninguém observou.
                  type={trend.mode === 'acquisition' ? 'linear' : 'monotone'}
                  dataKey="value"
                  name={trend.mode === 'raw' ? 'Dado bruto' : 'Média da aquisição'}
                  stroke={muiTheme.palette.primary.main}
                  strokeWidth={2}
                  dot={
                    trend.mode === 'acquisition' || trend.filteredSamples.length < 40
                      ? { r: 3 }
                      : false
                  }
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Cobertura real exibida: {formatRange(trend.coveredStart, trend.coveredEnd)} ·{' '}
            {trend.filteredSamples.length} amostra(s)
            {trend.mode === 'acquisition'
              ? ` em ${trend.points.length} aquisição(ões); cada ponto é a média medida de uma delas.`
              : '. Lacunas permanecem sem conexão e sem zero artificial.'}
          </Typography>
        </>
      ) : null}
    </DashboardCard>
  );
}
