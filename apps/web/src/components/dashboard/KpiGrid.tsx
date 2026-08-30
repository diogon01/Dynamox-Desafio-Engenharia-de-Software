import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import SensorsOffOutlinedIcon from '@mui/icons-material/SensorsOffOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';

/**
 * Um KPI = um conceito. A versão anterior somava condição, ausência de sensor, ausência de
 * dados e recência num único "sinais de atenção" — o número resultava sempre igual ao total
 * de pontos e não dizia o que fazer. Aqui cada cartão responde a uma pergunta diferente e
 * pode ser zero sem que os outros sejam.
 */
interface Kpi {
  key: 'attention' | 'stale' | 'coverage';
  title: string;
  value: number;
  context: string;
  icon: ReactNode;
  tone: 'error' | 'warning' | 'info';
}

export interface KpiGridProps {
  view: DashboardView;
  loading: boolean;
}

export function KpiGrid({ view, loading }: KpiGridProps): JSX.Element {
  const { attention, stale, coverage } = view.kpis;

  const kpis: Kpi[] = [
    {
      key: 'attention',
      title: 'Em atenção',
      value: attention,
      context:
        attention > 0
          ? 'pontos com desvio demonstrativo acima do baseline'
          : 'nenhum desvio demonstrativo acima do baseline',
      icon: <WarningAmberOutlinedIcon fontSize="small" />,
      tone: 'error',
    },
    {
      key: 'stale',
      title: 'Sem leitura recente',
      value: stale,
      context:
        stale > 0
          ? 'última leitura com mais de 24 h ou à frente do relógio'
          : 'todas as leituras dentro da janela de 24 h',
      icon: <AccessTimeOutlinedIcon fontSize="small" />,
      tone: 'warning',
    },
    {
      key: 'coverage',
      title: 'Cobertura',
      value: coverage,
      context:
        coverage > 0
          ? 'pontos sem sensor instalado ou sem nenhuma leitura'
          : 'todos os pontos com sensor reportando',
      icon: <SensorsOffOutlinedIcon fontSize="small" />,
      tone: 'info',
    },
  ];

  return (
    <Box
      component="section"
      aria-label="Indicadores operacionais"
      sx={{
        display: 'grid',
        // No celular os três indicadores dividem a linha: a fila de exceções precisa caber
        // na primeira dobra, e três cartões empilhados a empurrariam para fora da tela.
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: { xs: 0.75, sm: 1.5 },
      }}
    >
      {kpis.map((kpi) => {
        const active = kpi.value > 0;
        return (
          <Card
            key={kpi.key}
            variant="outlined"
            aria-label={`${kpi.title}: ${loading ? 'carregando' : kpi.value}`}
            sx={(theme) => ({
              minWidth: 0,
              borderColor: active ? `${kpi.tone}.main` : 'divider',
              // Cor comunica estado; superfície neutra quando não há o que comunicar.
              bgcolor: active
                ? alpha(theme.palette[kpi.tone].main, 0.06)
                : theme.palette.background.paper,
            })}
          >
            <CardContent
              sx={{ p: { xs: 1.25, sm: 1.75 }, '&:last-child': { pb: { xs: 1.25, sm: 1.75 } } }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {kpi.title}
                </Typography>
                <Box
                  aria-hidden="true"
                  sx={(theme) => ({
                    display: { xs: 'none', sm: 'grid' },
                    placeItems: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 2,
                    color: active ? `${kpi.tone}.main` : 'text.secondary',
                    bgcolor: active
                      ? alpha(theme.palette[kpi.tone].main, 0.12)
                      : theme.palette.action.hover,
                  })}
                >
                  {kpi.icon}
                </Box>
              </Stack>
              {loading ? (
                <Skeleton width="45%" height={44} />
              ) : (
                <Typography
                  variant="h4"
                  component="p"
                  sx={{ mt: 0.5, fontWeight: 750, color: active ? `${kpi.tone}.main` : 'text.primary' }}
                >
                  {kpi.value}
                </Typography>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: 'none', sm: 'block' } }}
              >
                {loading ? 'Avaliando a frota…' : kpi.context}
              </Typography>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
