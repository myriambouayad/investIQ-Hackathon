import { useEffect, useRef, useState } from 'react';
import { getQuotes } from '../api/market';
import type { QuotesResponse } from '../types';

/**
 * The tape.
 *
 * Server-side cache refreshes on a 60s cycle, so polling faster buys nothing
 * but load; this matches it. Renders nothing at all when quotes are
 * unavailable — a tape of dashes is worse than no tape, because a stale one
 * still looks live.
 */
const POLL_MS = 60_000;

function Quote({ ticker, price, change }: { ticker: string; price: number; change?: number }) {
  const known = change !== undefined && change !== null;
  const up = (change ?? 0) >= 0;
  return (
    <span className="inline-flex items-baseline gap-2 px-4 shrink-0">
      <span className="mono text-xs font-semibold text-gray-300">{ticker}</span>
      <span className="mono text-xs text-gray-100">
        {price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      {known && (
        <span className={`mono text-xs ${up ? 'text-emerald-400' : 'text-red-400'}`}>
          {up ? '▲' : '▼'} {Math.abs(change * 100).toFixed(2)}%
        </span>
      )}
    </span>
  );
}

export function MarketTape() {
  const [data, setData] = useState<QuotesResponse | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getQuotes()
        .then((d) => alive && setData(d))
        .catch(() => alive && setData(null));
    load();
    timer.current = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer.current);
    };
  }, []);

  const entries = Object.entries(data?.quotes ?? {});
  if (entries.length === 0) return null;

  const items = entries.map(([ticker, q]) => (
    <Quote key={ticker} ticker={ticker} price={q.price} change={q.change_pct} />
  ));

  return (
    <div className="relative overflow-hidden border-y border-gray-800 bg-gray-950 py-2">
      {/* The strip scrolls; screen readers get the list once, unanimated. */}
      <div className="sr-only">
        {entries.map(([t, q]) => `${t} ${q.price}. `).join('')}
      </div>
      <div className="flex w-max animate-[tape_60s_linear_infinite] motion-reduce:animate-none" aria-hidden>
        {items}
        {items}
      </div>
      {/* Feathered ends, so quotes enter and leave instead of being clipped. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-gray-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-gray-950 to-transparent" />
    </div>
  );
}
