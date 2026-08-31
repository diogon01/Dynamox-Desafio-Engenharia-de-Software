import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

import { machineTag } from '@dynamox/domain';
import { EmptyState } from '@dynamox/ui';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { links, type AnalyticsRange } from '../../features/investigation/links';
import { formatShortDateTime, hourWindow } from '../../features/time/instant';
import { DashboardCard } from './DashboardCard';
import { ConditionTag } from '../condition/ConditionTag';

/**
 * Ocorrências recentes — derivadas honestamente do estado disponível: cada item é a
 * última leitura real de um sensor com a classificação atual. O domínio não persiste
 * eventos, e o painel não finge que persiste.
 *
 * Lista em vez de tabela: numa coluna de um terço, duas linhas por item deixam a
 * mensagem visível — e é ela que diz por que o item importa.
 */
export function RecentOccurrences({
  view,
  loading,
  range,
}: {
  view: DashboardView;
  loading: boolean;
  range: AnalyticsRange;
}): JSX.Element {
  const navigate = useNavigate();
  const rows = view.occurrences.slice(0, 6);

  /**
   * A ocorrência tem um instante; abri-la deve levar ao sensor JÁ recortado nele — a hora
   * da leitura, não a janela inteira do painel. Sem instante (ponto que nunca reportou),
   * cai no recorte atual, que é o melhor contexto disponível.
   */
  const openOccurrence = (row: (typeof rows)[number]) => {
    if (!row.sensorSerial) return;
    const period = row.timestamp ? hourWindow(row.timestamp) : null;
    navigate(links.sensor(row.sensorSerial, period ?? range, period ? '15m' : undefined));
  };

  return (
    <DashboardCard
      title="Ocorrências recentes"
      titleId="occurrences-title"
      subtitle="Última leitura de cada sensor e a classificação atual."
      info="Derivado das leituras persistidas — o domínio não possui eventos/alarmes persistidos. Abrir leva ao sensor na hora da leitura."
      flush
    >
      {loading ? (
        <Stack spacing={1} sx={{ px: 2 }}>
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} variant="rounded" height={44} />
          ))}
        </Stack>
      ) : null}

      {!loading && rows.length === 0 ? (
        <Box sx={{ px: 2 }}>
          <EmptyState
            title="Sem leituras registradas"
            description="As ocorrências aparecem quando os sensores começam a reportar."
          />
        </Box>
      ) : null}

      {!loading && rows.length > 0 ? (
        <Stack component="ul" aria-label="Ocorrências recentes" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((row) => {
            const shortMachine = machineTag(row.machineName);
            const identity = `${shortMachine} · ${row.pointLabel} · ${row.sensorSerial}`;
            return (
              <Box component="li" key={row.id}>
                <ButtonBase
                  disabled={!row.sensorSerial}
                  onClick={() => openOccurrence(row)}
                  aria-label={`Abrir ${identity}: ${row.statusLabel} — ${row.message}`}
                  sx={(theme) => ({
                    width: '100%',
                    display: 'block',
                    textAlign: 'left',
                    px: `${theme.dashboard.cardPadding}px`,
                    py: 0.9,
                    borderTop: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                    '&:focus-visible': {
                      outline: `2px solid ${alpha(theme.palette.primary.main, 0.55)}`,
                      outlineOffset: -2,
                    },
                    '&.Mui-disabled': { opacity: 1 },
                  })}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography variant="body2" sx={{ fontWeight: 650 }} noWrap title={row.machineName}>
                      {identity}
                    </Typography>
                    <ConditionTag kind={row.statusKind} label={row.statusLabel} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" component="div" noWrap title={row.message}>
                    {formatShortDateTime(row.timestamp)} · {row.message}
                  </Typography>
                </ButtonBase>
              </Box>
            );
          })}
        </Stack>
      ) : null}

      <Box
        component="span"
        sx={{
          position: 'absolute',
          display: 'block',
          left: 0,
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        Derivado das leituras persistidas; não há alarmes persistidos no domínio.
      </Box>
    </DashboardCard>
  );
}
