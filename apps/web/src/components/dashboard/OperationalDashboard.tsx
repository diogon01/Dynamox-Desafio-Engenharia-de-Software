import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createSelectDashboardView,
  selectDashboard,
  selectDashboardInventoryLoading,
  selectDashboardPartialErrors,
} from '../../features/dashboard/dashboardSelectors';
import {
  dashboardSeriesAutoSelected,
  dashboardSeriesSelected,
  fetchConditionEvidence,
  fetchDashboardSeriesDetail,
  fetchOperationalDashboard,
  periodChanged,
} from '../../features/dashboard/dashboardSlice';
import { useAppDispatch, useAppSelector } from '../../store';
import { AcquisitionActivity } from './AcquisitionActivity';
import { AssetConditionColumns } from './AssetConditionColumns';
import { DashboardHeader } from './DashboardHeader';
import { DataQualityPanel } from './DataQualityPanel';
import { DayProfilePanel } from './DayProfilePanel';
import { FleetConditionBar } from './FleetConditionBar';
import { FleetConditionMatrix } from './FleetConditionMatrix';
import { InspectionPriorityTable } from './InspectionPriorityTable';
import { KpiRow } from './KpiRow';
import { RecentOccurrences } from './RecentOccurrences';
import { SensorHealthDonut } from './SensorHealthDonut';
import { SeriesExplorer } from './SeriesExplorer';
import { TrendPanel } from './TrendPanel';
import { WeeklyHeatmap } from './WeeklyHeatmap';

/**
 * Central operacional de condition monitoring. A composição segue a hierarquia
 * SITUAÇÃO → PRIORIDADE → EVIDÊNCIA → CONTEXTO DA FROTA → QUALIDADE → PADRÃO TEMPORAL
 * → EXPLORAÇÃO, num grid de 12 colunas:
 *
 *   KPIs (3+3+3+3) · Condição/Prioridade/Saúde (3+6+3) · Tendência/Ocorrências (9+3)
 *   Condição por ativo/Aquisição/Qualidade (3+6+3) · Heatmap/Perfil 24h (8+4) · Matriz (12)
 */
export function OperationalDashboard(): JSX.Element {
  const dispatch = useAppDispatch();
  const [nowMs] = useState(() => Date.now());
  const selectView = useMemo(() => createSelectDashboardView(nowMs), [nowMs]);
  const dashboard = useAppSelector(selectDashboard);
  const view = useAppSelector(selectView);
  const inventoryLoading = useAppSelector(selectDashboardInventoryLoading);
  const partialErrors = useAppSelector(selectDashboardPartialErrors);
  const investigationRef = useRef<HTMLHeadingElement>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    void dispatch(fetchOperationalDashboard());
  }, [dispatch]);

  // Segunda etapa: fora do caminho crítico do primeiro render — a tela já está
  // utilizável enquanto a avaliação de condição chega.
  useEffect(() => {
    if (dashboard.series.status === 'succeeded' && dashboard.conditionStatus === 'idle') {
      void dispatch(fetchConditionEvidence());
    }
  }, [dispatch, dashboard.series.status, dashboard.conditionStatus]);

  // Ao terminar a avaliação, o painel mostra a maior exceção — a menos que a pessoa já
  // tenha escolhido outra série.
  useEffect(() => {
    const alvo = view.ranking[0]?.preferredSeriesId ?? view.priority[0]?.preferredSeriesId;
    if (dashboard.conditionStatus === 'succeeded' && alvo) {
      dispatch(dashboardSeriesAutoSelected(alvo));
    }
  }, [dispatch, dashboard.conditionStatus, view.ranking, view.priority]);

  useEffect(() => {
    if (dashboard.selectedSeriesId) {
      void dispatch(fetchDashboardSeriesDetail(dashboard.selectedSeriesId));
    }
  }, [dispatch, dashboard.selectedSeriesId]);

  const selectSeries = useCallback(
    (seriesId: string) => {
      dispatch(dashboardSeriesSelected(seriesId));
    },
    [dispatch],
  );

  /**
   * Drill-down: troca o contexto E leva a pessoa até a evidência temporal — com foco,
   * para o caminho existir também no teclado.
   */
  const investigate = useCallback(
    (seriesId: string) => {
      selectSeries(seriesId);
      const heading = investigationRef.current;
      if (!heading) return;
      heading.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      heading.focus?.({ preventScroll: true });
    },
    [selectSeries],
  );

  const retryDetail = () => {
    if (dashboard.selectedSeriesId) {
      void dispatch(fetchDashboardSeriesDetail(dashboard.selectedSeriesId));
    }
  };

  const evaluating =
    dashboard.conditionStatus === 'loading' || dashboard.conditionStatus === 'idle';

  // Master/detail do padrão temporal: sem escolha explícita, o dia mais ativo.
  const activeDay =
    selectedDay ??
    view.weekMap.days.reduce(
      (best, day) => {
        const total = day.hours.reduce((sum, hour) => sum + hour.samples, 0);
        return total > best.total ? { day: day.day, total } : best;
      },
      { day: new Date(nowMs).getDay(), total: 0 },
    ).day;

  /** Item do grid: spans por breakpoint + ordem no empilhamento mobile. */
  const item = (lg: number, md: number, order: number) => ({
    gridColumn: { xs: 'span 12', md: `span ${md}`, lg: `span ${lg}` },
    order: { xs: order, md: 0 },
    minWidth: 0,
  });

  return (
    <Stack spacing={1.75}>
      <DashboardHeader
        period={dashboard.period}
        loadedAt={dashboard.loadedAt}
        latestReading={view.latestTimestamp}
        nowMs={nowMs}
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

      <KpiRow view={view} loading={inventoryLoading} />

      <Box
        sx={(muiTheme) => ({
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: `${muiTheme.dashboard.gridGap}px`,
          alignItems: 'stretch',
        })}
      >
        {/* SITUAÇÃO → PRIORIDADE → SAÚDE */}
        <Box sx={item(3, 6, 4)}>
          <FleetConditionBar view={view} loading={inventoryLoading} />
        </Box>
        <Box sx={item(6, 12, 1)}>
          <InspectionPriorityTable
            view={view}
            loading={inventoryLoading}
            evaluating={evaluating}
            selectedSeriesId={dashboard.selectedSeriesId}
            onInvestigate={investigate}
          />
        </Box>
        <Box sx={item(3, 6, 6)}>
          <SensorHealthDonut view={view} loading={inventoryLoading} />
        </Box>

        {/* EVIDÊNCIA */}
        <Box sx={item(9, 12, 2)}>
          <TrendPanel
            period={dashboard.period}
            series={dashboard.series.data}
            selectedSeriesId={dashboard.selectedSeriesId}
            samples={dashboard.detailSamples}
            status={dashboard.detailStatus}
            error={dashboard.detailError}
            nowMs={nowMs}
            onRetry={retryDetail}
            onPeriodChange={(period) => dispatch(periodChanged(period))}
            headingRef={investigationRef}
          />
        </Box>
        <Box sx={item(3, 12, 3)}>
          <RecentOccurrences view={view} loading={inventoryLoading} onInvestigate={investigate} />
        </Box>

        {/* CONTEXTO DA FROTA + QUALIDADE */}
        <Box sx={item(3, 6, 7)}>
          <AssetConditionColumns view={view} loading={inventoryLoading} />
        </Box>
        <Box sx={item(6, 12, 8)}>
          <AcquisitionActivity view={view} loading={inventoryLoading || evaluating} />
        </Box>
        <Box sx={item(3, 6, 5)}>
          <DataQualityPanel view={view} loading={inventoryLoading} />
        </Box>

        {/* PADRÃO TEMPORAL */}
        <Box sx={item(8, 12, 9)}>
          <WeeklyHeatmap
            weekMap={view.weekMap}
            loading={inventoryLoading || evaluating}
            selectedDay={activeDay}
            onSelectDay={setSelectedDay}
          />
        </Box>
        <Box sx={item(4, 12, 10)}>
          <DayProfilePanel
            weekMap={view.weekMap}
            loading={inventoryLoading || evaluating}
            selectedDay={activeDay}
            onSelectDay={setSelectedDay}
          />
        </Box>

        {/* EXPLORAÇÃO */}
        <Box sx={item(12, 12, 11)}>
          <FleetConditionMatrix
            view={view}
            loading={inventoryLoading}
            nowMs={nowMs}
            selectedSeriesId={dashboard.selectedSeriesId}
            onSelect={investigate}
          />
        </Box>
        <Box sx={item(12, 12, 12)}>
          <SeriesExplorer
            series={dashboard.series.data}
            selectedSeriesId={dashboard.selectedSeriesId}
            samples={dashboard.detailSamples}
            status={dashboard.detailStatus}
            error={dashboard.detailError}
            onSelectSeries={selectSeries}
            onRetry={retryDetail}
          />
        </Box>
      </Box>
    </Stack>
  );
}
