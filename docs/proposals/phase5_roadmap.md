# Phase 5: From Prototype to Professional Tool

**Status:** In Progress
**Date:** 2026-01-08
**Previous Phase:** Phase 4 (Paper Trading) - Complete

## Context
We have successfully built the "Loop": Data -> Logic -> Backtest -> Paper Trading. The system works, but it is currently a "Glass Cannon." It executes trades correctly but lacks the risk management, operational robustness, and visibility required for serious usage.

This proposal outlines three potential directions for Phase 5.

---

## Path A: Strategy Sophistication & Risk Management (Recommended)
**Focus:** Financial Engineering & Safety.

Currently, the system uses "All-In" position sizing and has no exit strategy other than a reversal signal. This is financially dangerous.

### Key Deliverables
1.  **Risk Management Module:**
    *   **Stop Loss (SL):** Automatically sell if price drops $X\%$ from entry.
    *   **Take Profit (TP):** Automatically sell if price rises $Y\%$ from entry.
    *   **Trailing Stop:** Adjust SL upwards as price rises to lock in profits.
2.  **Dynamic Position Sizing:**
    *   Replace "Max Cash" logic with "Risk Unit" logic (e.g., "Risk 1% of Account Equity per trade").
    *   Formula: `Units = (Account * Risk%) / (Entry - StopLoss)`.
3.  **Expanded Indicator Library:**
    *   **ATR (Average True Range):** Essential for volatility-based stops.
    *   **MACD & Bollinger Bands:** To support more complex strategies.

**Rationale:** "Slow is Fast." Before we build dashboards or deployment pipelines, we must ensure the *financial logic* is robust enough to survive real market conditions.

---

## Path B: Operations & Observability
**Focus:** Reliability & Automation.

Currently, the system relies on manual CLI invocation or basic Cron jobs. Visibility is limited to console logs.

### Key Deliverables
1.  **Notification Service:**
    *   Integrate Telegram/Discord/Email.
    *   Alert on: Buy/Sell execution, Errors, Daily Performance Summary.
2.  **Dockerized Deployment:**
    *   Create a self-contained `Dockerfile` that runs the scheduler internally.
    *   Support `docker-compose up -d bot` for set-and-forget usage.
3.  **Structured Logging:**
    *   Replace `console.log` with a proper logger (e.g., `winston` or `pino`) writing to file/stream.

**Rationale:** Necessary for running the bot 24/7 on a remote VPS without constant supervision.

---

## Path C: API & Dashboarding
**Focus:** User Experience & Analysis.

Currently, analyzing performance requires reading database tables or logs.

### Key Deliverables
1.  **REST API:**
    *   Expose endpoints: `GET /portfolio`, `GET /trades`, `GET /backtests/:id`.
2.  **Web Dashboard:**
    *   Frontend (React/Next.js) to view the Equity Curve.
    *   Candlestick charts with "Buy/Sell" markers overlaid.
3.  **Reporting UI:**
    *   Visual representation of Sharpe Ratio, Drawdown, and Monthly Returns.

**Rationale:** "Trading is Visual." Debugging a strategy is significantly faster when you can *see* where it bought and sold on a chart.

---

## Recommendation
**Proceed with Path A (Risk Management).**

While dashboards (Path C) are satisfying and notifications (Path B) are useful, **Risk Management is existential**. A bot without Stop Losses is a gambling machine, not a trading system. We should prioritize the financial integrity of the logic before improving its interface or deployment.
