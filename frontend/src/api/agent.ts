import api from './client';

/** One weighted input to a decision. Contributions sum exactly to raw_score. */
export interface Evidence {
  name: string;
  raw: number;
  weight: number;
  contribution: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  note: string;
}

export interface NewsDriver {
  text: string;
  published_at: string;
  source: string;
  polarity: number;
  decay: number;
  contribution: number;
  matched_terms: string;
}

export interface NewsScore {
  symbol: string;
  as_of: string;
  value: number;
  raw_value: number;
  coverage: number;
  source: string;
  thin_coverage: boolean;
  lexicon_version: string;
  drivers: NewsDriver[];
}

export interface Intent {
  symbol: string;
  side: 'long' | 'short';
  entry: number;
  stop: number;
  target_1: number;
  target_2: number;
  stop_distance: number;
  risk_reward: number;
  strategy: string;
  invalidation: string;
}

export interface Proposal {
  symbol: string;
  as_of: string;
  regime: string;
  regime_stability: number;
  raw_score: number;
  conviction: number;
  score: number;
  action: 'long' | 'short' | 'flat';
  evidence: Evidence[];
  rationale: string;
  weights_version: string;
  weights_hash: string;
  intent?: Intent;
  news?: NewsScore;
  skip_reason?: string;
}

export interface ScanResult {
  date: string;
  regime: string;
  regime_stability: number;
  regime_weights: Record<string, number> | null;
  news_source: string;
  news_is_synthetic: boolean;
  proposals: Proposal[];
  actionable: number;
  weights_hash: string;
  policy_hash: string;
  live_trading_supported: boolean;
  disclaimer: string;
}

export interface AgentConfig {
  live_trading_supported: boolean;
  weights_version: string;
  weights_hash: string;
  policy_hash: string;
  entry_threshold: number;
  short_threshold: number;
  stop_atr_multiple: number;
  target_risk_reward: number;
  max_chase_atr: number;
  regime_weights: Record<string, Record<string, number>>;
  features: { name: string; description: string }[];
  risk_limits: {
    risk_per_trade: number;
    max_concentration: number;
    max_open_risk: number;
    max_positions: number;
    min_risk_reward: number;
  };
  default_costs: Record<string, number>;
  disclaimer: string;
}

export interface Metrics {
  cagr: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  max_drawdown: number;
  calmar: number;
  best_year: number;
  worst_year: number;
  positive_months: number;
  var_95: number;
}

export interface BenchmarkComparison {
  strategy: Metrics;
  benchmark: Metrics;
  strategy_total_return: number;
  benchmark_total_return: number;
  excess_cagr: number;
  alpha_annualized: number;
  beta: number;
  tracking_error: number;
  information_ratio: number | null;
  up_capture: number | null;
  down_capture: number | null;
  drawdown_advantage: number;
  beat_benchmark: boolean;
}

export interface Significance {
  sharpe_per_period: number;
  sharpe_annualized: number;
  skew?: number;
  kurtosis?: number;
  n_observations: number;
  n_trials: number;
  threshold_sharpe: number | null;
  threshold_sharpe_annualized?: number;
  deflated_sharpe: number | null;
  verdict: string;
}

export interface BacktestReport {
  window: { start: string; end: string; bars: number; years: number };
  config: Record<string, unknown>;
  news_source: string;
  broker: {
    initial_cash: number;
    final_equity: number;
    net_profit: number;
    return_pct: number;
    closed_trades: number;
    win_rate: number;
    profit_factor: number | null;
    avg_win: number;
    avg_loss: number;
    total_costs: number;
    borrow_paid: number;
    cost_drag_pct: number;
    open_positions: number;
    live_trading_supported: boolean;
  };
  metrics: Metrics | null;
  benchmark: BenchmarkComparison;
  significance: Significance;
  risk: {
    policy_hash: string;
    weights_hash: string;
    vetoes: Record<string, number>;
    veto_total: number;
    breaker_events: {
      date: string; action: string; breakers: string[];
      detail: string; equity: number;
    }[];
  };
  equity_curve: { date: string; strategy: number; benchmark: number }[];
  caveats: string[];
  disclaimer: string;
  journal_summary?: Record<string, number>;
  recent_decisions?: Record<string, unknown>[];
}

export interface WalkForwardReport {
  split: string;
  in_sample: BacktestReport;
  out_of_sample: BacktestReport;
  reading_guide: string;
  disclaimer: string;
}

export interface BacktestRequest {
  start?: string;
  end?: string;
  initial_cash?: number;
  benchmark_symbol?: string;
  max_new_per_bar?: number;
  use_news?: boolean;
  n_trials?: number;
  commission_per_share?: number;
  commission_min?: number;
  half_spread_bps?: number;
  slippage_bps?: number;
  annual_borrow_rate?: number;
}

export interface RegimeHistory {
  symbol: string;
  series: { date: string; regime: string; stability: number }[];
  current: string;
  current_stability: number;
  counts: Record<string, number>;
  min_stability_to_trade: number;
}

export async function getAgentConfig(): Promise<AgentConfig> {
  const res = await api.get<AgentConfig>('/agent/config');
  return res.data;
}

export async function scan(body: Record<string, unknown> = {}): Promise<ScanResult> {
  const res = await api.post<ScanResult>('/agent/scan', body);
  return res.data;
}

export async function backtest(body: BacktestRequest = {}): Promise<BacktestReport> {
  const res = await api.post<BacktestReport>('/agent/backtest', body);
  return res.data;
}

export async function walkForward(
  body: BacktestRequest & { split?: string } = {},
): Promise<WalkForwardReport> {
  const res = await api.post<WalkForwardReport>('/agent/walk-forward', body);
  return res.data;
}

export async function getRegimeHistory(days = 180): Promise<RegimeHistory> {
  const res = await api.get<RegimeHistory>(`/agent/regime?days=${days}`);
  return res.data;
}

// ── The bot ──────────────────────────────────────────────────────────────────
// A live session of the same desk, advanced one bar at a time. `mode` is always
// "replay" and `live_trading_supported` always false — both come from the
// server so the UI never has to assert it on its own authority.

export interface BotSettings {
  initial_cash: number;
  symbols: string[] | null;
  benchmark_symbol: string;
  max_new_per_bar: number;
  use_news: boolean;
  session_bars: number;
  costs: Record<string, number | boolean>;
}

export interface BotSession {
  first_bar: string;
  last_bar: string;
  as_of: string | null;
  next_bar: string | null;
  bars_total: number;
  bars_done: number;
  bars_remaining: number;
  up_to_date: boolean;
}

export interface BotAccount {
  initial_cash: number;
  cash: number;
  /** The live account after this bar's fills — what the positions table sums to. */
  equity: number;
  /** The curve's last point: yesterday's book at today's close, before today's
   *  fills. This is the series returns and the benchmark comparison use. */
  marked_equity: number;
  /** marked_equity − equity: the spread and commission this bar's trades paid. */
  costs_this_bar: number;
  net_profit: number;
  return_pct: number;
  peak_equity: number;
  drawdown_pct: number;
  exposure: number;
  exposure_pct: number;
  open_risk: number;
  open_risk_pct: number;
  total_costs: number;
  borrow_paid: number;
}

export interface BotPosition {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entry_price: number;
  last_price: number;
  stop: number;
  target_1: number;
  target_2: number;
  market_value: number;
  unrealized: number;
  unrealized_pct: number;
  planned_loss: number;
  r_multiple: number | null;
  took_partial: boolean;
  opened: string;
  days_held: number;
  strategy: string;
}

export interface BotClosedTrade {
  symbol: string;
  side: string;
  opened: string;
  closed: string;
  holding_days: number;
  quantity: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  costs: number;
  reason: string;
  strategy: string;
}

/** A journal entry. Proposals, vetoes and fills all land here. */
export interface BotActivity {
  date: string;
  symbol: string;
  stage: 'proposal' | 'risk_gate' | 'execution';
  outcome: 'proposed' | 'vetoed' | 'cancelled' | 'filled';
  code: string;
  detail: string;
  score?: number;
  raw_score?: number;
  conviction?: number;
  regime?: string;
  action?: string;
  rationale?: string;
  evidence?: Evidence[];
  news?: NewsScore;
  quantity?: number;
  planned_loss?: number;
  checks?: { name: string; passed: boolean; code: string }[];
}

export interface BotRisk {
  action: 'normal' | 'half_size' | 'no_new_entries' | 'flatten' | 'blocked';
  active_breakers: { name: string; action: string; detail: string }[];
  blocks_new_entries: boolean;
  size_multiplier: number;
  cascade: {
    daily_pct: number;
    weekly_pct: number;
    monthly_pct: number;
    drawdown_pct: number;
  };
  vetoes: Record<string, number>;
  veto_total: number;
  breaker_events: {
    date: string; action: string; breakers: string[]; detail: string; equity: number;
  }[];
  open_risk_budget: number;
  open_risk_used_pct: number;
  /** The cascade's trigger levels, served from trading/policy.py so the
   *  gauges can never drift from the thresholds that actually fire. */
  thresholds: {
    daily_half_size: number;
    daily_flatten: number;
    weekly_half_size: number;
    weekly_stop: number;
    monthly_stop: number;
    peak_drawdown_block: number;
  };
  limits: AgentConfig['risk_limits'];
  policy_hash: string;
  weights_hash: string;
  weights_version: string;
}

export interface BotRegime {
  label: string | null;
  stability: number;
  weights: Record<string, number> | null;
  tradable: boolean;
  min_stability: number;
}

export interface BotSnapshot {
  exists: true;
  mode: 'replay';
  ephemeral: boolean;
  live_trading_supported: boolean;
  status: 'idle' | 'running' | 'paused' | 'up_to_date' | 'halted';
  running: boolean;
  halted: boolean;
  settings: BotSettings;
  universe: string[];
  data_source: string;
  news_source: string;
  news_is_synthetic: boolean;
  created_at: string;
  stepped_at: string | null;
  session: BotSession;
  account: BotAccount;
  regime: BotRegime;
  positions: BotPosition[];
  /** Intents waiting for the next bar's close. They carry no quantity: sizing
   *  is the risk gate's decision on the bar that executes them. */
  queue: (Proposal & { will_execute_on: string | null })[];
  activity: BotActivity[];
  journal_summary: Record<string, number>;
  closed_trades: BotClosedTrade[];
  performance: {
    broker: BacktestReport['broker'];
    benchmark: BenchmarkComparison | null;
    benchmark_symbol?: string;
    bars?: number;
  } | null;
  risk: BotRisk;
  equity_curve: { date: string; strategy: number; benchmark: number | null }[];
  caveats: string[];
  disclaimer: string;
  bars_taken?: number;
}

export interface BotDefaults {
  exists: false;
  mode: 'replay';
  ephemeral: boolean;
  live_trading_supported: boolean;
  universe: string[];
  data_source: string;
  defaults: BotSettings & { advance: number } & Record<string, number>;
  session_bars_range: [number, number];
  max_step_bars: number;
  first_bar: string;
  last_bar: string;
  risk_limits: AgentConfig['risk_limits'];
  disclaimer: string;
}

export type BotState = BotSnapshot | BotDefaults;

export interface BotStartBody {
  initial_cash?: number;
  symbols?: string[] | null;
  benchmark_symbol?: string;
  max_new_per_bar?: number;
  use_news?: boolean;
  session_bars?: number;
  advance?: number;
  commission_per_share?: number;
  commission_min?: number;
  half_spread_bps?: number;
  slippage_bps?: number;
  annual_borrow_rate?: number;
}

export async function getBot(): Promise<BotState> {
  const res = await api.get<BotState>('/agent/bot');
  return res.data;
}

export async function startBot(body: BotStartBody = {}): Promise<BotSnapshot> {
  const res = await api.post<BotSnapshot>('/agent/bot/start', body);
  return res.data;
}

/** Advance the bot. `bars_taken` may be less than asked at the end of a
 *  session, or when the drawdown breaker halts the desk mid-chunk. */
export async function stepBot(
  body: { bars?: number; to_end?: boolean } = {},
): Promise<BotSnapshot> {
  const res = await api.post<BotSnapshot>('/agent/bot/step', body);
  return res.data;
}

export async function setBotRunning(running: boolean): Promise<BotSnapshot> {
  const res = await api.post<BotSnapshot>('/agent/bot/run', { running });
  return res.data;
}

export async function resetBot(): Promise<BotDefaults> {
  const res = await api.delete<BotDefaults>('/agent/bot');
  return res.data;
}
