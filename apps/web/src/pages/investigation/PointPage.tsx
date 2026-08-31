import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, ErrorState, LoadingState } from '@dynamox/ui';

import { api } from '../../api/client';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { StatusTag, statusColor } from '../../components/dashboard/StatusTag';
import { axisTickStyle, chartGridStroke, chartTooltipStyles } from '../../components/dashboard/chartTheme';
import { DeviationBar } from '../../components/investigation/DeviationBar';
import { InvestigationPageHeader } from '../../components/investigation/InvestigationPageHeader';
import { KpiStrip } from '../../components/investigation/KpiStrip';
import { RangePresets, type RangePreset } from '../../components/investigation/RangePresets';
import { trendDirection } from '../../components/investigation/TrendSparkline';
import {
  formatAxisValue,
  formatMeasurement,
  formatNumber,
  seriesMetricLabel,
} from '../../features/dashboard/dashboardFormatters';
import { links } from '../../features/investigation/links';
import { useAnalyticsQuery, useTimeRange } from '../../features/investigation/useAnalyticsQuery';
import {
  TIME_ZONE_LABEL,
  formatChartTick,
  formatDateTime,
  formatRange,
  formatRelativeTime,
} from '../../features/time/instant';

/**
 * NÍVEL "PONTO": o contexto entre o ativo e o sensor.
 *
 * Deliberadamente mais raso que a página do sensor. Responde "este ponto está bem, está
 * reportando, e o que ele mede?" — e entrega o próximo passo. Quem quer trinta dias de
 * história, aquisições paginadas e dados brutos desce um nível: o botão está aqui.
 */
export function PointPage(): JSX.Element {
  const { machineKey = '', pointKey = '' } = useParams();
  const [, setSearch] = useSearchParams();
  const range = useTimeRange();
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);

  const query = useAnalyticsQuery(
    () => api.pointSummary(machineKey, pointKey, { from: range.from, to: range.to }),
    [machineKey, pointKey, range.from, range.to],
  );
  const point = query.data;

  const applyPreset = (preset: RangePreset) => {
    const to = new Date();
    const from = new Date(to.getTime() - preset.days * 86_400_000);
    setSearch(new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }));
  };

  const chartData = (point?.trend ?? []).map((entry) => ({
    t: Date.parse(entry.timestamp),
    value: entry.value,
  }));

  const notFound =
    query.status === 'failed' && query.httpStatus === 404;

  return (
    <Box sx={{ pb: 3 }}>
      <InvestigationPageHeader
        steps={[
          { label: 'Visão geral', to: '/' },
          {
            label: point?.machineName ?? machineKey,
            to: links.asset(point?.machineName ?? machineKey, range),
          },
          { label: point?.monitoringPointName ?? pointKey },
        ]}
        title={point?.monitoringPointName ?? pointKey}
        subtitle={
          point
            ? `${point.machineName} · ${point.sensorSerialNumber ?? 'sem sensor instalado'}${point.sensorModel ? ` · ${point.sensorModel}` : ''} · última leitura ${formatRelativeTime(point.window.lastAt)}`
            : 'Ponto de monitoramento.'
        }
        chips={
          <>
            {point ? <StatusTag kind={point.condition} /> : null}
            <Chip size="small" variant="outlined" label={formatRange(range.from, range.to)} />
            <Chip size="small" variant="outlined" label={TIME_ZONE_LABEL} />
          </>
        }
        actions={
          <Stack direction="row" gap={1} alignItems="flex-start">
            <RangePresets from={range.from} to={range.to} onSelect={applyPreset} />
            {point?.sensorSerialNumber ? (
              <Button
                component={RouterLink}
                to={links.sensor(point.sensorSerialNumber, range)}
                variant="contained"
                size="small"
                endIcon={<ArrowForwardIcon />}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Abrir sensor
              </Button>
            ) : null}
          </Stack>
        }
      />

      {query.status === 'loading' || query.status === 'idle' ? (
        <LoadingState label="Consultando o ponto…" />
      ) : null}

      {notFound ? (
        <EmptyState
          title="Ponto não encontrado"
          description={`"${pointKey}" não corresponde a nenhum ponto de "${machineKey}". Verifique o endereço ou volte ao ativo.`}
        />
      ) : null}

      {query.status === 'failed' && !notFound ? (
        <ErrorState
          message={query.error ?? 'Não foi possível carregar o ponto.'}
          onRetry={query.reload}
        />
      ) : null}

      {query.status === 'succeeded' && point ? (
        <Box
          sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: `${theme.dashboard.gridGap}px`,
            alignItems: 'stretch',
          })}
        >
          <Box sx={{ gridColumn: 'span 12' }}>
            <KpiStrip
              items={[
                {
                  label: 'Desvio vs. referência',
                  value:
                    point.deviationRatio === null ? '—' : `${formatNumber(point.deviationRatio, 2)}×`,
                  hint:
                    point.baselineValue === null
                      ? 'sem referência na janela'
                      : `ref ${formatMeasurement(point.baselineValue, point.unit)}`,
                  tone: (point.deviationRatio ?? 0) >= 2 ? 'warning' : 'default',
                },
                {
                  label: 'Último valor',
                  value:
                    point.window.lastValue === null
                      ? '—'
                      : formatMeasurement(point.window.lastValue, point.unit),
                  hint: formatRelativeTime(point.window.lastAt),
                },
                {
                  label: 'Aquisições na janela',
                  value: formatNumber(point.window.acquisitionCount, 0),
                  hint: `${formatNumber(point.window.sampleCount, 0)} amostras agregadas`,
                },
                {
                  label: 'Faixa da janela',
                  value:
                    point.window.min === null || point.window.max === null
                      ? '—'
                      : `${formatNumber(point.window.min, 4)} – ${formatNumber(point.window.max, 4)}`,
                  hint: point.window.avg === null ? undefined : `média ${formatNumber(point.window.avg, 4)} ${point.unit}`,
                },
              ]}
            />
          </Box>

          <Box sx={{ gridColumn: { xs: 'span 12', lg: 'span 8' }, display: 'flex', minWidth: 0 }}>
            <DashboardCard
              title="Tendência do ponto"
              titleId="point-trend-title"
              size="chart"
              subtitle="RMS do eixo âncora por bucket, nas últimas 24 h da janela."
              info="A história completa do período está na página do sensor, com bucket ajustável."
            >
              {chartData.length < 2 ? (
                <EmptyState
                  title="Sem tendência no período"
                  description="O ponto não reportou o suficiente para desenhar uma curva."
                />
              ) : (
                <Box sx={{ width: '100%', flexGrow: 1, minHeight: 160 }} role="img" aria-label="Tendência do ponto">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke(muiTheme)} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={formatChartTick}
                        tick={axisTickStyle(muiTheme)}
                        tickLine={false}
                        minTickGap={32}
                      />
                      <YAxis
                        tick={axisTickStyle(muiTheme)}
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={formatAxisValue}
                      />
                      <Tooltip
                        {...tooltip}
                        labelFormatter={(label) => formatDateTime(Number(label))}
                        formatter={(value) => [`${formatNumber(Number(value), 4)} g`, 'RMS do bucket']}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="RMS do bucket"
                        stroke={statusColor(point.condition, muiTheme.palette)}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </DashboardCard>
          </Box>

          <Box sx={{ gridColumn: { xs: 'span 12', lg: 'span 4' }, display: 'flex', minWidth: 0 }}>
            <DashboardCard
              title="Classificação"
              titleId="point-condition-title"
              subtitle="Quais aquisições produziram o desvio."
            >
              <Stack spacing={1} sx={{ flexGrow: 1 }}>
                <DeviationBar ratio={point.deviationRatio} condition={point.condition} />
                <Divider flexItem />
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="caption" color="text.secondary">
                    Aquisição atual
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {formatDateTime(point.currentAt)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="caption" color="text.secondary">
                    Aquisição de referência
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {formatDateTime(point.baselineAt)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  A referência é uma aquisição concreta da janela — nunca a média do período,
                  que já conteria a própria variação.
                </Typography>
                <Box sx={{ mt: 'auto' }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Tendência: {trendDirection(point.trend) ?? 'sem dados suficientes'}
                  </Typography>
                  {point.currentCycleId ? (
                    <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                      <RouterLink
                        to={links.acquisition(point.currentCycleId, range)}
                        style={{ color: 'inherit' }}
                      >
                        Abrir a aquisição atual
                      </RouterLink>
                    </Typography>
                  ) : null}
                </Box>
              </Stack>
            </DashboardCard>
          </Box>

          <Box sx={{ gridColumn: 'span 12' }}>
            <Card variant="outlined">
              <Box sx={(theme) => ({ px: `${theme.dashboard.cardPadding}px`, pt: 1.5, pb: 0.5 })}>
                <Typography variant="h2" component="h2">
                  Séries disponíveis
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Grandezas medidas pelo sensor deste ponto, com a última leitura na janela.
                </Typography>
              </Box>
              {point.series.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <EmptyState
                    title="Nenhuma série neste ponto"
                    description="Associe um sensor ao ponto para que ele passe a medir."
                  />
                </Box>
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table
                    size="small"
                    aria-label="Séries do ponto"
                    sx={{ '& .MuiTableCell-root': { px: 1, py: 0.6, borderColor: 'divider' } }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Grandeza</TableCell>
                        <TableCell>Unidade</TableCell>
                        <TableCell align="right">Última leitura</TableCell>
                        <TableCell>Instante</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {point.series.map((series) => (
                        <TableRow key={series.seriesId} hover>
                          <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {seriesMetricLabel(series.physicalQuantity, series.axis)}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{series.unit}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {series.lastValue === null
                              ? '—'
                              : formatMeasurement(series.lastValue, series.unit)}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                            {formatDateTime(series.lastAt, 'sem leitura na janela')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Card>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
