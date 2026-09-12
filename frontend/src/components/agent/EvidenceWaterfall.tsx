import type { Evidence } from '../../api/agent';
import { num } from './format';

/* ── The explainability visual ─────────────────────────────────────────────
   A diverging bar per piece of evidence. The bars are drawn to a shared
   scale and are labelled with the exact contribution, so the reader can add
   them up and land on the score. That reconstruction is the whole point --
   a score you cannot re-derive by hand is not an explanation.            */
export function EvidenceWaterfall({ evidence, rawScore, conviction, score }: {
  evidence: Evidence[]; rawScore: number; conviction: number; score: number;
}) {
  const max = Math.max(0.001, ...evidence.map((e) => Math.abs(e.contribution)));
  return (
    <div className="space-y-2">
      {evidence.map((e) => {
        const width = (Math.abs(e.contribution) / max) * 50;
        const positive = e.contribution >= 0;
        return (
          <div key={e.name} className="flex items-center gap-3 text-xs" title={e.note}>
            <span className="w-20 shrink-0 text-gray-400 capitalize">{e.name}</span>
            <span className="w-16 shrink-0 text-right text-gray-500 tabular-nums">
              {e.raw >= 0 ? '+' : ''}{num(e.raw, 3)}
            </span>
            <span className="w-10 shrink-0 text-right text-gray-600 tabular-nums">
              ×{num(e.weight, 2)}
            </span>
            <div className="flex-1 h-4 relative bg-gray-900/60 rounded">
              <div className="absolute inset-y-0 left-1/2 w-px bg-gray-700" />
              <div
                className={`absolute inset-y-0.5 rounded ${positive ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
                style={
                  positive
                    ? { left: '50%', width: `${width}%` }
                    : { right: '50%', width: `${width}%` }
                }
              />
            </div>
            <span
              className={`w-16 shrink-0 text-right tabular-nums font-medium ${
                positive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {e.contribution >= 0 ? '+' : ''}{num(e.contribution, 4)}
            </span>
          </div>
        );
      })}

      <div className="pt-2 mt-1 border-t border-gray-700 space-y-1 text-xs">
        <div className="flex justify-between text-gray-300">
          <span>Sum of contributions</span>
          <span className="tabular-nums font-semibold">
            {rawScore >= 0 ? '+' : ''}{num(rawScore, 4)}
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span title="Damps conviction when realised volatility is unusually high. Never affects position size.">
            × volatility conviction
          </span>
          <span className="tabular-nums">{num(conviction, 4)}</span>
        </div>
        <div className="flex justify-between text-gray-100 font-semibold">
          <span>Score</span>
          <span className="tabular-nums">{score >= 0 ? '+' : ''}{num(score, 4)}</span>
        </div>
      </div>
    </div>
  );
}
