import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useEffect, useMemo, useState } from 'react';

import {
  createSelectDashboardView,
  selectDashboard,
  selectDashboardInventoryLoading,
  selectDashboardPartialErrors,
} from '../../features/dashboard/dashboardSelectors';
import {
  dashboardSeriesSelected,
  fetchDashboardSeriesDetail,
  fetchOperationalDashboard,
  periodChanged,
} from '../../features/dashboard/dashboardSlice';
import { useAppDispatch, useAppSelector } from '../../store';
import { DashboardHeader } from './DashboardHeader';
import { KpiGrid } from './KpiGrid';
import { OperationalInsights } from './OperationalInsights';
import { SensorConditionMatrix } from './SensorConditionMatrix';
import { SeriesExplorer } from './SeriesExplorer';
import { TrendPanel } from './TrendPanel';

export function OperationalDashboard(): JSX.Element {
  const dispatch = useAppDispatch();
  const [nowMs] = useState(() => Date.now());
  const selectView = useMemo(() => createSelectDashboardView(nowMs), [nowMs]);
  const dashboard = useAppSelector(selectDashboard);
  const view = useAppSelector(selectView);
  const inventoryLoading = useAppSelector(selectDashboardInventoryLoading);
  const partialErrors = useAppSelector(selectDashboardPartialErrors);

  useEffect(() => {
    void dispatch(fetchOperationalDashboard());
  }, [dispatch]);

  useEffect(() => {
    if (dashboard.selectedSeriesId) {
      void dispatch(fetchDashboardSeriesDetail(dashboard.selectedSeriesId));
    }
  }, [dispatch, dashboard.selectedSeriesId]);

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
