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
  formatDateTime,
  formatMeasurement,
  formatNumber,
  formatRelativeTime,
} from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { statusColor } from './StatusTag';

const CONDITION_SHORT: Record<SensorCellView['condition'], string> = {
  normal: 'NORMAL',
  observation: 'OBSERVAÇÃO',
  attention: 'ATENÇÃO',
  unclassified: 'SEM CLASSIF.',
  'no-data': 'SEM DADOS',
  'no-sensor': 'SEM SENSOR',
};

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
 * Matriz de condição da frota — exploração densa: máquinas nas colunas, posições nas
 * linhas, um chip por sensor. Clique seleciona o contexto da tendência crítica.
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

  return (
    <DashboardCard
      title="Matriz de condição da frota"
      titleId="fleet-matrix-title"
      subtitle="Todos os pontos por máquina. Selecione um sensor para investigar."
      flush
    >
      {loading ? (
        <Box sx={{ px: 1.75 }} aria-label="Carregando matriz de sensores">
          <Skeleton variant="rounded" height={120} />
        </Box>
      ) : null}

      {!loading && machines.length === 0 ? (
        <Box sx={{ px: 1.75 }}>
          <EmptyState
            title="Nenhuma máquina cadastrada"
            description="Cadastre uma máquina e seus pontos para iniciar o monitoramento operacional."
          />
        </Box>
      ) : null}

      {!loading && machines.length > 0 ? (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Máquinas, pontos, sensores e condição">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 76 }}>Ponto</TableCell>
                {machines.map((row) => (
                  <TableCell key={row.machine.id} align="center" sx={{ minWidth: 132 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color: 'text.primary', display: 'block' }}
                      noWrap
                      title={row.machine.name}
                    >
                      {row.machine.name.split(' — ')[0]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none' }}>
                      {row.machine.type}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {positions.map((position) => (
                <TableRow key={position}>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>{position}</TableCell>
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
                      <TableCell key={row.machine.id} align="center" sx={{ py: 0.75 }}>
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
                                width: '100%',
                                maxWidth: 150,
                                px: 1,
                                py: 0.5,
                                borderRadius: 1.5,
                                border: 1,
                                borderColor: selected ? 'primary.main' : alpha(color, 0.35),
                                bgcolor: alpha(color, 0.09),
                                display: 'block',
                                textAlign: 'center',
                                '&:focus-visible': {
                                  outline: `2px solid ${alpha(muiTheme.palette.primary.main, 0.55)}`,
                                },
                                '&.Mui-disabled': { opacity: 1 },
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={0.6}
                                alignItems="center"
                                justifyContent="center"
                              >
                                <Box
                                  aria-hidden="true"
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: color,
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography sx={{ fontSize: 11.5, fontWeight: 700 }} noWrap>
                                  {cell.sensorSerial ?? 'Sem sensor'}
                                </Typography>
                              </Stack>
                              <Typography
                                sx={{ fontSize: 9.5, fontWeight: 700, color, letterSpacing: 0.3 }}
                              >
                                {CONDITION_SHORT[cell.condition]}
                                {cell.evidence?.deviationRatio != null
                                  ? ` · ${formatNumber(cell.evidence.deviationRatio, 2)}×`
                                  : ''}
                              </Typography>
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
      ) : null}
    </DashboardCard>
  );
}
