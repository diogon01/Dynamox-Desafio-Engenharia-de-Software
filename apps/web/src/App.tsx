import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { registerUnauthorizedHandler } from './api/client';
import { AppShell } from './components/AppShell';
import { MachinesPanel } from './components/MachinesPanel';
import { MonitoringPointsPanel } from './components/MonitoringPointsPanel';
import { OperationalDashboard } from './components/dashboard/OperationalDashboard';
import { RequireAuth } from './components/RequireAuth';
import { restoreSession, sessionExpired } from './features/auth/authSlice';
import { LoginPage } from './pages/LoginPage';
import { useAppDispatch } from './store';

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
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<OperationalDashboard />} />
        <Route path="/machines" element={<MachinesPanel />} />
        <Route path="/monitoring-points" element={<MonitoringPointsPanel />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
