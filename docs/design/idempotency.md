# Idempotency Strategy: Data Integrity

In our system, "Idempotency" ensures that performing the same operation multiple times results in the same outcome without side effects (like data duplication).

## 1. The Problem
Data ingestion often involves "backfilling" historical data. If we run a backfill for `CBA.AX` from `2024-01-01` twice, we must ensure we don't have duplicate candles for the same day in our database.

## 2. Our Implementation

### Database Layer (The Safety Net)
We define a unique constraint on the natural keys of a candle:
```sql
CREATE UNIQUE INDEX idx_candles_symbol_interval_time 
ON candles (symbol, interval, time DESC);
```
This physically prevents the database from storing two records for the same symbol at the same time and interval.

### Application Layer (The Logic)
When inserting data, we use the `ON CONFLICT DO NOTHING` clause:
```sql
INSERT INTO candles (...) 
VALUES (...) 
ON CONFLICT (symbol, interval, time) DO NOTHING;
```
*   **Result:** If a row already exists, the database silently skips it.
*   **Benefit:** We can safely "top-up" data. If we have data until Monday, and we run a backfill starting from last Friday, only Tuesday's data will be added, and Friday-Monday will be ignored.
