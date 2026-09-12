import { useMemo, useState } from 'react';
import { BookmarkPlus, Check, Download } from 'lucide-react';
import type { BacktestPoint, SimulationResult } from '../types';
import { Card } from './ui/Card';
import { Delta } from './ui/Delta';
import { Segmented } from './ui/Segmented';
import { Button } from './ui/Button';
import { BacktestChart } from './charts/BacktestChart';
import { MonteCarloChart } from './charts/MonteCarloChart';
import { AllocationChart } from './charts/AllocationChart';
import { DrawdownChart } from './charts/DrawdownChart';
import { moneyFull, pct } from './charts/tokens';
import { saveScenario } from '../api/scenarios';

interface Props {
  result: SimulationResult;
}

const METRIC_TOOLTIPS: Record<string, string> = {
  cagr: 'Compound Annual Growth Rate — the smoothed annual return over the full backtest period.',
  volatility: 'Annualized standard deviation of daily returns. Higher = more price swings.',
  sharpe: 'Return per unit of total risk (3% risk-free rate). Above 1.0 is considered good.',
  sortino: 'Like Sharpe but only penalizes downside volatility. Better measure for most investors.',
  max_drawdown: 'Worst peak-to-trough decline. If this keeps you up at night, go more conservative.',
  calmar: 'CAGR divided by max drawdown. Measures return earned per unit of worst-case loss.',
  var_95: 'Value at Risk: worst 5% of daily return outcomes.',
  fees: 'Total expense-ratio and advisory drag paid across the backtest period.',
};

type Window = '1Y' | '3Y' | '5Y' | 'ALL';
const WINDOW_YEARS: Record<Window, number | null> = { '1Y': 1, '3Y': 3, '5Y': 5, ALL: null };

/** Trims the series to the trailing window, keeping at least two points. */
function slice(series: BacktestPoint[], win: Window): BacktestPoint[] {
  const years = WINDOW_YEARS[win];
  if (!years || series.length < 3) return series;
  const end = new Date(series[series.length - 1].date);
  const cutoff = new Date(end);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const out = series.filter((p) => new Date(p.date) >= cutoff);
  return out.length >= 2 ? out : series;
}

export function ResultsPanel({ result }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [win, setWin] = useState<Window>('ALL');
  const [hover, setHover] = useState<BacktestPoint | null>(null);

  const { inputs, backtest, projection, allocation } = result;
  const m = backtest.metrics;

  const series = useMemo(() => slice(backtest.series, win), [backtest.series, win]);

  // The hero tracks the cursor. With no cursor it shows the end of the
  // window, which is the number the screen is nominally about.
  const point = hover ?? series[series.length - 1];
  const first = series[0];
  const shown = point?.balance ?? backtest.final_balance;

  // Over the full history, "change" means profit against everything paid in.
  // Over a trailing window it means the move across that window — the same
  // question a period selector asks anywhere else.
  const full = win === 'ALL';
  const changeAbs = full ? shown - (point?.contributed ?? 0) : shown - (first?.balance ?? 0);
  const changeBase = full ? point?.contributed || 1 : first?.balance || 1;
  const changePct = changeAbs / changeBase;

  async function handleSave() {
    setSaving(true);
    try {
      const name = `${inputs.risk_label} — ${moneyFull(inputs.amount)}, ${inputs.horizon_years}yr`;
      await saveScenario({
        name,
        risk_tier: inputs.risk,
        amount: inputs.amount,
        horizon_years: inputs.horizon_years,
        monthly_contribution: inputs.monthly_contribution,
        extra_fee: inputs.extra_fee,
        goal: inputs.goal,
        result_json: result,
      });
      setSaved(true);
    } catch {
      // silent fail — user can retry
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-sim-${inputs.risk}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis: [string, string, string, string][] = [
    ['CAGR', pct(m.cagr), m.cagr >= 0 ? 'text-emerald-400' : 'text-red-400', METRIC_TOOLTIPS.cagr],
    ['Max drawdown', pct(m.max_drawdown), 'text-red-400', METRIC_TOOLTIPS.max_drawdown],
    ['Sharpe', m.sharpe.toFixed(2), 'text-gray-50', METRIC_TOOLTIPS.sharpe],
    ['Volatility', pct(m.volatility), 'text-gray-50', METRIC_TOOLTIPS.volatility],
    ['Fees paid', moneyFull(backtest.fees_paid), 'text-gray-50', METRIC_TOOLTIPS.fees],
  ];

  return (
    <div className="flex flex-col gap-4 rise">
      {/* ── Hero ──────────────────────────────────────────────────────────
          The value, its change, and the line that produced it, in one
          uninterrupted block. Scrubbing the chart drives the figure. */}
      <section className="bg-gray-900 rounded-lg border border-gray-700/70 overflow-hidden">
        <div className="px-5 pt-5 pb-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="eyebrow">Portfolio value</p>
              <span className="text-[0.6875rem] text-gray-600 mono">
                {hover ? point.date : `${result.history_start} → ${result.history_end}`}
              </span>
            </div>
            <p className="figure figure-xl text-gray-50 mt-1.5">{moneyFull(shown)}</p>
            <div className="flex items-center gap-2.5 mt-2">
              <Delta value={changeAbs} pct={changePct} size="md" />
              <span className="text-xs text-gray-500">
                {full ? `on ${moneyFull(point?.contributed ?? 0)} invested` : `past ${win}`}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={handleExport} title="Download raw JSON">
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
              <Button variant="secondary" size="sm" onClick={handleSave} loading={saving} disabled={saved}>
                {saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                {saved ? 'Saved' : 'Save'}
              </Button>
            </div>
            <Segmented
              name="window"
              label="Chart period"
              value={win}
              onChange={setWin}
              options={[
                { value: '1Y', label: '1Y' },
                { value: '3Y', label: '3Y' },
                { value: '5Y', label: '5Y' },
                { value: 'ALL', label: 'ALL' },
              ]}
            />
          </div>
        </div>

        <div className="px-2 pb-3">
          <BacktestChart data={series} onHover={setHover} height={280} showKey={false} />
        </div>

        {/* KPI rail. Hairlines instead of five more bordered boxes — these are
            facets of the number above, not five separate cards. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-gray-700/40 border-t border-gray-700/50">
          {kpis.map(([label, value, tone, tip]) => (
            <div key={label} title={tip} className="bg-gray-900 px-5 py-3.5">
              <p className="eyebrow truncate">{label}</p>
              <p className={`figure figure-md mt-1 ${tone}`}>{value}</p>
            </div>
          ))}
          {/* Closes the trailing hole at 2- and 3-up, where five cells do not
              fill the row and the gap colour would show through. */}
          <div className="bg-gray-900 lg:hidden" aria-hidden />
        </div>
      </section>

      {/* ── Positions + risk ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card
          className="lg:col-span-3"
          title="Positions"
          subtitle={`${allocation.length} holdings · ${pct(result.equity_share, 0)} equity · ${pct(
            result.blended_expense_ratio,
            2,
          )} blended expense ratio`}
        >
          <AllocationChart allocation={allocation} />
        </Card>

        <Card
          className="lg:col-span-2"
          title="Risk & performance"
          subtitle={`Measured over ${result.history_start.slice(0, 4)}–${result.history_end.slice(0, 4)}`}
        >
          <dl className="flex flex-col">
            {(
              [
                ['Sharpe ratio', m.sharpe.toFixed(2), METRIC_TOOLTIPS.sharpe],
                ['Sortino ratio', m.sortino.toFixed(2), METRIC_TOOLTIPS.sortino],
                ['Calmar ratio', m.calmar.toFixed(2), METRIC_TOOLTIPS.calmar],
                ['Volatility', pct(m.volatility), METRIC_TOOLTIPS.volatility],
                ['95% VaR (daily)', pct(m.var_95), METRIC_TOOLTIPS.var_95],
                ['Best year', pct(m.best_year), ''],
                ['Worst year', pct(m.worst_year), ''],
                ['Positive months', pct(m.positive_months, 1), ''],
              ] as [string, string, string][]
            ).map(([label, val, tip]) => {
              // Signed figures get direction colour; ratios stay neutral so
              // the eye is not told that 0.94 is "good".
              const signed = val.startsWith('-') || val.startsWith('−');
              const directional = /year|VaR/i.test(label);
              return (
                <div
                  key={label}
                  title={tip}
                  className="flex items-baseline justify-between gap-4 py-2 border-b border-gray-700/30 last:border-0"
                >
                  <dt className="text-xs text-gray-400">{label}</dt>
                  <dd
                    className={`mono text-sm font-medium ${
                      directional ? (signed ? 'text-red-400' : 'text-emerald-400') : 'text-gray-100'
                    }`}
                  >
                    {val}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>
      </div>

      {/* ── Drawdown ─────────────────────────────────────────────────────── */}
      <Card
        title="Drawdown"
        subtitle="How far below its previous peak the portfolio sat at each point"
        action={
          <div className="text-right">
            <p className="eyebrow">Worst</p>
            <p className="figure figure-md text-red-400 mt-0.5">{pct(m.max_drawdown)}</p>
          </div>
        }
      >
        <DrawdownChart data={backtest.series} />
      </Card>

      {/* ── Forward projection ───────────────────────────────────────────── */}
      <Card
        title="Forward projection"
        subtitle={`${inputs.horizon_years}-year horizon · 2,000 bootstrapped paths`}
        action={
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="eyebrow">Beats what you put in</p>
              <p className="figure figure-md text-emerald-400 mt-0.5">
                {pct(projection.prob_beat_contributions, 1)}
              </p>
            </div>
            {projection.prob_hit_goal !== undefined && (
              <div className="text-right">
                <p className="eyebrow">Hits your goal</p>
                <p className="figure figure-md text-amber-400 mt-0.5">
                  {pct(projection.prob_hit_goal, 1)}
                </p>
              </div>
            )}
          </div>
        }
      >
        <MonteCarloChart projection={projection} goal={inputs.goal} />
      </Card>

      <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-700/40 pt-4">
        {result.disclaimer}
      </p>
    </div>
  );
}
