import { Ban, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { money2, pct, signed } from '../agent/format';
import type { BotSnapshot } from '../../api/agent';

/** The risk cascade as it stands on the current bar, not as documented.
 *
 *  Each row shows the live number against the threshold that would fire, so the
 *  reader can see how close the desk is to being throttled rather than only
 *  learning about it after the fact. The thresholds come from the API, which
 *  reads them from `trading/policy.py` — the one place they are defined.
 */
const ACTION_LOOK: Record<
  BotSnapshot['risk']['action'],
  { color: 'green' | 'yellow' | 'red'; label: string; Icon: typeof ShieldCheck }
> = {
  normal: { color: 'green', label: 'Normal — full size', Icon: ShieldCheck },
  half_size: { color: 'yellow', label: 'Half size', Icon: ShieldAlert },
  no_new_entries: { color: 'yellow', label: 'No new entries', Icon: ShieldAlert },
  flatten: { color: 'red', label: 'Flatten — close everything', Icon: TriangleAlert },
  blocked: { color: 'red', label: 'Blocked — full stop', Icon: Ban },
};

function Gauge({
  label,
  value,
  trigger,
  note,
}: {
  label: string;
  value: number;
  trigger: number;
  note: string;
}) {
  // How far the loss has travelled toward the threshold that fires.
  const travelled = value >= 0 ? 0 : Math.min(100, (value / trigger) * 100);
  const fired = value <= trigger;
  return (
    <div title={note}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span
          className={`tabular-nums ${
            fired ? 'text-red-400 font-semibold' : value < 0 ? 'text-amber-400' : 'text-gray-300'
          }`}
        >
          {signed(value)}
          <span className="text-gray-600"> / {pct(trigger)}</span>
        </span>
      </div>
      <div className="h-1 mt-1 rounded-full bg-gray-900/80 overflow-hidden">
        <div
          className={`h-full rounded-full ${fired ? 'bg-red-500' : 'bg-amber-500/70'}`}
          style={{ width: `${travelled}%` }}
        />
      </div>
    </div>
  );
}

export function BotRiskPanel({ snap }: { snap: BotSnapshot }) {
  const { risk } = snap;
  const look = ACTION_LOOK[risk.action] ?? ACTION_LOOK.normal;
  const { Icon } = look;
  const vetoes = Object.entries(risk.vetoes);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon
          className={`w-4 h-4 ${
            look.color === 'green'
              ? 'text-emerald-400'
              : look.color === 'yellow'
                ? 'text-amber-400'
                : 'text-red-400'
          }`}
        />
        <Badge color={look.color}>{look.label}</Badge>
        {risk.size_multiplier !== 1 && (
          <span className="text-xs text-gray-400">
            sizing × {risk.size_multiplier}
          </span>
        )}
        {risk.blocks_new_entries && (
          <span className="text-xs text-red-300">new entries refused</span>
        )}
      </div>

      {risk.active_breakers.length > 0 && (
        <ul className="space-y-1">
          {risk.active_breakers.map((b) => (
            <li key={b.name} className="text-xs text-red-300">
              <span className="font-mono">{b.name}</span> — {b.detail}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2.5">
        <Gauge
          label="Today"
          value={risk.cascade.daily_pct}
          trigger={risk.thresholds.daily_half_size}
          note={`At or below ${pct(risk.thresholds.daily_half_size)} in a day halves size; strictly below ${pct(risk.thresholds.daily_flatten)} flattens the book.`}
        />
        <Gauge
          label="This week"
          value={risk.cascade.weekly_pct}
          trigger={risk.thresholds.weekly_half_size}
          note={`At or below ${pct(risk.thresholds.weekly_half_size)} halves size; at or below ${pct(risk.thresholds.weekly_stop)} refuses new entries.`}
        />
        <Gauge
          label="This month"
          value={risk.cascade.monthly_pct}
          trigger={risk.thresholds.monthly_stop}
          note={`At or below ${pct(risk.thresholds.monthly_stop)} in a month refuses new entries.`}
        />
        <Gauge
          label="From peak"
          value={risk.cascade.drawdown_pct}
          trigger={risk.thresholds.peak_drawdown_block}
          note={`At or below ${pct(risk.thresholds.peak_drawdown_block)} from peak equity is a full stop. In a live deployment this writes state/TRADING_BLOCKED, which only a human may remove.`}
        />
      </div>

      <div className="pt-3 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400" title="Summed planned loss across every open stop.">
            Open risk
          </span>
          <span className="tabular-nums text-gray-300">
            {pct(risk.open_risk_used_pct)}
            <span className="text-gray-600"> / {pct(risk.open_risk_budget)} budget</span>
          </span>
        </div>
        <div className="h-1 mt-1 rounded-full bg-gray-900/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{
              width: `${Math.min(100, (risk.open_risk_used_pct / risk.open_risk_budget) * 100)}%`,
            }}
          />
        </div>
      </div>

      <div className="pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-400 mb-1.5">
          Refused by the gate — {risk.veto_total} in this session
        </p>
        {vetoes.length === 0 ? (
          <p className="text-xs text-gray-500">Nothing refused yet.</p>
        ) : (
          <ul className="space-y-1">
            {vetoes.map(([code, n]) => (
              <li key={code} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-mono truncate">{code}</span>
                <span className="text-gray-300 tabular-nums ml-2">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {risk.breaker_events.length > 0 && (
        <div className="pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-1.5">Breakers that fired</p>
          <ul className="space-y-1.5">
            {risk.breaker_events.slice(-5).reverse().map((ev, i) => (
              <li key={`${ev.date}-${i}`} className="text-xs">
                <span className="text-gray-500 tabular-nums">{ev.date}</span>{' '}
                <Badge color="red">{ev.action}</Badge>{' '}
                <span className="text-gray-400">
                  {ev.detail} — equity {money2(ev.equity)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-600 pt-2 border-t border-gray-700">
        Limits: {pct(risk.limits.risk_per_trade)} risk per trade ·{' '}
        {pct(risk.limits.max_concentration)} max in one name ·{' '}
        {risk.limits.max_positions} positions · {risk.limits.min_risk_reward}R minimum
        reward.
        <br />
        <span className="font-mono">
          policy {risk.policy_hash.slice(0, 8)} · weights {risk.weights_version}{' '}
          {risk.weights_hash.slice(0, 8)}
        </span>
      </p>
    </div>
  );
}
