import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';

import { API_BASE_URL } from '../api/client';
import { logout } from '../features/auth/authSlice';
import { useAppDispatch, useAppSelector } from '../store';

const DRAWER_WIDTH = 288;

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
    description: 'Estado da API e série temporal',
    icon: <SpaceDashboardOutlinedIcon />,
  },
  {
    to: '/machines',
    label: 'Máquinas',
    description: 'Cadastro, edição e exclusão',
    icon: <PrecisionManufacturingOutlinedIcon />,
  },
  {
    to: '/monitoring-points',
    label: 'Pontos e sensores',
    description: 'Pontos de monitoramento e sensores',
    icon: <SensorsOutlinedIcon />,
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Visão geral',
  '/machines': 'Máquinas',
  '/monitoring-points': 'Pontos e sensores',
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const location = useLocation();

  return (
    <Box sx={{ width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2.5, pb: 2 }}>
        <Avatar
          variant="rounded"
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontWeight: 700,
            borderRadius: 3,
            width: 44,
            height: 44,
          }}
        >
          DX
        </Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
            CONDITION MONITORING
          </Typography>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
            Desafio Dynamox
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ mx: 2.5 }} />

      <List
        component="nav"
        aria-label="Navegação principal"
        sx={{ px: 1.5, py: 1.5, flexGrow: 1 }}
        subheader={
          <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: 2.4 }}>
            Monitoramento
          </ListSubheader>
        }
      >
        {NAV_ITEMS.map((item) => {
          const selected = location.pathname === item.to;
          return (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={selected}
              onClick={onNavigate}
              sx={{
                mb: 0.5,
                // Trilho esquerdo do item ativo, como no design de referência.
                ...(selected
                  ? {
                      boxShadow: (muiTheme) =>
                        `inset 3px 0 0 ${muiTheme.palette.primary.main}`,
                    }
                  : {}),
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: selected ? 'primary.main' : undefined }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.description}
                primaryTypographyProps={{ fontWeight: selected ? 700 : 600 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItemButton>
          );
        })}

        <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: 2.4 }}>
          Ferramentas
        </ListSubheader>
        <ListItemButton
          component="a"
          href={`${API_BASE_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <ApiOutlinedIcon />
          </ListItemIcon>
          <ListItemText
            primary="API (Swagger)"
            secondary="Documentação interativa"
            primaryTypographyProps={{ fontWeight: 600 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItemButton>
      </List>

      <Divider sx={{ mx: 2.5 }} />
      <Typography variant="caption" color="text.secondary" sx={{ p: 2.5, pt: 1.5 }}>
        Dados sintéticos de demonstração. A aplicação nunca acessa a plataforma produtiva
        da Dynamox.
      </Typography>
    </Box>
  );
}

export function AppShell(): JSX.Element {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const location = useLocation();
  const muiTheme = useTheme();
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = PAGE_TITLES[location.pathname] ?? 'Visão geral';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          <SidebarContent />
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar flutuante em card, não uma AppBar chapada. */}
        <Box sx={{ px: { xs: 1.5, md: 3 }, pt: 1.5, position: 'sticky', top: 0, zIndex: 10 }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: 4,
              border: 1,
              borderColor: 'divider',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.85),
              backdropFilter: 'blur(8px)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
            }}
          >
            {!isDesktop ? (
              <IconButton
                aria-label="Abrir menu de navegação"
                onClick={() => setMobileOpen(true)}
                edge="start"
              >
                <MenuIcon />
              </IconButton>
            ) : null}

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
                MONITORAMENTO DE ATIVOS
              </Typography>
              <Typography variant="h1" component="h1" sx={{ fontSize: '1.2rem', lineHeight: 1.2 }}>
                {title}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
              </Avatar>
              <Typography
                variant="body2"
                sx={{ display: { xs: 'none', sm: 'block' } }}
                color="text.secondary"
              >
                {user?.email}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LogoutIcon />}
                onClick={() => void dispatch(logout())}
              >
                Sair
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Box component="main" sx={{ px: { xs: 1.5, md: 3 }, py: 3, flexGrow: 1 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
