# Data Sources & Adapters

This document tracks the quirks, limitations, and implementation details of the various market data providers used in the project.

## 1. Yahoo Finance (`yahoo-finance2`)

### Current Status
We use the `yahoo-finance2` Node.js library for fetching historical data for Australian (ASX) and Global stocks.

### Implementation Quirks
*   **API Deprecation:** Yahoo officially removed the `/historical` endpoint. The library simulates this using the `/chart` endpoint.
*   **Method Usage:** We must instantiate the class (`new YahooFinance()`) rather than using static methods to avoid initialization errors.
*   **Result Mapping:** The data returned from `yf.chart()` is contained in the `.quotes` property of the response.

### Known Limitations
*   **Hourly Data:** While Yahoo provides hourly data, the "lookback" (how far back in time you can go) is much shorter than daily data (usually limited to 730 days).
*   **Adjusted Prices:** Yahoo provides "Adjusted" prices (handling dividends and splits). This explains why prices may have many decimal places (e.g., $155.6799...).
*   **Rate Limiting:** As a free service, Yahoo Finance may rate-limit aggressive backfilling. We favor a "Slow is Fast" approach by fetching only what is necessary.
