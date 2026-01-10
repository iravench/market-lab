import yahooFinance from 'yahoo-finance2';
import pool from '../db';

export class MarketDataService {
  /**
   * Fetches historical data from Yahoo Finance and saves it to TimescaleDB.
   * @param symbol The ticker symbol (e.g., 'CBA.AX' for CommBank)
   * @param startDate Date string (e.g., '2023-01-01')
   * @param interval The candle size ('1d' for daily, '1h' for hourly)
   */
  async backfill(symbol: string, startDate: string, interval: '1d' | '1h' = '1d') {
    console.log(`📥 Fetching ${interval} candles for ${symbol} starting from ${startDate}...`);

    try {
      const queryOptions = {
        period1: startDate,
        period2: new Date(), // Now
        interval: interval as any,
      };

      const yf = new yahooFinance({ suppressNotices: ['ripHistorical'] });
      // Use chart() instead of historical()
      const response = await yf.chart(symbol, queryOptions);
      const result = response?.quotes;

      if (!result || result.length === 0) {
        console.warn('⚠️ No data returned from Yahoo Finance.');
        return;
      }

      console.log(`💾 Saving ${result.length} candles to database...`);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const insertText = `
          INSERT INTO candles (time, symbol, interval, open, high, low, close, volume)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (symbol, interval, time) DO NOTHING
        `;

        for (const candle of result) {
          // Filter out any null values (Yahoo sometimes has gaps)
          if (candle.open === null || candle.close === null) continue;

          await client.query(insertText, [
            candle.date,
            symbol,
            interval,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume
          ]);
        }

        await client.query('COMMIT');
        console.log(`✅ Successfully backfilled ${symbol}.`);

      } catch (dbErr) {
        await client.query('ROLLBACK');
        console.error('❌ Database error during save:', dbErr);
        throw dbErr;
      } finally {
        client.release();
      }

    } catch (err) {
      console.error('❌ Error fetching data from Yahoo Finance:', err);
    }
  }
}
