import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { MachinePointSummaryDto } from '@dynamox/domain';
import { machineSlug } from '@dynamox/domain';
import { EmptyState, ErrorState, LoadingState } from '@dynamox/ui';

import { api } from '../../api/client';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { StatusTag, statusColor } from '../../components/dashboard/StatusTag';
import { axisTickStyle, chartGridStroke, chartTooltipStyles } from '../../components/dashboard/chartTheme';
import { DeviationBar } from '../../components/investigation/DeviationBar';
import { PageHeader } from '../../components/PageHeader';
import { KpiStrip } from '../../components/investigation/KpiStrip';
import { RangePresets, type RangePreset } from '../../components/investigation/RangePresets';
import { TrendSparkline, trendDirection } from '../../components/investigation/TrendSparkline';
import {
  formatAxisValue,
  formatMeasurement,
  formatNumber,
} from '../../features/dashboard/dashboardFormatters';
import { selectCanMutate } from '../../features/auth/authSlice';
import { links } from '../../features/investigation/links';
import { useAnalyticsQuery, useTimeRange } from '../../features/investigation/useAnalyticsQuery';
import { useAppSelector } from '../../store';
import { DeleteMachineDialog } from './DeleteMachineDialog';
import {
  TIME_ZONE_LABEL,
  formatChartTick,
  formatDateTime,
  formatRange,
  formatRelativeTime,
} from '../../features/time/instant';

/**
 * PÁGINA CANÔNICA DA MÁQUINA — operação e cadastro no mesmo lugar.
 *
 * Havia o risco de existirem duas páginas para a mesma entidade: uma analítica em /assets
 * e outra de cadastro em /machines. Uma máquina é uma coisa só; a rota também. Aqui ficam
 * a identidade e as ações de cadastro (editar, excluir, novo ponto) junto do que a pessoa
 * realmente vem ver: como a máquina está e o que aconteceu no período.
 *
 * Ordem de leitura: indicadores → tendência dos pontos → tabela que leva ao ponto e ao
 * sensor. Toda a resposta operacional vem de UMA consulta agregada: nenhuma amostra bruta
 * atravessa esta tela.
 */
export function MachinePage(): JSX.Element {
  const { machineKey = '' } = useParams();
  const [, setSearch] = useSearchParams();
  const range = useTimeRange();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);
  const canMutate = useAppSelector(selectCanMutate);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const query = useAnalyticsQuery(
    () => api.machineSummary(machineKey, { from: range.from, to: range.to }),
    [machineKey, range.from, range.to],
  );
  const asset = query.data;

  const applyPreset = (preset: RangePreset) => {
    const to = new Date();
    const from = new Date(to.getTime() - preset.days * 86_400_000);
    setSearch(new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }));
  };

  /**
   * Uma linha por ponto sobre o mesmo eixo temporal: é a comparação que interessa no
   * ativo — dois mancais da mesma máquina divergindo é sinal, cada um no seu gráfico não é.
   */
  const trendSeries = (asset?.points ?? []).filter((point) => point.trend.length >= 2);
  const chartData = (() => {
    const byTimestamp = new Map<number, Record<string, number>>();
    for (const point of trendSeries) {
      for (const entry of point.trend) {
        const at = Date.parse(entry.timestamp);
        const row = byTimestamp.get(at) ?? {};
        row[point.monitoringPointId] = entry.value;
        byTimestamp.set(at, row);
      }
    }
    return [...byTimestamp.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, values]) => ({ t, ...values }));
  })();

  const conditionCounts = (asset?.points ?? []).reduce<Record<string, number>>((counts, point) => {
    counts[point.condition] = (counts[point.condition] ?? 0) + 1;
    return counts;
  }, {});

  const openPoint = (point: MachinePointSummaryDto) => {
    if (!asset) return;
    navigate(links.point(asset.machineName, point.monitoringPointName, range));
  };

  return (
    <Box sx={{ pb: 3 }}>
      <PageHeader
        steps={[{ label: 'Visão geral', to: '/' }, { label: asset?.machineName ?? machineKey }]}
        title={asset?.machineName ?? machineKey}
        subtitle={
          asset
            ? `${asset.machineType === 'Pump' ? 'Bomba' : 'Ventilador'} · ${asset.kpis.points} ponto(s) monitorado(s) · ${
                asset.lastAt ? `última comunicação ${formatRelativeTime(asset.lastAt)}` : 'ainda sem leituras'
              }`
            : 'Ativo da planta sintética.'
        }
        chips={
          <>
            <Chip size="small" variant="outlined" label={formatRange(range.from, range.to)} />
            <Chip size="small" variant="outlined" label={TIME_ZONE_LABEL} />
            {asset?.kpis.attention ? (
              <Chip
                size="small"
                label={`${asset.kpis.attention} ponto(s) exigindo atenção`}
                sx={{
                  bgcolor: alpha(muiTheme.palette.condition.attention, 0.12),
                  color: muiTheme.palette.condition.attention,
                  fontWeight: 700,
                }}
              />
            ) : null}
          </>
        }
        actions={
          <Stack direction="row" gap={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
            <RangePresets from={range.from} to={range.to} onSelect={applyPreset} />
            {canMutate && asset ? (
              <>
                <Button
                  component={RouterLink}
                  to={`/machines/${encodeURIComponent(machineSlug(asset.machineName))}/edit`}
                  size="small"
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                >
                  Editar
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Excluir
                </Button>
              </>
            ) : null}
          </Stack>
        }
      />

      {query.status === 'loading' || query.status === 'idle' ? (
        <LoadingState label="Consultando o ativo…" />
      ) : null}

      {query.status === 'failed' && query.httpStatus === 404 ? (
        <EmptyState
          title="Ativo não encontrado"
          description={`Nenhuma máquina cadastrada corresponde a "${machineKey}". Verifique o endereço.`}
          action={
            <Button component={RouterLink} to="/" variant="outlined" size="small">
              Voltar à visão geral
            </Button>
          }
        />
      ) : null}

      {query.status === 'failed' && query.httpStatus !== 404 ? (
        <ErrorState
          message={query.error ?? 'Não foi possível carregar o ativo.'}
          onRetry={query.reload}
        />
      ) : null}

      {query.status === 'succeeded' && asset && asset.points.length === 0 ? (
        <EmptyState
          title="Máquina sem pontos de monitoramento"
          description="Cadastre o primeiro ponto para que esta máquina passe a ser monitorada."
          action={
            canMutate ? (
              <Button
                component={RouterLink}
                to={`/machines/${encodeURIComponent(machineSlug(asset.machineName))}/points/new`}
                variant="contained"
                startIcon={<AddIcon />}
              >
                Novo ponto
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {query.status === 'succeeded' && asset && asset.points.length > 0 ? (
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
                  label: 'Pontos monitorados',
                  value: `${asset.kpis.sensors}/${asset.kpis.points}`,
                  hint: `${formatNumber(asset.kpis.coveragePercent, 1)}% reportando na janela`,
                },
                {
                  label: 'Em atenção',
                  value: String(asset.kpis.attention),
                  hint: asset.kpis.attention > 0 ? 'exigem inspeção' : 'nenhuma exceção',
                  tone: asset.kpis.attention > 0 ? 'warning' : 'default',
                },
                {
                  label: 'Aquisições na janela',
                  value: formatNumber(asset.kpis.acquisitionCount, 0),
                  hint: 'ciclos de 60 s persistidos',
                },
                {
                  label: 'Maior desvio',
                  value:
                    asset.kpis.maxDeviationRatio === null
                      ? '—'
                      : `${formatNumber(asset.kpis.maxDeviationRatio, 2)}×`,
                  hint: asset.kpis.maxDeviationPoint ?? undefined,
                  tone: (asset.kpis.maxDeviationRatio ?? 0) >= 2 ? 'warning' : 'default',
                },
              ]}
            />
          </Box>

          <Box sx={{ gridColumn: { xs: 'span 12', lg: 'span 8' }, display: 'flex', minWidth: 0 }}>
            <DashboardCard
              title="Tendência dos pontos"
              titleId="asset-trend-title"
              size="primaryChart"
              subtitle="RMS do eixo âncora por bucket, nas últimas 24 h da janela. Um traço por ponto, no mesmo eixo."
              info="Agregado no banco. A razão publicada continua vindo do RMS radial (Y/Z pareados)."
            >
              {chartData.length === 0 ? (
                <EmptyState
                  title="Sem tendência no período"
                  description="Os pontos deste ativo não reportaram o suficiente para desenhar uma curva."
                />
              ) : (
                <Box sx={{ width: '100%', flexGrow: 1, minHeight: 240 }} role="img" aria-label="Tendência dos pontos do ativo">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
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
                        formatter={(value, name) => [`${formatNumber(Number(value), 4)} g`, String(name)]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={24}
                        wrapperStyle={{ fontSize: 11 }}
                        iconType="plainline"
                      />
                      {trendSeries.map((point, index) => (
                        <Line
                          key={point.monitoringPointId}
                          type="monotone"
                          dataKey={point.monitoringPointId}
                          name={point.monitoringPointName}
                          stroke={
                            point.condition === 'normal'
                              ? [muiTheme.palette.primary.main, muiTheme.palette.secondary.main][index % 2]
                              : statusColor(point.condition, muiTheme.palette)
                          }
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </DashboardCard>
          </Box>

          <Box sx={{ gridColumn: { xs: 'span 12', lg: 'span 4' }, display: 'flex', minWidth: 0 }}>
            <DashboardCard
              title="Estado do ativo"
              titleId="asset-state-title"
              subtitle="Como os pontos se distribuem agora."
            >
              <Stack spacing={1.25} sx={{ flexGrow: 1 }}>
                <Box
                  aria-hidden="true"
                  sx={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', bgcolor: 'action.hover' }}
                >
                  {Object.entries(conditionCounts).map(([condition, count]) => (
                    <Box
                      key={condition}
                      sx={{
                        width: `${(count / Math.max(1, asset.points.length)) * 100}%`,
                        bgcolor: statusColor(condition as never, muiTheme.palette),
                      }}
                    />
                  ))}
                </Box>

                <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} spacing={1}>
                  {asset.points.map((point) => (
                    <Box
                      component="li"
                      key={point.monitoringPointId}
                      sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                          {point.monitoringPointName}
                        </Typography>
                        <StatusTag kind={point.condition} />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {point.sensorSerialNumber ?? 'sem sensor'} ·{' '}
                          {point.currentValue === null
                            ? 'sem leitura'
                            : formatMeasurement(point.currentValue, point.unit)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 700, color: statusColor(point.condition, muiTheme.palette) }}
                        >
                          {point.deviationRatio === null ? '—' : `${formatNumber(point.deviationRatio, 2)}×`}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>

                <Box sx={{ mt: 'auto', pt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Última comunicação: {formatDateTime(asset.lastAt)} {TIME_ZONE_LABEL}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Cobertura na janela: {formatNumber(asset.kpis.coveragePercent, 1)}% dos pontos.
                  </Typography>
                </Box>
              </Stack>
            </DashboardCard>
          </Box>

          <Box sx={{ gridColumn: 'span 12' }}>
            <Card variant="outlined">
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                gap={1}
                sx={(theme) => ({ px: `${theme.dashboard.cardPadding}px`, pt: 1.5, pb: 0.5 })}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h2" component="h2">
                    Pontos e sensores
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Clique na linha para abrir o ponto; no serial, para ir direto ao sensor.
                  </Typography>
                </Box>
                {canMutate ? (
                  <Button
                    component={RouterLink}
                    to={`/machines/${encodeURIComponent(machineSlug(asset.machineName))}/points/new`}
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    Novo ponto
                  </Button>
                ) : null}
              </Stack>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table
                  size="small"
                  aria-label="Pontos e sensores do ativo"
                  sx={{ '& .MuiTableCell-root': { px: 1, py: 0.6, borderColor: 'divider' } }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Ponto</TableCell>
                      <TableCell>Sensor</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Modelo</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell align="right">Valor atual</TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        Referência
                      </TableCell>
                      <TableCell sx={{ minWidth: 104 }}>Desvio</TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Tendência</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Última leitura</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {asset.points.map((point) => (
                      <TableRow
                        key={point.monitoringPointId}
                        hover
                        onClick={() => openPoint(point)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {point.monitoringPointName}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {point.sensorSerialNumber ? (
                            <Link
                              component={RouterLink}
                              to={links.sensor(point.sensorSerialNumber, range)}
                              onClick={(event) => event.stopPropagation()}
                              underline="hover"
                              sx={{ fontWeight: 600 }}
                            >
                              {point.sensorSerialNumber}
                            </Link>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              sem sensor
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary' }}>
                          {point.sensorModel ?? '—'}
                        </TableCell>
                        <TableCell>
                          <StatusTag kind={point.condition} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {point.currentValue === null ? '—' : formatMeasurement(point.currentValue, point.unit)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap', color: 'text.secondary' }}
                        >
                          {point.baselineValue === null ? '—' : formatMeasurement(point.baselineValue, point.unit)}
                        </TableCell>
                        <TableCell>
                          <DeviationBar
                            ratio={point.deviationRatio}
                            condition={point.condition}
                            title={
                              point.baselineValue === null
                                ? undefined
                                : `atual ${formatMeasurement(point.currentValue, point.unit)} vs referência ${formatMeasurement(point.baselineValue, point.unit)}`
                            }
                          />
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                          <Stack direction="row" alignItems="center" gap={0.75}>
                            <TrendSparkline trend={point.trend} condition={point.condition} />
                            <Typography variant="caption" color="text.secondary">
                              {trendDirection(point.trend) ?? ''}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap', color: 'text.secondary' }}
                        >
                          {formatDateTime(point.lastAt, 'sem leitura')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Box>
        </Box>
      ) : null}

      {asset ? (
        <DeleteMachineDialog
          machine={
            confirmingDelete
              ? { id: asset.machineId, name: asset.machineName, type: asset.machineType, createdAt: '', updatedAt: '' }
              : null
          }
          pointCount={asset.kpis.points}
          sensorCount={asset.kpis.sensors}
          onClose={() => setConfirmingDelete(false)}
          onDeleted={() => {
            setConfirmingDelete(false);
            navigate('/machines');
          }}
        />
      ) : null}
    </Box>
  );
}
