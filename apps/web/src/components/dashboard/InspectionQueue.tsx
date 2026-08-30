import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';

import type {
  AttentionSeverity,
  DashboardView,
} from '../../features/dashboard/dashboardAggregations';
import {
  formatMeasurement,
  formatNumber,
  formatRelativeTime,
} from '../../features/dashboard/dashboardFormatters';

/**
 * Fila de inspeção — a primeira pergunta que a tela responde: existe algo exigindo atenção?
 *
 * Substitui o par "ranking + sinais" da versão anterior, que listava o mesmo ativo duas
 * vezes (uma pelo índice, outra pela recência) e enterrava a exceção real no meio de
 * doze linhas de 1,00×. Aqui só entram exceções, ordenadas por severidade, e cada linha
 * carrega a evidência inteira: máquina, ponto, sensor, grandeza medida, valor, unidade,
 * índice vs baseline e idade da leitura.
 */

/** Rótulo de severidade: é um estado, não uma ação — por isso não parece um botão. */
const SEVERITY_META: Record<AttentionSeverity, { label: string; tone: 'error' | 'warning' | 'info' }> = {
  high: { label: 'Prioridade alta', tone: 'error' },
  medium: { label: 'Atenção', tone: 'warning' },
  info: { label: 'Informação', tone: 'info' },
};

/** Quantas linhas aparecem antes de "ver todas" — o corte é sempre declarado na tela. */
const VISIBLE_ROWS = 5;

export interface InspectionQueueProps {
  view: DashboardView;
  loading: boolean;
  evaluating: boolean;
  nowMs: number;
  selectedSeriesId: string | null;
  onInvestigate: (seriesId: string) => void;
}

function SeverityTag({ severity }: { severity: AttentionSeverity }): JSX.Element {
  const meta = SEVERITY_META[severity];
  return (
    <Box
      component="span"
      sx={(theme) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        borderLeft: 3,
        borderColor: `${meta.tone}.main`,
        bgcolor: alpha(theme.palette[meta.tone].main, 0.1),
        color: `${meta.tone}.main`,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      })}
    >
      {meta.label}
    </Box>
  );
}

export function InspectionQueue({
  view,
  loading,
  evaluating,
  nowMs,
  selectedSeriesId,
  onInvestigate,
}: InspectionQueueProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const total = view.signals.length;
  const rows = showAll ? view.signals : view.signals.slice(0, VISIBLE_ROWS);

  return (
    <Card variant="outlined" component="section" aria-labelledby="inspection-queue-title">
      <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'baseline' }}
          gap={0.5}
        >
          <Box>
            <Typography id="inspection-queue-title" variant="h2" component="h2">
              Prioridade de inspeção
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Evidência estatística demonstrativa, recência e cobertura. Não é alarmística
              industrial validada.
            </Typography>
          </Box>
          {total > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              Mostrando {rows.length} de {total}
            </Typography>
          ) : null}
        </Stack>

        {loading ? (
          <Stack spacing={1} sx={{ mt: 2 }} aria-label="Carregando fila de inspeção">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} variant="rounded" height={72} />
            ))}
          </Stack>
        ) : null}

        {!loading && total === 0 ? (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ mt: 2, p: 1.75, borderRadius: 2, bgcolor: 'background.default' }}
          >
            <CheckCircleOutlineIcon color="success" />
            <Box>
              <Typography variant="subtitle2">Nenhuma exceção na frota monitorada</Typography>
              <Typography variant="body2" color="text.secondary">
                {evaluating
                  ? 'A avaliação de condição ainda está em andamento.'
                  : 'Todos os pontos com sensor reportaram dentro do baseline demonstrativo e da janela de recência.'}
              </Typography>
            </Box>
          </Stack>
        ) : null}

        {!loading && total > 0 ? (
          <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
            {rows.map((signal) => {
              const selected = Boolean(signal.seriesId) && signal.seriesId === selectedSeriesId;
              return (
                <Stack
                  key={signal.id}
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  gap={1}
                  sx={(theme) => ({
                    py: 1.25,
                    px: 1,
                    mx: -1,
                    borderRadius: 2,
                    bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                  })}
                >
                  <Box sx={{ minWidth: { md: 128 } }}>
                    <SeverityTag severity={signal.severity} />
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* ASSET → POINT → SENSOR */}
                    <Typography variant="subtitle2">
                      {signal.machineName} · {signal.pointAndSensor}
                    </Typography>
                    {/* SIGNAL → EVIDENCE: a grandeza medida e o número que a sustenta. */}
                    <Typography variant="body2" color="text.secondary">
                      {signal.evidenceLabel ? `${signal.evidenceLabel}: ` : ''}
                      {formatMeasurement(signal.evidenceValue, signal.evidenceUnit)}
                      {signal.deviationRatio !== null
                        ? ` · ${formatNumber(signal.deviationRatio, 2)}× o baseline demonstrativo (${formatMeasurement(signal.baseline, signal.evidenceUnit)})`
                        : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {signal.reason}
                    </Typography>
                  </Box>

                  <Stack
                    direction={{ xs: 'row', md: 'column' }}
                    alignItems={{ xs: 'center', md: 'flex-end' }}
                    justifyContent="space-between"
                    gap={0.5}
                    sx={{ minWidth: { md: 190 } }}
                  >
                    <Typography variant="caption" color="text.secondary" noWrap>
                      Leitura {formatRelativeTime(signal.lastTimestamp, nowMs)}
                    </Typography>
                    <Button
                      size="small"
                      variant={signal.severity === 'high' ? 'contained' : 'outlined'}
                      endIcon={<ArrowForwardIcon />}
                      disabled={!signal.seriesId}
                      onClick={() => {
                        if (signal.seriesId) onInvestigate(signal.seriesId);
                      }}
                    >
                      Investigar
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        ) : null}

        {!loading && total > VISIBLE_ROWS ? (
          <Button
            size="small"
            sx={{ mt: 1 }}
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll}
          >
            {showAll ? 'Mostrar apenas as primeiras' : `Ver todas as ${total} exceções`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
