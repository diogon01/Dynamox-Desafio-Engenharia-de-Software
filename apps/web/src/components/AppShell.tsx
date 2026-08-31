import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import { Suspense, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { LoadingState } from '@dynamox/ui';

import { API_BASE_URL } from '../api/client';
import { AppHeader } from './AppHeader';



interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: ReactNode;
}

/** Ícone + rótulo + descrição de uma linha, como no shell de referência. */
const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Visão geral',
    description: 'Condição, prioridade e tendência',
    icon: <SpaceDashboardOutlinedIcon />,
  },
  {
    to: '/machines',
    label: 'Máquinas',
    description: 'Cadastro e operação dos ativos',
    icon: <PrecisionManufacturingOutlinedIcon />,
  },
  {
    to: '/monitoring-points',
    label: 'Pontos e sensores',
    description: 'Registro de toda a planta, com busca',
    icon: <SensorsOutlinedIcon />,
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  return (
    <Box sx={(muiTheme) => ({ width: muiTheme.dashboard.sidebarWidth, display: 'flex', flexDirection: 'column', height: '100%' })}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2, py: 1.75 }}>
        <Avatar
          variant="rounded"
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontWeight: 700,
            borderRadius: '50%',
            width: 38,
            height: 38,
            fontSize: '0.86rem',
          }}
        >
          DX
        </Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.45 }}>
            CONDITION MONITORING
          </Typography>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
            Desafio Dynamox
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ mx: 2 }} />

      <List
        component="nav"
        aria-label="Navegação principal"
        sx={{ px: 1.25, py: 1.25, flexGrow: 1 }}
        subheader={
          <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: 2.7, px: 1.5, fontSize: '0.68rem' }}>
            Monitoramento
          </ListSubheader>
        }
      >
        {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              sx={(theme) => ({
                mb: 0.35,
                minHeight: 54,
                px: 1.5,
                '&.active': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                  '& .MuiListItemText-primary': { fontWeight: 700 },
                },
              })}
            >
              <ListItemIcon sx={{ minWidth: 36, '& svg': { fontSize: 18 } }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.description}
                primaryTypographyProps={{ fontWeight: 650, fontSize: '0.76rem' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItemButton>
          ))}

        <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: 2.2, px: 1.5, mt: -1.1, fontSize: '0.68rem' }}>
          Ferramentas
        </ListSubheader>
        <ListItemButton
          component="a"
          href={`${API_BASE_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ListItemIcon sx={{ minWidth: 36, '& svg': { fontSize: 18 } }}>
            <ApiOutlinedIcon />
          </ListItemIcon>
          <ListItemText
            primary="API (Swagger)"
            secondary="Documentação interativa"
            primaryTypographyProps={{ fontWeight: 650, fontSize: '0.76rem' }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItemButton>
      </List>

      <Divider sx={{ mx: 2 }} />
      <Typography variant="caption" color="text.secondary" sx={{ p: 2, pt: 1.25 }}>
        Dados sintéticos de demonstração. A aplicação nunca acessa a plataforma produtiva
        da Dynamox.
      </Typography>
    </Box>
  );
}

export function AppShell(): JSX.Element {
  const muiTheme = useTheme();
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={(muiTheme) => ({
            width: muiTheme.dashboard.sidebarWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: muiTheme.dashboard.sidebarWidth },
          })}
        >
          <SidebarContent />
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={(muiTheme) => ({ '& .MuiDrawer-paper': { width: muiTheme.dashboard.sidebarWidth } })}
        >
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Uma única barra de aplicação; a página começa imediatamente abaixo dela. */}
        <AppHeader onOpenNavigation={isDesktop ? undefined : () => setMobileOpen(true)} />

        <Box
          component="main"
          sx={(theme) => ({
            px: `${theme.dashboard.pagePaddingX.xs}px`,
            pb: 3,
            flexGrow: 1,
            minWidth: 0,
            [theme.breakpoints.up('md')]: { px: `${theme.dashboard.pagePaddingX.md}px` },
          })}
        >
          <Suspense fallback={<LoadingState label="Carregando página…" />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
