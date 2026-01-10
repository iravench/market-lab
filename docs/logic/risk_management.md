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

## 3. Market Regime Filtering
Strategies that work well in trending markets often fail in chopping (sideways) markets, and vice-versa. Applying the wrong strategy to the wrong environment is a primary source of drawdown.

*   **Trend vs. Chop (ADX):** Using the Average Directional Index to classify the market state. Trend-following strategies are disabled during low-ADX "chop" regimes to prevent "death by a thousand cuts."
*   **Volatility States (Bollinger Bands):** Identifying periods of extreme compression ("Squeezes") or expansion to filter entries.
*   **Momentum Validation (MACD):** ensuring that price breakouts are supported by underlying momentum, filtering out "bull traps."

## 4. Portfolio & Systemic Risk
Individual trades may be safe, but a collection of correlated trades can be fatal.

*   **Correlation Limits:** Preventing the portfolio from becoming accidentally concentrated in a single sector or factor by rejecting new positions that are highly correlated with existing holdings.
*   **Hard Stops (Circuit Breakers):**
    *   **Daily Loss Limit:** A cooling-off mechanism to halt trading if a single session's losses exceed a threshold, preventing "revenge trading" spirals.
    *   **Max Drawdown Hard Stop:** A permanent system disablement if equity falls below a critical level, acknowledging that the current edge may be broken.

## 5. Execution Risk
*   **Slippage & Liquidity:** Acknowledging that "Paper Prices" are not "Real Prices." The system models friction (slippage) and enforces liquidity floors to ensure the simulated performance is attainable in reality.
