import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BacktestPoint } from '../../types';
import { Tip } from './chartkit';
import { BARE_AXIS, C, CURSOR } from './tokens';

interface Props {
  data: BacktestPoint[];
}

/**
 * Underwater curve. Zero is the only reference that matters, so it gets the
 * one solid rule on the plot and everything else hangs off it — the shape
 * below the line is the answer to "how bad did it get, and for how long".
 */
export function DrawdownChart({ data }: Props) {
  const worst = data.reduce((a, b) => (b.drawdown < a.drawdown ? b : a), data[0]);

  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="ddWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.down} stopOpacity={0} />
            <stop offset="100%" stopColor={C.down} stopOpacity={0.35} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="date"
          {...BARE_AXIS}
          tickFormatter={(v: string) => v.slice(0, 4)}
          interval={Math.max(1, Math.floor(data.length / 6))}
          minTickGap={24}
        />
        <YAxis
          {...BARE_AXIS}
          orientation="right"
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          width={52}
          domain={['dataMin', 0]}
          tickCount={4}
        />
        <ReferenceLine y={0} stroke={C.hairline} strokeWidth={1} />
        {worst && (
          <ReferenceLine
            y={worst.drawdown}
            stroke={C.down}
            strokeDasharray="3 3"
            strokeOpacity={0.45}
          />
        )}
        <Tooltip
          cursor={CURSOR}
          content={({ active, payload, label }: any) =>
            active && payload?.length ? (
              <Tip
                label={label}
                rows={[
                  {
                    name: 'Below peak',
                    value: `${(payload[0].value * 100).toFixed(2)}%`,
                    color: C.down,
                  },
                ]}
              />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke={C.down}
          strokeWidth={1.25}
          fill="url(#ddWash)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
