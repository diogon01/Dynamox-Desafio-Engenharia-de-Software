import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { machineTag } from '@dynamox/domain';
import { EmptyState, ErrorState, LoadingState } from '@dynamox/ui';

import { api } from '../../api/client';
import { InvestigationBreadcrumbs } from '../../components/investigation/InvestigationBreadcrumbs';
import { KpiStrip } from '../../components/investigation/KpiStrip';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { StatusTag } from '../../components/dashboard/StatusTag';
import { axisTickStyle, chartGridStroke, chartTooltipStyles } from '../../components/dashboard/chartTheme';
import {
  formatAxisValue,
  formatMeasurement,
  formatNumber,
} from '../../features/dashboard/dashboardFormatters';
import {
  formatChartTick,
  formatDateTime,
} from '../../features/time/instant';
import { links } from '../../features/investigation/links';
import { useAnalyticsQuery, useTimeRange } from '../../features/investigation/useAnalyticsQuery';

const RANGE_PRESETS = [
  { id: '24h', label: '24 h', days: 1, bucket: '15m' },
  { id: '7d', label: '7 dias', days: 7, bucket: '1h' },
  { id: '30d', label: '30 dias', days: 30, bucket: '4h' },
] as const;

/**
 * NÍVEL "SENSOR": trinta dias de história sem baixar um único dado bruto.
 *
 * O gráfico consome buckets agregados no banco (≈175 pontos para 30 dias, contra ~170 mil
 * amostras) e a lista de aquisições é paginada no servidor. Amostra crua só no nível
 * seguinte, e sob pedido explícito.
 */
export function SensorPage(): JSX.Element {
  const { serialNumber = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const range = useTimeRange();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);

  const bucket = search.get('bucket') ?? '1h';
  const page = Number(search.get('page') ?? '1');
  const pageSize = Number(search.get('pageSize') ?? '25');

  const setParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(search);
      for (const [key, value] of Object.entries(patch)) next.set(key, value);
      setSearch(next);
    },
    [search, setSearch],
  );

  // A condição da frota traz identidade, baseline e razão do sensor sem consulta extra.
  const condition = useAnalyticsQuery(
    () => api.fleetCondition({ from: range.from, to: range.to }),
    [range.from, range.to],
  );
  const point = condition.data?.points.find((item) => item.sensorSerialNumber === serialNumber) ?? null;

  // A série âncora do sensor vem da listagem de séries (uma requisição pequena).
  const series = useAnalyticsQuery(() => api.timeSeries(), []);
  const anchor =
    series.data?.find(
      (item) =>
        item.sensorSerialNumber === serialNumber &&
        item.physicalQuantity === 'acceleration' &&
        item.axis === 'y',
    ) ?? null;

  const points = useAnalyticsQuery(
    () =>
      anchor
        ? api.seriesPoints(anchor.id, { from: range.from, to: range.to }, bucket)
        : Promise.resolve(null),
    [anchor?.id, range.from, range.to, bucket],
  );

  const acquisitions = useAnalyticsQuery(
    () =>
      api.sensorAcquisitions(serialNumber, { from: range.from, to: range.to }, {
        page,
        pageSize,
        includeTotal: true,
      }),
    [serialNumber, range.from, range.to, page, pageSize],
  );

  const chartData = (points.data?.points ?? []).map((item) => ({
    t: Date.parse(item.bucketStart),
    avg: item.avg,
    band: item.min !== null && item.max !== null ? [item.min, item.max] : undefined,
  }));

  /**
   * Domínio do eixo Y a partir dos próprios dados, com 8% de folga.
   *
   * Ancorar em zero achataria a leitura: a variação operacional aqui é de milésimos de g,
   * e uma escala 0→máximo transformaria uma degradação real numa linha reta. A faixa
   * min/max continua desenhada, então a amplitude não é escondida — só é enquadrada.
   */
  const values = chartData.flatMap((item) => [item.avg, ...(item.band ?? [])]).filter((v): v is number => v !== null && v !== undefined);
  const yDomain: [number, number] | undefined = values.length
    ? (() => {
        const low = Math.min(...values);
        const high = Math.max(...values);
        const pad = Math.max((high - low) * 0.08, high * 0.02);
        return [Math.max(0, low - pad), high + pad];
      })()
    : undefined;

  const applyPreset = (preset: (typeof RANGE_PRESETS)[number]) => {
    const to = new Date().toISOString();
    const from = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000).toISOString();
    setSearch(new URLSearchParams({ from, to, bucket: preset.bucket, page: '1', pageSize: String(pageSize) }));
  };

  return (
    <Box sx={{ pt: 2, pb: 3 }}>
      <InvestigationBreadcrumbs
        steps={[
          { label: 'Visão geral', to: '/' },
          // Ativo e ponto só entram quando a condição já os identificou: um degrau da
          // trilha nunca pode apontar para uma rota que ainda não sabemos montar.
          ...(point?.machineName
            ? [{ label: machineTag(point.machineName), to: links.machine(point.machineName, range) }]
            : []),
          ...(point?.machineName && point.monitoringPointName
            ? [
                {
                  label: point.monitoringPointName,
                  to: links.point(point.machineName, point.monitoringPointName, range),
                },
              ]
            : []),
          { label: serialNumber },
        ]}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5} sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" component="h1">
            {serialNumber}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
            {point
              ? `${point.machineName} · ${point.monitoringPointName} · ${point.sensorModel ?? '—'}`
              : 'Sensor da planta sintética.'}
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {point ? <StatusTag kind={point.condition} /> : null}
            <Chip size="small" variant="outlined" label={`Janela: ${formatDateTime(range.from)} → ${formatDateTime(range.to)}`} />
            <Chip size="small" variant="outlined" label={`Bucket: ${bucket}`} />
          </Stack>
        </Box>

        <ToggleButtonGroup exclusive size="small" value={bucket} sx={{ alignSelf: { md: 'flex-start' } }}>
          {RANGE_PRESETS.map((preset) => (
            <ToggleButton key={preset.id} value={preset.bucket} onClick={() => applyPreset(preset)}>
              {preset.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <KpiStrip
        items={[
          { label: 'Aquisições', value: formatNumber(points.data?.stats.acquisitionCount ?? 0, 0) },
          { label: 'Amostras na janela', value: formatNumber(points.data?.stats.sampleCount ?? 0, 0) },
          { label: 'Mínimo', value: points.data?.stats.min == null ? '—' : formatMeasurement(points.data.stats.min, 'g') },
          { label: 'Máximo', value: points.data?.stats.max == null ? '—' : formatMeasurement(points.data.stats.max, 'g') },
          { label: 'Média', value: points.data?.stats.avg == null ? '—' : formatMeasurement(points.data.stats.avg, 'g') },
          {
            label: 'Desvio vs. referência',
            value: point?.deviationRatio == null ? '—' : `${formatNumber(point.deviationRatio, 2)}×`,
            hint: point?.baselineValue == null ? undefined : `ref ${formatMeasurement(point.baselineValue, 'g')}`,
            tone: (point?.deviationRatio ?? 0) >= 2 ? 'warning' : 'default',
          },
        ]}
      />

      <Box sx={{ mt: 2 }}>
        <DashboardCard
          title="Aceleração radial — eixo Y (agregado)"
          titleId="sensor-trend-title"
          size="primaryChart"
          subtitle={`Um ponto por bucket de ${bucket}; a faixa mostra mínimo e máximo do bucket. Nenhuma amostra bruta é transportada.`}
        >
          {points.status === 'loading' || points.status === 'idle' ? (
            <LoadingState label="Agregando a série…" />
          ) : null}
          {points.status === 'failed' ? (
            <ErrorState message={points.error ?? 'Falha ao agregar a série.'} onRetry={points.reload} />
          ) : null}
          {points.status === 'succeeded' && chartData.length === 0 ? (
            <EmptyState title="Sem dados na janela" description="Escolha outro período para investigar." />
          ) : null}
          {/* Altura explícita: fora do grid do painel não há linha para o card esticar, e o
              ResponsiveContainer precisa de uma altura resolvível. */}
          {points.status === 'succeeded' && chartData.length > 0 ? (
            <Box sx={{ width: '100%', height: { xs: 260, md: 320 } }} role="img" aria-label="Série agregada do sensor">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke(muiTheme)} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatChartTick}
                    tick={axisTickStyle(muiTheme)}
                    tickLine={false}
                    minTickGap={28}
                  />
                  {/* Domínio automático: com variações pequenas, forçar zero achataria a curva. */}
                  <YAxis
                    tick={axisTickStyle(muiTheme)}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                    domain={yDomain ?? ['auto', 'auto']}
                    allowDataOverflow={false}
                    tickFormatter={formatAxisValue}
                  />
                  <Tooltip
                    {...tooltip}
                    labelFormatter={(label) => formatDateTime(Number(label))}
                    formatter={(value, name) => {
                      if (Array.isArray(value)) {
                        const [low, high] = value as [number, number];
                        return [`${formatNumber(low, 4)} – ${formatNumber(high, 4)} g`, 'Faixa do bucket'];
                      }
                      return [`${formatNumber(Number(value), 4)} g`, name === 'avg' ? 'Média do bucket' : String(name)];
                    }}
                  />
                  <Area
                    dataKey="band"
                    name="Faixa do bucket"
                    // baseValue segue o domínio: sem isso a área desceria até zero e
                    // arrastaria a escala junto.
                    baseValue="dataMin"
                    stroke="none"
                    fill={muiTheme.palette.primary.main}
                    fillOpacity={0.14}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    name="Média do bucket"
                    stroke={muiTheme.palette.primary.main}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          ) : null}
        </DashboardCard>
      </Box>

      <Card variant="outlined" sx={{ mt: 2 }}>
        <Box sx={(theme) => ({ px: `${theme.dashboard.cardPadding}px`, pt: 1.5, pb: 0.5 })}>
          <Typography variant="h2" component="h2">
            Aquisições
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            Cada linha é um ciclo de 60 s. Clique para abrir a aquisição e, dentro dela, os dados brutos.
          </Typography>
        </Box>

        {acquisitions.status === 'loading' || acquisitions.status === 'idle' ? (
          <Box sx={{ p: 2 }}>
            <LoadingState label="Carregando aquisições…" />
          </Box>
        ) : null}
        {acquisitions.status === 'failed' ? (
          <Box sx={{ p: 2 }}>
            <ErrorState message={acquisitions.error ?? 'Falha ao listar aquisições.'} onRetry={acquisitions.reload} />
          </Box>
        ) : null}
        {acquisitions.status === 'succeeded' && acquisitions.data?.items.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <EmptyState
              title="Nenhuma aquisição encontrada neste período"
              description="Amplie a janela ou escolha outro sensor."
            />
          </Box>
        ) : null}
        {acquisitions.status === 'succeeded' && acquisitions.data && acquisitions.data.items.length > 0 ? (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Aquisições do sensor">
                <TableHead>
                  <TableRow>
                    <TableCell>Início</TableCell>
                    <TableCell align="right">Duração</TableCell>
                    <TableCell align="right">RPM</TableCell>
                    <TableCell align="right">Carga</TableCell>
                    <TableCell align="right">Amostras</TableCell>
                    <TableCell align="right">Mín</TableCell>
                    <TableCell align="right">Máx</TableCell>
                    <TableCell align="right">Média</TableCell>
                    <TableCell>Evento</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {acquisitions.data.items.map((item) => (
                    <TableRow
                      key={item.cycleId}
                      hover
                      onClick={() => navigate(links.acquisition(item.cycleId, range))}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {item.startedAt ? formatDateTime(item.startedAt) : '—'}
                      </TableCell>
                      <TableCell align="right">{item.durationSeconds ? `${item.durationSeconds} s` : '—'}</TableCell>
                      <TableCell align="right">{item.rpm ?? '—'}</TableCell>
                      <TableCell align="right">{item.loadPercent === null ? '—' : `${formatNumber(item.loadPercent, 1)}%`}</TableCell>
                      <TableCell align="right">{item.sampleCount}</TableCell>
                      <TableCell align="right">{item.min === null ? '—' : formatMeasurement(item.min, item.unit)}</TableCell>
                      <TableCell align="right">{item.max === null ? '—' : formatMeasurement(item.max, item.unit)}</TableCell>
                      <TableCell align="right">{item.avg === null ? '—' : formatMeasurement(item.avg, item.unit)}</TableCell>
                      <TableCell>
                        {item.event && item.event !== 'none' ? (
                          <Chip size="small" variant="outlined" label={item.event} />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={acquisitions.data.total ?? -1}
              page={acquisitions.data.page - 1}
              onPageChange={(_, next) => setParams({ page: String(next + 1) })}
              rowsPerPage={acquisitions.data.pageSize}
              rowsPerPageOptions={[25, 50, 100]}
              onRowsPerPageChange={(event) => setParams({ pageSize: event.target.value, page: '1' })}
              labelRowsPerPage="Itens por página"
              labelDisplayedRows={({ from, to, count }) =>
                count === -1 ? `${from}–${to}` : `${from}–${to} de ${count}`
              }
              getItemAriaLabel={(type) =>
                type === 'previous' ? 'Ir para a página anterior' : 'Ir para a próxima página'
              }
            />
          </>
        ) : null}
      </Card>
    </Box>
  );
}
