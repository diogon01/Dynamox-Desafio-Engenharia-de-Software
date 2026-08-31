import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import type { HeatmapResponseDto } from '@dynamox/domain';
import { EmptyState, ErrorState } from '@dynamox/ui';

import { formatNumber } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';

/**
 * Mapa de atividade DATA × HORA, calculado no banco (`/analytics/heatmap`).
 *
 * Mudou de dia-da-semana para data real por uma razão de produto: a célula agora é um
 * ponto de entrada da investigação — clicar abre exatamente aquela hora daquele dia. Com
 * dia-da-semana, "quarta 14h" não identificava qual quarta.
 */
export interface ActivityHeatmapProps {
  data: HeatmapResponseDto | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Abre a janela temporal correspondente à célula. */
  onSelectWindow: (bucketStart: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function dayLabel(day: string): string {
  const [, month, date] = day.split('-');
  return `${date}/${month}`;
}

function weekdayLabel(day: string): string {
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return names[new Date(`${day}T00:00:00.000Z`).getUTCDay()];
}

export function ActivityHeatmap({
  data,
  loading,
  error,
  onRetry,
  onSelectWindow,
}: ActivityHeatmapProps): JSX.Element {
  const muiTheme = useTheme();

  const byDay = new Map<string, Map<number, HeatmapResponseDto['buckets'][number]>>();
  for (const bucket of data?.buckets ?? []) {
    const hours = byDay.get(bucket.day) ?? new Map();
    hours.set(bucket.hour, bucket);
    byDay.set(bucket.day, hours);
  }
  // Mais recente em cima: a investigação começa pelo que acabou de acontecer.
  const days = [...byDay.keys()].sort().reverse().slice(0, 14);

  const cellColor = (coverage: number): string => {
    if (coverage <= 0) return alpha(muiTheme.palette.primary.main, 0.05);
    const intensity = 0.18 + (coverage / 100) * 0.82;
    return intensity >= 0.85
      ? muiTheme.palette.primary.dark
      : alpha(muiTheme.palette.primary.main, intensity);
  };

  return (
    <DashboardCard
      title="Mapa de atividade (data × hora)"
      titleId="activity-heatmap-title"
      size="heatmap"
      subtitle="% de sensores com leitura em cada hora. Clique numa célula para investigar a janela."
      info="Agregado no banco a partir da série âncora de cada sensor; a página não baixa amostras."
    >
      {loading ? <Skeleton variant="rounded" height={210} /> : null}

      {!loading && error ? (
        <ErrorState message={error} onRetry={onRetry} title="Não foi possível carregar o mapa" />
      ) : null}

      {!loading && !error && days.length === 0 ? (
        <EmptyState
          title="Sem leituras no período"
          description="O mapa é preenchido conforme as aquisições são persistidas."
        />
      ) : null}

      {!loading && !error && days.length > 0 ? (
        <Box sx={{ overflowX: 'auto', flexGrow: 1, display: 'flex' }}>
          <Box sx={{ minWidth: 620, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: '62px repeat(24, minmax(0, 1fr))', gap: '1px', mb: '1px' }}
              aria-hidden="true"
            >
              <Box />
              {HOURS.map((hour) => (
                <Typography
                  key={hour}
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: 10, textAlign: 'center', lineHeight: 1 }}
                >
                  {hour % 2 === 0 ? `${String(hour).padStart(2, '0')}h` : ''}
                </Typography>
              ))}
            </Box>

            {days.map((day) => (
              <Box
                key={day}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '62px repeat(24, minmax(0, 1fr))',
                  gap: '1px',
                  mb: '1px',
                  flex: 1,
                  minHeight: 16,
                  maxHeight: 30,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center' }}
                >
                  {dayLabel(day)} {weekdayLabel(day)}
                </Typography>
                {HOURS.map((hour) => {
                  const bucket = byDay.get(day)?.get(hour);
                  const coverage = bucket?.coveragePercent ?? 0;
                  return (
                    <Tooltip
                      key={hour}
                      arrow
                      enterDelay={120}
                      title={
                        bucket
                          ? `${dayLabel(day)} ${String(hour).padStart(2, '0')}h — ${bucket.reportingSensors}/${bucket.expectedSensors} sensores · ${bucket.acquisitionCount} aquisição(ões) · ${formatNumber(bucket.sampleCount, 0)} amostras. Clique para investigar.`
                          : `${dayLabel(day)} ${String(hour).padStart(2, '0')}h — sem leituras`
                      }
                    >
                      <Box
                        component="button"
                        type="button"
                        disabled={!bucket}
                        onClick={() => bucket && onSelectWindow(bucket.bucketStart)}
                        aria-label={`Investigar ${dayLabel(day)} ${hour}h: ${bucket?.reportingSensors ?? 0} de ${data?.expectedSensors ?? 0} sensores`}
                        sx={{
                          all: 'unset',
                          cursor: bucket ? 'pointer' : 'default',
                          display: 'block',
                          height: '100%',
                          minHeight: 14,
                          borderRadius: '2px',
                          bgcolor: cellColor(coverage),
                          '&:hover': bucket
                            ? { outline: `2px solid ${muiTheme.palette.primary.dark}`, outlineOffset: -1 }
                            : undefined,
                          '&:focus-visible': { outline: `2px solid ${muiTheme.palette.primary.dark}` },
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            ))}

            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.55} sx={{ mt: 'auto', pt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Baixa cobertura
              </Typography>
              {[0, 25, 50, 75, 100].map((step) => (
                <Box
                  key={step}
                  aria-hidden="true"
                  sx={{ width: 16, height: 8, borderRadius: '2px', bgcolor: cellColor(step) }}
                />
              ))}
              <Typography variant="caption" color="text.secondary">
                Total
              </Typography>
            </Stack>
          </Box>
        </Box>
      ) : null}
    </DashboardCard>
  );
}
