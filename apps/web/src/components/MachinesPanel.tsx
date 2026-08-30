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
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState, type FormEvent } from 'react';

import { MACHINE_TYPES, isMachineType, type MachineType } from '@dynamox/domain';
import { EmptyState, ErrorState, LoadingState } from '@dynamox/ui';

import type { MachineDto } from '../api/client';
import {
  createMachine,
  deleteMachine,
  fetchMachines,
  selectMachines,
  updateMachine,
} from '../features/machines/machinesSlice';
import { fetchMonitoringPoints } from '../features/monitoringPoints/monitoringPointsSlice';
import { selectCanMutate } from '../features/auth/authSlice';
import { useAppDispatch, useAppSelector } from '../store';

/** Mesmo teto aplicado pela API; a validação local só antecipa a mensagem. */
const NAME_MAX_LENGTH = 120;

function validateMachineName(value: string): string | null {
  if (value === '') return 'Informe o nome da máquina.';
  return value.length > NAME_MAX_LENGTH
    ? `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`
    : null;
}

export function MachinesPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const {
    items,
    listStatus,
    listError,
    createStatus,
    createError,
    updateStatus,
    updateError,
    deleteStatus,
    deleteError,
  } = useAppSelector(selectMachines);
  // Backend é a barreira real (403); a UI apenas não oferece o que o perfil não pode fazer.
  const canMutate = useAppSelector(selectCanMutate);

  const [name, setName] = useState('');
  const [type, setType] = useState<MachineType>('Pump');
  const [touched, setTouched] = useState(false);

  /** Máquina em edição; null = formulário de edição oculto. */
  const [editTarget, setEditTarget] = useState<MachineDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<MachineType>('Pump');
  const [editTouched, setEditTouched] = useState(false);

  /** Máquina aguardando confirmação de exclusão; null = nada pendente. */
  const [deleteTarget, setDeleteTarget] = useState<MachineDto | null>(null);

  useEffect(() => {
    void dispatch(fetchMachines());
  }, [dispatch]);

  const trimmedName = name.trim();
  const submitting = createStatus === 'loading';
  const saving = updateStatus === 'loading';
  const removing = deleteStatus === 'loading';

  const nameError = validateMachineName(trimmedName);
  const trimmedEditName = editName.trim();
  const editNameError = validateMachineName(trimmedEditName);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (nameError || submitting) return;

    const result = await dispatch(createMachine({ name: trimmedName, type }));
    // O formulário só é limpo quando a API confirma; em erro, o texto digitado fica.
    if (createMachine.fulfilled.match(result)) {
      setName('');
      setType('Pump');
      setTouched(false);
    }
  };

  const startEdit = (machine: MachineDto) => {
    setDeleteTarget(null);
    setEditTarget(machine);
    setEditName(machine.name);
    setEditType(machine.type);
    setEditTouched(false);
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setEditTouched(true);
    if (!editTarget || editNameError || saving) return;

    const result = await dispatch(
      updateMachine({ id: editTarget.id, changes: { name: trimmedEditName, type: editType } }),
    );
    if (updateMachine.fulfilled.match(result)) {
      setEditTarget(null);
      // O tipo da máquina aparece também na tabela de pontos: mantém as telas coerentes.
      void dispatch(fetchMonitoringPoints());
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || removing) return;

    const result = await dispatch(deleteMachine(deleteTarget.id));
    if (deleteMachine.fulfilled.match(result)) {
      setDeleteTarget(null);
      // A exclusão cascateia os pontos da máquina: a outra tabela precisa refletir isso.
      void dispatch(fetchMonitoringPoints());
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="overline" color="primary.main" component="div">
          Gestão de ativos
        </Typography>
        <Typography variant="h1" component="h2" gutterBottom>
          Máquinas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Ativos monitorados. Cadastre uma máquina informando o nome e o tipo; os dados são
          persistidos pela API no PostgreSQL.
        </Typography>

        {!canMutate ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            Seu perfil é somente leitura: as máquinas abaixo podem ser consultadas, mas criar,
            editar e excluir exigem um perfil administrador.
          </Alert>
        ) : null}

        {canMutate ? (
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mb: 3 }}>
          <Stack spacing={2}>
            {createStatus === 'failed' && createError ? (
              <Alert severity="error">{createError}</Alert>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                label="Nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setTouched(true)}
                error={touched && nameError !== null}
                helperText={touched && nameError ? nameError : ' '}
                disabled={submitting}
                fullWidth
                inputProps={{ 'aria-label': 'Nome' }}
              />
              <TextField
                select
                label="Tipo"
                value={type}
                onChange={(event) => {
                  if (isMachineType(event.target.value)) setType(event.target.value);
                }}
                disabled={submitting}
                helperText=" "
                sx={{ minWidth: { sm: 180 }, width: { xs: '100%', sm: 'auto' } }}
                inputProps={{ 'aria-label': 'Tipo' }}
              >
                {MACHINE_TYPES.map((machineType) => (
                  <MenuItem key={machineType} value={machineType}>
                    {machineType}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                sx={{ mt: { sm: 1 }, whiteSpace: 'nowrap' }}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {submitting ? 'Cadastrando…' : 'Cadastrar máquina'}
              </Button>
            </Stack>
          </Stack>
        </Box>
        ) : null}

        {editTarget ? (
          <Box
            component="form"
            onSubmit={handleEditSubmit}
            noValidate
            sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            <Stack spacing={2}>
              <Typography variant="subtitle2">Editar máquina “{editTarget.name}”</Typography>

              {updateStatus === 'failed' && updateError ? (
                <Alert severity="error">{updateError}</Alert>
              ) : null}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems="flex-start"
              >
                <TextField
                  label="Novo nome"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  onBlur={() => setEditTouched(true)}
                  error={editTouched && editNameError !== null}
                  helperText={editTouched && editNameError ? editNameError : ' '}
                  disabled={saving}
                  fullWidth
                  inputProps={{ 'aria-label': 'Novo nome' }}
                />
                <TextField
                  select
                  label="Novo tipo"
                  value={editType}
                  onChange={(event) => {
                    if (isMachineType(event.target.value)) setEditType(event.target.value);
                  }}
                  disabled={saving}
                  helperText=" "
                  sx={{ minWidth: { sm: 180 }, width: { xs: '100%', sm: 'auto' } }}
                  inputProps={{ 'aria-label': 'Novo tipo' }}
                >
                  {MACHINE_TYPES.map((machineType) => (
                    <MenuItem key={machineType} value={machineType}>
                      {machineType}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving}
                  sx={{ mt: { sm: 1 }, whiteSpace: 'nowrap' }}
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button
                  type="button"
                  variant="text"
                  disabled={saving}
                  onClick={() => setEditTarget(null)}
                  sx={{ mt: { sm: 1 } }}
                >
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </Box>
        ) : null}

        {deleteTarget ? (
          <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle2">
                Excluir a máquina “{deleteTarget.name}”? Os pontos de monitoramento dela
                também serão removidos.
              </Typography>

              {deleteStatus === 'failed' && deleteError ? (
                <Alert severity="error">{deleteError}</Alert>
              ) : null}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  color="error"
                  disabled={removing}
                  onClick={() => void handleDeleteConfirm()}
                  startIcon={
                    removing ? <CircularProgress size={16} color="inherit" /> : undefined
                  }
                >
                  {removing ? 'Excluindo…' : 'Confirmar exclusão'}
                </Button>
                <Button variant="text" disabled={removing} onClick={() => setDeleteTarget(null)}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </Box>
        ) : null}

        {listStatus === 'loading' || listStatus === 'idle' ? (
          <LoadingState label="Carregando máquinas…" />
        ) : null}

        {listStatus === 'failed' ? (
          <ErrorState
            message={listError ?? 'Não foi possível carregar as máquinas.'}
            onRetry={() => void dispatch(fetchMachines())}
          />
        ) : null}

        {listStatus === 'succeeded' && items.length === 0 ? (
          <EmptyState
            title="Nenhuma máquina cadastrada"
            description="Use o formulário acima para cadastrar a primeira máquina."
          />
        ) : null}

        {listStatus === 'succeeded' && items.length > 0 ? (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Máquinas cadastradas">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell aria-label="Ações" />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((machine) => (
                  <TableRow key={machine.id} hover>
                    <TableCell>{machine.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={machine.type}
                        size="small"
                        color={machine.type === 'Pump' ? 'primary' : 'secondary'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {canMutate ? (
                      <>
                      <Button
                        size="small"
                        aria-label={`Editar máquina ${machine.name}`}
                        onClick={() => startEdit(machine)}
                        disabled={saving || removing}
                      >
                        Editar
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        aria-label={`Excluir máquina ${machine.name}`}
                        onClick={() => {
                          setEditTarget(null);
                          setDeleteTarget(machine);
                        }}
                        disabled={saving || removing}
                      >
                        Excluir
                      </Button>
                      </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
      </CardContent>
    </Card>
  );
}
