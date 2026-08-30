import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';

import { API_BASE_URL } from '../api/client';
import { logout, selectAuthenticatedUser } from '../features/auth/authSlice';
import { formatDateTime } from '../features/dashboard/dashboardFormatters';
import { fetchHealth, selectDiagnostics } from '../features/diagnostics/diagnosticsSlice';
import { useAppDispatch, useAppSelector } from '../store';

export function SystemStatusBar(): JSX.Element {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthenticatedUser);
  const { healthStatus, health, healthError } = useAppSelector(selectDiagnostics);
  const loading = healthStatus === 'loading' || healthStatus === 'idle';

  useEffect(() => {
    void dispatch(fetchHealth());
  }, [dispatch]);

  return (
    <Card
      variant="outlined"
      component="section"
      aria-labelledby="system-status-title"
      sx={{ bgcolor: 'background.paper' }}
    >
      <CardContent sx={{ py: 0.75, px: { xs: 1.5, sm: 2 }, '&:last-child': { pb: 0.75 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1.5}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography id="system-status-title" variant="subtitle2" component="h2">
                Estado do sistema
              </Typography>

              {loading ? (
                <>
                  <Skeleton variant="rounded" width={82} height={24} />
                  <Skeleton variant="rounded" width={94} height={24} />
                </>
              ) : null}

              {healthStatus === 'failed' ? (
                <>
                  <Chip
                    icon={<ErrorOutlineIcon />}
                    label="API indisponível"
                    color="error"
                    size="small"
                    variant="outlined"
                  />
                  <Chip label="Banco: não verificado" size="small" variant="outlined" />
                  <Tooltip title="Consultar o estado novamente">
                    <IconButton
                      size="small"
                      aria-label="Atualizar estado do sistema"
                      onClick={() => void dispatch(fetchHealth())}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              ) : null}

              {healthStatus === 'succeeded' && health ? (
                <>
                  <Chip
                    icon={
                      health.status === 'ok' ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />
                    }
                    label={`API: ${health.status === 'ok' ? 'operacional' : 'degradada'}`}
                    color={health.status === 'ok' ? 'success' : 'warning'}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    icon={
                      health.database === 'up' ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />
                    }
                    label={`Banco: ${health.database === 'up' ? 'operacional' : 'indisponível'}`}
                    color={health.database === 'up' ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                  />
                  <Chip label={`v${health.version}`} size="small" variant="outlined" />
                </>
              ) : null}
            </Stack>

            <Typography
              variant="caption"
              color={healthStatus === 'failed' ? 'error.main' : 'text.secondary'}
              sx={{
                // A barra não compete com o header do dashboard: detalhe só em telas largas.
                display: { xs: 'none', lg: 'block' },
                mt: 0.25,
                overflowWrap: 'anywhere',
              }}
            >
              {healthStatus === 'failed'
                ? `${healthError ?? 'A API local não respondeu.'} · ${API_BASE_URL}`
                : `${API_BASE_URL}${health?.timestamp ? ` · Atualizado em ${formatDateTime(health.timestamp)}` : ''}`}
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              flexShrink: 0,
              borderTop: { xs: 1, sm: 0 },
              borderColor: 'divider',
              pt: { xs: 1, sm: 0 },
            }}
          >
            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.78rem' }}>
              {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" noWrap sx={{ maxWidth: { xs: 210, md: 280 } }}>
                {user?.email ?? 'Usuário autenticado'}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: 'none', md: 'block' } }}
              >
                Sessão autenticada
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LogoutIcon />}
              aria-label="Sair da sessão"
              onClick={() => void dispatch(logout())}
            >
              Sair
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
