import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type { DashboardPeriod } from '../../features/dashboard/dashboardSlice';
import { formatDateTime } from '../../features/dashboard/dashboardFormatters';

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '24h': '24 h',
  '7d': '7 dias',
  '30d': '30 dias',
  all: 'Tudo',
};

const PERIODS: DashboardPeriod[] = ['24h', '7d', '30d', 'all'];

export interface DashboardHeaderProps {
  period: DashboardPeriod;
  loadedAt: string | null;
  latestReading: string | null;
  /** Inventário: contexto do que está sendo monitorado, não a mensagem operacional. */
  inventory: { machines: number; points: number; sensors: number };
  onPeriodChange: (period: DashboardPeriod) => void;
}

export function DashboardHeader({
  period,
  loadedAt,
  latestReading,
  inventory,
  onPeriodChange,
}: DashboardHeaderProps): JSX.Element {
  return (
    <Box
      component="header"
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 1,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-end' }}
        gap={2}
      >
        <Box>
          <Typography
            variant="overline"
            color="primary.main"
            sx={{ fontWeight: 700, letterSpacing: 1 }}
          >
            Central de condição
          </Typography>
          <Typography variant="h1" component="h1">
            Visão geral operacional
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Exceções primeiro; a frota completa e o histórico ficam abaixo.
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            <Chip
              icon={<CalendarMonthOutlinedIcon />}
              label={`Período: ${PERIOD_LABELS[period]}`}
              size="small"
              variant="outlined"
            />
            <Chip
              icon={<ScheduleOutlinedIcon />}
              label={`Última leitura: ${formatDateTime(latestReading)}`}
              size="small"
              variant="outlined"
            />
            {loadedAt ? (
              <Chip
                label={`Painel atualizado: ${formatDateTime(loadedAt)}`}
                size="small"
                variant="outlined"
                // Redundante no celular: ocupa uma linha inteira antes das exceções.
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              />
            ) : null}
          </Stack>
          {/* Inventário como contexto: informa a escala do monitoramento sem competir
              com os indicadores de exceção. */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Monitorando {inventory.machines} máquina(s) · {inventory.points} ponto(s) ·{' '}
            {inventory.sensors} sensor(es)
          </Typography>
        </Box>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={period}
          aria-label="Período global do dashboard"
          onChange={(_event, next: DashboardPeriod | null) => {
            if (next) onPeriodChange(next);
          }}
          sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start', md: 'flex-end' } }}
        >
          {PERIODS.map((key) => (
            <ToggleButton key={key} value={key} aria-label={PERIOD_LABELS[key]} sx={{ flex: 1 }}>
              {PERIOD_LABELS[key]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
    </Box>
  );
}
