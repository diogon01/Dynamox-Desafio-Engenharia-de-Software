import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
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
import { FleetConditionMatrix } from './FleetConditionMatrix';
import { InspectionPriorityTable } from './InspectionPriorityTable';
import { KpiRow } from './KpiRow';
import { RecentOccurrences } from './RecentOccurrences';
import { SensorHealthDonut } from './SensorHealthDonut';
import { SeriesExplorer } from './SeriesExplorer';
import { TrendPanel } from './TrendPanel';
import { WeeklyHeatmap } from './WeeklyHeatmap';

/**
 * Central operacional de condition monitoring, num único grid de 12 colunas:
 *
 *   KPIs                     3 + 3 + 3 + 3
 *   Evidência                Tendência 7 | (Prioridade / Saúde) 5
 *   Padrão temporal          Heatmap 7   | (Ocorrências / Qualidade) 5
 *   Contexto da frota        4 + 4 + 4
 *   Exploração               Explorador 9 | Matriz 3
 *
 * A ordem do DOM segue a decisão operacional (prioridade antes da evidência); a posição
 * visual vem de `order`, o que também permite reempilhar a página no mobile sem duplicar
 * marcação.
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
  const gridGap = useTheme().dashboard.gridGap;
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

  /** Coluna de um item do grid principal. */
  const slot = (opts: {
    md?: number;
    lg: number | 'auto';
    order: { xs: number; md: number };
  }) => ({
    gridColumn: {
      xs: 'span 12',
      md: `span ${opts.md ?? 12}`,
      lg: opts.lg === 'auto' ? 'auto' : `span ${opts.lg}`,
    },
    order: opts.order,
    minWidth: 0,
    display: 'flex',
    '& > *': { flex: 1, minWidth: 0 },
  });

  /**
   * Coluna dupla à direita de um painel largo. Em telas menores ela se dissolve
   * (`display: contents`) e os dois cards voltam a ser itens do grid principal, cada um
   * com sua própria posição no empilhamento.
   */
  const pairedColumn = (rows: string, order: number) => ({
    display: { xs: 'contents', lg: 'grid' },
    gridColumn: { lg: 'span 5' },
    gridTemplateRows: { lg: rows },
    gap: `${gridGap}px`,
    order: { lg: order },
    minWidth: 0,
  });

  return (
    <>
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
          sx={{ mb: `${gridGap}px` }}
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

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: `${gridGap}px`,
          alignItems: 'stretch',
        }}
      >
        {/* SITUAÇÃO */}
        <KpiRow view={view} loading={inventoryLoading} />

        {/* EVIDÊNCIA — tendência larga, prioridade e saúde empilhadas ao lado */}
        <Box sx={pairedColumn('1fr 1fr', 6)}>
          <Box sx={slot({ md: 6, lg: 'auto', order: { xs: 5, md: 6 } })}>
            <InspectionPriorityTable
              view={view}
              loading={inventoryLoading}
              evaluating={evaluating}
              selectedSeriesId={dashboard.selectedSeriesId}
              onInvestigate={investigate}
            />
          </Box>
          <Box sx={slot({ md: 6, lg: 'auto', order: { xs: 11, md: 7 } })}>
            <SensorHealthDonut view={view} loading={inventoryLoading} />
          </Box>
        </Box>
        <Box sx={slot({ md: 12, lg: 7, order: { xs: 6, md: 5 } })}>
          <TrendPanel
            period={dashboard.period}
            series={dashboard.series.data}
            selectedSeriesId={dashboard.selectedSeriesId}
            samples={dashboard.detailSamples}
            status={dashboard.detailStatus}
            error={dashboard.detailError}
            nowMs={nowMs}
            onRetry={retryDetail}
            onSelectSeries={selectSeries}
            onPeriodChange={(period) => dispatch(periodChanged(period))}
            headingRef={investigationRef}
          />
        </Box>

        {/* PADRÃO TEMPORAL — heatmap largo, ocorrências e qualidade ao lado */}
        <Box sx={pairedColumn('minmax(128px, auto) minmax(80px, auto)', 9)}>
          <Box sx={slot({ md: 6, lg: 'auto', order: { xs: 7, md: 9 } })}>
            <RecentOccurrences view={view} loading={inventoryLoading} onInvestigate={investigate} />
          </Box>
          <Box sx={slot({ md: 6, lg: 'auto', order: { xs: 9, md: 10 } })}>
            <DataQualityPanel view={view} loading={inventoryLoading} />
          </Box>
        </Box>
        <Box sx={slot({ md: 12, lg: 7, order: { xs: 12, md: 8 } })}>
          <WeeklyHeatmap
            weekMap={view.weekMap}
            loading={inventoryLoading || evaluating}
            selectedDay={activeDay}
            onSelectDay={setSelectedDay}
          />
        </Box>

        {/* CONTEXTO DA FROTA */}
        <Box sx={slot({ md: 6, lg: 4, order: { xs: 10, md: 11 } })}>
          <AssetConditionColumns view={view} loading={inventoryLoading} />
        </Box>
        <Box sx={slot({ md: 6, lg: 4, order: { xs: 13, md: 12 } })}>
          <AcquisitionActivity view={view} loading={inventoryLoading || evaluating} />
        </Box>
        <Box sx={slot({ md: 12, lg: 4, order: { xs: 14, md: 13 } })}>
          <DayProfilePanel
            weekMap={view.weekMap}
            loading={inventoryLoading || evaluating}
            selectedDay={activeDay}
            onSelectDay={setSelectedDay}
          />
        </Box>

        {/* EXPLORAÇÃO */}
        <Box sx={slot({ md: 12, lg: 9, order: { xs: 15, md: 14 } })}>
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
        <Box sx={slot({ md: 12, lg: 3, order: { xs: 16, md: 15 } })}>
          <FleetConditionMatrix
            view={view}
            loading={inventoryLoading}
            nowMs={nowMs}
            selectedSeriesId={dashboard.selectedSeriesId}
            onSelect={investigate}
          />
        </Box>
      </Box>
    </>
  );
}
