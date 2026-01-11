import pool from './index';
import { Candle } from '../logic/types';

export class CandleRepository {
  async getCandles(symbol: string, interval: string, fromDate: Date, toDate: Date): Promise<Candle[]> {
    const queryText = `
      SELECT time, open, high, low, close, volume
      FROM candles
      WHERE symbol = $1 
        AND interval = $2
        AND time >= $3
        AND time <= $4
      ORDER BY time ASC
    `;

    const result = await pool.query(queryText, [symbol, interval, fromDate, toDate]);

    return result.rows.map(row => ({
      time: row.time, // pg driver usually returns Date objects for timestamptz
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume)
    }));
  }

  async getMultiSymbolCandles(symbols: string[], interval: string, fromDate: Date, toDate: Date): Promise<Map<string, Candle[]>> {
    const queryText = `
      SELECT symbol, time, open, high, low, close, volume
      FROM candles
      WHERE symbol = ANY($1)
        AND interval = $2
        AND time >= $3
        AND time <= $4
      ORDER BY symbol, time ASC
    `;

    const result = await pool.query(queryText, [symbols, interval, fromDate, toDate]);
    const results = new Map<string, Candle[]>();

    for (const row of result.rows) {
      const symbol = row.symbol;
      if (!results.has(symbol)) {
        results.set(symbol, []);
      }

      results.get(symbol)!.push({
        time: row.time, // pg driver usually returns Date objects for timestamptz
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume)
      });
    }

    return results;
  }
}
