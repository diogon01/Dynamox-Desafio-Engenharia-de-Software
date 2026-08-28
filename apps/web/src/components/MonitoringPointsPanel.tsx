import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState, type FormEvent } from 'react';

import {
  SENSOR_MODELS,
  isSensorModelAllowedForMachine,
  type SensorModel,
} from '@dynamox/domain';
import { EmptyState, ErrorState, LoadingState } from '@dynamox/ui';

import type { MonitoringPointDto, MonitoringPointSortColumn } from '../api/client';
import { fetchMachines } from '../features/machines/machinesSlice';
import {
  assignSensor,
  createMonitoringPoint,
  fetchMonitoringPoints,
  pageChanged,
  sortChanged,
} from '../features/monitoringPoints/monitoringPointsSlice';
import { useAppDispatch, useAppSelector } from '../store';

/** Mesmo teto aplicado pela API; a validação local só antecipa a mensagem. */
const NAME_MAX_LENGTH = 120;

const COLUMNS: Array<{ id: MonitoringPointSortColumn; label: string }> = [
  { id: 'machineName', label: 'Máquina' },
  { id: 'machineType', label: 'Tipo da máquina' },
  { id: 'pointName', label: 'Ponto de monitoramento' },
  { id: 'sensorModel', label: 'Modelo do sensor' },
];

export function MonitoringPointsPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const machines = useAppSelector((state) => state.machines);
  const {
    pageData,
    page,
    sortBy,
    sortDir,
    listStatus,
    listError,
    createStatus,
    createError,
    assignStatus,
    assignError,
  } = useAppSelector((state) => state.monitoringPoints);

  const [machineId, setMachineId] = useState('');
  const [pointName, setPointName] = useState('');
  const [touched, setTouched] = useState(false);

  /** Ponto selecionado para receber sensor; null = formulário de associação oculto. */
  const [assignTarget, setAssignTarget] = useState<MonitoringPointDto | null>(null);
  const [serialNumber, setSerialNumber] = useState('');
  const [sensorModel, setSensorModel] = useState<SensorModel>('HF+');
  const [assignTouched, setAssignTouched] = useState(false);

  // O painel é autossuficiente: carrega as máquinas (para o select) se ninguém carregou.
  useEffect(() => {
    if (machines.listStatus === 'idle') void dispatch(fetchMachines());
  }, [dispatch, machines.listStatus]);

  // Recarrega sempre que página ou ordenação mudam (o thunk lê page/sort do estado).
  useEffect(() => {
    void dispatch(fetchMonitoringPoints());
  }, [dispatch, page, sortBy, sortDir]);

  const trimmedPointName = pointName.trim();
  const creating = createStatus === 'loading';
  const assigning = assignStatus === 'loading';

  const machineError = machineId === '' ? 'Selecione a máquina.' : null;
  const nameError =
    trimmedPointName === ''
      ? 'Informe o nome do ponto.'
      : trimmedPointName.length > NAME_MAX_LENGTH
        ? `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`
        : null;

  const trimmedSerial = serialNumber.trim();
  const serialError = trimmedSerial === '' ? 'Informe o identificador do sensor.' : null;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (machineError || nameError || creating) return;

    const result = await dispatch(
      createMonitoringPoint({ machineId, name: trimmedPointName }),
    );
    // O formulário só é limpo quando a API confirma; em erro, o que foi digitado fica.
    if (createMonitoringPoint.fulfilled.match(result)) {
      setPointName('');
      setTouched(false);
    }
  };

  const handleAssign = async (event: FormEvent) => {
    event.preventDefault();
    setAssignTouched(true);
    if (!assignTarget || serialError || assigning) return;

    const result = await dispatch(
      assignSensor({
        pointId: assignTarget.id,
        serialNumber: trimmedSerial,
        model: sensorModel,
      }),
    );
    if (assignSensor.fulfilled.match(result)) {
      setAssignTarget(null);
      setSerialNumber('');
      setSensorModel('HF+');
      setAssignTouched(false);
    }
  };

  const startAssign = (point: MonitoringPointDto) => {
    setAssignTarget(point);
    setSerialNumber('');
    // Pré-seleciona um modelo sempre válido para a máquina do ponto.
    setSensorModel('HF+');
    setAssignTouched(false);
  };

  const items = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const pageSize = pageData?.pageSize ?? 5;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h2" component="h2" gutterBottom>
          Pontos de monitoramento
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Cada ponto pertence a uma máquina e recebe no máximo um sensor (TcAg, TcAs ou
          HF+). Máquinas do tipo Pump não aceitam sensores TcAg ou TcAs.
        </Typography>

        <Box component="form" onSubmit={handleCreate} noValidate sx={{ mb: 3 }}>
          <Stack spacing={2}>
            {createStatus === 'failed' && createError ? (
              <Alert severity="error">{createError}</Alert>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                select
                label="Máquina"
                value={machineId}
                onChange={(event) => setMachineId(event.target.value)}
                onBlur={() => setTouched(true)}
                error={touched && machineError !== null}
                helperText={touched && machineError ? machineError : ' '}
                disabled={creating || machines.items.length === 0}
                sx={{ minWidth: { sm: 220 }, width: { xs: '100%', sm: 'auto' } }}
                inputProps={{ 'aria-label': 'Máquina' }}
              >
                {machines.items.map((machine) => (
                  <MenuItem key={machine.id} value={machine.id}>
                    {machine.name} ({machine.type})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Nome do ponto"
                value={pointName}
                onChange={(event) => setPointName(event.target.value)}
                onBlur={() => setTouched(true)}
                error={touched && nameError !== null}
                helperText={touched && nameError ? nameError : ' '}
                disabled={creating}
                fullWidth
                inputProps={{ 'aria-label': 'Nome do ponto' }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={creating}
                sx={{ mt: { sm: 1 }, whiteSpace: 'nowrap' }}
                startIcon={creating ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {creating ? 'Criando…' : 'Criar ponto'}
              </Button>
            </Stack>
          </Stack>
        </Box>

        {assignTarget ? (
          <Box
            component="form"
            onSubmit={handleAssign}
            noValidate
            sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            <Stack spacing={2}>
              <Typography variant="subtitle2">
                Associar sensor ao ponto “{assignTarget.name}” ({assignTarget.machine.name})
              </Typography>

              {assignStatus === 'failed' && assignError ? (
                <Alert severity="error">{assignError}</Alert>
              ) : null}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems="flex-start"
              >
                <TextField
                  label="Identificador do sensor"
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  onBlur={() => setAssignTouched(true)}
                  error={assignTouched && serialError !== null}
                  helperText={assignTouched && serialError ? serialError : ' '}
                  disabled={assigning}
                  fullWidth
                  inputProps={{ 'aria-label': 'Identificador do sensor' }}
                />
                <TextField
                  select
                  label="Modelo"
                  value={sensorModel}
                  onChange={(event) => setSensorModel(event.target.value as SensorModel)}
                  disabled={assigning}
                  helperText=" "
                  sx={{ minWidth: { sm: 160 }, width: { xs: '100%', sm: 'auto' } }}
                  inputProps={{ 'aria-label': 'Modelo' }}
                >
                  {SENSOR_MODELS.map((model) => (
                    <MenuItem
                      key={model}
                      value={model}
                      // A regra do domínio já bloqueia na interface; a API revalida.
                      disabled={
                        !isSensorModelAllowedForMachine(assignTarget.machine.type, model)
                      }
                    >
                      {model}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={assigning}
                  sx={{ mt: { sm: 1 }, whiteSpace: 'nowrap' }}
                  startIcon={
                    assigning ? <CircularProgress size={16} color="inherit" /> : undefined
                  }
                >
                  {assigning ? 'Associando…' : 'Associar'}
                </Button>
                <Button
                  type="button"
                  variant="text"
                  disabled={assigning}
                  onClick={() => setAssignTarget(null)}
                  sx={{ mt: { sm: 1 } }}
                >
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </Box>
        ) : null}

        {listStatus === 'loading' || listStatus === 'idle' ? (
          <LoadingState label="Carregando pontos de monitoramento…" />
        ) : null}

        {listStatus === 'failed' ? (
          <ErrorState
            message={listError ?? 'Não foi possível carregar os pontos.'}
            onRetry={() => void dispatch(fetchMonitoringPoints())}
          />
        ) : null}

        {listStatus === 'succeeded' && total === 0 ? (
          <EmptyState
            title="Nenhum ponto de monitoramento"
            description="Use o formulário acima para criar o primeiro ponto."
          />
        ) : null}

        {listStatus === 'succeeded' && total > 0 ? (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Pontos de monitoramento cadastrados">
                <TableHead>
                  <TableRow>
                    {COLUMNS.map((column) => (
                      <TableCell
                        key={column.id}
                        sortDirection={sortBy === column.id ? sortDir : false}
                      >
                        <TableSortLabel
                          active={sortBy === column.id}
                          direction={sortBy === column.id ? sortDir : 'asc'}
                          onClick={() => dispatch(sortChanged(column.id))}
                        >
                          {column.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                    <TableCell aria-label="Ações" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((point) => (
                    <TableRow key={point.id} hover>
                      <TableCell>{point.machine.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={point.machine.type}
                          size="small"
                          color={point.machine.type === 'Pump' ? 'primary' : 'secondary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{point.name}</TableCell>
                      <TableCell>
                        {point.sensor
                          ? `${point.sensor.model} (${point.sensor.serialNumber})`
                          : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {point.sensor ? null : (
                          <Button
                            size="small"
                            onClick={() => startAssign(point)}
                            disabled={assigning}
                          >
                            Associar sensor
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page - 1}
              onPageChange={(_, newPage) => dispatch(pageChanged(newPage + 1))}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[pageSize]}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
