# Risk Management Architecture

## 1. Context & Philosophy
The Risk Management module acts as the system's "Gatekeeper," prioritizing **Capital Preservation** over Profit Maximization. This aligns with the "Slow is Fast" philosophy, where long-term survival is the prerequisite for compounding returns.

While the **Strategy Core** identifies *opportunities* ("I want to buy X"), the **Risk Module** validates *feasibility* and *safety* ("Can we afford X? How much? Is the market condition safe?"). It operates independently to prevent emotional or reckless decision-making.

## 2. Transactional Risk (Per Trade)

### 2.1 Volatility-Adjusted Position Sizing
Traditional "fixed dollar" or "all-in" sizing ignores the fluctuating risk profile of assets. A \$1000 position in a stable utility stock carries significantly less risk than a \$1000 position in a volatile crypto-currency.

To normalize this risk, we employ the **Risk Unit** concept:
*   **Concept:** Every trade should risk a fixed percentage of total Account Equity (e.g., 1%).
*   **Mechanism:** Position size is inversely proportional to volatility. As volatility (measured by ATR) increases, position size decreases, ensuring the dollar-risk remains constant.

### 2.2 Dynamic Exits (The Chandelier Exit)
Static stop losses (e.g., "sell if down 5%") are brittle; they often trigger prematurely during normal market noise or fail to protect profits during a strong trend.

*   **ATR Trailing Stop:** A dynamic stop-loss that "ratchets" upwards as the price moves in the trade's favor.
*   **Why:** It creates a "one-way valve" for profit accumulation. It allows winning trades to run (Slow) while cutting losing trades or reversals quickly (Fast) based on statistical volatility rather than arbitrary percentages.

### 2.3 Dynamic Take Profits (Bollinger Bands)
Unlike static targets (e.g., "Sell at +5%"), dynamic targets adjust to market volatility.

*   **Mechanism:**
    *   **BUY Trade:** Take Profit is set to the **Upper Bollinger Band** (SMA + 2σ) of the entry candle.
    *   **SELL Trade:** Take Profit is set to the **Lower Bollinger Band** (SMA - 2σ).
*   **Rationale:** The Upper Band represents a statistically "expensive" zone relative to the mean. Prices often revert from these levels, making them logical areas to secure profit in mean-reversion or trend-following systems.

## 3. Market Regime Filtering (Implemented)
Strategies that work well in trending markets often fail in chopping (sideways) markets, and vice-versa. Applying the wrong strategy to the wrong environment is a primary source of drawdown.

*   **Trend vs. Chop (ADX - Implemented):** 
    *   **Mechanism:** Before accepting a `BUY` signal, the Risk Manager calculates the Average Directional Index (ADX) over the last 14 periods.
    *   **Threshold:** If `ADX < 25`, the market is classified as "Choppy" or "Range-Bound."
    *   **Action:** The trade is **rejected** (signal forced to `HOLD`). This prevents trend-following strategies from getting "chopped up" in directionless markets.
*   **Volatility States (Bollinger Bands):** Identifying periods of extreme compression ("Squeezes") or expansion to filter entries.
*   **Momentum Validation (MACD):** ensuring that price breakouts are supported by underlying momentum, filtering out "bull traps."

## 4. Portfolio & Systemic Risk
Individual trades may be safe, but a collection of correlated trades can be fatal.

*   **Correlation Limits (Implemented):** 
    *   **Problem:** If the portfolio holds 10 stocks that are all highly correlated (e.g., all Tech stocks), diversification is an illusion. A crash in that sector destroys the entire account.
    *   **Mechanism:** Before entering a new trade, calculate the **Pearson Correlation Coefficient** between the candidate asset and *every* existing holding over the last N periods (e.g., 30 days).
    *   **Threshold:** If Correlation > 0.7 (or < -0.7 for hedging) with *any* existing position, the new trade is blocked.
    *   **Goal:** Force the system to find alpha in uncorrelated assets (Energy, Metals, Utilities), ensuring true diversification.
*   **Hard Stops (Circuit Breakers):**
    *   **Daily Loss Limit (Implemented):**
        *   **Concept:** A cooling-off mechanism to halt trading if a single session's losses exceed a threshold (e.g., 2% of Equity).
        *   **Mechanism:** The Risk Manager sums the Realized PnL of all trades closed on the current day.
        *   **Action:** If `Daily Loss > Limit`, the system enters a **Liquidate Only** mode for the remainder of the day. All open positions are closed, and new entries are blocked. This prevents "revenge trading" spirals.
    *   **Max Drawdown Hard Stop:** A permanent system disablement if equity falls below a critical level, acknowledging that the current edge may be broken.

## 5. Execution Risk & Slippage
Acknowledging that "Paper Prices" are not "Real Prices." The system simulates friction (slippage) to ensure performance metrics are realistic.

### 5.1 Fixed Percentage Slippage
*   **Concept:** Assumes every trade executes at a price slightly worse than the theoretical signal price.
*   **Formula:**
    *   Buy Price = $Price \times (1 + \text{Slippage \%})$
    *   Sell Price = $Price \times (1 - \text{Slippage \%})$
*   **Rationale:** Represents standard market spread and fees not captured by the broker model.

### 5.2 Volatility-Based Slippage
*   **Concept:** Slippage is not constant; it increases when the market is volatile (wide spreads, fast movement).
*   **Formula:** Execution Price = $Price \pm (\text{Candle Range} \times \text{Factor})$
    *   Where Candle Range = High - Low.
*   **Rationale:** During a crash (high volatility), liquidity dries up, and you are more likely to get filled far from your stop price. This model penalizes trading during chaos.
