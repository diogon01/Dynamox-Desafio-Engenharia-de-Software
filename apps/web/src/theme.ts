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
  primary: '#008CA5',
  primaryDark: '#006B80',
  primaryContrast: '#F4FBFE',
  accent: '#12A7BE',
  background: '#F4F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#FBFCFD',
  onSurface: '#14233B',
  // Texto e estados passam WCAG AA (>= 4,5:1) sobre as três superfícies reais do produto:
  // #FFFFFF (paper), #F8FAFC (drawer) e #F3F5F7 (fundo). Medido, não estimado.
  muted: '#5F6D7C',
  border: '#D7E0E6',
  success: '#008C62',
  warning: '#E66A16',
  error: '#E43E3D',
};

/**
 * Cores semânticas de CONDIÇÃO — o vocabulário visual do condition monitoring.
 * Condição, recência e cobertura são conceitos diferentes e recebem tons diferentes;
 * cor nunca é o único canal (sempre acompanhada de rótulo e, quando preciso, ícone).
 */
const CONDITION = {
  normal: '#00976A',
  observation: '#F2A900',
  attention: '#F04444',
  unclassified: '#7F8996',
  noData: '#B2BAC3',
  stale: '#E58A00',
};

/** Tokens de layout do dashboard: uma fonte só para dimensões repetidas. */
const DASHBOARD = {
  sidebarWidth: 232,
  pagePaddingX: { xs: 10, md: 14 },
  gridGap: 5,
  sectionGap: 5,
  cardPadding: 10,
  cardRadius: 9,
  headerHeight: 42,
  chart: {
    tickFontSize: 9.5,
    axisColor: '#556676',
    gridColor: alpha('#556676', 0.14),
    tooltip: {
      background: '#FFFFFF',
      border: '#D6E0E8',
      radius: 7,
      fontSize: 11,
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
  shape: { borderRadius: 9 },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h1: { fontSize: '1.42rem', fontWeight: 750, lineHeight: 1.18, letterSpacing: -0.25 },
    h2: { fontSize: '0.77rem', fontWeight: 750, lineHeight: 1.2 },
    h4: { fontSize: '1.8rem', fontWeight: 750 },
    subtitle2: { fontSize: '0.78rem', fontWeight: 700 },
    body2: { fontSize: '0.72rem' },
    button: { textTransform: 'none', fontWeight: 600 },
    caption: { fontWeight: 500, fontSize: '0.61rem', lineHeight: 1.28 },
    overline: { fontSize: '0.59rem', fontWeight: 750, lineHeight: 1.5, letterSpacing: 0.75 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: BRAND.border,
          borderRadius: DASHBOARD.cardRadius,
          boxShadow: '0 1px 2px rgba(15, 35, 55, 0.06), 0 3px 10px rgba(15, 35, 55, 0.025)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        // Ações em pílula, marca do design system de referência.
        root: { borderRadius: 7, minHeight: 30 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { height: 22, fontWeight: 650, fontSize: '0.66rem', borderRadius: 999 },
        icon: { fontSize: '0.9rem' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: '0.68rem', padding: '5px 8px', borderColor: '#E7EDF1' },
        head: {
          fontWeight: 700,
          color: BRAND.muted,
          whiteSpace: 'nowrap',
          fontSize: '0.58rem',
          textTransform: 'uppercase',
          letterSpacing: 0.25,
          paddingTop: 4,
          paddingBottom: 4,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { minHeight: 32, fontSize: '0.7rem', borderRadius: 7 },
        input: { paddingTop: 7, paddingBottom: 7 },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '0.72rem' } },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          minHeight: 30,
          paddingTop: 3,
          paddingBottom: 3,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: BRAND.surfaceAlt,
          borderRight: `1px solid ${BRAND.border}`,
          boxShadow: '12px 0 32px rgba(17, 24, 39, 0.025)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          '&.Mui-selected': {
            backgroundColor: alpha(BRAND.primary, 0.1),
            '&:hover': { backgroundColor: alpha(BRAND.primary, 0.16) },
          },
        },
      },
    },
  },
});
