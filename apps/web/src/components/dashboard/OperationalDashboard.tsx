import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useEffect, useMemo, useState } from 'react';

import { HealthPanel } from '../HealthPanel';
import { buildDashboardView } from '../../features/dashboard/dashboardAggregations';
import {
  dashboardSeriesSelected,
  fetchDashboardSeriesDetail,
  fetchOperationalDashboard,
  periodChanged,
} from '../../features/dashboard/dashboardSlice';
import { fetchHealth } from '../../features/diagnostics/diagnosticsSlice';
import { useAppDispatch, useAppSelector } from '../../store';
import { DashboardHeader } from './DashboardHeader';
import { KpiGrid } from './KpiGrid';
import { OperationalInsights } from './OperationalInsights';
import { SensorConditionMatrix } from './SensorConditionMatrix';
import { SeriesExplorer } from './SeriesExplorer';
import { TrendPanel } from './TrendPanel';

export function OperationalDashboard(): JSX.Element {
  const dispatch = useAppDispatch();
  const dashboard = useAppSelector((state) => state.dashboard);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    void dispatch(fetchHealth());
    void dispatch(fetchOperationalDashboard());
  }, [dispatch]);

  useEffect(() => {
    if (dashboard.selectedSeriesId) {
      void dispatch(fetchDashboardSeriesDetail(dashboard.selectedSeriesId));
    }
  }, [dispatch, dashboard.selectedSeriesId]);

  const view = useMemo(() => buildDashboardView(dashboard, nowMs), [dashboard, nowMs]);
  const inventoryLoading = [dashboard.machines, dashboard.points, dashboard.series].some(
    (resource) => resource.status === 'idle' || resource.status === 'loading',
  );
  const partialErrors = [
    dashboard.machines.error ? `Máquinas: ${dashboard.machines.error}` : null,
    dashboard.points.error ? `Pontos: ${dashboard.points.error}` : null,
    dashboard.series.error ? `Séries: ${dashboard.series.error}` : null,
    Object.keys(dashboard.metricErrors).length > 0
      ? `${Object.keys(dashboard.metricErrors).length} série(s) sem métricas.`
      : null,
    Object.keys(dashboard.radialSampleErrors).length > 0
      ? `${Object.keys(dashboard.radialSampleErrors).length} série(s) radiais sem baseline calculável.`
      : null,
  ].flatMap((value) => (value ? [value] : []));

  const selectSeries = (seriesId: string) => {
    dispatch(dashboardSeriesSelected(seriesId));
  };

  const retryDetail = () => {
    if (dashboard.selectedSeriesId) {
      void dispatch(fetchDashboardSeriesDetail(dashboard.selectedSeriesId));
    }
  };

  return (
    <Stack spacing={1.5}>
      <HealthPanel />
      <DashboardHeader
        period={dashboard.period}
        loadedAt={dashboard.loadedAt}
        latestReading={view.latestTimestamp}
        onPeriodChange={(period) => dispatch(periodChanged(period))}
      />

      {partialErrors.length > 0 ? (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => void dispatch(fetchOperationalDashboard())}
            >
              Tentar novamente
            </Button>
          }
        >
          <AlertTitle>Dados parciais</AlertTitle>
          {partialErrors.join(' ')} As seções disponíveis continuam operacionais.
        </Alert>
      ) : null}

      <KpiGrid view={view} loading={inventoryLoading} nowMs={nowMs} />
      <SensorConditionMatrix
        view={view}
        loading={inventoryLoading}
        selectedSeriesId={dashboard.selectedSeriesId}
        onSelectSeries={selectSeries}
      />
      <TrendPanel
        period={dashboard.period}
        series={dashboard.series.data}
        selectedSeriesId={dashboard.selectedSeriesId}
        samples={dashboard.detailSamples}
        status={dashboard.detailStatus}
        error={dashboard.detailError}
        nowMs={nowMs}
        onSelectSeries={selectSeries}
        onRetry={retryDetail}
      />
      <OperationalInsights
        view={view}
        loading={inventoryLoading || dashboard.metricsStatus === 'loading'}
        onSelectSeries={selectSeries}
      />
      <SeriesExplorer
        series={dashboard.series.data}
        selectedSeriesId={dashboard.selectedSeriesId}
        samples={dashboard.detailSamples}
        status={dashboard.detailStatus}
        error={dashboard.detailError}
        onSelectSeries={selectSeries}
        onRetry={retryDetail}
      />
    </Stack>
  );
}
