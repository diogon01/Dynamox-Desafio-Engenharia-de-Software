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

import { Link as RouterLink } from 'react-router-dom';

import { DEFAULT_CONDITION_POLICY } from '@dynamox/domain';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { formatMeasurement, formatNumber, formatPercent } from '../../features/dashboard/dashboardFormatters';
import { links, type AnalyticsRange } from '../../features/investigation/links';

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
  /**
   * Destino da investigação, quando existe UM lugar claro para continuar. Cobertura e
   * recência ficam informativas de propósito: não há uma página que responda "quais pontos
   * estão descobertos" melhor do que a própria matriz logo abaixo, e inventar uma rota só
   * para o número virar link seria decoração.
   */
  to?: string;
}

export function KpiRow({
  view,
  loading,
  range,
}: {
  view: DashboardView;
  loading: boolean;
  range: AnalyticsRange;
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
      to: top ? links.machine(top.machineName, range) : undefined,
    },
    {
      key: 'deviation',
      label: 'Maior desvio',
      value: deviation ? `${formatNumber(deviation.ratio, 2)}×` : '—',
      context: deviation?.cell.evidence
        ? `RMS radial Y/Z · ${formatMeasurement(deviation.cell.evidence.value, deviation.cell.evidence.unit)}`
        : 'sem referência comparável na janela',
      icon: <MonitorHeartOutlinedIcon />,
      tone: 'primary',
      active: Boolean(deviation && deviation.ratio >= DEFAULT_CONDITION_POLICY.attentionRatio),
      to: deviation?.cell.sensorSerial ? links.sensor(deviation.cell.sensorSerial, range) : undefined,
    },
    {
      key: 'coverage',
      label: 'Cobertura monitorada',
      value: formatPercent(headline.coverage.reporting, headline.coverage.points),
      context: `${headline.coverage.reporting} de ${headline.coverage.points} pontos reportando`,
      icon: <ShieldOutlinedIcon />,
      tone: 'success',
      active: false,
    },
    {
      key: 'recency',
      label: 'Leituras atuais',
      value: formatPercent(headline.recency.current, headline.recency.installed),
      context: 'leituras dentro das últimas 24 h',
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
            order: { xs: index + 1, lg: 0 },
            minWidth: 0,
            display: 'flex',
          }}
        >
          <Card
            variant="outlined"
            {...(kpi.to && !loading
              ? { component: RouterLink, to: kpi.to, 'aria-label': `${kpi.label}: ${kpi.value}. ${kpi.context}. Abrir investigação.` }
              : { 'aria-label': `${kpi.label}: ${loading ? 'carregando' : kpi.value}` })}
            sx={(muiTheme) => ({
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              px: `${muiTheme.dashboard.cardPadding}px`,
              py: 1.5,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              textDecoration: 'none',
              // Só quem leva a algum lugar ganha linguagem de item navegável.
              ...(kpi.to && !loading
                ? {
                    cursor: 'pointer',
                    transition: 'border-color 120ms, background-color 120ms',
                    '&:hover': {
                      borderColor: muiTheme.palette[kpi.tone].main,
                      bgcolor: alpha(muiTheme.palette[kpi.tone].main, 0.04),
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${alpha(muiTheme.palette[kpi.tone].main, 0.6)}`,
                      outlineOffset: 2,
                    },
                  }
                : {}),
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
