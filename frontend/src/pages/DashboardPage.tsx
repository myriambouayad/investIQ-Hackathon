import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { MarketTape } from '../components/MarketTape';
import { SimulateForm } from '../components/SimulateForm';
import { ResultsPanel } from '../components/ResultsPanel';
import { SavingsAdvisor } from '../components/SavingsAdvisor';
import { RiskQuestionnaire } from '../components/RiskQuestionnaire';
import { Card } from '../components/ui/Card';
import { simulate } from '../api/portfolio';
import type { SimulationResult, SimulateFormData } from '../types';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, ChevronDown, LineChart, PiggyBank, Target } from 'lucide-react';

/**
 * A drawer on the control rail.
 *
 * The two side tools used to sit above the form as full-width panels with
 * conversational titles, which pushed the thing the page is for below the
 * fold. They are accessories to the parameters, so they live with them.
 */
function Tool({
  icon: Icon,
  label,
  meta,
  open,
  onToggle,
  children,
}: {
  icon: typeof PiggyBank;
  label: string;
  meta: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700/70 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/60 transition-colors"
      >
        <Icon className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-gray-200">{label}</span>
          <span className="block text-xs text-gray-500 truncate">{meta}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-700/50">{children}</div>}
    </div>
  );
}

/**
 * Before a run there is nothing to plot, and a blank column reads as a
 * loading failure. A ruled, labelled frame says the stage is waiting rather
 * than broken, and names what will land in it.
 */
function EmptyStage() {
  return (
    <div className="bg-gray-900 rounded-lg border border-dashed border-gray-700 px-6 py-16 flex flex-col items-center text-center">
      <LineChart className="w-7 h-7 text-gray-700 mb-4" aria-hidden />
      <p className="text-sm font-medium text-gray-300">No simulation yet</p>
      <p className="text-xs text-gray-500 mt-1.5 max-w-xs leading-relaxed">
        Set your parameters on the left and run. You'll get a historical backtest,
        the allocation behind it, and a forward projection.
      </p>
      <dl className="grid grid-cols-3 gap-px bg-gray-800 border border-gray-800 rounded-md overflow-hidden mt-7 w-full max-w-md">
        {[
          ['Backtest', 'real prices'],
          ['Positions', 'per-ticker'],
          ['Projection', '2,000 paths'],
        ].map(([t, s]) => (
          <div key={t} className="bg-gray-900 px-3 py-2.5">
            <dt className="text-xs font-medium text-gray-400">{t}</dt>
            <dd className="text-[0.6875rem] text-gray-600 mono mt-0.5">{s}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openTool, setOpenTool] = useState<'savings' | 'risk' | null>(null);
  const [recommendedRisk, setRecommendedRisk] = useState<string | null>(null);

  async function handleSimulate(data: SimulateFormData) {
    setLoading(true);
    setError('');
    try {
      const res = await simulate(data);
      setResult(res);
      // On narrow screens the stage sits below the rail, so bring it into view.
      if (window.matchMedia('(max-width: 1023px)').matches) {
        setTimeout(
          () => document.getElementById('stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          100,
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Simulation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const toggle = (t: 'savings' | 'risk') => setOpenTool((cur) => (cur === t ? null : t));

  return (
    <Layout tape={<MarketTape />}>
      {/* ── Desk header ──────────────────────────────────────────────────
          A status line, not a greeting. Who the desk belongs to, where the
          numbers come from, and whether anything has been run yet. */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-4 mb-5 border-b border-gray-800">
        <div>
          <p className="eyebrow">Simulation desk</p>
          <h1 className="figure figure-lg text-gray-50 mt-1">
            {user?.username ?? 'investor'}
          </h1>
        </div>
        <dl className="flex items-center gap-5 text-xs">
          <div>
            <dt className="eyebrow">Source</dt>
            <dd className="mono text-gray-200 mt-0.5">{result?.data_source ?? '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">Window</dt>
            <dd className="mono text-gray-200 mt-0.5">
              {result ? `${result.history_start.slice(0, 4)}–${result.history_end.slice(0, 4)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Status</dt>
            <dd className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  loading
                    ? 'bg-amber-400 live-dot'
                    : result
                      ? 'bg-emerald-400'
                      : 'bg-gray-600'
                }`}
                aria-hidden
              />
              <span className="text-gray-200">
                {loading ? 'Running' : result ? 'Complete' : 'Idle'}
              </span>
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] gap-4 items-start">
        {/* ── Control rail ─────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-[4.5rem]">
          <Card title="Parameters">
            {error && (
              <div
                role="alert"
                className="mb-4 flex gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-md text-xs text-red-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            {recommendedRisk && (
              <div className="mb-4 p-3 rounded-md border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 text-xs text-gray-300">
                Questionnaire suggests{' '}
                <strong className="text-[var(--color-accent)] capitalize font-semibold">
                  {recommendedRisk}
                </strong>
                . Select it below to use it.
              </div>
            )}

            <SimulateForm onSubmit={handleSimulate} loading={loading} layout="rail" />
          </Card>

          <Tool
            icon={PiggyBank}
            label="Savings capacity"
            meta="What you can afford to invest monthly"
            open={openTool === 'savings'}
            onToggle={() => toggle('savings')}
          >
            <SavingsAdvisor />
          </Tool>

          <Tool
            icon={Target}
            label="Risk profile"
            meta="Five questions, one recommended tier"
            open={openTool === 'risk'}
            onToggle={() => toggle('risk')}
          >
            <RiskQuestionnaire
              onResult={(tier) => {
                setRecommendedRisk(tier);
                setOpenTool(null);
              }}
            />
          </Tool>
        </aside>

        {/* ── Stage ────────────────────────────────────────────────────── */}
        <div id="stage" className="min-w-0">
          {result ? <ResultsPanel result={result} /> : <EmptyStage />}
        </div>
      </div>
    </Layout>
  );
}
