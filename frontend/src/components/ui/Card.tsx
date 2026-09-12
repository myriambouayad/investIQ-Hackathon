import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Removes the body padding so a chart can run to the panel edge. */
  flush?: boolean;
}

/**
 * A panel on the desk surface.
 *
 * Deliberately close in value to the page ground: the hairline does the
 * separating, not a fill. Stacked panels then read as one continuous
 * surface with rules drawn on it rather than as a pile of widgets.
 */
export function Card({
  children,
  className = '',
  title,
  subtitle,
  action,
  flush = false,
}: CardProps) {
  return (
    <div
      className={`bg-gray-900 rounded-lg border border-gray-700/70 ${className}`}
    >
      {(title || action) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 px-5 py-3.5 border-b border-gray-700/50">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-gray-300">
                {title}
              </h3>
            )}
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={flush ? '' : 'px-5 py-4'}>{children}</div>
    </div>
  );
}

/**
 * A single readout.
 *
 * The figure outweighs its label by a wide margin — on a desk you scan the
 * numbers and only read the words when one surprises you.
 */
export function StatCard({
  label,
  value,
  sub,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: 'green' | 'red' | 'yellow' | 'default';
  tooltip?: string;
}) {
  const colorMap = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    yellow: 'text-amber-400',
    default: 'text-gray-50',
  };
  return (
    <div
      className="bg-gray-900 rounded-lg border border-gray-700/70 px-4 py-3.5 flex flex-col gap-1.5"
      title={tooltip}
    >
      <p className="eyebrow truncate">{label}</p>
      <p className={`figure figure-lg ${colorMap[color || 'default']}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 tabular">{sub}</p>}
    </div>
  );
}
