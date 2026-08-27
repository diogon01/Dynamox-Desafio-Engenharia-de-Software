import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { registerUnauthorizedHandler } from './api/client';
import { HealthPanel } from './components/HealthPanel';
import { MachinesPanel } from './components/MachinesPanel';
import { RequireAuth } from './components/RequireAuth';
import { SeriesPanel } from './components/SeriesPanel';
import { logout, restoreSession, sessionExpired } from './features/auth/authSlice';
import { fetchHealth, fetchTimeSeries } from './features/diagnostics/diagnosticsSlice';
import { LoginPage } from './pages/LoginPage';
import { useAppDispatch, useAppSelector } from './store';

function Dashboard(): JSX.Element {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    void dispatch(fetchHealth());
    void dispatch(fetchTimeSeries());
  }, [dispatch]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography
            variant="h1"
            component="h1"
            sx={{ fontSize: '1.15rem', fontWeight: 600, flexGrow: 1 }}
          >
            Monitoramento de Ativos — Desafio Dynamox
          </Typography>
          <Typography variant="body2">{user?.email}</Typography>
          <Button color="inherit" variant="outlined" onClick={() => void dispatch(logout())}>
            Sair
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, display: 'grid', gap: 3 }}>
        <HealthPanel />
        <MachinesPanel />
        <SeriesPanel />

        <Typography variant="caption" color="text.secondary">
          Os dados exibidos são sintéticos e servem apenas para demonstrar a integração entre
          frontend, API e PostgreSQL.
        </Typography>
      </Container>
    </Box>
  );
}

export function App(): JSX.Element {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Tratamento central de 401: qualquer resposta não autorizada derruba a sessão.
    registerUnauthorizedHandler(() => dispatch(sessionExpired()));
    void dispatch(restoreSession());
    return () => registerUnauthorizedHandler(null);
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
