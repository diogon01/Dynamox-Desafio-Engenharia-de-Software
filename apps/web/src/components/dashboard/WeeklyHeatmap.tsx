import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { EmptyState } from '@dynamox/ui';

import type { WeekHeatmap } from '../../features/dashboard/dashboardAggregations';
import { formatNumber } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';

/**
 * Mapa de calor semanal da AQUISIÇÃO: cada célula é a fração de sensores com leitura
 * naquele dia × hora. Escala monocromática sobre a primária — intensidade, não arco-íris.
 * Clique numa célula ou no rótulo do dia seleciona o dia no painel de perfil 24 h.
 */
export function WeeklyHeatmap({
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
  const hasData = weekMap.days.some((day) => day.hours.some((hour) => hour.samples > 0));

  const cellColor = (share: number): string => {
    if (share <= 0) return alpha(muiTheme.palette.primary.main, 0.05);
    // 0→claro, 1→primary.dark; piso de 0,18 para célula com dado nunca sumir.
    const intensity = 0.18 + share * 0.82;
    return intensity >= 0.85
      ? muiTheme.palette.primary.dark
      : alpha(muiTheme.palette.primary.main, intensity);
  };

  return (
    <DashboardCard
      title="Mapa de calor semanal (24 h)"
      titleId="weekly-heatmap-title"
      subtitle="Intensidade de aquisição por dia da semana e hora — % de sensores com leitura."
      info="Derivado das amostras radiais carregadas. Selecione um dia para detalhá-lo no perfil 24 h."
    >
      {loading ? <Skeleton variant="rounded" height={210} /> : null}

      {!loading && !hasData ? (
        <EmptyState
          title="Sem leituras no período"
          description="O mapa é preenchido conforme as aquisições são persistidas."
        />
      ) : null}

      {!loading && hasData ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ minWidth: 560 }}>
            {/* Cabeçalho de horas (rótulo a cada 2 h para reduzir ruído). */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '44px repeat(24, minmax(0, 1fr))',
                gap: '3px',
                mb: '3px',
              }}
              aria-hidden="true"
            >
              <Box />
              {Array.from({ length: 24 }, (_, hour) => (
                <Typography
                  key={hour}
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: 9.5, textAlign: 'center', lineHeight: 1 }}
                >
                  {hour % 2 === 0 ? `${String(hour).padStart(2, '0')}h` : ''}
                </Typography>
              ))}
            </Box>

            {weekMap.days.map((dayRow) => (
              <Box
                key={dayRow.day}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '44px repeat(24, minmax(0, 1fr))',
                  gap: '3px',
                  mb: '3px',
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => onSelectDay(dayRow.day)}
                  aria-label={`Selecionar ${dayRow.label} no perfil de 24 horas`}
                  aria-pressed={selectedDay === dayRow.day}
                  sx={{
                    all: 'unset',
                    cursor: 'pointer',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: selectedDay === dayRow.day ? 'primary.main' : 'text.secondary',
                    display: 'flex',
                    alignItems: 'center',
                    '&:focus-visible': {
                      outline: `2px solid ${alpha(muiTheme.palette.primary.main, 0.5)}`,
                      borderRadius: 0.5,
                    },
                  }}
                >
                  {dayRow.label}
                </Box>
                {dayRow.hours.map((hour) => (
                  <Tooltip
                    key={hour.hour}
                    arrow
                    enterDelay={120}
                    title={
                      hour.samples > 0
                        ? `${dayRow.label} · ${String(hour.hour).padStart(2, '0')}h–${String((hour.hour + 1) % 24).padStart(2, '0')}h — Sensores reportando: ${hour.sensorsReporting} / ${weekMap.totalSensors} · Cobertura: ${formatNumber(hour.share * 100, 1)}% · Amostras: ${formatNumber(hour.samples, 0)}`
                        : `${dayRow.label} · ${String(hour.hour).padStart(2, '0')}h — sem leituras`
                    }
                  >
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onSelectDay(dayRow.day)}
                      aria-label={`${dayRow.label} ${hour.hour}h: ${hour.sensorsReporting} de ${weekMap.totalSensors} sensores`}
                      sx={{
                        all: 'unset',
                        cursor: 'pointer',
                        display: 'block',
                        height: 20,
                        borderRadius: '3px',
                        bgcolor: cellColor(hour.share),
                        outline:
                          selectedDay === dayRow.day
                            ? `1px solid ${alpha(muiTheme.palette.primary.dark, 0.4)}`
                            : 'none',
                        '&:focus-visible': {
                          outline: `2px solid ${muiTheme.palette.primary.dark}`,
                        },
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            ))}

            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Baixa atividade
              </Typography>
              {[0.12, 0.32, 0.55, 0.78, 1].map((step) => (
                <Box
                  key={step}
                  aria-hidden="true"
                  sx={{ width: 18, height: 10, borderRadius: '2px', bgcolor: cellColor(step) }}
                />
              ))}
              <Typography variant="caption" color="text.secondary">
                Alta atividade
              </Typography>
            </Stack>
          </Box>
        </Box>
      ) : null}
    </DashboardCard>
  );
}
