import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import type { FleetConditionPoint, MachineType } from '@dynamox/domain';
import { EmptyState, ErrorState, LoadingState } from '@dynamox/ui';

import { api, type MachineDto, type MonitoringPointDto } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/dashboard/StatusTag';
import { selectCanMutate } from '../../features/auth/authSlice';
import { links } from '../../features/investigation/links';
import { useAnalyticsQuery, useTimeRange } from '../../features/investigation/useAnalyticsQuery';
import { formatDateTime, formatRelativeTime } from '../../features/time/instant';
import { useAppSelector } from '../../store';
import { DeleteMachineDialog } from './DeleteMachineDialog';

const TYPE_LABELS: Record<MachineType, string> = { Pump: 'Bomba', Fan: 'Ventilador' };

interface MachineRow {
  machine: MachineDto;
  points: MonitoringPointDto[];
  sensors: number;
  condition: FleetConditionPoint | null;
  lastAt: string | null;
}

/**
 * LISTAGEM DE MÁQUINAS — a porta do cadastro.
 *
 * É uma página só de listagem: criar, editar e excluir têm rotas próprias. Um painel único
 * tentando listar, criar e editar ao mesmo tempo obriga a pessoa a procurar em qual dos
 * três formulários abertos ela está.
 *
 * A linha carrega o que decide uma navegação — quantos pontos, quantos sensores, qual a
 * condição e quando falou pela última vez — e é montada com as consultas que já existem,
 * sem endpoint novo.
 */
export function MachinesListPage(): JSX.Element {
  const navigate = useNavigate();
  const canMutate = useAppSelector(selectCanMutate);
  const range = useTimeRange();
  const [pendingDelete, setPendingDelete] = useState<MachineRow | null>(null);

  const query = useAnalyticsQuery(
    () =>
      Promise.all([
        api.machines(),
        api.allMonitoringPoints(),
        api.fleetCondition({ from: range.from, to: range.to }),
      ]),
    [range.from, range.to],
  );

  useEffect(() => {
    // Sai de vista se a máquina em confirmação some entre uma carga e outra.
    if (pendingDelete && query.data && !query.data[0].some((m) => m.id === pendingDelete.machine.id)) {
      setPendingDelete(null);
    }
  }, [pendingDelete, query.data]);

  const reload = useCallback(() => query.reload(), [query]);

  const rows: MachineRow[] = (() => {
    if (!query.data) return [];
    const [machines, points, condition] = query.data;
    return machines.map((machine) => {
      const machinePoints = points.filter((point) => point.machine.id === machine.id);
      const conditions = condition.points.filter((item) =>
        machinePoints.some((point) => point.id === item.monitoringPointId),
      );
      // A condição da máquina é a do seu ponto mais crítico: uma máquina não está "média".
      const rank = (item: FleetConditionPoint) =>
        item.condition === 'attention' ? 3 : item.condition === 'observation' ? 2 : 1;
      const worst = conditions.reduce<FleetConditionPoint | null>(
        (best, item) => (best === null || rank(item) > rank(best) ? item : best),
        null,
      );
      const lastAt = conditions.reduce<string | null>(
        (latest, item) =>
          item.currentAt && (!latest || item.currentAt > latest) ? item.currentAt : latest,
        null,
      );
      return {
        machine,
        points: machinePoints,
        sensors: machinePoints.filter((point) => point.sensor !== null).length,
        condition: worst,
        lastAt,
      };
    });
  })();

  return (
    <Box sx={{ pb: 3 }}>
      <PageHeader
        steps={[{ label: 'Visão geral', to: '/' }, { label: 'Máquinas' }]}
        title="Máquinas"
        subtitle="Ativos monitorados da planta. Abrir uma máquina mostra a operação e o cadastro no mesmo lugar."
        actions={
          canMutate ? (
            <Button component={RouterLink} to="/machines/new" variant="contained" startIcon={<AddIcon />}>
              Nova máquina
            </Button>
          ) : undefined
        }
      />

      {!canMutate ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Seu perfil é somente leitura: as máquinas podem ser consultadas, mas criar, editar e
          excluir exigem um perfil administrador.
        </Alert>
      ) : null}

      {query.status === 'loading' || query.status === 'idle' ? (
        <LoadingState label="Carregando máquinas…" />
      ) : null}
      {query.status === 'failed' ? (
        <ErrorState message={query.error ?? 'Não foi possível carregar as máquinas.'} onRetry={reload} />
      ) : null}

      {query.status === 'succeeded' && rows.length === 0 ? (
        <EmptyState
          title="Nenhuma máquina cadastrada"
          description="Cadastre a primeira máquina para começar a monitorar a planta."
          action={
            canMutate ? (
              <Button component={RouterLink} to="/machines/new" variant="contained" startIcon={<AddIcon />}>
                Nova máquina
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {query.status === 'succeeded' && rows.length > 0 ? (
        <Card variant="outlined">
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table
              size="small"
              aria-label="Máquinas cadastradas"
              sx={{ '& .MuiTableCell-root': { px: 1.25, py: 0.75, borderColor: 'divider' } }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '34%' }}>Identificação</TableCell>
                  <TableCell sx={{ width: '12%' }}>Tipo</TableCell>
                  <TableCell align="right" sx={{ width: '8%' }}>
                    Pontos
                  </TableCell>
                  <TableCell align="right" sx={{ width: '10%' }}>
                    Sensores
                  </TableCell>
                  <TableCell sx={{ width: '12%' }}>Condição</TableCell>
                  <TableCell sx={{ width: '16%', display: { xs: 'none', md: 'table-cell' } }}>
                    Última leitura
                  </TableCell>
                  <TableCell align="right" sx={{ width: 96 }}>
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.machine.id}
                    hover
                    onClick={() => navigate(links.machine(row.machine.name, range))}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {row.machine.name}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {TYPE_LABELS[row.machine.type]}
                    </TableCell>
                    <TableCell align="right">{row.points.length}</TableCell>
                    <TableCell align="right">
                      {row.sensors}
                      {row.sensors < row.points.length ? (
                        <Typography variant="caption" color="text.secondary">
                          {` de ${row.points.length}`}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {row.condition ? (
                        <StatusTag kind={row.condition.condition} />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          sem pontos
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap', color: 'text.secondary' }}
                      title={formatDateTime(row.lastAt)}
                    >
                      {formatRelativeTime(row.lastAt)}
                    </TableCell>
                    <TableCell align="right" padding="none" sx={{ pr: 1 }}>
                      <Stack direction="row" justifyContent="flex-end">
                        <IconButton
                          size="small"
                          aria-label={`Editar ${row.machine.name}`}
                          disabled={!canMutate}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/machines/${encodeURIComponent(row.machine.name)}/edit`);
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Excluir ${row.machine.name}`}
                          disabled={!canMutate}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDelete(row);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : null}

      <DeleteMachineDialog
        machine={pendingDelete?.machine ?? null}
        pointCount={pendingDelete?.points.length ?? 0}
        sensorCount={pendingDelete?.sensors ?? 0}
        onClose={() => setPendingDelete(null)}
        onDeleted={() => {
          setPendingDelete(null);
          reload();
        }}
      />
    </Box>
  );
}
