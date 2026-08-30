import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/**
 * Superfície padrão dos painéis do dashboard: título denso, subtítulo opcional, ícone de
 * informação e uma área de ação à direita. Centraliza o estilo que antes seria repetido
 * como Paper + sx em cada arquivo. Cards não são clicáveis; linhas internas podem ser.
 */
export interface DashboardCardProps {
  title: string;
  titleId?: string;
  subtitle?: ReactNode;
  /** Texto do tooltip de contexto ao lado do título. */
  info?: string;
  /** Conteúdo alinhado à direita do cabeçalho (chips, tabs, contagem). */
  action?: ReactNode;
  /** Remove o padding lateral do corpo — para tabelas encostarem nas bordas. */
  flush?: boolean;
  children: ReactNode;
}

export function DashboardCard({
  title,
  titleId,
  subtitle,
  info,
  action,
  flush = false,
  children,
}: DashboardCardProps): JSX.Element {
  return (
    <Card
      variant="outlined"
      component="section"
      aria-labelledby={titleId}
      sx={(muiTheme) => ({
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: `${muiTheme.dashboard.cardPadding}px`,
        ...(flush ? { px: 0, '& > .DashboardCard-header': { px: `${muiTheme.dashboard.cardPadding}px` } } : {}),
      })}
    >
      <Stack
        className="DashboardCard-header"
        // Em telas estreitas a ação desce para baixo do título; lado a lado, ela
        // esmagava o subtítulo a uma coluna de uma palavra por linha.
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
        gap={{ xs: 0.5, sm: 1 }}
        sx={{ mb: subtitle ? 0.25 : 1 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography id={titleId} variant="h2" component="h2" noWrap>
              {title}
            </Typography>
            {info ? (
              <Tooltip title={info} arrow>
                <InfoOutlinedIcon
                  sx={{ fontSize: 15, color: 'text.secondary' }}
                  aria-label={`Sobre: ${title}`}
                />
              </Tooltip>
            ) : null}
          </Stack>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" component="div">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Stack>
      <Box sx={{ flexGrow: 1, minWidth: 0, mt: subtitle ? 1 : 0 }}>{children}</Box>
    </Card>
  );
}
