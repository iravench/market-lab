# Backtest Metrics: Understanding Performance

It is not enough to know *if* a strategy made money. We must understand *how* it made money and what risks were taken.

## 1. Total Return
The absolute percentage growth of the portfolio.
$$ \text{Return} = \frac{\text{Final Equity} - \text{Initial Equity}}{\text{Initial Equity}} \times 100 $$

## 2. Max Drawdown (MDD)
The largest single drop from a peak to a trough. This measures the "pain" an investor would have felt during the worst period of the strategy.
*   **Formula:** Min ( (Trough - Peak) / Peak )
*   **Interpretation:** An MDD of -50% means the portfolio lost half its value at some point. Recovering from -50% requires a +100% gain.

## 3. Sharpe Ratio
A measure of risk-adjusted return. It asks: "Was the return worth the volatility?"
$$ \text{Sharpe} = \frac{R_p - R_f}{\sigma_p} \times \sqrt{252} $$
Where:
*   $R_p$ = Mean Daily Return
*   $R_f$ = Risk-Free Rate (Assumed 0 in our simulation)
*   $\sigma_p$ = Standard Deviation of Daily Returns
*   $\sqrt{252}$ = Annualization factor (trading days in a year)

**Interpretation:**
*   **> 1.0:** Good.
*   **> 2.0:** Excellent.
*   **> 3.0:** Exceptional (or you have a bug/overfit).

## 4. Sortino Ratio
Similar to Sharpe, but only penalizes *downside* volatility.
*   **Why:** Upside volatility (price shooting up) is good! Sharpe punishes it; Sortino does not.
*   **Formula:** (Mean Return - Target Return) / Downside Deviation
*   **Interpretation:** A high Sortino means the strategy generates returns without crashing.

## 5. Calmar Ratio
A measure of return relative to drawdown risk.
*   **Formula:** Annualized Return / Max Drawdown
*   **Interpretation:**
    *   **> 0.5:** Acceptable.
    *   **> 1.0:** Excellent (Strategy makes 100% for every 100% risk).
    *   **> 3.0:** Holy Grail territory.

## 6. System Quality Number (SQN)
Measures the statistical significance of the trading system. It answers: "Is this edge real or just luck?"
*   **Formula:** $\sqrt{N} \times \frac{\text{Expectancy}}{\text{StdDev of R-Multiples}}$
*   **Interpretation:**
    *   **< 1.6:** Poor / Hard to trade.
    *   **1.6 - 2.0:** Average.
    *   **2.0 - 3.0:** Good.
    *   **> 3.0:** Excellent.
    *   **> 7.0:** Holy Grail.

## 7. Expectancy
The average dollar amount you expect to make (or lose) per trade.
*   **Formula:** (Average Win * Win Rate) - (Average Loss * Loss Rate)
*   **Interpretation:** Must be positive for a profitable system.

## 8. Win Rate
The percentage of trades that resulted in a profit.
*   **Note:** A strategy can be profitable with a low win rate (e.g., 40%) if the winners are much larger than the losers (high Risk:Reward ratio).