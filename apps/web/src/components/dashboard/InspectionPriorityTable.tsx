import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { Line, LineChart, ResponsiveContainer } from 'recharts';

import { EmptyState } from '@dynamox/ui';

import type {
  DashboardView,
  SensorCellView,
} from '../../features/dashboard/dashboardAggregations';
import {
  formatMeasurement,
  formatNumber,
} from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { StatusTag, statusColor } from './StatusTag';

/**
 * O painel operacional central: ranking denso das prioridades reais de inspeção.
 * Exceções primeiro; as demais linhas dão o contexto do "resto está normal".
 * Clicar numa linha troca o contexto da tendência crítica.
 */
export interface InspectionPriorityTableProps {
  view: DashboardView;
  loading: boolean;
  evaluating: boolean;
  selectedSeriesId: string | null;
  onInvestigate: (seriesId: string) => void;
}

function DeviationCell({ cell }: { cell: SensorCellView }): JSX.Element {
  const muiTheme = useTheme();
  const ratio = cell.assessment?.deviationRatio ?? null;
  // O valor medido acompanha a barra: em telas estreitas a coluna própria não cabe.
  const medida = cell.evidence
    ? `${cell.evidence.label}: ${formatMeasurement(cell.evidence.value, cell.evidence.unit)}`
    : undefined;
  if (ratio === null) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }
  // Barra proporcional ao índice, saturando em 4× para manter a escala legível.
  const width = Math.min(1, ratio / 4) * 100;
  const color = statusColor(cell.condition, muiTheme.palette);
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 96 }} title={medida}>
      <Box
        aria-hidden="true"
        sx={{ flexGrow: 1, height: 6, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden' }}
      >
        <Box sx={{ width: `${width}%`, height: '100%', bgcolor: color }} />
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700, color, whiteSpace: 'nowrap' }}>
        {formatNumber(ratio, 2)}×
      </Typography>
    </Stack>
  );
}

function Sparkline({
  points,
  cell,
}: {
  points: Array<{ t: number; v: number }>;
  cell: SensorCellView;
}): JSX.Element {
  const muiTheme = useTheme();
  if (points.length < 2) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }
  return (
    <Box sx={{ width: 72, height: 22 }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
          <Line
            type="linear"
            dataKey="v"
            stroke={statusColor(cell.condition, muiTheme.palette)}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function InspectionPriorityTable({
  view,
  loading,
  evaluating,
  selectedSeriesId,
  onInvestigate,
}: InspectionPriorityTableProps): JSX.Element {
  const evaluated = view.cells.filter((cell) => cell.sensorSerial).length;
  const rows = view.priority;

  return (
    <DashboardCard
      title="Prioridade de inspeção"
      titleId="inspection-priority-title"
      subtitle="Evidência estatística demonstrativa. Não é alarmística industrial validada."
      action={
        !loading && evaluated > 0 ? (
          <Typography variant="caption" color="text.secondary">
            Mostrando {rows.length} de {evaluated} avaliados
          </Typography>
        ) : undefined
      }
      flush
    >
      {loading ? (
        <Stack spacing={1} sx={{ px: 1.75 }} aria-label="Carregando fila de inspeção">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} variant="rounded" height={40} />
          ))}
        </Stack>
      ) : null}

      {!loading && rows.length === 0 ? (
        <Box sx={{ px: 1.75 }}>
          <EmptyState
            title="Nenhum ponto avaliável"
            description={
              evaluating
                ? 'A avaliação de condição ainda está em andamento.'
                : 'Associe sensores aos pontos para gerar prioridades.'
            }
          />
        </Box>
      ) : null}

      {!loading && rows.length > 0 ? (
        <TableContainer sx={{ overflowX: 'auto', mt: -1 }}>
          <Table
            size="small"
            aria-label="Ranking de prioridade de inspeção"
            // Densidade industrial: menos padding lateral para a tabela caber em 6 colunas.
            sx={{
              '& .MuiTableCell-root': { px: 0.85, py: 0.5, lineHeight: 1.25, borderColor: 'divider' },
              '& .MuiIconButton-root svg': { fontSize: 12 },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 30 }}>#</TableCell>
                <TableCell>Máquina</TableCell>
                <TableCell>Ponto · Sensor</TableCell>
                <TableCell>Severidade</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', xl: 'table-cell' } }}>
                  Valor atual
                </TableCell>
                <TableCell sx={{ whiteSpace: 'normal', lineHeight: 1.25, minWidth: 96 }}>
                  Desvio vs. baseline
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', xl: 'table-cell' } }}>Tendência</TableCell>
                <TableCell sx={{ width: 44 }} aria-label="Ação" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((cell, index) => {
                const selected =
                  Boolean(cell.preferredSeriesId) && cell.preferredSeriesId === selectedSeriesId;
                const clickable = Boolean(cell.preferredSeriesId);
                return (
                  <TableRow
                    key={cell.key}
                    hover={clickable}
                    selected={selected}
                    onClick={() => {
                      if (cell.preferredSeriesId) onInvestigate(cell.preferredSeriesId);
                    }}
                    sx={(muiTheme) => ({
                      cursor: clickable ? 'pointer' : 'default',
                      '&.Mui-selected': {
                        bgcolor: alpha(muiTheme.palette.primary.main, 0.07),
                      },
                    })}
                  >
                    <TableCell sx={{ color: 'text.secondary' }}>{index + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {/* Nome curto na tabela densa; o completo vive no title e no tooltip. */}
                      <span title={cell.machineName}>{cell.machineName.split(' — ')[0]}</span>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                        {cell.positionLabel}
                      </Typography>
                      <Typography variant="body2" component="span" color="text.secondary">
                        {' '}
                        · {cell.sensorSerial}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusTag kind={cell.condition} />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        display: { xs: 'none', xl: 'table-cell' },
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                      }}
                    >
                      {cell.evidence
                        ? formatMeasurement(cell.evidence.value, cell.evidence.unit)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <DeviationCell cell={cell} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', xl: 'table-cell' } }}>
                      <Sparkline points={view.sparklines[cell.key] ?? []} cell={cell} />
                    </TableCell>
                    <TableCell padding="none" align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={!clickable}
                        aria-label={`Investigar ${cell.machineName} ${cell.positionLabel} ${cell.sensorSerial ?? ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (cell.preferredSeriesId) onInvestigate(cell.preferredSeriesId);
                        }}
                      >
                        <ArrowForwardIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </DashboardCard>
  );
}
