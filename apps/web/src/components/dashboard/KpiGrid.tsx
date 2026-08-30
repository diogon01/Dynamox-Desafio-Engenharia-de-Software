import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import WhereToVoteOutlinedIcon from '@mui/icons-material/WhereToVoteOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { formatRelativeTime } from '../../features/dashboard/dashboardFormatters';

interface Kpi {
  title: string;
  value: number;
  context: string;
  tooltip?: string;
  icon: ReactNode;
  tone?: 'default' | 'warning';
}

export function KpiGrid({
  view,
  loading,
  nowMs,
}: {
  view: DashboardView;
  loading: boolean;
  nowMs: number;
}): JSX.Element {
  const kpis: Kpi[] = [
    {
      title: 'Máquinas',
      value: view.kpis.machines,
      context: 'ativos cadastrados e monitoráveis',
      icon: <PrecisionManufacturingOutlinedIcon fontSize="small" />,
    },
    {
      title: 'Pontos',
      value: view.kpis.points,
      context: 'posições de monitoramento',
      icon: <WhereToVoteOutlinedIcon fontSize="small" />,
    },
    {
      title: 'Sensores',
      value: view.kpis.sensors,
      context: `${Math.max(0, view.kpis.points - view.kpis.sensors)} ponto(s) sem sensor`,
      icon: <SensorsOutlinedIcon fontSize="small" />,
    },
    {
      title: 'Sinais de atenção',
      value: view.kpis.attention,
      context: 'condição demonstrativa, ausência ou recência',
      tooltip:
        'Conta pontos únicos com desvio demonstrativo, sensor ausente, falta de dados ou leitura desatualizada.',
      icon: <WarningAmberOutlinedIcon fontSize="small" />,
      tone: view.kpis.attention > 0 ? 'warning' : 'default',
    },
    {
      title: 'Desatualizados',
      value: view.kpis.stale,
      context: view.latestTimestamp
        ? `leitura mais recente ${formatRelativeTime(view.latestTimestamp, nowMs)}`
        : 'nenhuma leitura disponível',
      tooltip: 'Uma leitura é considerada desatualizada após 24 horas.',
      icon: <AccessTimeOutlinedIcon fontSize="small" />,
      tone: view.kpis.stale > 0 ? 'warning' : 'default',
    },
  ];

  return (
    <Box
      component="section"
      aria-label="Indicadores operacionais"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(5, minmax(0, 1fr))',
        },
        gap: 1.5,
      }}
    >
      {kpis.map((kpi) => (
        <Card
          key={kpi.title}
          variant="outlined"
          aria-label={`${kpi.title}: ${loading ? 'carregando' : kpi.value}`}
          sx={(theme) => ({
            minWidth: 0,
            borderColor: kpi.tone === 'warning' ? 'warning.main' : 'divider',
            bgcolor:
              kpi.tone === 'warning'
                ? alpha(theme.palette.warning.main, 0.07)
                : theme.palette.background.paper,
          })}
        >
          <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Tooltip title={kpi.tooltip ?? ''} disableHoverListener={!kpi.tooltip}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {kpi.title}
                </Typography>
              </Tooltip>
              <Box
                aria-hidden="true"
                sx={(theme) => ({
                  display: 'grid',
                  placeItems: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: 2,
                  color: kpi.tone === 'warning' ? 'warning.dark' : 'primary.main',
                  bgcolor:
                    kpi.tone === 'warning'
                      ? alpha(theme.palette.warning.main, 0.14)
                      : alpha(theme.palette.primary.main, 0.1),
                })}
              >
                {kpi.icon}
              </Box>
            </Stack>
            {loading ? (
              <Skeleton width="55%" height={44} />
            ) : (
              <Typography variant="h4" component="p" sx={{ mt: 0.5, fontWeight: 750 }}>
                {kpi.value}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {loading ? 'Atualizando inventário…' : kpi.context}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
