import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';

import type { AlertDetailDto, AlertEventDto } from '@dynamox/domain';
import { EmptyState, ErrorState } from '@dynamox/ui';

import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { AlertLevelTag, AlertStatusTag, alertLevelColor, alertStatusColor } from '../../components/alerts/AlertLevelTag';
import { KpiStrip } from '../../components/investigation/KpiStrip';
import {
  ALERT_EVENT_LABELS,
  ALERT_FAMILY_LABELS,
  ALERT_RESOLUTION_LABELS,
  ALERT_TYPE_LABELS,
  alertIdentity,
  alertSummary,
  describeThresholdMode,
  formatMeasure,
  formatThreshold,
} from '../../features/alerts/alertLabels';
import { selectCanMutate } from '../../features/auth/authSlice';
import { formatMeasurement, formatNumber } from '../../features/dashboard/dashboardFormatters';
import { links } from '../../features/investigation/links';
import { useAnalyticsQuery } from '../../features/investigation/useAnalyticsQuery';
import { TIME_ZONE_LABEL, formatDateTime, formatRelativeTime, hourWindow } from '../../features/time/instant';
import { useAppSelector } from '../../store';

/** Um fato do episódio: rótulo curto e valor — a ficha responde "regra, evidência, quando". */
function Fact({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }): JSX.Element {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }} component="div">
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary" component="div">
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

function eventDescription(event: AlertEventDto, alert: AlertDetailDto): string {
  const measure = event.measure !== null ? formatMeasure(event.measure, alert.thresholdMode) : null;
  switch (event.type) {
    case 'opened':
      return `${measure ?? '—'} ≥ ${formatThreshold(event.threshold, alert.thresholdMode)} por ${alert.trigger.consecutiveEvaluations} leituras consecutivas → ${event.toLevel}`;
    case 'escalated':
      return `${measure ?? '—'} ≥ ${formatThreshold(event.threshold, alert.thresholdMode)} · ${event.fromLevel} → ${event.toLevel}${event.note ? ` · ${event.note}` : ''}`;
    case 'acknowledged':
      return `${event.actor ?? 'usuário'}${event.note ? ` — “${event.note}”` : ''}`;
    case 'resolved':
      return alert.resolutionReason
        ? `${ALERT_RESOLUTION_LABELS[alert.resolutionReason]}${measure ? ` · ${measure}` : ''}${event.threshold !== null ? ` (< ${formatThreshold(event.threshold, alert.thresholdMode)})` : ''}`
        : (measure ?? '—');
    default:
      return measure ?? '';
  }
}

/**
 * DETALHE DO ALERTA — responde, sem sair da tela: que regra disparou (e com que versão da
 * política), sobre qual sensor/ponto/máquina, com que evidência (valor, baseline, razão,
 * limiar, quantas leituras), quando abriu, se escalou, se alguém reconheceu e quando
 * resolveu. Cada coisa que o motor sabe está aqui; nada que ele não sabe é sugerido.
 */
export function AlertDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const canMutate = useAppSelector(selectCanMutate);
  const muiTheme = useTheme();
  const query = useAnalyticsQuery(() => api.alert(id), [id]);
  const [detail, setDetail] = useState<AlertDetailDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState('');
  const [ackStatus, setAckStatus] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [ackError, setAckError] = useState<string | null>(null);

  const alert = detail ?? query.data;
  const loading = query.status === 'loading' || query.status === 'idle';

  const acknowledge = async () => {
    setAckStatus('saving');
    setAckError(null);
    try {
      const updated = await api.acknowledgeAlert(id, note.trim() === '' ? null : note.trim());
      setDetail(updated);
      setDialogOpen(false);
      setNote('');
      setAckStatus('idle');
    } catch (reason) {
      setAckStatus('failed');
      setAckError(reason instanceof Error ? reason.message : 'Não foi possível reconhecer o alerta.');
    }
  };

  const steps = [{ label: 'Visão geral', to: '/' }, { label: 'Alertas', to: links.alerts() }, { label: alert ? ALERT_TYPE_LABELS[alert.type] : '…' }];

  if (query.status === 'failed') {
    return (
      <Box>
        <PageHeader steps={steps} title="Alerta" />
        {query.httpStatus === 404 ? (
          <EmptyState
            title="Alerta não encontrado"
            description="O identificador não corresponde a nenhum episódio. Volte à listagem para escolher outro."
            action={
              <Button component={RouterLink} to={links.alerts()} variant="outlined" size="small">
                Ver alertas
              </Button>
            }
          />
        ) : (
          <ErrorState message={query.error ?? 'Falha ao carregar o alerta.'} onRetry={query.reload} />
        )}
      </Box>
    );
  }

  if (loading || !alert) {
    return (
      <Box role="status" aria-label="Carregando alerta">
        <PageHeader steps={steps} title="Alerta" />
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={72} />
          <Skeleton variant="rounded" height={180} />
          <Skeleton variant="rounded" height={160} />
        </Stack>
      </Box>
    );
  }

  const identity = alertIdentity(alert);
  const isRatio = alert.thresholdMode === 'ratio-to-baseline';
  const isPresence = alert.thresholdMode === 'elapsed-intervals';
  const valueUnit = isPresence ? 's' : alert.unit;
  const range = hourWindow(alert.trigger.at ?? alert.openedAt);
  const activeColor = alert.status === 'resolved' ? alertStatusColor('resolved', muiTheme.palette) : alertLevelColor(alert.level, muiTheme.palette);

  const kpis = [
    { label: 'Nível', value: alert.level, hint: alert.status === 'resolved' ? 'nível em que resolveu' : 'latched: só cai ao resolver' },
    { label: 'Aberto', value: formatDateTime(alert.openedAt), hint: formatRelativeTime(alert.openedAt) },
    {
      label: alert.status === 'resolved' ? 'Resolvido' : 'Última evidência',
      value: formatDateTime(alert.resolvedAt ?? alert.lastEvaluatedAt),
      hint: alert.resolutionReason ? ALERT_RESOLUTION_LABELS[alert.resolutionReason] : formatRelativeTime(alert.lastEvaluatedAt),
    },
    { label: 'Pico', value: formatMeasure(alert.peak.measure, alert.thresholdMode), hint: alert.peak.at ? formatDateTime(alert.peak.at) : undefined },
    { label: 'Política', value: `v${alert.policyVersion}`, hint: `regra ${alert.ruleKey}` },
  ];

  return (
    <Box>
      <PageHeader
        steps={steps}
        title={ALERT_TYPE_LABELS[alert.type]}
        subtitle={
          <>
            {identity} · {ALERT_FAMILY_LABELS[alert.family]} · {alertSummary(alert)}
          </>
        }
        chips={
          <>
            <AlertLevelTag level={alert.level} status={alert.status} />
            <AlertStatusTag status={alert.status} />
            {alert.acknowledgedAt ? (
              <Chip size="small" variant="outlined" label={`Reconhecido por ${alert.acknowledgedBy ?? '—'} em ${formatDateTime(alert.acknowledgedAt)}`} />
            ) : null}
          </>
        }
        actions={
          canMutate && !alert.acknowledgedAt ? (
            <Button variant="contained" size="small" onClick={() => setDialogOpen(true)}>
              Reconhecer
            </Button>
          ) : null
        }
      />

      {alert.status === 'open' && alert.acknowledgedAt === null && alert.state === 'active' && alert.acknowledgedLevel === null && alert.events.some((e) => e.type === 'escalated' && e.note) ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Este episódio escalou para A2 depois de ter sido reconhecido em A1: a mudança de prioridade exige novo reconhecimento.
        </Alert>
      ) : null}

      <KpiStrip items={kpis} />

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: `${muiTheme.dashboard.gridGap}px`, mt: 1.5 }}>
        <Box sx={{ gridColumn: { xs: 'span 12', lg: 'span 7' } }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Box sx={{ px: `${muiTheme.dashboard.cardPadding}px`, pt: 1.5, pb: 0.5 }}>
              <Typography variant="h2" component="h2">
                Evidência do disparo
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                A leitura que completou o gatilho — {describeThresholdMode(alert.thresholdMode)}.
              </Typography>
            </Box>
            <Stack direction="row" gap={{ xs: 2, md: 4 }} flexWrap="wrap" useFlexGap sx={{ p: `${muiTheme.dashboard.cardPadding}px`, pt: 1 }}>
              <Fact
                label={isPresence ? 'Silêncio' : 'Leitura'}
                value={isPresence ? formatMeasure(alert.trigger.measure, alert.thresholdMode) : formatMeasurement(alert.trigger.value, valueUnit)}
                hint={isPresence ? `última aquisição ${formatDateTime(alert.trigger.at)}` : alert.metric}
              />
              {!isPresence ? (
                <Fact
                  label="Baseline do ponto"
                  value={formatMeasurement(alert.trigger.baseline, valueUnit)}
                  hint="mediana da hora do dia, aprendida nos primeiros 192 ciclos"
                />
              ) : (
                <Fact label="Cadência esperada" value={`${formatNumber(alert.trigger.baseline, 0)} s`} hint="intervalo declarado da regra" />
              )}
              <Fact
                label="Medida × limiar"
                value={`${formatMeasure(alert.trigger.measure, alert.thresholdMode)} ≥ ${formatThreshold(alert.trigger.threshold, alert.thresholdMode)}`}
                hint={`${alert.trigger.consecutiveEvaluations} leitura(s) consecutiva(s)`}
              />
              <Fact label={`Instante (${TIME_ZONE_LABEL})`} value={formatDateTime(alert.trigger.at)} />
              <Fact
                label="Última leitura"
                value={`${formatMeasure(alert.last.measure, alert.thresholdMode)}${!isPresence && alert.last.value !== null ? ` · ${formatMeasurement(alert.last.value, valueUnit)}` : ''}`}
                hint={formatDateTime(alert.last.at)}
              />
            </Stack>
            <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ px: `${muiTheme.dashboard.cardPadding}px`, pb: 2 }}>
              {alert.trigger.cycleId && range ? (
                <Button component={RouterLink} to={links.acquisition(alert.trigger.cycleId, range)} size="small" variant="outlined">
                  Abrir aquisição do disparo
                </Button>
              ) : null}
              {alert.sensorSerialNumber && range ? (
                <Button component={RouterLink} to={links.sensor(alert.sensorSerialNumber, range, '15m')} size="small" variant="text">
                  Sensor na hora do disparo
                </Button>
              ) : null}
              {alert.machineName && alert.monitoringPointName && range ? (
                <Button component={RouterLink} to={links.point(alert.machineName, alert.monitoringPointName, range)} size="small" variant="text">
                  Ponto monitorado
                </Button>
              ) : null}
              {alert.machineName && range ? (
                <Button component={RouterLink} to={links.machine(alert.machineName, range)} size="small" variant="text">
                  Máquina
                </Button>
              ) : null}
            </Stack>
          </Card>
        </Box>

        <Box sx={{ gridColumn: { xs: 'span 12', lg: 'span 5' } }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Box sx={{ px: `${muiTheme.dashboard.cardPadding}px`, pt: 1.5, pb: 0.5 }}>
              <Typography variant="h2" component="h2">
                Regra aplicada
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                Alert Policy v{alert.rule.policyVersion} deste projeto — limiares orientados pela literatura industrial e pelo comportamento medido do dataset.
              </Typography>
            </Box>
            <Stack direction="row" gap={{ xs: 2, md: 3 }} flexWrap="wrap" useFlexGap sx={{ p: `${muiTheme.dashboard.cardPadding}px`, pt: 1 }}>
              <Fact label="Chave" value={alert.rule.key} hint={`${alert.rule.metric} (${alert.rule.unit})`} />
              <Fact label="A1" value={formatThreshold(alert.rule.a1Threshold, alert.thresholdMode)} />
              <Fact label="A2" value={alert.rule.a2Threshold !== null ? formatThreshold(alert.rule.a2Threshold, alert.thresholdMode) : '—'} />
              <Fact label="Clear" value={formatThreshold(alert.rule.clearThreshold, alert.thresholdMode)} hint="histerese: abaixo disto conta para resolver" />
              <Fact label="Consecutivas" value={`${alert.rule.consecutiveTrigger} para abrir · ${alert.rule.consecutiveClear} para resolver`} />
              {alert.rule.learningCycles !== null ? (
                <Fact label="Baseline" value={`${alert.rule.learningCycles} ciclos`} hint="mediana por hora UTC, por ponto e sensor" />
              ) : null}
              {alert.rule.expectedIntervalSeconds !== null ? <Fact label="Cadência" value={`${alert.rule.expectedIntervalSeconds} s`} /> : null}
              {alert.rule.postGapSuppressionMinutes !== null ? (
                <Fact label="Pós-lacuna" value={`${alert.rule.postGapSuppressionMinutes} min suprimidos`} hint="religamento não é anomalia" />
              ) : null}
            </Stack>
          </Card>
        </Box>

        <Box sx={{ gridColumn: 'span 12' }}>
          <Card variant="outlined">
            <Box sx={{ px: `${muiTheme.dashboard.cardPadding}px`, pt: 1.5, pb: 0.5 }}>
              <Typography variant="h2" component="h2">
                Linha do tempo
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                Aberto → escalado → reconhecido → resolvido. Instantes no tempo do dado ({TIME_ZONE_LABEL}); o reconhecimento usa o relógio da API.
              </Typography>
            </Box>
            <Stack component="ol" aria-label="Linha do tempo do alerta" sx={{ listStyle: 'none', m: 0, p: `${muiTheme.dashboard.cardPadding}px`, pt: 1, gap: 1 }}>
              {alert.events.map((event) => {
                const color =
                  event.type === 'acknowledged'
                    ? muiTheme.palette.alert.acknowledged
                    : event.type === 'resolved'
                      ? muiTheme.palette.alert.resolved
                      : alertLevelColor(event.toLevel ?? alert.level, muiTheme.palette);
                return (
                  <Stack component="li" key={event.id} direction="row" gap={1.5} alignItems="flex-start">
                    <Box aria-hidden="true" sx={{ mt: 0.6, width: 10, height: 10, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 0 3px ${alpha(color, 0.18)}`, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 650 }}>
                        {ALERT_EVENT_LABELS[event.type]}
                        {event.toLevel && event.type !== 'acknowledged' ? ` · ${event.toLevel}` : ''}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {formatDateTime(event.occurredAt)}
                        </Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {eventDescription(event, alert)}
                        {event.cycleId && range ? (
                          <>
                            {' · '}
                            <Link component={RouterLink} to={links.acquisition(event.cycleId, hourWindow(event.occurredAt) ?? range)}>
                              aquisição
                            </Link>
                          </>
                        ) : null}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </Card>
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
        {isRatio
          ? 'A razão compara a leitura com a baseline aprendida do ponto na mesma hora do dia. A condição do painel usa outra referência (a aquisição sincronizada anterior); por isso um alerta pode estar aberto com a condição "normal" — as duas leituras são verdadeiras.'
          : isPresence
            ? 'Ausência de dado não é falha mecânica: este alerta é de qualidade do dado/conectividade. O sistema não distingue parada planejada de falha de gateway — não há calendário de operação.'
            : 'A diferença compara a leitura com a baseline térmica do ponto na mesma hora do dia; após uma lacuna longa, os primeiros 120 min são ignorados para o religamento não parecer anomalia.'}
      </Typography>

      <Dialog open={dialogOpen} onClose={() => (ackStatus === 'saving' ? undefined : setDialogOpen(false))} aria-labelledby="ack-title">
        <DialogTitle id="ack-title">Reconhecer alerta</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            Reconhecer registra que alguém viu o episódio. Não resolve nem silencia: o alerta continua ativo até a condição
            normalizar — e, se escalar para A2, pede novo reconhecimento.
          </DialogContentText>
          <TextField
            label="Nota (opcional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
            helperText={`${note.length}/500`}
          />
          {ackStatus === 'failed' && ackError ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {ackError}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={ackStatus === 'saving'}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void acknowledge()} disabled={ackStatus === 'saving'} sx={{ bgcolor: activeColor }}>
            {ackStatus === 'saving' ? 'Registrando…' : 'Confirmar reconhecimento'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
