# Backtester Architecture

The Backtester is the core simulation engine that verifies if a strategy has historical merit. It simulates the passage of time, market interactions, and portfolio management.

## 1. Components

### A. The Engine (Event Loop)
The conductor of the orchestra. It does not know *how* to trade or *what* the strategy is. It simply:
1.  Iterates through historical time (Candle by Candle).
2.  Feeds the "Visible History" to the Strategy.
3.  Takes the Strategy's `Signal` and passes it to the Broker.
4.  Records the resulting state for reporting.

### B. The Virtual Broker (Accounting)
The component responsible for state management. It mimics a real exchange and wallet.
*   **Responsibilities:**
    *   Maintain Cash Balance (USD).
    *   Maintain Asset Positions (e.g., Share count).
    *   Calculate Fees & Slippage.
    *   Reject invalid orders (e.g., buying with insufficient funds).

### C. The Reporter (PerformanceAnalyzer)
Analyzes the resulting equity curve to produce metrics. This logic is decoupled from the main loop.
*   Sharpe Ratio
*   Max Drawdown
*   Total Return
*   Win/Loss Ratio

---

## 2. The Simulation Loop Logic

```typescript
// Pseudo-code for the main loop
let history = []; // Growing array of candles
let portfolio = new Portfolio(initialCash: 10000);

for (const candle of allHistoricalCandles) {
    history.push(candle);
    
    // 1. Ask Strategy for decision
    const signal = strategy.analyze(history);
    
    // 2. Execute decision
    if (signal.action === 'BUY') {
        portfolio.buy(signal.price, calculatePositionSize(portfolio));
    } else if (signal.action === 'SELL') {
        portfolio.sell(signal.price, portfolio.assets);
    }
    
    // 3. Log state for analysis
    snapshot(portfolio.totalValue());
}
```

---

## 3. Key Concepts

### Look-Ahead Bias (The Enemy)
The most common error in backtesting. It occurs when code accidentally uses data from the future.
*   *Bad:* Calculating an indicator using `allHistoricalCandles`.
*   *Good:* Calculating an indicator using `allHistoricalCandles.slice(0, currentDay)`.

### Slippage & Fees
A strategy that makes $0.01 profit per trade might look great on paper but will bankrupt you in reality due to fees.
*   **Fees:** Fixed ($ per trade) or Percentage (bps).
*   **Slippage:** The difference between the signal price (e.g., Close) and the actual filled price. We often simulate this by adding a penalty to the execution price.

---

## 4. Interfaces (Draft)

```typescript
interface PortfolioState {
    cash: number;
    positions: Record<string, number>; // symbol -> quantity
    totalEquity: number;
}

interface BacktestResult {
    initialCapital: number;
    finalCapital: number;
    trades: TradeRecord[];
    metrics: {
        totalReturnPct: number;
        maxDrawdownPct: number;
    }
}
```
