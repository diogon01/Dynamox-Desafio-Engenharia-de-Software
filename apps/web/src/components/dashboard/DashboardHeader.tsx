import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type { DashboardPeriod } from '../../features/dashboard/dashboardSlice';
import {
  formatDateTime,
  formatRelativeTime,
} from '../../features/dashboard/dashboardFormatters';

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
  nowMs: number;
  onPeriodChange: (period: DashboardPeriod) => void;
}

/** Cabeçalho operacional: título, janela ativa e a troca de período — nada de inventário. */
export function DashboardHeader({
  period,
  loadedAt,
  latestReading,
  nowMs,
  onPeriodChange,
}: DashboardHeaderProps): JSX.Element {
  return (
    <Box
      component="header"
      sx={(muiTheme) => ({
        px: `${muiTheme.dashboard.cardPadding + 4}px`,
        py: 1.5,
        borderRadius: `${muiTheme.dashboard.cardRadius}px`,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 1,
      })}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={1.5}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main" component="div">
            Central de condição
          </Typography>
          <Typography variant="h1" component="h1" sx={{ lineHeight: 1.15 }}>
            Visão geral operacional
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
            Priorização de inspeção, tendência e saúde dos sensores com dados persistidos pela API.
          </Typography>
        </Box>

        <Stack alignItems={{ xs: 'stretch', md: 'flex-end' }} gap={0.75}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={period}
            aria-label="Período global do dashboard"
            onChange={(_event, next: DashboardPeriod | null) => {
              if (next) onPeriodChange(next);
            }}
          >
            {PERIODS.map((key) => (
              <ToggleButton key={key} value={key} aria-label={PERIOD_LABELS[key]} sx={{ flex: 1, px: 1.5 }}>
                {PERIOD_LABELS[key]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap justifyContent={{ md: 'flex-end' }}>
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
                label={`Painel atualizado ${formatRelativeTime(loadedAt, nowMs)}`}
                size="small"
                variant="outlined"
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              />
            ) : null}
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
