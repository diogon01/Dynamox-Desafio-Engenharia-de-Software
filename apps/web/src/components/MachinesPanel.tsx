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

import { MACHINE_TYPES, type MachineType } from '@dynamox/domain';
import { EmptyState, ErrorState, LoadingState } from '@dynamox/ui';

import { createMachine, fetchMachines } from '../features/machines/machinesSlice';
import { useAppDispatch, useAppSelector } from '../store';

/** Mesmo teto aplicado pela API; a validação local só antecipa a mensagem. */
const NAME_MAX_LENGTH = 120;

export function MachinesPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const { items, listStatus, listError, createStatus, createError } = useAppSelector(
    (state) => state.machines,
  );

  const [name, setName] = useState('');
  const [type, setType] = useState<MachineType>('Pump');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    void dispatch(fetchMachines());
  }, [dispatch]);

  const trimmedName = name.trim();
  const submitting = createStatus === 'loading';

  const nameError =
    trimmedName === ''
      ? 'Informe o nome da máquina.'
      : trimmedName.length > NAME_MAX_LENGTH
        ? `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`
        : null;

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

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h2" component="h2" gutterBottom>
          Máquinas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Ativos monitorados. Cadastre uma máquina informando o nome e o tipo; os dados são
          persistidos pela API no PostgreSQL.
        </Typography>

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
                onChange={(event) => setType(event.target.value as MachineType)}
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
