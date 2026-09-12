import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Projection } from '../../types';
import { Key, Tip } from './chartkit';
import { BARE_AXIS, C, CURSOR, money, moneyFull, pct } from './tokens';

interface Props {
  projection: Projection;
  goal?: number | null;
}

/**
 * The forward fan.
 *
 * Three overlapping filled series is the usual rendering and it is the wrong
 * one: it reads as three forecasts when there is only one, with uncertainty
 * around it. Drawn as nested bands — 10th–90th wide and pale, 25th–75th
 * tight and darker, the median a single line — the eye gets the shape of the
 * distribution instead of three competing predictions.
 */
export function MonteCarloChart({ projection, goal }: Props) {
  // Quarterly resolution is plenty at this horizon and keeps the path count
  // low enough that hover stays responsive.
  const data = projection.series
    .filter((_, i) => i % 3 === 0 || i === projection.series.length - 1)
    .map((p) => ({
      month: p.month,
      band90: [p.p10, p.p90] as [number, number],
      band50: [p.p25, p.p75] as [number, number],
      p50: p.p50,
      p10: p.p10,
      p90: p.p90,
      p25: p.p25,
      p75: p.p75,
      contributed: p.contributed,
    }));

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="month"
            {...BARE_AXIS}
            tickFormatter={(v: number) => (v === 0 ? 'now' : `${Math.round(v / 12)}y`)}
            interval={Math.max(1, Math.floor(data.length / 6))}
            minTickGap={24}
          />
          <YAxis {...BARE_AXIS} orientation="right" tickFormatter={money} width={52} tickCount={5} />

          <Tooltip
            cursor={CURSOR}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <Tip
                  label={`year ${(p.month / 12).toFixed(1)}`}
                  rows={[
                    { name: '90th pct', value: moneyFull(p.p90), color: C.up },
                    { name: 'Median', value: moneyFull(p.p50), color: C.accent },
                    { name: '10th pct', value: moneyFull(p.p10), color: C.down },
                    { name: 'Invested', value: moneyFull(p.contributed), color: C.muted },
                  ]}
                />
              );
            }}
          />

          <Area
            dataKey="band90"
            stroke={C.accent}
            strokeOpacity={0.3}
            strokeWidth={1}
            fill={C.accent}
            fillOpacity={0.14}
            isAnimationActive={false}
          />
          <Area
            dataKey="band50"
            stroke="none"
            fill={C.accent}
            fillOpacity={0.28}
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
            dataKey="p50"
            stroke={C.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, fill: C.accent, stroke: 'var(--color-bg)', strokeWidth: 2 }}
            isAnimationActive={false}
          />

          {goal ? (
            <ReferenceLine
              y={goal}
              stroke={C.up}
              strokeDasharray="5 4"
              strokeOpacity={0.8}
              label={{
                value: `goal ${money(goal)}`,
                fill: 'var(--color-emerald-400)',
                fontSize: 10,
                position: 'insideTopLeft',
              }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>

      <Key
        items={[
          { label: 'Median path', color: C.accent },
          { label: '25th–75th', color: 'color-mix(in srgb, var(--color-accent) 45%, transparent)' },
          { label: '10th–90th', color: 'color-mix(in srgb, var(--color-accent) 22%, transparent)' },
          { label: 'Total invested', color: C.muted, dashed: true },
        ]}
      />

      {/* Outcome spread. Read as one sentence: bad case, expected, good case. */}
      <div className="grid grid-cols-3 divide-x divide-gray-700/50 border-t border-gray-700/50 pt-3 mt-1">
        {(
          [
            ['10th percentile', projection.final_p10, 'text-red-400', 'if things go badly'],
            ['Median outcome', projection.final_p50, 'text-gray-50', 'half of paths beat this'],
            ['90th percentile', projection.final_p90, 'text-emerald-400', 'if things go well'],
          ] as const
        ).map(([label, value, tone, note], i) => (
          <div key={label} className={i === 0 ? 'pr-3' : 'px-3'}>
            <p className="eyebrow">{label}</p>
            <p className={`figure figure-md mt-1 ${tone}`}>{moneyFull(value)}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {i === 1 ? note : `${pct(value / projection.final_p50 - 1, 0)} vs median`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
