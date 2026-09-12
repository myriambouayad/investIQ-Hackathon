import type { AllocationItem } from '../../types';
import { moneyFull, pct } from './tokens';

/**
 * Holdings.
 *
 * A pie was the obvious choice and the wrong one: slices under about eight
 * percent are unreadable, the labels have to be drawn inside the wedges, and
 * fifteen tickers force fifteen arbitrary hues. A single composition bar plus
 * a rank-ordered list answers the two real questions — what dominates, and
 * what is each position actually worth — and stays legible at any count.
 *
 * The ramp is one hue stepped by value, not a categorical palette. Weight,
 * not identity, is what the shading encodes, so the darkest band is always
 * the largest position.
 */

const RAMP = [
  'var(--color-indigo-300)',
  'var(--color-indigo-600)',
  'var(--color-blue-400)',
  'var(--color-gray-300)',
  'var(--color-gray-500)',
  'var(--color-gray-700)',
];

function shadeFor(i: number) {
  return RAMP[Math.min(i, RAMP.length - 1)];
}

export function AllocationChart({ allocation }: { allocation: AllocationItem[] }) {
  const rows = [...allocation].sort((a, b) => b.weight - a.weight);
  const total = rows.reduce((s, a) => s + a.weight, 0) || 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Composition bar — the whole portfolio as one 100% width. */}
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-800"
        role="img"
        aria-label={`Allocation: ${rows.map((a) => `${a.ticker} ${pct(a.weight, 0)}`).join(', ')}`}
      >
        {rows.map((a, i) => (
          <div
            key={a.ticker}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(a.weight / total) * 100}%`,
              background: shadeFor(i),
              boxShadow: 'inset -1px 0 0 var(--color-gray-900)',
            }}
            title={`${a.ticker} — ${pct(a.weight)}`}
          />
        ))}
      </div>

      {/* Positions. Ticker in mono so the column scans; dollars right-aligned
          so magnitudes compare without reading a single digit. */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-700/50">
            <th className="pb-2 eyebrow font-medium">Position</th>
            <th className="pb-2 eyebrow font-medium text-right">Weight</th>
            <th className="pb-2 eyebrow font-medium text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr
              key={a.ticker}
              className="border-b border-gray-700/30 last:border-0 hover:bg-gray-800/60 transition-colors"
            >
              <td className="py-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-1 h-7 rounded-full shrink-0"
                    style={{ background: shadeFor(i) }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="mono text-[0.8125rem] font-semibold text-gray-100 leading-tight">
                      {a.ticker}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-[15rem]">{a.name}</p>
                  </div>
                </div>
              </td>
              <td className="py-2.5 text-right align-middle">
                <span className="mono text-gray-200">{pct(a.weight, 1)}</span>
              </td>
              <td className="py-2.5 text-right align-middle">
                <span className="mono text-gray-50 font-medium">{moneyFull(a.dollars)}</span>
                <p className="text-xs text-gray-500 tabular">
                  {a.whole_shares.toLocaleString()} sh @ {moneyFull(a.price)}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
