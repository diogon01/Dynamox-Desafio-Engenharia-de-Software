import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { TimeSeriesSampleDto, TimeSeriesSummary } from '@dynamox/domain';
import { EmptyState, ErrorState } from '@dynamox/ui';

import {
  aggregateSamplesForDetail,
  computeSampleStats,
} from '../../features/dashboard/dashboardAggregations';
import {
  formatAxisValue,
  formatDateTime,
  formatChartTick,
  formatNumber,
  seriesMetricLabel,
} from '../../features/dashboard/dashboardFormatters';
import type { RequestStatus } from '../../store/requestStatus';
import { SeriesHierarchyFilters } from './SeriesHierarchyFilters';

export interface SeriesExplorerProps {
  series: TimeSeriesSummary[];
  selectedSeriesId: string | null;
  samples: TimeSeriesSampleDto[];
  status: RequestStatus;
  error: string | null;
  onSelectSeries: (seriesId: string) => void;
  onRetry: () => void;
}

export function SeriesExplorer({
  series,
  selectedSeriesId,
  samples,
  status,
  error,
  onSelectSeries,
  onRetry,
}: SeriesExplorerProps): JSX.Element {
  const muiTheme = useTheme();
  const selected = series.find((item) => item.id === selectedSeriesId) ?? null;
  const stats = useMemo(() => computeSampleStats(samples), [samples]);
  const chart = useMemo(() => aggregateSamplesForDetail(samples), [samples]);

  return (
    <Accordion
      component="section"
      disableGutters
      sx={{ border: 1, borderColor: 'divider', borderRadius: '12px !important', overflow: 'hidden' }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="series-explorer-content">
        <Box>
          <Typography variant="h2" component="h2">
            Explorar série temporal
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Filtros hierárquicos, métricas completas e amostras persistidas.
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails id="series-explorer-content" sx={{ pt: 0 }}>
        {series.length === 0 ? (
          <EmptyState
            title="Nenhuma série persistida"
            description="Sensores instalados aparecerão aqui após a primeira ingestão de telemetria."
          />
        ) : (
          <Stack spacing={2}>
            <SeriesHierarchyFilters
              series={series}
              selectedSeriesId={selectedSeriesId}
              onSelect={onSelectSeries}
            />

            {selected ? (
              <Typography variant="body2" color="text.secondary">
                {selected.machineType ?? 'Máquina não associada'} · {selected.sensorSerialNumber} ({selected.sensorModel}) ·{' '}
                {seriesMetricLabel(selected.physicalQuantity, selected.axis)} · {selected.unit}
              </Typography>
            ) : null}

            {status === 'loading' || status === 'idle' ? (
              <Skeleton variant="rounded" height={270} aria-label="Carregando detalhes da série" />
            ) : null}
            {status === 'failed' ? (
              <ErrorState
                title="Não foi possível abrir a série"
                message={error ?? 'A API não devolveu as amostras.'}
                onRetry={onRetry}
              />
            ) : null}
            {status === 'succeeded' && samples.length === 0 ? (
              <EmptyState
                title="A série existe, mas está vazia"
                description="Aguarde uma aquisição ou selecione outra métrica."
              />
            ) : null}
            {status === 'succeeded' && samples.length > 0 && selected ? (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
                    gap: 1,
                  }}
                >
                  {[
                    ['Amostras', String(stats.count)],
                    ['Mínimo', formatNumber(stats.min, 4)],
                    ['Máximo', formatNumber(stats.max, 4)],
                    ['Média', formatNumber(stats.avg, 4)],
                    ['Último', formatNumber(stats.last, 4)],
                    ['Unidade', selected.unit],
                  ].map(([label, value]) => (
                    <Card key={label} variant="outlined">
                      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" fontWeight={750}>{value}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
                <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={chart.aggregated ? 'Média agregada para visualização' : 'Dados brutos'}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`${formatDateTime(stats.firstTimestamp)} – ${formatDateTime(stats.lastTimestamp)}`}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Box
                  role="img"
                  aria-label={`Detalhe da série ${seriesMetricLabel(selected.physicalQuantity, selected.axis)}`}
                  sx={{ width: '100%', height: { xs: 240, md: 300 }, minWidth: 0 }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chart.points}
                      margin={{ top: 8, right: 16, bottom: 8, left: 4 }}
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
                        minTickGap={30}
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
                        formatter={(value) => [`${formatNumber(Number(value), 4)} ${selected.unit}`, 'Valor']}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={muiTheme.palette.primary.main}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </>
            ) : null}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
