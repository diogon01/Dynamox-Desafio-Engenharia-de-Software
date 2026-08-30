import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { EmptyState } from '@dynamox/ui';

import type {
  AttentionSeverity,
  DashboardView,
} from '../../features/dashboard/dashboardAggregations';
import {
  formatDateTime,
  formatNumber,
} from '../../features/dashboard/dashboardFormatters';

const SEVERITY_META: Record<
  AttentionSeverity,
  { label: string; color: 'error' | 'warning' | 'info' }
> = {
  high: { label: 'Prioridade alta', color: 'error' },
  medium: { label: 'Verificar', color: 'warning' },
  info: { label: 'Informação', color: 'info' },
};

export interface OperationalInsightsProps {
  view: DashboardView;
  loading: boolean;
  onSelectSeries: (seriesId: string) => void;
}

function PriorityRanking({
  view,
  loading,
  onSelectSeries,
}: OperationalInsightsProps): JSX.Element {
  const max = Math.max(...view.ranking.map((cell) => cell.assessment?.deviationRatio ?? 0), 1);
  return (
    <Card variant="outlined" component="section" aria-labelledby="ranking-title" sx={{ minWidth: 0 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography id="ranking-title" variant="h2" component="h2">
          Prioridade de inspeção
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Top 5 pelo índice demonstrativo relativo ao baseline.
        </Typography>

        {loading ? (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {[0, 1, 2].map((key) => <Skeleton key={key} variant="rounded" height={58} />)}
          </Stack>
        ) : null}

        {!loading && view.ranking.length === 0 ? (
          <EmptyState
            title="Nenhum baseline calculável"
            description="O ranking exige duas aquisições radiais Y/Z observadas em sensores demonstrativos."
          />
        ) : null}

        {!loading && view.ranking.length > 0 ? (
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {view.ranking.map((cell, index) => {
              const ratio = cell.assessment?.deviationRatio ?? 0;
              return (
                <ButtonBase
                  key={cell.key}
                  onClick={() => {
                    if (cell.preferredSeriesId) onSelectSeries(cell.preferredSeriesId);
                  }}
                  aria-label={`Explorar ${cell.machineName}, ${cell.positionLabel}, índice ${formatNumber(ratio, 2)} vezes`}
                  sx={(theme) => ({
                    display: 'block',
                    width: '100%',
                    p: 1,
                    textAlign: 'left',
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                    '&:focus-visible': {
                      outline: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    },
                  })}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color="text.secondary" sx={{ width: 18 }}>
                      {index + 1}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {cell.machineName} · {cell.positionLabel}
                        </Typography>
                        <Typography variant="body2" fontWeight={750} color={ratio >= 2 ? 'error.main' : 'text.primary'}>
                          {formatNumber(ratio, 2)}×
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {cell.sensorSerial} · {cell.conditionLabel}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(ratio / max) * 100}
                        color={ratio >= 2 ? 'error' : ratio >= 1.5 ? 'warning' : 'success'}
                        sx={{ height: 5, borderRadius: 999, mt: 0.5 }}
                      />
                    </Box>
                  </Stack>
                </ButtonBase>
              );
            })}
          </Stack>
        ) : null}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
          Limiar 2,0× didático do sensor twin. Não representa diagnóstico industrial validado.
        </Typography>
      </CardContent>
    </Card>
  );
}

function SensorDistribution({ view, loading }: OperationalInsightsProps): JSX.Element {
  const total = view.distribution.reduce((sum, item) => sum + item.value, 0);
  return (
    <Card variant="outlined" component="section" aria-labelledby="distribution-title">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <BarChartOutlinedIcon color="primary" />
          <Box>
            <Typography id="distribution-title" variant="h2" component="h2">
              Recência dos sensores
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Atualização das leituras instaladas.
            </Typography>
          </Box>
        </Stack>
        {loading ? <Skeleton variant="rounded" height={180} sx={{ mt: 2 }} /> : null}
        {!loading && total === 0 ? (
          <EmptyState title="Nenhum sensor instalado" description="A distribuição aparecerá após a associação." />
        ) : null}
        {!loading && total > 0 ? (
          <Stack spacing={1.25} sx={{ mt: 2 }}>
            {view.distribution.map((item) => {
              const percentage = (item.value / total) * 100;
              const color = item.key === 'current' ? 'success' : item.key === 'no-data' ? 'inherit' : 'warning';
              return (
                <Box key={item.key}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{item.value}</Typography>
                  </Stack>
                  <Box sx={{ height: 7, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden', mt: 0.5 }}>
                    <Box
                      sx={{
                        width: `${percentage}%`,
                        height: '100%',
                        bgcolor: color === 'inherit' ? 'text.disabled' : `${color}.main`,
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AttentionSignals({
  view,
  loading,
  onSelectSeries,
}: OperationalInsightsProps): JSX.Element {
  return (
    <Card variant="outlined" component="section" aria-labelledby="signals-title">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <ErrorOutlineIcon color={view.signals.length > 0 ? 'warning' : 'success'} />
          <Box sx={{ flex: 1 }}>
            <Typography id="signals-title" variant="h2" component="h2">
              Sinais de atenção
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Evidências estatísticas, ausência e recência; não é alarmística industrial.
            </Typography>
          </Box>
        </Stack>
        {loading ? (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {[0, 1, 2].map((key) => <Skeleton key={key} variant="rounded" height={72} />)}
          </Stack>
        ) : null}
        {!loading && view.signals.length === 0 ? (
          <EmptyState
            title="Nenhum sinal derivável"
            description="Os sensores com dados disponíveis não apresentaram pendências pelas regras demonstrativas."
          />
        ) : null}
        {!loading && view.signals.length > 0 ? (
          <Stack divider={<Divider flexItem />} sx={{ mt: 1.5 }}>
            {view.signals.slice(0, 8).map((signal) => {
              const meta = SEVERITY_META[signal.severity];
              return (
                <Stack
                  key={signal.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={1}
                  sx={{ py: 1.1 }}
                >
                  <Chip label={meta.label} color={meta.color} size="small" variant="outlined" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {signal.machineName} · {signal.pointAndSensor}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {signal.reason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Última leitura: {formatDateTime(signal.lastTimestamp)}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    disabled={!signal.seriesId}
                    onClick={() => {
                      if (signal.seriesId) onSelectSeries(signal.seriesId);
                    }}
                  >
                    Explorar série
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OperationalInsights(props: OperationalInsightsProps): JSX.Element {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.7fr) minmax(280px, 0.8fr)' },
        gap: 1.5,
        alignItems: 'stretch',
      }}
    >
      <PriorityRanking {...props} />
      <SensorDistribution {...props} />
      <Box sx={{ gridColumn: '1 / -1' }}>
        <AttentionSignals {...props} />
      </Box>
    </Box>
  );
}
