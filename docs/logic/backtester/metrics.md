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

## 4. Win Rate
The percentage of trades that resulted in a profit.
*   **Note:** A strategy can be profitable with a low win rate (e.g., 40%) if the winners are much larger than the losers (high Risk:Reward ratio).
