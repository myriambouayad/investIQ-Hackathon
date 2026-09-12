import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { SimulateForm } from '../components/SimulateForm';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { compareAll } from '../api/portfolio';
import type { CompareResult, SimulateFormData, RiskTier, SimulationResult } from '../types';
import { BacktestChart } from '../components/charts/BacktestChart';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Tip } from '../components/charts/chartkit';
import { BARE_AXIS, CURSOR } from '../components/charts/tokens';

/**
 * Risk is an ordered axis, so the tiers get an intensity ramp rather than
 * three unrelated hues — neutral through to the full accent. Reading left to
 * right along the bars is then reading up the risk scale.
 */
const TIER_COLORS: Record<RiskTier, string> = {
  conservative: 'var(--color-gray-500)',
  balanced: 'var(--color-indigo-600)',
  aggressive: 'var(--color-indigo-400)',
};

const TIER_BADGE: Record<RiskTier, 'blue' | 'purple' | 'gray'> = {
  conservative: 'gray',
  balanced: 'blue',
  aggressive: 'purple',
};

function pct(n: number) { return `${(n * 100).toFixed(2)}%`; }
function money(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function MetricsBar({ results }: { results: Record<RiskTier, SimulationResult> }) {
  const tiers: RiskTier[] = ['conservative', 'balanced', 'aggressive'];

  const charts = [
    { key: 'cagr', label: 'CAGR', fmt: pct, fromMetrics: true },
    { key: 'sharpe', label: 'Sharpe Ratio', fmt: (n: number) => n.toFixed(2), fromMetrics: true },
    { key: 'max_drawdown', label: 'Max Drawdown', fmt: pct, fromMetrics: true },
    { key: 'volatility', label: 'Volatility', fmt: pct, fromMetrics: true },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {charts.map(({ key, label, fmt: f }) => {
        const data = tiers.map((t) => ({
          name: results[t].inputs.risk_label,
          value: Math.abs((results[t].backtest.metrics as any)[key]),
          raw: (results[t].backtest.metrics as any)[key],
          tier: t,
        }));
        return (
          <Card key={key} title={label}>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" {...BARE_AXIS} />
                <YAxis
                  {...BARE_AXIS}
                  orientation="right"
                  tickFormatter={(v) => f(key === 'max_drawdown' ? -v : v)}
                  width={48}
                  tickCount={4}
                />
                <Tooltip
                  cursor={{ ...CURSOR, strokeDasharray: undefined, fill: 'var(--color-gray-800)' }}
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <Tip
                        label={payload[0].payload.name}
                        rows={[
                          {
                            name: label,
                            value: f(payload[0].payload.raw),
                            color: TIER_COLORS[payload[0].payload.tier as RiskTier],
                          },
                        ]}
                      />
                    ) : null
                  }
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.tier} fill={TIER_COLORS[d.tier as RiskTier]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        );
      })}
    </div>
  );
}

export default function ComparePage() {
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCompare(data: SimulateFormData) {
    setLoading(true);
    setError('');
    try {
      const res = await compareAll(data);
      setResult(res);
      setTimeout(() => document.getElementById('compare-results')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  }

  const tiers: RiskTier[] = ['conservative', 'balanced', 'aggressive'];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <header className="pb-4 border-b border-gray-800">
          <p className="eyebrow">Comparison desk</p>
          <h1 className="figure figure-lg text-gray-50 mt-1">Three tiers, one set of inputs</h1>
        </header>

        <Card title="Parameters">
          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/25 rounded-md text-xs text-red-300">
              {error}
            </div>
          )}
          <SimulateForm onSubmit={handleCompare} loading={loading} submitLabel="Compare all three" />
        </Card>

        {result && (
          <div id="compare-results" className="flex flex-col gap-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tiers.map((tier) => {
                const r = result.results[tier];
                const m = r.backtest.metrics;
                return (
                  <Card key={tier}>
                    <div className="flex items-center justify-between mb-3">
                      <Badge color={TIER_BADGE[tier]}>{r.inputs.risk_label}</Badge>
                      <span className="text-xs text-gray-500">{(r.equity_share * 100).toFixed(0)}% equity</span>
                    </div>
                    <div className="mb-4">
                      <p className="eyebrow">Median end value</p>
                      <p className="figure figure-lg text-gray-50 mt-1">
                        {money(r.projection.final_p50)}
                      </p>
                    </div>
                    <dl className="flex flex-col text-sm">
                      {(
                        [
                          ['CAGR', pct(m.cagr), 'text-emerald-400'],
                          ['Sharpe', m.sharpe.toFixed(2), 'text-gray-100'],
                          ['Max drawdown', pct(m.max_drawdown), 'text-red-400'],
                          ['Volatility', pct(m.volatility), 'text-gray-100'],
                          ['Fees paid', money(r.backtest.fees_paid), 'text-gray-100'],
                        ] as [string, string, string][]
                      ).map(([k, v, tone]) => (
                        <div
                          key={k}
                          className="flex items-baseline justify-between gap-4 py-1.5 border-b border-gray-700/30 last:border-0"
                        >
                          <dt className="text-xs text-gray-400">{k}</dt>
                          <dd className={`mono text-sm ${tone}`}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                );
              })}
            </div>

            {/* Metrics bar charts */}
            <MetricsBar results={result.results} />

            {/* Backtest overlays */}
            <Card title="Historical balance" subtitle={`All three tiers · data source: ${result.data_source}`}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {tiers.map((tier) => (
                  <div key={tier}>
                    <p className="eyebrow mb-2">{tier}</p>
                    <BacktestChart data={result.results[tier].backtest.series} />
                  </div>
                ))}
              </div>
            </Card>

            <p className="text-xs text-gray-600 text-center">
              {result.results.balanced.disclaimer}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
