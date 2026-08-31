import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { EmptyState } from '@dynamox/ui';

import type {
  DashboardView,
  SensorCellView,
} from '../../features/dashboard/dashboardAggregations';
import {
  formatMeasurement,
  formatNumber,
} from '../../features/dashboard/dashboardFormatters';
import {
  formatDateTime,
  formatRelativeTime,
} from '../../features/time/instant';
import { DashboardCard } from './DashboardCard';
import { statusColor } from './StatusTag';

function CellTooltip({ cell, nowMs }: { cell: SensorCellView; nowMs: number }): JSX.Element {
  return (
    <Box sx={{ p: 0.25, maxWidth: 300 }}>
      <Typography variant="subtitle2">
        {cell.machineName} · {cell.pointName}
      </Typography>
      <Typography variant="caption" display="block">
        Sensor: {cell.sensorSerial ?? 'não instalado'} · {cell.sensorModel ?? '—'}
      </Typography>
      <Typography variant="caption" display="block">
        {cell.evidence
          ? `${cell.evidence.label}: ${formatMeasurement(cell.evidence.value, cell.evidence.unit)}`
          : 'Sem leitura'}
      </Typography>
      {cell.evidence?.deviationRatio != null ? (
        <Typography variant="caption" display="block">
          Índice: {formatNumber(cell.evidence.deviationRatio, 2)}× · baseline{' '}
          {formatMeasurement(cell.evidence.baseline, cell.evidence.unit)}
        </Typography>
      ) : null}
      <Typography variant="caption" display="block">
        Última leitura: {formatDateTime(cell.lastTimestamp)} (
        {formatRelativeTime(cell.lastTimestamp, nowMs)})
      </Typography>
      <Typography variant="caption" display="block">
        Condição: {cell.conditionLabel} · {cell.freshnessLabel}
      </Typography>
    </Box>
  );
}

/**
 * Matriz de condição da frota — a leitura de uma olhada: máquinas nas colunas, posições
 * nas linhas, um ponto colorido por sensor. Cabe numa coluna estreita porque a identidade
 * do sensor vive no tooltip e no rótulo acessível, não numa etiqueta por célula.
 * Clique seleciona o contexto da tendência crítica.
 */
export function FleetConditionMatrix({
  view,
  loading,
  nowMs,
  selectedSeriesId,
  onSelect,
}: {
  view: DashboardView;
  loading: boolean;
  nowMs: number;
  selectedSeriesId: string | null;
  onSelect: (seriesId: string) => void;
}): JSX.Element {
  const muiTheme = useTheme();
  const machines = view.rows;
  const positions = [...new Set(view.cells.map((cell) => cell.positionLabel))];
  const legend = [...new Set(view.cells.map((cell) => cell.condition))].map((kind) => ({
    kind,
    label: view.cells.find((cell) => cell.condition === kind)?.conditionLabel ?? kind,
  }));

  return (
    <DashboardCard
      title="Matriz de condição da frota"
      titleId="fleet-matrix-title"
      subtitle="Todos os pontos por máquina."
      info="Cada ponto é um sensor: cor indica a condição demonstrativa. Selecione para investigar."
      flush
    >
      {loading ? (
        <Box sx={{ px: 2 }} aria-label="Carregando matriz de sensores">
          <Skeleton variant="rounded" height={140} />
        </Box>
      ) : null}

      {!loading && machines.length === 0 ? (
        <Box sx={{ px: 2 }}>
          <EmptyState
            title="Nenhuma máquina cadastrada"
            description="Cadastre uma máquina e seus pontos para iniciar o monitoramento operacional."
          />
        </Box>
      ) : null}

      {!loading && machines.length > 0 ? (
        <>
          <TableContainer sx={{ overflowX: 'auto', flexGrow: 1 }}>
            <Table
              size="small"
              aria-label="Máquinas, pontos, sensores e condição"
              sx={{
                tableLayout: 'fixed',
                '& .MuiTableCell-root': { px: 0.4, py: 0.5, borderColor: 'divider' },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 44, pl: 2 }}>Ponto</TableCell>
                  {machines.map((row) => (
                    <TableCell key={row.machine.id} align="center" sx={{ px: 0.25 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, color: 'text.primary', display: 'block', fontSize: 10 }}
                        noWrap
                        title={row.machine.name}
                      >
                        {row.machine.name.split(' — ')[0]}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position}>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary', pl: 2 }}>
                      {position}
                    </TableCell>
                    {machines.map((row) => {
                      const cell = row.cells.find((item) => item.positionLabel === position);
                      if (!cell) {
                        return (
                          <TableCell key={row.machine.id} align="center">
                            <Typography variant="caption" color="text.disabled">
                              —
                            </Typography>
                          </TableCell>
                        );
                      }
                      const color = statusColor(cell.condition, muiTheme.palette);
                      const selected =
                        Boolean(cell.preferredSeriesId) &&
                        cell.series.some((item) => item.id === selectedSeriesId);
                      const clickable = Boolean(cell.preferredSeriesId);
                      return (
                        <TableCell key={row.machine.id} align="center">
                          <Tooltip arrow title={<CellTooltip cell={cell} nowMs={nowMs} />}>
                            <span>
                              <ButtonBase
                                disabled={!clickable}
                                aria-label={`${cell.machineName}, ${cell.pointName}, ${cell.sensorSerial ?? 'sem sensor'}, ${cell.conditionLabel}`}
                                aria-pressed={selected}
                                onClick={() => {
                                  if (cell.preferredSeriesId) onSelect(cell.preferredSeriesId);
                                }}
                                sx={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  display: 'grid',
                                  placeItems: 'center',
                                  border: selected ? `2px solid ${muiTheme.palette.primary.main}` : '2px solid transparent',
                                  '&:hover': { bgcolor: alpha(color, 0.14) },
                                  '&:focus-visible': {
                                    outline: `2px solid ${alpha(muiTheme.palette.primary.main, 0.55)}`,
                                  },
                                  '&.Mui-disabled': { opacity: 1 },
                                }}
                              >
                                <Box
                                  aria-hidden="true"
                                  sx={{
                                    width: 13,
                                    height: 13,
                                    borderRadius: '50%',
                                    bgcolor: cell.condition === 'no-sensor' ? 'transparent' : color,
                                    border: `1.5px solid ${color}`,
                                  }}
                                />
                              </ButtonBase>
                            </span>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} sx={{ px: 2, pt: 1.25, pb: 1.5 }}>
            {legend.map((entry) => (
              <Stack key={entry.kind} direction="row" alignItems="center" spacing={0.5}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    bgcolor: statusColor(entry.kind, muiTheme.palette),
                  }}
                />
                <Typography variant="caption" noWrap>
                  {entry.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      ) : null}
    </DashboardCard>
  );
}
