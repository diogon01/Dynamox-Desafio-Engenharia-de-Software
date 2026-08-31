import { lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { registerUnauthorizedHandler } from './api/client';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { restoreSession, sessionExpired } from './features/auth/authSlice';
import { LoginPage } from './pages/LoginPage';
import { useAppDispatch } from './store';

const OperationalDashboard = lazy(async () => {
  const module = await import('./components/dashboard/OperationalDashboard');
  return { default: module.OperationalDashboard };
});
const MachinesPanel = lazy(async () => {
  const module = await import('./components/MachinesPanel');
  return { default: module.MachinesPanel };
});
const TimeWindowPage = lazy(async () => {
  const module = await import('./pages/investigation/TimeWindowPage');
  return { default: module.TimeWindowPage };
});

const SensorPage = lazy(async () => {
  const module = await import('./pages/investigation/SensorPage');
  return { default: module.SensorPage };
});

const AcquisitionPage = lazy(async () => {
  const module = await import('./pages/investigation/AcquisitionPage');
  return { default: module.AcquisitionPage };
});

const RawSamplesPage = lazy(async () => {
  const module = await import('./pages/investigation/RawSamplesPage');
  return { default: module.RawSamplesPage };
});

const MonitoringPointsPanel = lazy(async () => {
  const module = await import('./components/MonitoringPointsPanel');
  return { default: module.MonitoringPointsPanel };
});

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
        <Route index element={<OperationalDashboard />} />
        <Route path="/machines" element={<MachinesPanel />} />
        <Route path="/monitoring-points" element={<MonitoringPointsPanel />} />
        {/* Investigação: cada rota é um nível do drill-down, com o recorte na URL. */}
        <Route path="/monitoring/windows/:date/:hour" element={<TimeWindowPage />} />
        <Route path="/sensors/:serialNumber" element={<SensorPage />} />
        <Route path="/acquisitions/:cycleId" element={<AcquisitionPage />} />
        <Route path="/acquisitions/:cycleId/samples" element={<RawSamplesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
