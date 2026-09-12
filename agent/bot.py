"""The bot: the same desk, driven one bar at a time from the dashboard.

`evaluate.run` walks a window start to finish and hands back a report. That is
the right shape for judging a strategy and the wrong shape for watching one
work. This module keeps an `evaluate.Desk` alive between requests so the bar
loop can be advanced on demand, and serialises the whole of its state -- cash,
open positions, the queue of intents waiting for tomorrow's close, every veto
the risk gate issued -- into one snapshot the UI can render.

Nothing here is a second implementation of the trading logic. `step` forwards to
`Desk.step`, so the execution lag, the risk gate, the cost model and the stop
handling are the ones the backtest is reported with, not lookalikes.
`test_agent.py::stepping_the_desk_matches_the_backtest` asserts a stepped bot
and a straight-through run produce the same equity curve to the cent, which is
the only thing that makes the figures on the dashboard mean what they say.

## It is a replay, and it says so

The bot's session starts `session_bars` before the newest bar in the price data
and walks forward toward it. That is a replay of history, not a live feed, and
`snapshot()["mode"]` is the string `"replay"` so the UI has no way to imply
otherwise. There is no live mode to switch to: `LIVE_TRADING_SUPPORTED` is
False, there is no broker client in the process, and
`test_agent.py::no_broker_imports_anywhere` walks this module along with the
rest of the package.

## Deliberately not persisted

Bot state lives in memory for the life of the process. A paper bot whose
positions survived a restart would be a trading system of record, and a
trading system of record needs reconciliation, an audit log with retention,
and a migration story before it deserves the name. `snapshot()["ephemeral"]`
is True so the client can say plainly that a restart resets the session.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Dict, List, Optional

import pandas as pd

from trading import policy
from trading.types import Action

from . import decide, evaluate, news as news_mod, signals
from .costs import CostModel
from .paper import LIVE_TRADING_SUPPORTED, Position

# How far back a session starts by default. Roughly one trading year, which is
# long enough for the risk cascade to have something to react to and short
# enough to step through without the client making hundreds of requests.
DEFAULT_SESSION_BARS = 260
MIN_SESSION_BARS = 40
MAX_SESSION_BARS = 1500

# Bars per `step` call. The cap is a courtesy to the event loop: the desk scores
# the whole universe on every bar, so an unbounded request could occupy a worker
# thread for minutes.
MAX_STEP_BARS = 400

DISCLAIMER = (
    "Simulated on historical prices. No broker is connected, no order is "
    "placed, and this software does not support real-money trading. "
    "Educational use only. Not financial advice."
)


@dataclass(frozen=True)
class BotConfig:
    """What the user is allowed to change about the bot."""

    initial_cash: float = 25_000.0
    symbols: Optional[List[str]] = None
    benchmark_symbol: str = "VTI"
    max_new_per_bar: int = 2
    use_news: bool = True
    session_bars: int = DEFAULT_SESSION_BARS
    costs: CostModel = field(default_factory=CostModel.retail)

    def to_dict(self) -> dict:
        return {
            "initial_cash": self.initial_cash,
            "symbols": list(self.symbols) if self.symbols else None,
            "benchmark_symbol": self.benchmark_symbol,
            "max_new_per_bar": self.max_new_per_bar,
            "use_news": self.use_news,
            "session_bars": self.session_bars,
            "costs": {
                "commission_per_share": self.costs.commission_per_share,
                "commission_min": self.costs.commission_min,
                "half_spread_bps": self.costs.half_spread_bps,
                "slippage_bps": self.costs.slippage_bps,
                "annual_borrow_rate": self.costs.annual_borrow_rate,
                "frictionless": self.costs.is_frictionless,
            },
        }


class TradingBot:
    """A desk with a cursor. Advance it, then ask it what happened."""

    def __init__(
        self,
        prices: pd.DataFrame,
        config: Optional[BotConfig] = None,
        news_provider: Optional[news_mod.NewsProvider] = None,
        data_source: str = "unknown",
    ) -> None:
        cfg = config or BotConfig()
        if not MIN_SESSION_BARS <= cfg.session_bars <= MAX_SESSION_BARS:
            raise ValueError(
                f"session_bars must be between {MIN_SESSION_BARS} and {MAX_SESSION_BARS}"
            )

        tradable = signals.tradable_dates(prices)
        if len(tradable) < MIN_SESSION_BARS:
            raise ValueError("not enough price history to open a session")

        # The session is the last `session_bars` tradable bars. Features are
        # still derived from the full history before that point -- a bot that
        # only knew the session window would have no 200-day trend on day one.
        session = list(tradable[-cfg.session_bars:])

        run_config = evaluate.RunConfig(
            initial_cash=cfg.initial_cash,
            benchmark_symbol=cfg.benchmark_symbol,
            costs=cfg.costs,
            max_new_per_bar=cfg.max_new_per_bar,
            universe=cfg.symbols,
            start=session[0],
            end=session[-1],
            use_news=cfg.use_news,
        )

        self.config = cfg
        self.data_source = data_source
        self.desk = evaluate.Desk(prices, run_config, news_provider)
        self.session = session
        self.cursor = 0
        self.running = False
        self.created_at = datetime.now(timezone.utc)
        self.stepped_at: Optional[datetime] = None

    # ── Cursor ───────────────────────────────────────────────────────────────

    @property
    def bars_total(self) -> int:
        return len(self.session)

    @property
    def bars_remaining(self) -> int:
        return self.bars_total - self.cursor

    @property
    def up_to_date(self) -> bool:
        """The cursor has reached the newest bar the price data has."""
        return self.bars_remaining == 0

    @property
    def as_of(self) -> Optional[pd.Timestamp]:
        """The last bar the bot has seen. None before the first step."""
        return self.session[self.cursor - 1] if self.cursor else None

    @property
    def status(self) -> str:
        if self.desk.halted:
            return "halted"
        if self.up_to_date:
            return "up_to_date"
        if self.cursor == 0:
            return "idle"
        return "running" if self.running else "paused"

    # ── Driving it ───────────────────────────────────────────────────────────

    def step(self, bars: int = 1) -> int:
        """Advance up to `bars` bars. Returns how many were actually taken.

        Short-steps rather than raising at the end of the session: a client
        polling `step` while the user holds the play button should coast to a
        stop, not collect an error.
        """
        if bars < 1:
            raise ValueError("bars must be at least 1")
        take = min(bars, MAX_STEP_BARS, self.bars_remaining)
        taken = 0
        for _ in range(take):
            self.desk.step(self.session[self.cursor])
            self.cursor += 1
            taken += 1
            # A full stop is a full stop. Continuing to walk bars after the
            # drawdown breaker fired would spend the user's attention on a
            # desk that is no longer permitted to do anything.
            if self.desk.halted:
                break
        if taken:
            self.stepped_at = datetime.now(timezone.utc)
        if self.up_to_date or self.desk.halted:
            self.running = False
        # The count, not the request. A caller that asked for 20 bars and got 1
        # because the desk halted needs to be told that, and the client's play
        # loop stops on exactly this number.
        return taken

    def run_to_end(self) -> int:
        """Step to the newest bar, in `MAX_STEP_BARS` chunks."""
        total = 0
        while not self.up_to_date and not self.desk.halted:
            taken = self.step(MAX_STEP_BARS)
            if taken == 0:
                break
            total += taken
        return total

    # ── Snapshot ─────────────────────────────────────────────────────────────

    def snapshot_gap(self) -> float:
        """Marked equity minus live equity: what this bar's fills cost.

        Zero on a bar that traded nothing. See the note in `snapshot`.
        """
        broker = self.desk.broker
        if self.as_of is None:
            return 0.0
        curve = broker.equity_curve()
        if curve.empty:
            return 0.0
        return float(curve.iloc[-1]) - broker.equity(self.desk.prices.loc[self.as_of])

    def snapshot(self, feed: int = 30) -> dict:
        """Everything the dashboard renders, including the unflattering parts."""
        desk = self.desk
        broker = desk.broker
        as_of = self.as_of
        prices_now = desk.prices.loc[as_of] if as_of is not None else None

        equity = broker.equity(prices_now) if as_of is not None else broker.initial_cash
        peak = max(broker.peak_equity, equity)

        # Two equity figures, and they are allowed to differ.
        #
        # `mark` records the curve at the top of a bar: yesterday's book valued
        # at today's close. That is the series returns are computed from, and it
        # is what the backtest reports. Exits and entries then fill at that same
        # close, which moves nothing but the costs they pay -- so the live
        # account after the bar sits exactly one bar's costs below the curve's
        # last point. Both are correct at the instant they describe. The panel
        # shows the live one as the headline because it is what the account is
        # worth and what the positions table adds up to, and carries the gap
        # rather than quietly reconciling it.
        curve = broker.equity_curve()
        marked = float(curve.iloc[-1]) if len(curve) else broker.initial_cash
        exposure = (
            sum(abs(p.market_value(float(prices_now[p.symbol])))
                for p in broker.positions.values())
            if as_of is not None else 0.0
        )
        open_risk = sum(p.planned_loss() for p in broker.positions.values())

        out = {
            "mode": "replay",
            "ephemeral": True,
            "live_trading_supported": LIVE_TRADING_SUPPORTED,
            "status": self.status,
            "running": self.running,
            "halted": desk.halted,
            "settings": self.config.to_dict(),
            "universe": list(desk.universe),
            "data_source": self.data_source,
            "news_source": desk.provider.source,
            "news_is_synthetic": desk.provider.source == "synthetic",
            "created_at": self.created_at.isoformat(),
            "stepped_at": self.stepped_at.isoformat() if self.stepped_at else None,
            "session": {
                "first_bar": self.session[0].strftime("%Y-%m-%d"),
                "last_bar": self.session[-1].strftime("%Y-%m-%d"),
                "as_of": as_of.strftime("%Y-%m-%d") if as_of is not None else None,
                "next_bar": (self.session[self.cursor].strftime("%Y-%m-%d")
                             if not self.up_to_date else None),
                "bars_total": self.bars_total,
                "bars_done": self.cursor,
                "bars_remaining": self.bars_remaining,
                "up_to_date": self.up_to_date,
            },
            "account": {
                "initial_cash": round(broker.initial_cash, 2),
                "cash": round(broker.cash, 2),
                "equity": round(equity, 2),
                "marked_equity": round(marked, 2),
                "costs_this_bar": round(marked - equity, 2),
                "net_profit": round(equity - broker.initial_cash, 2),
                "return_pct": round(equity / broker.initial_cash - 1.0, 6),
                "peak_equity": round(peak, 2),
                "drawdown_pct": round(equity / peak - 1.0, 6) if peak > 0 else 0.0,
                # Gross: a short adds its notional here the same as a long,
                # because the exposure that matters for risk is how much market
                # the book is facing, not the net direction it faces it in. It
                # can exceed 100% of equity without any leverage being used.
                "exposure": round(exposure, 2),
                "exposure_pct": round(exposure / equity, 6) if equity > 0 else 0.0,
                "open_risk": round(open_risk, 2),
                "open_risk_pct": round(open_risk / equity, 6) if equity > 0 else 0.0,
                "total_costs": round(broker.total_costs, 2),
                "borrow_paid": round(broker.borrow_paid, 2),
            },
            "regime": self._regime(as_of),
            "positions": [self._position(p, prices_now, as_of)
                          for p in broker.positions.values()],
            "queue": [self._queued(p) for p in desk.pending],
            "activity": desk.journal.recent(feed),
            "journal_summary": desk.journal.summary(),
            "closed_trades": [t.to_dict() for t in broker.closed[-20:]][::-1],
            "performance": self._performance(),
            "risk": self._risk(as_of, prices_now, equity, open_risk),
            "equity_curve": self._equity_curve(),
            "caveats": self._caveats(),
            "disclaimer": DISCLAIMER,
        }
        return out

    # ── Snapshot sections ────────────────────────────────────────────────────

    def _regime(self, as_of: Optional[pd.Timestamp]) -> dict:
        if as_of is None:
            return {"label": None, "stability": 0, "weights": None,
                    "tradable": False, "min_stability": 3}
        label, stability = self.desk.regime.at(as_of)
        weights = decide.REGIME_WEIGHTS.get(label)
        return {
            "label": label,
            "stability": int(stability),
            "weights": weights.as_dict() if weights else None,
            # The gate refuses a regime that has not held for three bars, so a
            # bot sitting on its hands during a transition is behaving, not broken.
            "tradable": label != "unknown" and stability >= 3,
            "min_stability": 3,
        }

    def _position(
        self, pos: Position, prices_now: pd.Series, as_of: pd.Timestamp
    ) -> dict:
        last = float(prices_now[pos.symbol])
        unrealized = pos.unrealized(last)
        planned = pos.planned_loss()
        return {
            "symbol": pos.symbol,
            "side": pos.side.value,
            "quantity": pos.quantity,
            "entry_price": round(pos.entry_price, 4),
            "last_price": round(last, 4),
            "stop": round(pos.stop, 4),
            "target_1": round(pos.target_1, 4),
            "target_2": round(pos.target_2, 4),
            "market_value": round(abs(pos.market_value(last)), 2),
            "unrealized": round(unrealized, 2),
            "unrealized_pct": round(unrealized / (pos.entry_price * pos.quantity), 6)
            if pos.quantity and pos.entry_price else 0.0,
            "planned_loss": round(planned, 2),
            # Where the trade sits between its stop and its first target, in R.
            # The number a desk actually watches, and it is not derivable from
            # price alone, so the API owes the client the arithmetic.
            "r_multiple": round(unrealized / planned, 3) if planned > 0 else None,
            "took_partial": pos.took_partial,
            "opened": pos.opened.strftime("%Y-%m-%d"),
            "days_held": int((pd.Timestamp(as_of) - pos.opened).days),
            "strategy": pos.strategy,
        }

    def _queued(self, proposal: decide.Proposal) -> dict:
        """An intent waiting for the next bar's close.

        Carries no quantity, because the proposal has none: size is the risk
        gate's decision on the bar it executes, against the equity it finds
        there. A queue that displayed a size would be inventing one.
        """
        d = proposal.to_dict()
        d["will_execute_on"] = (
            self.session[self.cursor].strftime("%Y-%m-%d") if not self.up_to_date else None
        )
        return d

    def _performance(self) -> Optional[dict]:
        """Broker stats and the benchmark, once there is enough curve to compare."""
        curve = self.desk.broker.equity_curve()
        if len(curve) < 3:
            return None

        stats = self.desk.broker.stats()
        bench_prices = self.desk.prices[self.config.benchmark_symbol].loc[curve.index]
        try:
            bench = evaluate.buy_and_hold(
                bench_prices, self.config.initial_cash, self.config.costs
            )
        except ValueError:
            return {"broker": stats, "benchmark": None}

        comparison = evaluate.compare(curve, bench)
        return {
            "broker": stats,
            "benchmark": comparison if "error" not in comparison else None,
            "benchmark_symbol": self.config.benchmark_symbol,
            "bars": len(curve),
        }

    def _risk(
        self,
        as_of: Optional[pd.Timestamp],
        prices_now: Optional[pd.Series],
        equity: float,
        open_risk: float,
    ) -> dict:
        """The cascade as it stands right now, not merely as it is documented."""
        active: List[dict] = []
        action = Action.NORMAL
        cascade = {"daily_pct": 0.0, "weekly_pct": 0.0,
                   "monthly_pct": 0.0, "drawdown_pct": 0.0}

        if as_of is not None:
            state = self.desk.broker.account_state(as_of, prices_now)
            breakers = policy.evaluate_breakers(state, block_file=None)
            action = policy.strictest(breakers)
            active = [{"name": b.name, "action": b.action.value, "detail": b.detail}
                      for b in breakers]
            cascade = {
                "daily_pct": round(state.daily_pct, 6),
                "weekly_pct": round(state.weekly_pct, 6),
                "monthly_pct": round(state.monthly_pct, 6),
                "drawdown_pct": round(state.drawdown_pct, 6),
            }

        return {
            "action": action.value,
            "active_breakers": active,
            "blocks_new_entries": policy.blocks_new_entries(action),
            "size_multiplier": policy.size_multiplier(action),
            "cascade": cascade,
            "vetoes": dict(sorted(self.desk.veto_counts.items(), key=lambda kv: -kv[1])),
            "veto_total": sum(self.desk.veto_counts.values()),
            "breaker_events": self.desk.breaker_events,
            "open_risk_budget": policy.MAX_OPEN_RISK,
            "open_risk_used_pct": round(open_risk / equity, 6) if equity > 0 else 0.0,
            # Served rather than duplicated in the client. A dashboard that drew
            # its gauges against its own copy of -2% would keep drawing them
            # there after someone edited the policy, which is the one direction
            # a risk display must not be wrong in.
            "thresholds": {
                "daily_half_size": policy.DAILY_HALF_SIZE,
                "daily_flatten": policy.DAILY_FLATTEN,
                "weekly_half_size": policy.WEEKLY_HALF_SIZE,
                "weekly_stop": policy.WEEKLY_STOP,
                "monthly_stop": policy.MONTHLY_STOP,
                "peak_drawdown_block": policy.PEAK_DRAWDOWN_BLOCK,
            },
            "limits": {
                "risk_per_trade": policy.RISK_PER_TRADE,
                "max_concentration": policy.MAX_CONCENTRATION,
                "max_open_risk": policy.MAX_OPEN_RISK,
                "max_positions": policy.MAX_POSITIONS,
                "min_risk_reward": policy.MIN_RISK_REWARD,
            },
            "policy_hash": policy.policy_hash(),
            "weights_hash": decide.weights_hash(),
            "weights_version": decide.WEIGHTS_VERSION,
        }

    def _equity_curve(self) -> List[dict]:
        curve = self.desk.broker.equity_curve()
        if curve.empty:
            return []
        try:
            bench = evaluate.buy_and_hold(
                self.desk.prices[self.config.benchmark_symbol].loc[curve.index],
                self.config.initial_cash,
                self.config.costs,
            ).reindex(curve.index)
        except ValueError:
            bench = pd.Series(index=curve.index, dtype=float)

        return [
            {"date": d.strftime("%Y-%m-%d"),
             "strategy": round(float(s), 2),
             "benchmark": None if pd.isna(b) else round(float(b), 2)}
            for d, s, b in zip(curve.index, curve.values, bench.values)
        ]

    def _caveats(self) -> List[str]:
        out = [
            "This is a replay of historical bars, not a live market feed. The "
            "bot is stepping through prices whose outcome is already known to "
            "the data, though not to the bot: every feature is point-in-time "
            "and every signal executes on the following bar's close.",
            "Positions are open, so the equity figure includes unrealised "
            "profit that a real exit would have to pay costs to collect.",
            "Bot state is held in memory and is lost when the server restarts.",
        ]
        if abs(self.snapshot_gap()) >= 0.01:
            out.append(
                "The equity chart marks each bar before that bar's own fills, "
                "which is what returns are computed from. The headline equity "
                "is the account after them, so the two differ by the "
                f"${abs(self.snapshot_gap()):,.2f} of spread and commission "
                "this bar's trades paid."
            )
        if self.data_source == "synthetic":
            out.append(
                "Prices came from the synthetic generator, not a market. The "
                "series is a deterministic simulation and the bot's results on "
                "it say nothing about any real instrument."
            )
        if self.desk.provider.source == "synthetic":
            out.append(
                "News sentiment came from the synthetic provider, which is "
                "built from past returns and seeded noise and carries no real "
                "information. Any contribution it appears to make is noise."
            )
        if self.desk.provider.source == "none":
            out.append("No news provider is configured; the news evidence line is 0.0.")
        if self.config.costs.is_frictionless:
            out.append(
                "COSTS DISABLED. Fills pay no spread, slippage or commission, "
                "so this run is a counterfactual rather than an achievable result."
            )
        if self.desk.halted:
            out.append(
                "The drawdown breaker has fired and the desk is stopped. In a "
                "live deployment this writes state/TRADING_BLOCKED and only a "
                "human may remove it; here it ends the session."
            )
        return out


# ── Session store ────────────────────────────────────────────────────────────

class BotRegistry:
    """One bot per key, bounded, oldest evicted first.

    Bounded because each bot pins a features frame per symbol for the life of
    the process, and an unbounded registry is a memory leak with a user id
    attached.
    """

    def __init__(self, limit: int = 12) -> None:
        self.limit = limit
        self._bots: Dict[str, TradingBot] = {}

    def get(self, key: str) -> Optional[TradingBot]:
        return self._bots.get(key)

    def put(self, key: str, bot: TradingBot) -> TradingBot:
        if key not in self._bots and len(self._bots) >= self.limit:
            self._bots.pop(next(iter(self._bots)))
        self._bots[key] = bot
        return bot

    def drop(self, key: str) -> bool:
        return self._bots.pop(key, None) is not None

    def __len__(self) -> int:
        return len(self._bots)


def merge_config(base: BotConfig, **changes) -> BotConfig:
    """Apply only the fields the caller actually set."""
    given = {k: v for k, v in changes.items() if v is not None}
    return replace(base, **given) if given else base
