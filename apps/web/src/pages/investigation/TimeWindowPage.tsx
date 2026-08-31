import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { EmptyState, ErrorState, LoadingState } from '@dynamox/ui';

import { api } from '../../api/client';
import { InvestigationBreadcrumbs } from '../../components/investigation/InvestigationBreadcrumbs';
import { KpiStrip } from '../../components/investigation/KpiStrip';
import {
  formatDateTime,
  formatMeasurement,
  formatNumber,
} from '../../features/dashboard/dashboardFormatters';
import { useAnalyticsQuery, useTimeRange, withRange } from '../../features/investigation/useAnalyticsQuery';

/**
 * NÍVEL "HORA" da investigação: o que aconteceu numa janela específica.
 *
 * A página é definida pela URL (`/monitoring/windows/:date/:hour` + `from`/`to`), e a
 * consulta é recortada por essa janela — nada do histórico fora dela é lido.
 */
export function TimeWindowPage(): JSX.Element {
  const { date = '', hour = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const range = useTimeRange();
  const navigate = useNavigate();

  const page = Number(search.get('page') ?? '1');
  const pageSize = Number(search.get('pageSize') ?? '25');

  const query = useAnalyticsQuery(
    () => api.timeWindow({ from: range.from, to: range.to }, page, pageSize),
    [range.from, range.to, page, pageSize],
  );

  const setParam = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(search);
      for (const [key, value] of Object.entries(patch)) next.set(key, value);
      setSearch(next, { replace: false });
    },
    [search, setSearch],
  );

  const hourLabel = `${String(hour).padStart(2, '0')}h`;
  const dayLabel = date.split('-').reverse().join('/');
  const data = query.data;

  return (
    <Box sx={{ pt: 2, pb: 3 }}>
      <InvestigationBreadcrumbs
        steps={[
          { label: 'Visão geral', to: '/' },
          { label: dayLabel },
          { label: hourLabel },
        ]}
      />

      <Typography variant="h1" component="h1">
        {dayLabel} · {hourLabel}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
        Janela de uma hora. A consulta cobre apenas este intervalo — o restante do histórico não é lido.
      </Typography>
      <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1, mb: 2 }}>
        <Chip size="small" variant="outlined" label={`De ${formatDateTime(range.from)}`} />
        <Chip size="small" variant="outlined" label={`até ${formatDateTime(range.to)}`} />
      </Stack>

      {query.status === 'loading' || query.status === 'idle' ? (
        <LoadingState label="Consultando a janela…" />
      ) : null}

      {query.status === 'failed' ? (
        <ErrorState
          message={query.error ?? 'Não foi possível consultar a janela.'}
          onRetry={query.reload}
        />
      ) : null}

      {query.status === 'succeeded' && data ? (
        <>
          <KpiStrip
            items={[
              { label: 'Sensores reportando', value: `${data.kpis.reportingSensors}/${data.kpis.expectedSensors}` },
              { label: 'Sem leitura', value: String(data.kpis.silentSensors), tone: data.kpis.silentSensors > 0 ? 'warning' : 'default' },
              { label: 'Aquisições', value: formatNumber(data.kpis.acquisitionCount, 0) },
              { label: 'Amostras', value: formatNumber(data.kpis.sampleCount, 0) },
              {
                label: 'Maior valor',
                value: data.kpis.maxValue === null ? '—' : formatMeasurement(data.kpis.maxValue, 'g'),
                hint: data.kpis.maxValueSensor ?? undefined,
              },
            ]}
          />

          {data.items.length === 0 ? (
            <EmptyState
              title="Nenhuma aquisição nesta janela"
              description="Nenhum sensor reportou entre os instantes selecionados."
            />
          ) : (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" aria-label="Sensores da janela">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ativo</TableCell>
                      <TableCell>Ponto</TableCell>
                      <TableCell>Sensor</TableCell>
                      <TableCell align="right">Aquisições</TableCell>
                      <TableCell align="right">Último valor</TableCell>
                      <TableCell align="right">Média</TableCell>
                      <TableCell align="right">Máximo</TableCell>
                      <TableCell>Última leitura</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow
                        key={item.sensorSerialNumber}
                        hover
                        onClick={() =>
                          navigate(
                            withRange(`/sensors/${item.sensorSerialNumber}`, range, { bucket: '15m' }),
                          )
                        }
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {item.machineName?.split(' — ')[0] ?? '—'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.monitoringPointName ?? '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {item.sensorSerialNumber}
                        </TableCell>
                        <TableCell align="right">{item.acquisitionCount}</TableCell>
                        <TableCell align="right">
                          {item.lastValue === null ? '—' : formatMeasurement(item.lastValue, item.unit)}
                        </TableCell>
                        <TableCell align="right">
                          {item.avg === null ? '—' : formatMeasurement(item.avg, item.unit)}
                        </TableCell>
                        <TableCell align="right">
                          {item.max === null ? '—' : formatMeasurement(item.max, item.unit)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          {item.lastAt ? formatDateTime(item.lastAt) : 'sem leitura'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={data.total}
                page={data.page - 1}
                onPageChange={(_, next) => setParam({ page: String(next + 1) })}
                rowsPerPage={data.pageSize}
                rowsPerPageOptions={[25, 50, 100]}
                onRowsPerPageChange={(event) =>
                  setParam({ pageSize: event.target.value, page: '1' })
                }
                labelRowsPerPage="Itens por página"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                getItemAriaLabel={(type) =>
                  type === 'previous' ? 'Ir para a página anterior' : 'Ir para a próxima página'
                }
              />
            </Card>
          )}
        </>
      ) : null}
    </Box>
  );
}
