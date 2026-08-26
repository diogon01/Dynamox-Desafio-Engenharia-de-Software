import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
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

import {
  fetchSeriesDetail,
  fetchTimeSeries,
  seriesSelected,
} from '../features/diagnostics/diagnosticsSlice';
import { useAppDispatch, useAppSelector } from '../store';

function formatNumber(value: number | null, digits = 4): string {
  return value === null ? '—' : value.toFixed(digits);
}

export function SeriesPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const {
    seriesStatus,
    series,
    seriesError,
    selectedSeriesId,
    detailStatus,
    samples,
    metrics,
    detailError,
  } = useAppSelector((state) => state.diagnostics);

  useEffect(() => {
    if (selectedSeriesId) {
      void dispatch(fetchSeriesDetail(selectedSeriesId));
    }
  }, [dispatch, selectedSeriesId]);

  const selected = series.find((item) => item.id === selectedSeriesId);

  const chartData = samples.map((sample) => ({
    timestamp: new Date(sample.timestamp).toLocaleTimeString('pt-BR'),
    value: sample.value,
  }));

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h2" component="h2" gutterBottom>
          Série temporal
        </Typography>

        {seriesStatus === 'loading' || seriesStatus === 'idle' ? (
          <LoadingState label="Carregando séries…" />
        ) : null}

        {seriesStatus === 'failed' ? (
          <ErrorState
            message={seriesError ?? 'Não foi possível listar as séries.'}
            onRetry={() => void dispatch(fetchTimeSeries())}
          />
        ) : null}

        {seriesStatus === 'succeeded' && series.length === 0 ? (
          <EmptyState
            title="Nenhuma série persistida ainda"
            description="Rode as migrações e o seed (npm run prisma:deploy && npm run seed) ou ingira um ciclo em POST /api/telemetry-cycles."
          />
        ) : null}

        {seriesStatus === 'succeeded' && series.length > 0 ? (
          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="Série"
              value={selectedSeriesId ?? ''}
              onChange={(event) => dispatch(seriesSelected(event.target.value))}
              sx={{ maxWidth: 460 }}
            >
              {series.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.machineName ?? 'Sensor sem máquina'} ·{' '}
                  {item.monitoringPointName ?? 'sem ponto associado'} · {item.physicalQuantity}
                  {item.axis ? ` (${item.axis})` : ''} — {item.sampleCount} amostras
                </MenuItem>
              ))}
            </TextField>

            {selected ? (
              <Typography variant="body2" color="text.secondary">
                {selected.machineType ?? 'máquina não associada'} · sensor{' '}
                {selected.sensorSerialNumber} ({selected.sensorModel}) · unidade {selected.unit}
              </Typography>
            ) : null}

            {detailStatus === 'loading' ? <LoadingState label="Carregando amostras…" /> : null}

            {detailStatus === 'failed' ? (
              <ErrorState
                message={detailError ?? 'Não foi possível carregar a série.'}
                onRetry={() =>
                  selectedSeriesId ? void dispatch(fetchSeriesDetail(selectedSeriesId)) : undefined
                }
              />
            ) : null}

            {detailStatus === 'succeeded' && samples.length === 0 ? (
              <EmptyState title="A série existe, mas ainda não tem amostras." />
            ) : null}

            {detailStatus === 'succeeded' && samples.length > 0 ? (
              <>
                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                  <Typography variant="body2">
                    <strong>Amostras:</strong> {metrics?.count ?? samples.length}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Mín.:</strong> {formatNumber(metrics?.min ?? null)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Máx.:</strong> {formatNumber(metrics?.max ?? null)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Média:</strong> {formatNumber(metrics?.avg ?? null)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Último:</strong> {formatNumber(metrics?.last ?? null)}
                  </Typography>
                </Stack>

                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" fontSize={12} minTickGap={24} />
                      <YAxis fontSize={12} width={72} domain={['auto', 'auto']} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#0b6bcb"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : null}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}
