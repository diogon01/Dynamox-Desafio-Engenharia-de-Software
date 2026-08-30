import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { formatMeasurement, formatNumber } from '../../features/dashboard/dashboardFormatters';

/**
 * Os quatro números do topo — cada um responde a UMA pergunta:
 * condição (ativos em atenção), magnitude (maior desvio), cobertura e recência.
 * Nenhum agrega os outros; todos vêm dos dados persistidos, nunca de valores de protótipo.
 * Renderiza itens diretos do grid da página, para os quatro cards dividirem a mesma linha.
 */
interface KpiSpec {
  key: string;
  label: string;
  value: string;
  context: string;
  icon: ReactNode;
  tone: 'error' | 'primary' | 'success' | 'warning';
  active: boolean;
}

function percent(part: number, total: number): string {
  if (total === 0) return '—';
  return `${formatNumber((part / total) * 100, 1)}%`;
}

export function KpiRow({
  view,
  loading,
}: {
  view: DashboardView;
  loading: boolean;
}): JSX.Element {
  const { headline } = view;
  const top = headline.attention.top;
  const deviation = headline.maxDeviation;

  const kpis: KpiSpec[] = [
    {
      key: 'attention',
      label: 'Ativos em atenção',
      value: String(headline.attention.count),
      context:
        headline.attention.count > 0 && top
          ? `${top.machineName} · ${top.positionLabel} é o mais crítico`
          : `de ${headline.coverage.points} pontos monitorados`,
      icon: <WarningAmberOutlinedIcon />,
      tone: 'warning',
      active: headline.attention.count > 0,
    },
    {
      key: 'deviation',
      label: 'Maior desvio',
      value: deviation ? `${formatNumber(deviation.ratio, 2)}×` : '—',
      context: deviation?.cell.evidence
        ? `${deviation.cell.evidence.label} · ${formatMeasurement(deviation.cell.evidence.value, deviation.cell.evidence.unit)} vs baseline`
        : 'nenhum baseline demonstrativo calculado',
      icon: <MonitorHeartOutlinedIcon />,
      tone: 'primary',
      active: Boolean(deviation && deviation.ratio >= 2),
    },
    {
      key: 'coverage',
      label: 'Cobertura monitorada',
      value: percent(headline.coverage.reporting, headline.coverage.points),
      context: `${headline.coverage.reporting}/${headline.coverage.points} pontos instrumentados e reportando`,
      icon: <ShieldOutlinedIcon />,
      tone: 'success',
      active: false,
    },
    {
      key: 'recency',
      label: 'Leituras atuais',
      value: percent(headline.recency.current, headline.recency.installed),
      context: 'leituras dentro da janela de 24 h',
      icon: <AccessTimeOutlinedIcon />,
      tone: 'warning',
      active: headline.recency.installed > 0 && headline.recency.current < headline.recency.installed,
    },
  ];

  return (
    <>
      {kpis.map((kpi, index) => (
        <Box
          key={kpi.key}
          sx={{
            // Dois por linha já no celular: quatro cards de largura inteira empurrariam a
            // prioridade de inspeção para fora da primeira tela.
            gridColumn: { xs: 'span 6', lg: 'span 3' },
            order: index + 1,
            minWidth: 0,
            display: 'flex',
          }}
        >
          <Card
            variant="outlined"
            aria-label={`${kpi.label}: ${loading ? 'carregando' : kpi.value}`}
            sx={(muiTheme) => ({
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              minHeight: muiTheme.dashboard.cardMinHeight.kpi,
              px: `${muiTheme.dashboard.cardPadding}px`,
              py: 1.5,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            })}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Box
                aria-hidden="true"
                sx={(muiTheme) => ({
                  display: { xs: 'none', sm: 'grid' },
                  placeItems: 'center',
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  flexShrink: 0,
                  color: `${kpi.tone}.main`,
                  bgcolor: alpha(muiTheme.palette[kpi.tone].main, 0.09),
                  border: `1px solid ${alpha(muiTheme.palette[kpi.tone].main, 0.16)}`,
                  '& svg': { fontSize: 26 },
                })}
              >
                {kpi.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary" component="div" noWrap>
                  {kpi.label}
                </Typography>
                {loading ? (
                  <Skeleton width={72} height={38} />
                ) : (
                  <Typography
                    component="p"
                    sx={{
                      fontSize: { xs: '1.5rem', md: '1.7rem' },
                      fontWeight: 750,
                      lineHeight: 1.1,
                      color: `${kpi.tone}.main`,
                    }}
                  >
                    {kpi.value}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
                  {loading ? 'Avaliando a frota…' : kpi.context}
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Box>
      ))}
    </>
  );
}
