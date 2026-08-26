import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';

import { HealthPanel } from './components/HealthPanel';
import { SeriesPanel } from './components/SeriesPanel';
import { fetchHealth, fetchTimeSeries } from './features/diagnostics/diagnosticsSlice';
import { useAppDispatch } from './store';

export function App(): JSX.Element {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(fetchHealth());
    void dispatch(fetchTimeSeries());
  }, [dispatch]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h1" component="h1" sx={{ fontSize: '1.15rem', fontWeight: 600 }}>
            Monitoramento de Ativos — Desafio Dynamox
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, display: 'grid', gap: 3 }}>
        <HealthPanel />
        <SeriesPanel />

        <Typography variant="caption" color="text.secondary">
          Fase 0 — fundação. Os dados exibidos são sintéticos e servem apenas para demonstrar a
          integração entre frontend, API e PostgreSQL.
        </Typography>
      </Container>
    </Box>
  );
}
