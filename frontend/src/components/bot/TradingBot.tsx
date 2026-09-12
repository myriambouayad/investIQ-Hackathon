import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, Bot, ChevronsRight, FlaskConical, Info, Lock, Pause, Play,
  RotateCcw, StepForward, TriangleAlert,
} from 'lucide-react';
import { Card, StatCard } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { BotEquityChart } from './BotEquityChart';
import { BotPositions } from './BotPositions';
import { BotQueue } from './BotQueue';
import { BotActivity } from './BotActivity';
import { BotRiskPanel } from './BotRiskPanel';
import { REGIME_COLOR, money, money2, pct, signed, signedMoney } from '../agent/format';
import {
  getBot, resetBot, setBotRunning, startBot, stepBot,
  type BotDefaults, type BotSnapshot, type BotStartBody,
} from '../../api/agent';

/* Play advances in chunks rather than one bar per request: a bar is a few
   milliseconds of work on the server and a whole round trip from the browser,
   so stepping singly spends the entire budget on HTTP. */
const BARS_PER_TICK = 4;
const TICK_MS = 450;

const STATUS: Record<
  BotSnapshot['status'],
  { color: 'green' | 'yellow' | 'blue' | 'red' | 'gray'; label: string }
> = {
  idle: { color: 'gray', label: 'Not started' },
  running: { color: 'green', label: 'Running' },
  paused: { color: 'yellow', label: 'Paused' },
  up_to_date: { color: 'blue', label: 'Caught up' },
  halted: { color: 'red', label: 'Halted by drawdown breaker' },
};

function errorText(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { field?: string; message?: string }) =>
        d.field ? `${d.field}: ${d.message}` : d.message)
      .filter(Boolean)
      .join('; ') || fallback;
  }
  return fallback;
}

/* ── Start form ─────────────────────────────────────────────────────────────
   Three dials only. Costs, weights and thresholds are deliberately not
   editable here: they are the things that make the result mean something, and
   a panel that let you tune them to taste on the dashboard would be a
   different product. The agent desk exposes them for a backtest, where
   changing them is an experiment you then have to declare.               */
function StartForm({
  defaults,
  onStart,
  starting,
}: {
  defaults: BotDefaults;
  onStart: (body: BotStartBody) => void;
  starting: boolean;
}) {
  const [cash, setCash] = useState(defaults.defaults.initial_cash);
  const [bars, setBars] = useState(defaults.defaults.session_bars);
  const [useNews, setUseNews] = useState(defaults.defaults.use_news);
  const [minBars, maxBars] = defaults.session_bars_range;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-sm text-gray-300 space-y-2">
        <p>
          The bot scores every symbol in the universe on five point-in-time
          features plus news sentiment, sums them into one number you can
          re-derive by hand, and proposes a trade when that number clears its
          threshold. It never sizes its own position — the risk gate in{' '}
          <span className="font-mono text-xs">trading/</span> does that, and is
          free to refuse the trade outright.
        </p>
        <p className="text-gray-400">
          Signals from one bar execute at the <em>next</em> bar's close, every
          fill pays spread, slippage and commission, and results are shown
          against buy-and-hold over the identical bars.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-xs text-gray-400">Starting cash</span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={cash}
            onChange={(e) => setCash(Number(e.target.value))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-400">
            Session length ({minBars}–{maxBars} trading days)
          </span>
          <input
            type="number"
            min={minBars}
            max={maxBars}
            step={10}
            value={bars}
            onChange={(e) => setBars(Number(e.target.value))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={useNews}
            onChange={(e) => setUseNews(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-300">
            Use news sentiment
            {defaults.data_source === 'synthetic' && (
              <span className="block text-xs text-amber-400">
                synthetic corpus — non-predictive by construction
              </span>
            )}
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => onStart({
          initial_cash: cash,
          session_bars: bars,
          use_news: useNews,
          // Open with a curve already on screen rather than a flat line, then
          // let the user drive the rest a bar at a time.
          advance: Math.min(Math.floor(bars / 2), bars),
        })} loading={starting}>
          <Play className="w-4 h-4" />
          Start the bot
        </Button>
        <span className="text-xs text-gray-500">
          Replays {bars} trading days ending {defaults.last_bar}. Prices:{' '}
          {defaults.data_source}.
        </span>
      </div>
    </div>
  );
}

/* ── The panel ──────────────────────────────────────────────────────────── */
export function TradingBot() {
  const [snap, setSnap] = useState<BotSnapshot | null>(null);
  const [defaults, setDefaults] = useState<BotDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  // The play loop must not outlive the component or a pause, and it must not
  // overlap itself: one step is in flight at a time, by construction.
  const cancelled = useRef(false);

  const apply = useCallback((state: BotSnapshot | BotDefaults) => {
    if (state.exists) {
      setSnap(state);
      setDefaults(null);
    } else {
      setSnap(null);
      setDefaults(state);
    }
  }, []);

  useEffect(() => {
    let live = true;
    getBot()
      .then((s) => live && apply(s))
      .catch((err) => live && setError(errorText(err, 'Could not load the bot.')))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [apply]);

  useEffect(() => () => { cancelled.current = true; }, []);

  useEffect(() => {
    if (!playing) return;
    cancelled.current = false;
    let timer: number | undefined;

    async function tick() {
      try {
        const s = await stepBot({ bars: BARS_PER_TICK });
        if (cancelled.current) return;
        setSnap(s);
        if (s.session.up_to_date || s.halted || s.bars_taken === 0) {
          setPlaying(false);
          return;
        }
        timer = window.setTimeout(tick, TICK_MS);
      } catch (err) {
        if (cancelled.current) return;
        setError(errorText(err, 'Stepping failed.'));
        setPlaying(false);
      }
    }
    tick();

    return () => {
      cancelled.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [playing]);

  async function act<T>(fn: () => Promise<T>, onOk: (v: T) => void, fallback: string) {
    setBusy(true);
    setError('');
    try {
      onOk(await fn());
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const handleStart = (body: BotStartBody) =>
    act(() => startBot(body), apply, 'Could not start the bot.');

  const handleStep = () =>
    act(() => stepBot({ bars: 1 }), setSnap, 'Stepping failed.');

  const handleSkip = () =>
    act(() => stepBot({ to_end: true }), setSnap, 'Stepping failed.');

  const handleReset = () => {
    setPlaying(false);
    return act(() => resetBot(), apply, 'Could not reset the bot.');
  };

  const togglePlay = async () => {
    if (playing) {
      setPlaying(false);
      await act(() => setBotRunning(false), setSnap, 'Could not pause.');
      return;
    }
    setError('');
    try {
      setSnap(await setBotRunning(true));
    } catch (err) {
      setError(errorText(err, 'Could not start playing.'));
      return;
    }
    setPlaying(true);
  };

  /* ── Header, always rendered ─────────────────────────────────────────── */
  const status = snap ? STATUS[snap.status] : null;
  const header = (
    <div className="flex items-center gap-2 flex-wrap">
      {status && (
        <Badge color={status.color}>
          {snap?.status === 'running' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
          )}
          {status.label}
        </Badge>
      )}
      {/* Both of these come from the server. The UI is not asserting them. */}
      <Badge color="gray">
        <Lock className="w-3 h-3 mr-1" />
        paper only — no broker connected
      </Badge>
      <Badge color="purple">
        <FlaskConical className="w-3 h-3 mr-1" />
        historical replay
      </Badge>
    </div>
  );

  if (loading) {
    return (
      <Card title="AI Trading Bot" action={header}>
        <div className="py-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="AI Trading Bot"
      subtitle="Evidence-scored paper desk. Every proposal, veto and fill is shown with the numbers behind it."
      action={header}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {!snap && defaults && (
        <StartForm defaults={defaults} onStart={handleStart} starting={busy} />
      )}

      {snap && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={togglePlay}
              disabled={busy || snap.session.up_to_date || snap.halted}
              variant={playing ? 'secondary' : 'primary'}
              size="sm"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button
              onClick={handleStep}
              disabled={busy || playing || snap.session.up_to_date || snap.halted}
              variant="secondary"
              size="sm"
            >
              <StepForward className="w-4 h-4" />
              Step one day
            </Button>
            <Button
              onClick={handleSkip}
              disabled={busy || playing || snap.session.up_to_date || snap.halted}
              variant="secondary"
              size="sm"
              loading={busy && !playing}
            >
              <ChevronsRight className="w-4 h-4" />
              Skip to {snap.session.last_bar}
            </Button>
            <Button onClick={handleReset} disabled={busy} variant="ghost" size="sm">
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>

            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {snap.session.as_of
                    ? `Bar ${snap.session.bars_done} of ${snap.session.bars_total} · as of ${snap.session.as_of}`
                    : `Ready at ${snap.session.first_bar}`}
                </span>
                {snap.session.next_bar && <span>next {snap.session.next_bar}</span>}
              </div>
              <div className="h-1 mt-1 rounded-full bg-gray-900/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{
                    width: `${(snap.session.bars_done / snap.session.bars_total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {snap.halted && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-sm text-red-200 flex gap-2">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                The bot is stopped: equity fell{' '}
                {pct(Math.abs(snap.risk.cascade.drawdown_pct))} from its peak, which
                trips the full-stop breaker. On a real desk this writes a block
                file that only a human may remove after a written review — there
                is no code path that clears it. Reset to start a new session.
              </span>
            </div>
          )}

          {/* Headline numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              label="Equity"
              value={money2(snap.account.equity)}
              sub={`${money(snap.account.cash)} cash`}
              tooltip={
                'Cash plus the marked value of open positions, after this bar\'s fills.' +
                (snap.account.costs_this_bar
                  ? ` The chart marks each bar before its own trades, so its last point is ${money2(snap.account.marked_equity)} — ${money2(snap.account.costs_this_bar)} higher, being what those trades cost.`
                  : '')
              }
            />
            <StatCard
              label="Net P&L"
              value={signedMoney(snap.account.net_profit)}
              sub={signed(snap.account.return_pct)}
              color={snap.account.net_profit >= 0 ? 'green' : 'red'}
              tooltip="Includes unrealised profit on open positions, which a real exit would pay costs to collect."
            />
            <StatCard
              label={`vs buy & hold ${snap.settings.benchmark_symbol}`}
              value={
                snap.performance?.benchmark
                  ? signed(
                      snap.performance.benchmark.strategy_total_return -
                        snap.performance.benchmark.benchmark_total_return,
                    )
                  : '—'
              }
              sub={
                snap.performance?.benchmark
                  ? `bot ${signed(snap.performance.benchmark.strategy_total_return)} · index ${signed(snap.performance.benchmark.benchmark_total_return)}`
                  : 'needs a few more bars'
              }
              color={
                snap.performance?.benchmark
                  ? snap.performance.benchmark.beat_benchmark ? 'green' : 'red'
                  : 'default'
              }
              tooltip="The only comparison that makes an absolute return figure mean anything: the same cash, the same bars, the same costs, buying the index instead."
            />
            <StatCard
              label="Open positions"
              value={`${snap.positions.length} / ${snap.risk.limits.max_positions}`}
              sub={`${pct(snap.account.exposure_pct)} gross exposure`}
              tooltip="The desk sits in cash whenever nothing clears the entry threshold. Gross exposure counts a short's notional the same as a long's, so it can pass 100% of equity without leverage."
            />
            <StatCard
              label="Closed trades"
              value={String(snap.performance?.broker.closed_trades ?? 0)}
              sub={
                snap.performance?.broker.closed_trades
                  ? `${pct(snap.performance.broker.win_rate)} won · ${money2(snap.account.total_costs)} costs paid`
                  : 'none yet'
              }
              tooltip="Win rate alone says little — a high win rate with a poor profit factor still loses money."
            />
          </div>

          {/* Regime + provenance strip */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400">
            <Activity className="w-3.5 h-3.5" />
            <span>Market regime</span>
            <Badge color={REGIME_COLOR[snap.regime.label ?? 'unknown'] ?? 'gray'}>
              {snap.regime.label ?? 'unknown'}
            </Badge>
            <span
              title={`The gate refuses a regime that has not held for ${snap.regime.min_stability} bars, so the bot sitting still during a transition is it behaving, not failing.`}
            >
              held {snap.regime.stability} bar{snap.regime.stability === 1 ? '' : 's'}
              {!snap.regime.tradable && (
                <span className="text-amber-400">
                  {' '}— too unstable to trade
                </span>
              )}
            </span>
            {snap.regime.weights && (
              <span className="text-gray-600">
                weights:{' '}
                {Object.entries(snap.regime.weights)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(' · ')}
              </span>
            )}
            <span className="text-gray-600">·</span>
            <span>prices {snap.data_source}</span>
            <span>news {snap.news_source}</span>
            {snap.news_is_synthetic && <Badge color="yellow">synthetic news</Badge>}
          </div>

          <BotEquityChart
            data={snap.equity_curve}
            benchmarkSymbol={snap.settings.benchmark_symbol}
          />

          {/* Two columns */}
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="space-y-5">
              <section>
                <h4 className="text-sm font-semibold text-gray-100 mb-2">
                  Open positions
                </h4>
                <BotPositions snap={snap} />
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-100 mb-1">
                  Queued for the next bar
                </h4>
                <p className="text-xs text-gray-500 mb-2">
                  Scored on {snap.session.as_of ?? 'the last bar'}, fills at the
                  following close. Nothing acts on the price that produced it.
                </p>
                <BotQueue snap={snap} />
              </section>

              {snap.closed_trades.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-gray-100 mb-2">
                    Recently closed
                  </h4>
                  <ul className="space-y-1">
                    {snap.closed_trades.slice(0, 6).map((t, i) => (
                      <li
                        key={`${t.symbol}-${t.closed}-${i}`}
                        className="flex items-center justify-between text-xs py-1 border-b border-gray-800 last:border-0"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-gray-200">{t.symbol}</span>
                          <span className="text-gray-500">{t.reason.replace(/_/g, ' ')}</span>
                          <span className="text-gray-600">{t.holding_days}d</span>
                        </span>
                        <span
                          className={`tabular-nums shrink-0 ${
                            t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {signedMoney(t.pnl)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="space-y-5">
              <section>
                <h4 className="text-sm font-semibold text-gray-100 mb-2">
                  Risk cascade, live
                </h4>
                <BotRiskPanel snap={snap} />
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-100 mb-1">
                  Decision journal
                </h4>
                <p className="text-xs text-gray-500 mb-1">
                  Newest first. Expand a row for the evidence that produced the
                  score, or the risk check that refused it.
                </p>
                <BotActivity snap={snap} />
              </section>
            </div>
          </div>

          {/* Caveats. Not a footnote — the point of the panel. */}
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5" />
              What this is and is not
            </p>
            <ul className="space-y-1.5">
              {snap.caveats.map((c, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-2">
                  <span className="text-gray-600 shrink-0">—</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800 flex items-start gap-1.5">
              <Bot className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {snap.disclaimer}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
