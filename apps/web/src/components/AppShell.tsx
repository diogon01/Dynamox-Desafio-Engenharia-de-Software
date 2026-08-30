import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
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
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';

import { API_BASE_URL } from '../api/client';

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
    description: 'Condição, prioridade e tendência',
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
  const muiTheme = useTheme();
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <Box component="main" sx={{ px: { xs: 1.5, md: 3 }, py: 3, flexGrow: 1 }}>
          {!isDesktop ? (
            <IconButton
              aria-label="Abrir menu de navegação"
              onClick={() => setMobileOpen(true)}
              edge="start"
              sx={{ mb: 1 }}
            >
              <MenuIcon />
            </IconButton>
          ) : null}
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
