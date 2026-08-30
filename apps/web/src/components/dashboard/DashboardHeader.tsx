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

const PERIODS: DashboardPeriod[] = ['24h', '7d', '30d'];

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
  nowMs: _nowMs,
  onPeriodChange,
}: DashboardHeaderProps): JSX.Element {
  return (
    <Box
      component="header"
      sx={(muiTheme) => ({
        px: `${muiTheme.dashboard.cardPadding + 5}px`,
        py: 1,
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
        gap={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main" component="div">
            Central de condição
          </Typography>
          <Typography variant="h1" component="h1" sx={{ lineHeight: 1.15 }}>
            Visão geral operacional
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.1 }}>
            Priorização de inspeção, tendência e saúde dos sensores com dados persistidos pela API.
          </Typography>
          <Stack direction="row" gap={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.7 }}>
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
                icon={<ScheduleOutlinedIcon />}
                label={`Painel atualizado: ${formatDateTime(loadedAt)}`}
                size="small"
                variant="outlined"
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              />
            ) : null}
          </Stack>
        </Box>

        <Stack alignItems={{ xs: 'stretch', md: 'flex-end' }} alignSelf={{ md: 'flex-start' }} sx={{ pt: { md: 1.8 } }}>
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
              <ToggleButton key={key} value={key} aria-label={PERIOD_LABELS[key]} sx={{ flex: 1, px: 2 }}>
                {PERIOD_LABELS[key]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box
            component="button"
            type="button"
            aria-label="Tudo"
            aria-pressed={period === 'all'}
            onClick={() => onPeriodChange('all')}
            sx={{
              position: 'absolute',
              width: 1,
              height: 1,
              p: 0,
              m: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            Tudo
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
