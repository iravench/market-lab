# Data Schema Design: Global Market Compatibility

## 1. Overview
The `candles` table is designed to be a universal container for time-series market data, supporting diverse asset classes (Stocks, Crypto, Forex) across any global exchange.

## 2. Core Compatibility Features

### 2.1 Universal OHLCV Format
Regardless of the exchange (ASX, NYSE, Binance), price action is captured using the standard **Open, High, Low, Close, and Volume** model. This allows our Strategy Engine to remain "market-agnostic"—it doesn't care if it's processing an Australian bank or a digital currency.

### 2.2 Timezone Handling (TIMESTAMPTZ)
We use the `TIMESTAMPTZ` type to ensure all data is normalized to **UTC** at the database level.
*   **Why:** Global markets operate in different timezones with varying Daylight Savings rules.
*   **Benefit:** We can compare or correlate assets from different regions (e.g., seeing how the US market close affects the Australian market open) without manual offset calculations.

### 2.3 Precision & Accuracy (NUMERIC)
We avoid `FLOAT` or `REAL` types which are prone to binary rounding errors.
*   **Implementation:** Using PostgreSQL's `NUMERIC` type.
*   **Requirement:** Essential for assets with very low prices (penny stocks) or very high prices (Bitcoin), where every decimal point represents significant value.

## 3. Handling Market Specifics

### 3.1 Symbol Namespacing
To avoid collisions and identify the market of origin, we follow a suffix-based naming convention:
*   **Australian Stocks:** `{TICKER}.AX` (e.g., `CBA.AX`, `TLS.AX`)
*   **US Stocks:** `{TICKER}` (e.g., `AAPL`, `TSLA`)
*   **Crypto:** `{ASSET}/{STABLE}` (e.g., `BTC/USDT`)

### 3.2 Metadata (Future Consideration)
While the `candles` table stores price action, a future `instruments` or `assets` table will be required to store market-specific metadata:
*   **Currency:** (AUD, USD, BTC)
*   **Trading Hours:** (e.g., 10:00 - 16:00 AEST for ASX)
*   **Exchange:** (ASX, NASDAQ, BINANCE)

## 4. Scalability with TimescaleDB
By utilizing **Hypertables**, we ensure that as we expand from the Australian market to global markets, our query performance remains consistent. The data is automatically partitioned by time, preventing the "large table slowdown" common in standard relational databases.
