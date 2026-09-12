import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BacktestPoint } from '../../types';
import { Key, Tip, Wash } from './chartkit';
import { BARE_AXIS, C, CURSOR, money, moneyFull } from './tokens';

interface Props {
  data: BacktestPoint[];
  /** Fires as the cursor scrubs the series; null when it leaves. */
  onHover?: (point: BacktestPoint | null) => void;
  height?: number;
  showKey?: boolean;
}

/**
 * The portfolio line.
 *
 * Its colour is the outcome: green if the run finished above what was put
 * in, red if not. That is the whole verdict of the backtest delivered before
 * a single axis label is read. The contributed line stays grey and dashed —
 * it is the baseline being beaten, not a second result competing for
 * attention.
 */
export function BacktestChart({ data, onHover, height = 300, showKey = true }: Props) {
  const last = data[data.length - 1];
  const ahead = !last || last.balance >= last.contributed;
  const line = ahead ? C.up : C.down;

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          onMouseMove={(s: any) => onHover?.(s?.activePayload?.[0]?.payload ?? null)}
          onMouseLeave={() => onHover?.(null)}
        >
          <defs>
            <Wash id="btWashUp" color={C.up} />
            <Wash id="btWashDown" color={C.down} />
          </defs>

          <XAxis
            dataKey="date"
            {...BARE_AXIS}
            tickFormatter={(v: string) => v.slice(0, 4)}
            interval={Math.max(1, Math.floor(data.length / 6))}
            minTickGap={24}
            padding={{ left: 0, right: 0 }}
          />
          <YAxis
            {...BARE_AXIS}
            orientation="right"
            tickFormatter={money}
            width={52}
            tickCount={5}
            domain={['dataMin', 'dataMax']}
          />
          <Tooltip
            cursor={CURSOR}
            content={({ active, payload, label }: any) =>
              active && payload?.length ? (
                <Tip
                  label={label}
                  rows={[
                    { name: 'Portfolio', value: moneyFull(payload[0].payload.balance), color: line },
                    { name: 'Invested', value: moneyFull(payload[0].payload.contributed), color: C.muted },
                    {
                      name: 'P&L',
                      value: moneyFull(payload[0].payload.balance - payload[0].payload.contributed),
                    },
                  ]}
                />
              ) : null
            }
          />

          <Area
            type="monotone"
            dataKey="balance"
            stroke="none"
            fill={ahead ? 'url(#btWashUp)' : 'url(#btWashDown)'}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="contributed"
            stroke={C.muted}
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke={line}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, fill: line, stroke: 'var(--color-bg)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {showKey && (
        <Key
          items={[
            { label: 'Portfolio value', color: line },
            { label: 'Total invested', color: C.muted, dashed: true },
          ]}
        />
      )}
    </div>
  );
}
