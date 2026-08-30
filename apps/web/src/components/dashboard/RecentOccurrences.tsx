import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import { EmptyState } from '@dynamox/ui';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { formatShortDateTime } from '../../features/dashboard/dashboardFormatters';
import { DashboardCard } from './DashboardCard';
import { StatusTag } from './StatusTag';

/**
 * Ocorrências recentes — derivadas honestamente do estado disponível: cada linha é a
 * última leitura real de um sensor com a classificação atual. O domínio não persiste
 * eventos, e o painel não finge que persiste.
 */
export function RecentOccurrences({
  view,
  loading,
  onInvestigate,
}: {
  view: DashboardView;
  loading: boolean;
  onInvestigate: (seriesId: string) => void;
}): JSX.Element {
  return (
    <DashboardCard
      title="Ocorrências recentes"
      titleId="occurrences-title"
      info="Derivado das leituras persistidas — o domínio não possui eventos/alarmes persistidos."
    >
      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} variant="rounded" height={44} />
          ))}
        </Stack>
      ) : null}

      {!loading && view.occurrences.length === 0 ? (
        <EmptyState
          title="Sem leituras registradas"
          description="As ocorrências aparecem quando os sensores começam a reportar."
        />
      ) : null}

      {!loading && view.occurrences.length > 0 ? (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            aria-label="Ocorrências recentes"
            sx={{
              // Colunas densas mas legíveis; a mensagem só aparece quando há largura.
              '& .MuiTableCell-root': { py: 0.5, px: 0.85, lineHeight: 1.25, borderColor: 'divider' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Data / hora</TableCell>
                <TableCell>Máquina</TableCell>
                <TableCell>Ponto / sensor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ display: { xs: 'none', xl: 'table-cell' } }}>Mensagem</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {view.occurrences.slice(0, 6).map((row) => (
                <TableRow
                  key={row.id}
                  hover={Boolean(row.seriesId)}
                  onClick={() => {
                    if (row.seriesId) onInvestigate(row.seriesId);
                  }}
                  aria-label={`${row.machineName} ${row.pointLabel} ${row.sensorSerial}: ${row.statusLabel} — ${row.message}`}
                  sx={{ cursor: row.seriesId ? 'pointer' : 'default' }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    {formatShortDateTime(row.timestamp)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 650, whiteSpace: 'nowrap' }}>
                    {row.machineName.split(' — ')[0]}
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
                      {row.machineName.split(' — ')[0]} · {row.pointLabel} · {row.sensorSerial}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {row.pointLabel} · {row.sensorSerial}
                  </TableCell>
                  <TableCell><StatusTag kind={row.statusKind} label={row.statusLabel} /></TableCell>
                  <TableCell
                    sx={{
                      display: { xs: 'none', xl: 'table-cell' },
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={row.message}
                  >
                    {row.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
