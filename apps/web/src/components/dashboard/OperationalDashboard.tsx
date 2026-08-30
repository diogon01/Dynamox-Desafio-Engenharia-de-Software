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
import { DashboardHeader } from './DashboardHeader';
import { FleetFreshness } from './FleetFreshness';
import { InspectionQueue } from './InspectionQueue';
import { KpiGrid } from './KpiGrid';
import { SensorConditionMatrix } from './SensorConditionMatrix';
import { SeriesExplorer } from './SeriesExplorer';
import { TrendPanel } from './TrendPanel';

/**
 * Central operacional. A ordem da página é a ordem das perguntas de quem opera:
 *
 *   ATENÇÃO → ATIVO → PONTO → SENSOR → SINAL → EVIDÊNCIA → HISTÓRICO
 *
 * Antes, a página abria pelo inventário e pela frota inteira; a exceção real aparecia
 * depois de doze linhas iguais, e o gráfico que sustentava a decisão ficava no rodapé.
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

  useEffect(() => {
    void dispatch(fetchOperationalDashboard());
  }, [dispatch]);

  // Segunda etapa: só depois que as séries chegaram, e fora do caminho crítico do primeiro
  // render — a tela já está utilizável enquanto a avaliação de condição é buscada.
  useEffect(() => {
    if (dashboard.series.status === 'succeeded' && dashboard.conditionStatus === 'idle') {
      void dispatch(fetchConditionEvidence());
    }
  }, [dispatch, dashboard.series.status, dashboard.conditionStatus]);

  /**
   * Assim que a condição é avaliada, o painel passa a mostrar a maior exceção — a menos
   * que a pessoa já tenha escolhido outra série. Abrir o dashboard num sensor arbitrário
   * enquanto existe um ponto em atenção contraria a ordem de leitura da tela.
   */
  useEffect(() => {
    const alvo = view.ranking[0]?.preferredSeriesId;
    if (dashboard.conditionStatus === 'succeeded' && alvo) {
      dispatch(dashboardSeriesAutoSelected(alvo));
    }
  }, [dispatch, dashboard.conditionStatus, view.ranking]);

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
   * Drill-down: além de trocar a seleção, leva a pessoa até o painel de investigação.
   * Sem isto, clicar numa exceção atualizava um painel fora da tela e a interação parecia
   * não ter feito nada. O foco vai para o título, então o caminho também existe no teclado.
   */
  const investigate = useCallback(
    (seriesId: string) => {
      selectSeries(seriesId);
      const heading = investigationRef.current;
      if (!heading) return;
      heading.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      heading.focus?.({ preventScroll: true });
    },
    [selectSeries],
  );

  const retryDetail = () => {
    if (dashboard.selectedSeriesId) {
      void dispatch(fetchDashboardSeriesDetail(dashboard.selectedSeriesId));
    }
  };

  const evaluating = dashboard.conditionStatus === 'loading' || dashboard.conditionStatus === 'idle';

  return (
    <Stack spacing={1.5}>
      <DashboardHeader
        period={dashboard.period}
        loadedAt={dashboard.loadedAt}
        latestReading={view.latestTimestamp}
        inventory={{
          machines: view.kpis.machines,
          points: view.kpis.points,
          sensors: view.kpis.sensors,
        }}
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

      {/* 1. Existe algo exigindo atenção? */}
      <KpiGrid view={view} loading={inventoryLoading} />

      {/* 2–6. Qual ativo, ponto, sensor, sinal e por quê. */}
      <InspectionQueue
        view={view}
        loading={inventoryLoading}
        evaluating={evaluating}
        nowMs={nowMs}
        selectedSeriesId={dashboard.selectedSeriesId}
        onInvestigate={investigate}
      />

      {/* 7–9. Desde quando e qual é o histórico. */}
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
        onPeriodChange={(period) => dispatch(periodChanged(period))}
        headingRef={investigationRef}
      />

      {/* Frota completa: contexto, depois da exceção. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2.6fr) minmax(260px, 1fr)' },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <SensorConditionMatrix
          view={view}
          loading={inventoryLoading}
          nowMs={nowMs}
          selectedSeriesId={dashboard.selectedSeriesId}
          onSelectSeries={investigate}
        />
        <FleetFreshness view={view} loading={inventoryLoading} />
      </Box>

      {/* Mergulho manual em qualquer série, inclusive as que não geram exceção. */}
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
