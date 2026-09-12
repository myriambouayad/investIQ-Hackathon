import { ArrowDownRight, ArrowUpRight, Clock, Scissors } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { money2, num, pct, signedMoney } from '../agent/format';
import type { BotPosition, BotSnapshot } from '../../api/agent';

/** Where a trade sits between its stop and its second target.
 *
 *  Drawn on the trade's own geometry rather than a percentage of price, because
 *  the stop is what the position was sized against: a position 40% of the way
 *  to target is a different thing from one that is up 3%.
 */
function StopTargetTrack({ p }: { p: BotPosition }) {
  const lo = Math.min(p.stop, p.target_2);
  const hi = Math.max(p.stop, p.target_2);
  const span = hi - lo;
  const place = (v: number) =>
    span <= 0 ? 50 : Math.max(0, Math.min(100, ((v - lo) / span) * 100));

  const entry = place(p.entry_price);
  const last = place(p.last_price);
  const t1 = place(p.target_1);
  const winning = p.unrealized >= 0;

  return (
    <div className="relative h-1.5 rounded-full bg-gray-900/80 mt-2" title="Stop → target range">
      <div
        className={`absolute inset-y-0 rounded-full ${winning ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
        style={{
          left: `${Math.min(entry, last)}%`,
          width: `${Math.abs(last - entry)}%`,
        }}
      />
      <span
        className="absolute -top-0.5 w-px h-2.5 bg-gray-500"
        style={{ left: `${t1}%` }}
        title={`Target 1 ${money2(p.target_1)} — partial exit, stop to break-even`}
      />
      <span
        className="absolute -top-1 w-2 h-3.5 rounded-sm bg-gray-200"
        style={{ left: `calc(${last}% - 4px)` }}
        title={`Last ${money2(p.last_price)}`}
      />
    </div>
  );
}

export function BotPositions({ snap }: { snap: BotSnapshot }) {
  const { positions, risk } = snap;

  if (positions.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-3">
        Flat — no open positions. The desk holds cash whenever nothing clears the
        entry threshold or the risk gate refuses what it proposed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((p) => {
        const winning = p.unrealized >= 0;
        return (
          <div key={p.symbol} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-gray-100 text-sm">{p.symbol}</span>
                <Badge color={p.side === 'long' ? 'green' : 'red'}>
                  {p.side === 'long' ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {p.side}
                </Badge>
                <span className="text-xs text-gray-500 tabular-nums">
                  {p.quantity} @ {money2(p.entry_price)}
                </span>
                {p.took_partial && (
                  <Badge color="blue">
                    <Scissors className="w-3 h-3 mr-0.5" />
                    partial taken · stop at break-even
                  </Badge>
                )}
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    winning ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {signedMoney(p.unrealized)}
                </p>
                <p className="text-xs text-gray-500 tabular-nums">
                  {p.r_multiple !== null ? `${num(p.r_multiple, 2)}R` : pct(p.unrealized_pct)}
                </p>
              </div>
            </div>

            <StopTargetTrack p={p} />

            <div className="grid grid-cols-4 gap-2 mt-2 text-xs tabular-nums">
              <div>
                <p className="text-gray-500">Stop</p>
                <p className="text-red-300">{money2(p.stop)}</p>
              </div>
              <div>
                <p className="text-gray-500">Last</p>
                <p className="text-gray-200">{money2(p.last_price)}</p>
              </div>
              <div>
                <p className="text-gray-500">Target 2</p>
                <p className="text-emerald-300">{money2(p.target_2)}</p>
              </div>
              <div>
                <p className="text-gray-500" title="Quantity × distance to stop. The most this position loses if the stop fills at its level.">
                  At risk
                </p>
                <p className="text-gray-200">{money2(p.planned_loss)}</p>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              opened {p.opened} · {p.days_held}d · {p.strategy}
            </p>
          </div>
        );
      })}

      <p className="text-xs text-gray-500 pt-1">
        Total at risk {money2(snap.account.open_risk)} ={' '}
        {pct(snap.account.open_risk_pct)} of equity, against a{' '}
        {pct(risk.open_risk_budget)} budget across all open stops.
      </p>
    </div>
  );
}
