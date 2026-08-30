import { alpha, createTheme } from '@mui/material/styles';

/**
 * Design system do produto — Material UI 5 com a identidade do shell de referência
 * (vision-core): superfícies claras, primária ciano-petróleo, densidade industrial.
 * Nenhuma marca é reproduzida — apenas princípios de densidade, ritmo e hierarquia,
 * reimplementados como tokens de theme.
 *
 * Toda decisão visual do dashboard vive AQUI (paleta, semântica de condição, dimensões
 * de layout, tokens de gráfico), não espalhada pelos componentes.
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
  // #FFFFFF (paper), #F8FAFC (drawer) e #F3F5F7 (fundo). Medido, não estimado.
  muted: '#556676',
  border: '#D6E0E8',
  success: '#12813B',
  warning: '#946200',
  error: '#C2413B',
};

/**
 * Cores semânticas de CONDIÇÃO — o vocabulário visual do condition monitoring.
 * Condição, recência e cobertura são conceitos diferentes e recebem tons diferentes;
 * cor nunca é o único canal (sempre acompanhada de rótulo e, quando preciso, ícone).
 */
const CONDITION = {
  normal: '#12813B',
  observation: '#946200',
  attention: '#C2413B',
  unclassified: '#556676',
  noData: '#8A98A5',
  stale: '#8A5A00',
};

/** Tokens de layout do dashboard: uma fonte só para dimensões repetidas. */
const DASHBOARD = {
  sidebarWidth: 224,
  pagePaddingX: { xs: 12, md: 24 },
  gridGap: 14,
  sectionGap: 14,
  cardPadding: 14,
  cardRadius: 10,
  headerHeight: 52,
  chart: {
    tickFontSize: 11,
    axisColor: '#556676',
    gridColor: alpha('#556676', 0.14),
    tooltip: {
      background: '#FFFFFF',
      border: '#D6E0E8',
      radius: 8,
      fontSize: 12,
      shadow: '0 4px 12px rgba(23, 37, 46, 0.12)',
    },
  },
};

declare module '@mui/material/styles' {
  interface Palette {
    condition: typeof CONDITION;
  }
  interface PaletteOptions {
    condition?: typeof CONDITION;
  }
  interface Theme {
    dashboard: typeof DASHBOARD;
  }
  interface ThemeOptions {
    dashboard?: typeof DASHBOARD;
  }
}

export const theme = createTheme({
  dashboard: DASHBOARD,
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
    condition: CONDITION,
    divider: BRAND.border,
    background: { default: BRAND.background, paper: BRAND.surface },
    text: { primary: BRAND.onSurface, secondary: BRAND.muted },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h1: { fontSize: '1.65rem', fontWeight: 700, lineHeight: 1.25 },
    // Section heading dos painéis: denso, 15–16px.
    h2: { fontSize: '0.98rem', fontWeight: 700, lineHeight: 1.35 },
    h4: { fontSize: '2rem', fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    body2: { fontSize: '0.82rem' },
    button: { textTransform: 'none', fontWeight: 600 },
    caption: { fontWeight: 500, fontSize: '0.72rem' },
    overline: { fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0.8 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: BRAND.border,
          borderRadius: DASHBOARD.cardRadius,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        // Ações em pílula, marca do design system de referência.
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
        root: { fontSize: '0.78rem' },
        head: {
          fontWeight: 700,
          color: BRAND.muted,
          whiteSpace: 'nowrap',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          paddingTop: 4,
          paddingBottom: 4,
        },
      },
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
          borderRadius: 12,
          '&.Mui-selected': {
            backgroundColor: alpha(BRAND.primary, 0.1),
            '&:hover': { backgroundColor: alpha(BRAND.primary, 0.16) },
          },
        },
      },
    },
  },
});
