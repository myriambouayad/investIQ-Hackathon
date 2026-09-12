import React from 'react';

/**
 * Chart components. Values and formatters live in `tokens.ts` — mixing the
 * two in one module breaks fast refresh for every chart that imports it.
 */

/**
 * A top-to-transparent wash under a line. Anchored to a colour token so the
 * fill tracks whichever direction the series ended up going.
 */
export function Wash({ id, color, opacity = 0.28 }: { id: string; color: string; opacity?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={opacity} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

interface TipRow {
  name: string;
  value: string;
  color?: string;
}

/**
 * The readout that follows the cursor. Values are right-aligned and tabular
 * so they hold still as the pointer moves across the series — a tooltip whose
 * digits jitter is unreadable while scrubbing.
 */
export function Tip({ label, rows }: { label?: React.ReactNode; rows: TipRow[] }) {
  return (
    <div className="rounded-md border border-gray-700 bg-gray-950/95 backdrop-blur px-3 py-2 shadow-xl shadow-black/40">
      {label && (
        <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-gray-500 mb-1.5">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-6 text-xs">
            <span className="flex items-center gap-1.5 text-gray-400">
              {r.color && (
                <span
                  className="w-2 h-0.5 rounded-full shrink-0"
                  style={{ background: r.color }}
                  aria-hidden
                />
              )}
              {r.name}
            </span>
            <span className="mono text-gray-100 font-medium">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * An inline key. Replaces Recharts' legend box, which floats a bordered
 * island under the plot and pushes the series into a smaller frame.
 */
export function Key({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-gray-400">
          <span
            className="w-3 h-[2px] rounded-full shrink-0"
            style={{
              background: it.dashed
                ? `repeating-linear-gradient(90deg, ${it.color} 0 3px, transparent 3px 6px)`
                : it.color,
            }}
            aria-hidden
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
