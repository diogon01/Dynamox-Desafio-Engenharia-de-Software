import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import { Suspense, useState, type ReactNode } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';

import { LoadingState } from '@dynamox/ui';

import { API_BASE_URL } from '../api/client';
import { NAV_GROUPS, isNavItemActive, type NavItem } from '../features/navigation/navigation';
import { AppHeader } from './AppHeader';

/**
 * Um ícone por destino, ao lado do destino — o vocabulário visual mora aqui, a arquitetura
 * de navegação mora em `features/navigation`. Semelhantes usam o mesmo ícone: ponto e sensor
 * são a mesma família de "o que mede".
 */
const NAV_ICONS: Record<string, ReactNode> = {
  '/': <SpaceDashboardOutlinedIcon />,
  '/alerts': <NotificationsActiveOutlinedIcon />,
  '/machines': <PrecisionManufacturingOutlinedIcon />,
  '/monitoring-points': <SensorsOutlinedIcon />,
};

/** Rótulo de seção: presente para orientar, discreto para não competir com os destinos. */
function SectionLabel({ id, children }: { id: string; children: string }): JSX.Element {
  return (
    <Typography
      id={id}
      variant="overline"
      component="h2"
      color="text.secondary"
      sx={{ display: 'block', px: 1.75, pb: 0.5, fontSize: '0.63rem', letterSpacing: 0.9 }}
    >
      {children}
    </Typography>
  );
}

/**
 * Estado do item de navegação. O ativo se anuncia por quatro canais somados — trilho lateral,
 * fundo tonal, ícone colorido e peso do texto —, porque cor sozinha não é acessível e um
 * botão inteiro preenchido gritaria mais que o conteúdo da página.
 */
const navItemSx = (theme: Theme) => ({
  position: 'relative' as const,
  minHeight: 46,
  borderRadius: 2,
  px: 1.75,
  py: 0.85,
  mb: 0.25,
  color: 'text.primary',
  '& .MuiListItemIcon-root': { minWidth: 32, color: 'text.secondary', '& svg': { fontSize: 19 } },
  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
  '&:focus-visible': {
    outline: `2px solid ${alpha(theme.palette.primary.main, 0.6)}`,
    outlineOffset: -2,
  },
  '&.active': {
    bgcolor: alpha(theme.palette.primary.main, 0.1),
    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
    '& .MuiListItemIcon-root': { color: 'primary.main' },
    '& .MuiListItemText-primary': { fontWeight: 750, color: 'primary.dark' },
    // Trilho: identifica o item ativo mesmo em escala de cinza.
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 6,
      top: 9,
      bottom: 9,
      width: 3,
      borderRadius: 999,
      bgcolor: 'primary.main',
    },
  },
});

function ariaCurrent(item: NavItem, pathname: string): 'page' | 'true' | undefined {
  if (pathname === item.to) return 'page';
  return isNavItemActive(item, pathname) ? 'true' : undefined;
}

const primaryTypographyProps = { fontWeight: 650, fontSize: '0.78rem', lineHeight: 1.3 } as const;
const secondaryTypographyProps = { variant: 'caption', sx: { lineHeight: 1.3 } } as const;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const { pathname } = useLocation();

  return (
    <Box
      sx={(muiTheme) => ({
        width: muiTheme.dashboard.sidebarWidth,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      })}
    >
      {/* MARCA — identifica o produto e volta ao início; compacta, nunca um hero. */}
      <Stack
        component={RouterLink}
        to="/"
        onClick={onNavigate}
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{
          px: 2,
          py: 1.75,
          textDecoration: 'none',
          color: 'inherit',
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
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
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.45 }} component="div" noWrap>
            CONDITION MONITORING
          </Typography>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }} noWrap>
            Desafio Dynamox
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ mx: 2 }} />

      {/*
        Uma landmark de navegação só, com os grupos dentro: quem usa leitor de tela pula para
        "navegação principal" uma vez e ouve as seções, em vez de tropeçar em duas landmarks.
      */}
      <Box component="nav" aria-label="Navegação principal" sx={{ px: 1, pt: 1.5, flexGrow: 1, overflowY: 'auto' }}>
        {NAV_GROUPS.map((group, index) => (
          <Box key={group.id} sx={{ mb: index === NAV_GROUPS.length - 1 ? 0 : 2 }}>
            <SectionLabel id={`nav-group-${group.id}`}>{group.label}</SectionLabel>
            <List disablePadding aria-labelledby={`nav-group-${group.id}`}>
              {group.items.map((item) => (
                <ListItemButton
                  key={item.to}
                  /*
                   * `Link`, não `NavLink`: o NavLink calcularia o próprio "ativo" a partir do
                   * prefixo da rota e só então emitiria `aria-current` — o que discordaria do
                   * destaque visual justamente nas rotas de investigação, que vivem fora do
                   * prefixo. Uma fonte de verdade só: `isNavItemActive`.
                   */
                  component={RouterLink}
                  to={item.to}
                  className={isNavItemActive(item, pathname) ? 'active' : undefined}
                  /*
                   * "page" só onde a pessoa realmente está; "true" quando o item é o ramo que
                   * contém a página (um sensor está sob Máquinas, mas não É a página Máquinas).
                   */
                  aria-current={ariaCurrent(item, pathname)}
                  onClick={onNavigate}
                  sx={navItemSx}
                >
                  <ListItemIcon>{NAV_ICONS[item.to]}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.description}
                    primaryTypographyProps={primaryTypographyProps}
                    secondaryTypographyProps={secondaryTypographyProps}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))}
      </Box>

      {/*
        RODAPÉ — ferramenta de desenvolvimento e a ressalva sobre os dados. Ficam fora da
        navegação de operação de propósito: nenhum dos dois é um destino do trabalho diário.
        Usuário, perfil e sair já vivem no cabeçalho; duplicá-los aqui só ocuparia espaço.
      */}
      <Box sx={{ px: 1, pb: 0.5 }}>
        <Divider sx={{ mx: 1, mb: 1 }} />
        <List disablePadding>
          <ListItemButton
            component="a"
            href={`${API_BASE_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="API (Swagger) — documentação interativa, abre em nova aba"
            sx={navItemSx}
          >
            <ListItemIcon>
              <ApiOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary="API (Swagger)"
              secondary="Documentação interativa"
              primaryTypographyProps={primaryTypographyProps}
              secondaryTypographyProps={secondaryTypographyProps}
            />
            <OpenInNewIcon aria-hidden sx={{ fontSize: 14, color: 'text.disabled', ml: 0.5 }} />
          </ListItemButton>
        </List>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 2, pt: 0.5 }}>
        Dados sintéticos de demonstração. A aplicação nunca acessa a plataforma produtiva da
        Dynamox.
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
