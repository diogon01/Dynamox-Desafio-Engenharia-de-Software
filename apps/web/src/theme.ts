import { alpha, createTheme } from '@mui/material/styles';

/**
 * Tema Material inspirado no design system da plataforma web da 42 Robotics
 * (vision-core): superfícies claras, primária ciano-petróleo, ações em pílula,
 * três níveis de sombra suave e tipografia Inter. Nenhuma marca é reproduzida —
 * apenas os tokens de estilo.
 */
const BRAND = {
  primary: '#0C6E92',
  primaryDark: '#09556F',
  primaryContrast: '#F4FBFE',
  accent: '#17A8C9',
  background: '#F3F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  onSurface: '#182636',
  // Texto e estados passam WCAG AA (>= 4,5:1) sobre as três superfícies reais do produto:
  // #FFFFFF (paper), #F8FAFC (drawer) e #F3F5F7 (fundo). Os tons anteriores mediam
  // 4,40 (secundário), 3,30 (sucesso) e 2,47 (aviso) — reprovados na auditoria.
  muted: '#556676',
  border: '#D6E0E8',
  success: '#12813B',
  warning: '#946200',
  error: '#C2413B',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: BRAND.primary,
      dark: BRAND.primaryDark,
      contrastText: BRAND.primaryContrast,
    },
    secondary: { main: BRAND.accent },
    success: { main: BRAND.success },
    warning: { main: BRAND.warning },
    error: { main: BRAND.error },
    divider: BRAND.border,
    background: { default: BRAND.background, paper: BRAND.surface },
    text: { primary: BRAND.onSurface, secondary: BRAND.muted },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h1: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.25 },
    h2: { fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.35 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    caption: { fontWeight: 500 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: BRAND.border,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        // Ações em pílula, marca registrada do design system de referência.
        root: { borderRadius: 999 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: BRAND.muted, whiteSpace: 'nowrap' },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: BRAND.surfaceAlt,
          borderRight: 'none',
          boxShadow: '24px 0 48px rgba(17, 24, 39, 0.06)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          '&.Mui-selected': {
            backgroundColor: alpha(BRAND.primary, 0.1),
            '&:hover': { backgroundColor: alpha(BRAND.primary, 0.16) },
          },
        },
      },
    },
  },
});
