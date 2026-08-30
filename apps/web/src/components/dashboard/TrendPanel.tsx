import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
} from '../../features/dashboard/dashboardAggregations';
import {
  formatAxisValue,
  formatDateTime,
  formatChartTick,
  formatNumber,
  formatRange,
  seriesMetricLabel,
} from '../../features/dashboard/dashboardFormatters';
import type { DashboardPeriod } from '../../features/dashboard/dashboardSlice';
import type { RequestStatus } from '../../store/requestStatus';
import { SeriesHierarchyFilters } from './SeriesHierarchyFilters';

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
  onSelectSeries: (seriesId: string) => void;
  onRetry: () => void;
  /** Muda o período global — usado pelo estado vazio para alcançar o dado existente. */
  onPeriodChange: (period: DashboardPeriod) => void;
  /** Alvo do drill-down: o painel recebe foco quando uma exceção é aberta. */
  headingRef?: RefObject<HTMLHeadingElement>;
}

export function TrendPanel({
  period,
  series,
  selectedSeriesId,
  samples,
  status,
  error,
  nowMs,
  onSelectSeries,
  onRetry,
  onPeriodChange,
  headingRef,
}: TrendPanelProps): JSX.Element {
  const muiTheme = useTheme();
  const selected = series.find((item) => item.id === selectedSeriesId) ?? null;
  const trend = useMemo(
    () => buildTrendView(samples, period, nowMs),
    [samples, period, nowMs],
  );
  const baseline = selected
    ? computeDemonstrativeSeriesBaseline(selected.sensorSerialNumber, samples)
    : null;

  return (
    <Card variant="outlined" component="section" aria-labelledby="trend-title" sx={{ minWidth: 0 }}>
      <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          gap={1}
        >
          <Box>
            <Typography
              id="trend-title"
              variant="h2"
              component="h2"
              ref={headingRef}
              tabIndex={-1}
              sx={{ outline: 'none' }}
            >
              Investigação{selected ? ` — ${selected.sensorSerialNumber}` : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selected
                ? `${selected.machineName ?? 'Máquina não associada'} · ${selected.monitoringPointName ?? 'Sem ponto'} · ${seriesMetricLabel(selected.physicalQuantity, selected.axis)} · ${PERIOD_LABELS[period]}`
                : 'Selecione um ponto na fila de inspeção ou na frota para ver o histórico.'}
            </Typography>
          </Box>
          {selected ? (
            <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<InsightsOutlinedIcon />}
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
              {baseline !== null ? (
                <Chip label="Baseline demonstrativo" size="small" color="warning" variant="outlined" />
              ) : null}
            </Stack>
          ) : null}
        </Stack>

        {series.length > 0 ? (
          <Box sx={{ mt: 1.5 }}>
            <SeriesHierarchyFilters
              series={series}
              selectedSeriesId={selectedSeriesId}
              onSelect={onSelectSeries}
            />
          </Box>
        ) : null}

        {status === 'loading' || status === 'idle' ? (
          <Skeleton variant="rounded" height={300} sx={{ mt: 1.5 }} aria-label="Carregando tendência" />
        ) : null}

        {status === 'failed' ? (
          <Box sx={{ mt: 1.5 }}>
            <ErrorState
              title="Não foi possível carregar a tendência"
              message={error ?? 'A série selecionada não respondeu.'}
              onRetry={onRetry}
            />
          </Box>
        ) : null}

        {status === 'succeeded' && trend.filteredSamples.length === 0 ? (
          <Box sx={{ mt: 1.5 }}>
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
          </Box>
        ) : null}

        {status === 'succeeded' && trend.filteredSamples.length > 0 && selected ? (
          <>
            <Box
              role="img"
              aria-label={`Gráfico de ${seriesMetricLabel(selected.physicalQuantity, selected.axis)} em ${selected.unit}`}
              sx={{ width: '100%', height: { xs: 260, md: 320 }, mt: 1.5, minWidth: 0 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trend.points}
                  margin={{ top: 12, right: 16, bottom: 8, left: 4 }}
                  accessibilityLayer
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={muiTheme.palette.divider}
                  />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatChartTick}
                    fontSize={11}
                    minTickGap={28}
                  />
                  <YAxis
                    fontSize={11}
                    width={58}
                    domain={['auto', 'auto']}
                    tickFormatter={formatAxisValue}
                  />
                  <Tooltip
                    accessibilityLayer
                    labelFormatter={(label) => formatDateTime(Number(label))}
                    formatter={(value) => [
                      `${formatNumber(Number(value), 4)} ${selected.unit}`,
                      trend.mode === 'raw' ? 'Dado bruto' : 'Média da janela',
                    ]}
                  />
                  {baseline !== null ? (
                    <ReferenceLine
                      y={baseline}
                      stroke={muiTheme.palette.warning.main}
                      strokeDasharray="5 4"
                      label={{ value: 'baseline demo', position: 'insideTopRight', fontSize: 11 }}
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
      </CardContent>
    </Card>
  );
}
