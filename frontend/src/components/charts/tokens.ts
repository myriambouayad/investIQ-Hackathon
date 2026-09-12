/**
 * Shared chart vocabulary.
 *
 * Two rules hold across every chart in the app:
 *
 *  - Colour is read from the theme's custom properties, never hard-coded.
 *    SVG presentation attributes accept `var()`, so a single set of tokens
 *    drives both themes and the charts re-skin with everything else.
 *  - Chrome is subtractive. No legend box, no full grid, no axis rules. What
 *    is left is the series and just enough scale to read it — which is the
 *    difference between a quote screen and a slide deck.
 */

export const C = {
  up: 'var(--color-up)',
  down: 'var(--color-down)',
  accent: 'var(--color-accent)',
  muted: 'var(--color-muted)',
  grid: 'var(--grid-line)',
  hairline: 'var(--color-hairline)',
  surface: 'var(--color-card)',
  text: 'var(--color-text)',
} as const;

export const AXIS_TICK = { fill: 'var(--color-gray-500)', fontSize: 11 } as const;

/** Axis defaults: no rule, no tick marks, nothing but the labels. */
export const BARE_AXIS = {
  axisLine: false,
  tickLine: false,
  tick: AXIS_TICK,
} as const;

/** The vertical scrub line a tape draws under the cursor. */
export const CURSOR = {
  stroke: 'var(--color-gray-500)',
  strokeWidth: 1,
  strokeDasharray: '3 3',
} as const;

export function money(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function moneyFull(n: number) {
  return `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;
}

export function pct(n: number, digits = 2) {
  return `${(n * 100).toFixed(digits)}%`;
}
