import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock3 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { EvidenceWaterfall } from '../agent/EvidenceWaterfall';
import { money2, num } from '../agent/format';
import type { BotSnapshot } from '../../api/agent';

/** The intents waiting for the next bar's close.
 *
 *  This is the bot's intent made visible before it acts, which is the whole
 *  reason the execution lag exists. Note the absence of a share count: the
 *  proposal genuinely has none. Size is computed by the risk gate on the bar
 *  that fills it, from the stop distance and the equity it finds there, so a
 *  queue that printed a quantity here would be inventing one.
 */
export function BotQueue({ snap }: { snap: BotSnapshot }) {
  const [open, setOpen] = useState<string | null>(null);

  if (snap.queue.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-3">
        Nothing queued. On the last bar it scored, no symbol cleared the entry
        threshold — or the regime was too unstable for the gate to allow one.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {snap.queue.map((p) => {
        const expanded = open === p.symbol;
        const long = p.action === 'long';
        return (
          <div key={p.symbol} className="rounded-lg border border-gray-700 bg-gray-900/40">
            <button
              onClick={() => setOpen(expanded ? null : p.symbol)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-800/60 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                )}
                <span className="font-semibold text-sm text-gray-100">{p.symbol}</span>
                <Badge color={long ? 'green' : 'red'}>{p.action}</Badge>
                <span className="text-xs text-gray-500 tabular-nums">
                  score {p.score >= 0 ? '+' : ''}{num(p.score, 3)}
                </span>
              </div>
              <span className="text-xs text-gray-500 shrink-0 flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {p.will_execute_on ? `fills ${p.will_execute_on}` : 'awaiting next bar'}
              </span>
            </button>

            {expanded && (
              <div className="px-3 pb-3 space-y-3">
                {p.intent && (
                  <div className="grid grid-cols-4 gap-2 text-xs tabular-nums pt-1">
                    <div>
                      <p className="text-gray-500">Entry (signal)</p>
                      <p className="text-gray-200">{money2(p.intent.entry)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Stop</p>
                      <p className="text-red-300">{money2(p.intent.stop)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Target 2</p>
                      <p className="text-emerald-300">{money2(p.intent.target_2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Reward</p>
                      <p className="text-gray-200">{num(p.intent.risk_reward, 2)}R</p>
                    </div>
                  </div>
                )}
                <EvidenceWaterfall
                  evidence={p.evidence}
                  rawScore={p.raw_score}
                  conviction={p.conviction}
                  score={p.score}
                />
                {p.intent && (
                  <p className="text-xs text-gray-500">
                    Invalidated if: {p.intent.invalidation}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Size is not part of this proposal. The risk gate computes it on
                  the bar that fills it, then caps it by the breaker multiplier,
                  buying power, concentration and the open-risk budget.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
