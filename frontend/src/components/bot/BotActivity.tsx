import { useState } from 'react';
import {
  Ban, CheckCircle2, ChevronDown, ChevronRight, CircleSlash, Lightbulb,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { EvidenceWaterfall } from '../agent/EvidenceWaterfall';
import { money2, num } from '../agent/format';
import type { BotActivity as Entry, BotSnapshot } from '../../api/agent';

/** The journal, newest first.
 *
 *  Vetoes are shown alongside fills rather than hidden behind them. If the gate
 *  refused four fifths of what the desk wanted to do, the equity curve belongs
 *  to the gate and not to the strategy, and a feed that only listed fills would
 *  hide exactly that.
 */
const LOOK: Record<
  Entry['outcome'],
  { color: 'green' | 'red' | 'yellow' | 'gray' | 'blue'; Icon: typeof Ban; label: string }
> = {
  filled: { color: 'green', Icon: CheckCircle2, label: 'filled' },
  vetoed: { color: 'red', Icon: Ban, label: 'vetoed by risk gate' },
  cancelled: { color: 'yellow', Icon: CircleSlash, label: 'cancelled' },
  proposed: { color: 'blue', Icon: Lightbulb, label: 'proposed' },
};

function Row({ e }: { e: Entry }) {
  const [open, setOpen] = useState(false);
  const look = LOOK[e.outcome] ?? LOOK.proposed;
  const { Icon } = look;
  const hasDetail = Boolean(e.evidence?.length || e.checks?.length);

  return (
    <li className="border-b border-gray-800 last:border-0">
      <button
        onClick={() => hasDetail && setOpen(!open)}
        disabled={!hasDetail}
        className={`w-full text-left px-1 py-2 flex items-start gap-2 ${
          hasDetail ? 'hover:bg-gray-800/40 cursor-pointer' : 'cursor-default'
        }`}
      >
        {hasDetail ? (
          open ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon
          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
            look.color === 'green'
              ? 'text-emerald-400'
              : look.color === 'red'
                ? 'text-red-400'
                : look.color === 'yellow'
                  ? 'text-amber-400'
                  : 'text-blue-400'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 tabular-nums">{e.date}</span>
            <span className="text-xs font-semibold text-gray-200">{e.symbol}</span>
            <Badge color={look.color}>{look.label}</Badge>
            {e.code !== 'OK' && (
              <span className="text-xs text-gray-500 font-mono">{e.code}</span>
            )}
            {typeof e.score === 'number' && (
              <span className="text-xs text-gray-500 tabular-nums">
                score {e.score >= 0 ? '+' : ''}{num(e.score, 3)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 break-words">{e.detail}</p>
        </div>
      </button>

      {open && (
        <div className="pl-9 pr-1 pb-3 space-y-3">
          {e.evidence && e.evidence.length > 0 && (
            <EvidenceWaterfall
              evidence={e.evidence}
              rawScore={e.raw_score ?? 0}
              conviction={e.conviction ?? 1}
              score={e.score ?? 0}
            />
          )}
          {typeof e.quantity === 'number' && e.quantity > 0 && (
            <p className="text-xs text-gray-400">
              Sized by the risk gate at {e.quantity} shares, planned loss{' '}
              {money2(e.planned_loss ?? 0)}.
            </p>
          )}
          {e.checks && e.checks.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">
                Risk gate, in order — it stops at the first veto:
              </p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {e.checks.map((c) => (
                  <li key={c.name} className="text-xs flex items-center gap-1.5">
                    <span className={c.passed ? 'text-emerald-400' : 'text-red-400'}>
                      {c.passed ? '✓' : '✕'}
                    </span>
                    <span className="text-gray-400">{c.name.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function BotActivity({ snap }: { snap: BotSnapshot }) {
  if (snap.activity.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-3">
        Nothing yet. Step the bot forward and every proposal, veto and fill lands
        here with the evidence that produced it.
      </p>
    );
  }

  return (
    <>
      <ul className="max-h-96 overflow-y-auto pr-1">
        {snap.activity.map((e, i) => (
          <Row key={`${e.date}-${e.symbol}-${e.stage}-${i}`} e={e} />
        ))}
      </ul>
      <p className="text-xs text-gray-500 pt-2 border-t border-gray-800 mt-1">
        {Object.entries(snap.journal_summary)
          .map(([k, v]) => `${v} ${k}`)
          .join(' · ') || 'no entries'}{' '}
        since the session opened.
      </p>
    </>
  );
}
