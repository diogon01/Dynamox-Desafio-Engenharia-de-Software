import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ErrorState, LoadingState } from '@dynamox/ui';

import { API_BASE_URL } from '../api/client';
import { fetchHealth } from '../features/diagnostics/diagnosticsSlice';
import { useAppDispatch, useAppSelector } from '../store';

export function HealthPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const { healthStatus, health, healthError } = useAppSelector((state) => state.diagnostics);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h2" component="h2" gutterBottom>
          Estado da API
        </Typography>

        {healthStatus === 'loading' || healthStatus === 'idle' ? (
          <LoadingState label="Consultando a API local…" />
        ) : null}

        {healthStatus === 'failed' ? (
          <ErrorState
            message={healthError ?? 'A API local não respondeu.'}
            onRetry={() => void dispatch(fetchHealth())}
          />
        ) : null}

        {healthStatus === 'succeeded' && health ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              label={`API: ${health.status}`}
              color={health.status === 'ok' ? 'success' : 'warning'}
              size="small"
            />
            <Chip
              label={`Banco: ${health.database}`}
              color={health.database === 'up' ? 'success' : 'error'}
              size="small"
            />
            <Chip label={`Versão: ${health.version}`} size="small" variant="outlined" />
            <Typography variant="body2" color="text.secondary">
              {API_BASE_URL}
            </Typography>
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}
