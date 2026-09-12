import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

/**
 * The change chip.
 *
 * Direction is encoded three times over — arrow, explicit sign, colour — so
 * the reading survives a colour-blind viewer, a greyscale print, and a
 * glance too quick to resolve hue.
 */
export function Delta({
  value,
  pct,
  size = 'md',
  tone = 'chip',
}: {
  /** Absolute change. Its sign sets the direction. */
  value?: number;
  /** Fractional change (0.41 = +41%). Used alone if `value` is omitted. */
  pct?: number;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'chip' | 'plain';
}) {
  const basis = value ?? pct ?? 0;
  const up = basis >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;

  const text = up ? 'text-emerald-400' : 'text-red-400';
  const bg = up
    ? 'bg-emerald-500/10 border-emerald-500/25'
    : 'bg-red-500/10 border-red-500/25';

  const sizes = {
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-sm px-2 py-1 gap-1',
    lg: 'text-base px-2.5 py-1 gap-1',
  }[size];
  const icon = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' }[size];

  const money = (n: number) =>
    `${n < 0 ? '−' : '+'}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const percent = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n * 100).toFixed(2)}%`;

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium tabular ${sizes} ${text} ${
        tone === 'chip' ? `border ${bg}` : ''
      }`}
    >
      <Arrow className={`${icon} shrink-0`} aria-hidden />
      {value !== undefined && money(value)}
      {value !== undefined && pct !== undefined && (
        <span className="opacity-60">·</span>
      )}
      {pct !== undefined && percent(pct)}
      <span className="sr-only">{up ? ' gain' : ' loss'}</span>
    </span>
  );
}
