import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0b6bcb' },
    secondary: { main: '#f2760c' },
    background: { default: '#f5f7fa' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h1: { fontSize: '1.6rem', fontWeight: 600 },
    h2: { fontSize: '1.2rem', fontWeight: 600 },
  },
});
