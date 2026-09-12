import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { money2 } from '../agent/format';

/** The bot's equity against buy-and-hold over the identical bars.
 *
 *  The benchmark is not decoration. An equity curve that only shows the bot
 *  rising says nothing about whether the bot beat owning the index over the
 *  same window, which is the only comparison that makes the line meaningful.
 */
export function BotEquityChart({
  data,
  benchmarkSymbol,
  height = 220,
}: {
  data: { date: string; strategy: number; benchmark: number | null }[];
  benchmarkSymbol: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={{ stroke: '#374151' }}
          tickLine={false}
          tickFormatter={(v: string) => v.slice(2, 7)}
          minTickGap={28}
        />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(n: number) => `$${(n / 1000).toFixed(1)}k`}
        />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#9ca3af', fontSize: 12 }}
          formatter={(v, name) => [typeof v === 'number' ? money2(v) : '—', name]}
        />
        <Legend
          formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="strategy"
          name="Bot"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="benchmark"
          name={`Buy & hold ${benchmarkSymbol}`}
          stroke="#10b981"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
