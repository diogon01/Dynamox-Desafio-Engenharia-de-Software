import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@dynamox/ui';

import type { DashboardView } from '../../features/dashboard/dashboardAggregations';
import { DashboardCard } from './DashboardCard';
import {
  CONDITION_STACK_LABELS,
  CONDITION_STACK_ORDER,
  axisTickStyle,
  chartGridStroke,
  chartTooltipStyles,
} from './chartTheme';
import { FleetConditionStrip } from './FleetConditionStrip';
import { conditionColor } from '../condition/ConditionTag';

/** Nome curto da máquina para o eixo X (antes do primeiro separador). */
function shortName(name: string): string {
  return name.split(' — ')[0].trim();
}

/**
 * Condição por ativo — barras verticais 100% empilhadas. Responde: qual ativo concentra
 * a maior proporção de condições problemáticas?
 */
export function AssetConditionColumns({
  view,
  loading,
}: {
  view: DashboardView;
  loading: boolean;
}): JSX.Element {
  const muiTheme = useTheme();
  const tooltip = chartTooltipStyles(muiTheme);

  type AssetRow = { name: string; total: number } & Record<
    (typeof CONDITION_STACK_ORDER)[number],
    number
  >;
  const data: AssetRow[] = view.rows
    .filter((row) => row.cells.length > 0)
    .map((row) => {
      const counts: Record<(typeof CONDITION_STACK_ORDER)[number], number> = {
        normal: 0,
        observation: 0,
        attention: 0,
        unclassified: 0,
        noData: 0,
      };
      for (const cell of row.cells) {
        if (cell.condition === 'normal') counts.normal += 1;
        else if (cell.condition === 'observation') counts.observation += 1;
        else if (cell.condition === 'attention') counts.attention += 1;
        else if (cell.condition === 'no-data' || cell.condition === 'no-sensor') counts.noData += 1;
        else counts.unclassified += 1;
      }
      return { name: shortName(row.machine.name), total: row.cells.length, ...counts };
    });

  const stackKeys = CONDITION_STACK_ORDER.filter((key) => data.some((row) => row[key] > 0));

  return (
    <DashboardCard
      title="Condição por ativo"
      titleId="asset-condition-title"
      size="chart"
      subtitle="Distribuição da frota e proporção da condição em cada máquina."
      info="Classificação demonstrativa por ponto. Recência e cobertura têm painéis próprios."
    >
      {loading ? <Skeleton variant="rounded" height={180} /> : null}
      {!loading ? <FleetConditionStrip view={view} /> : null}
      {!loading && data.length === 0 ? (
        <EmptyState title="Sem ativos com pontos" description="Cadastre pontos de monitoramento." />
      ) : null}
      {!loading && data.length > 0 ? (
        <Box sx={{ width: '100%', flexGrow: 1, minHeight: 132 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} stackOffset="expand" margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke={chartGridStroke(muiTheme)} />
              <XAxis
                dataKey="name"
                tick={axisTickStyle(muiTheme)}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={data.length > 5 ? -28 : 0}
                height={data.length > 5 ? 44 : 24}
                textAnchor={data.length > 5 ? 'end' : 'middle'}
              />
              <YAxis
                tick={axisTickStyle(muiTheme)}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
              />
              <Tooltip
                {...tooltip}
                cursor={{ fill: chartGridStroke(muiTheme) }}
                formatter={(value: number, name: string, entry) => {
                  const total = (entry?.payload as { total?: number } | undefined)?.total ?? 0;
                  return [`${value} de ${total} ponto(s)`, name];
                }}
              />
              {stackKeys.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={CONDITION_STACK_LABELS[key]}
                  stackId="condition"
                  fill={conditionColor(key === 'noData' ? 'no-data' : key, muiTheme.palette)}
                  isAnimationActive={false}
                  maxBarSize={34}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      ) : null}
    </DashboardCard>
  );
}
