import React from 'react';

type Color = 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray';

/**
 * Low-fill, hairline-bordered tags. A badge labels a thing; it should not
 * out-shout the figure beside it, which a saturated pill invariably does.
 */
const colors: Record<Color, string> = {
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  red: 'bg-red-500/10 text-red-400 border-red-500/25',
  yellow: 'bg-amber-400/10 text-amber-400 border-amber-400/25',
  blue: 'bg-blue-400/10 text-blue-400 border-blue-400/25',
  purple: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/25',
  gray: 'bg-gray-800 text-gray-300 border-gray-700',
};

export function Badge({
  children,
  color = 'gray',
}: {
  children: React.ReactNode;
  color?: Color;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-semibold
                  uppercase tracking-[0.06em] border ${colors[color]}`}
    >
      {children}
    </span>
  );
}
