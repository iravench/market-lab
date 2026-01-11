import { CandleRepository } from '../db/repository';
import { Candle } from '../logic/types';
import { calculateReturns } from '../logic/math';

export class MarketDataProvider {
  private repo: CandleRepository;

  constructor() {
    this.repo = new CandleRepository();
  }

  /**
   * Fetches aligned candles for multiple symbols.
   * Uses "Inner Join" logic: only includes timestamps where ALL symbols have data.
   * This ensures that for any index i, all arrays have the same timestamp.
   */
  async getAlignedCandles(
    symbols: string[],
    interval: string,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, Candle[]>> {
    if (symbols.length === 0) return new Map();

    // Fetch raw data (potentially misaligned/gapped)
    const rawData = await this.repo.getMultiSymbolCandles(symbols, interval, startDate, endDate);

    // If any symbol is missing from the result (no data found), we can't align.
    // For intersection, if one symbol is missing, the result is empty.
    for (const symbol of symbols) {
      if (!rawData.has(symbol) || rawData.get(symbol)!.length === 0) {
        console.warn(`⚠️ No data found for ${symbol}. Alignment will result in empty set.`);
        return new Map();
      }
    }

    // If only one symbol, return as is (no intersection needed)
    if (symbols.length === 1) {
      return rawData;
    }

    // 1. Find intersection of timestamps
    // We map timestamps to the number of symbols that have them.
    const timestampCounts = new Map<string, number>();
    const totalSymbols = symbols.length;

    for (const [_, candles] of rawData) {
      for (const candle of candles) {
        const timeStr = candle.time.toISOString();
        timestampCounts.set(timeStr, (timestampCounts.get(timeStr) || 0) + 1);
      }
    }

    // 2. Identify valid timestamps (present in ALL symbols)
    const validTimestamps = new Set<string>();
    for (const [timeStr, count] of timestampCounts.entries()) {
      if (count === totalSymbols) {
        validTimestamps.add(timeStr);
      }
    }

    // 3. Filter and sort candles for each symbol
    const alignedData = new Map<string, Candle[]>();
    for (const [symbol, candles] of rawData) {
      const filtered = candles
        .filter(c => validTimestamps.has(c.time.toISOString()))
        .sort((a, b) => a.time.getTime() - b.time.getTime()); // Ensure sorted order
      
      alignedData.set(symbol, filtered);
    }

    return alignedData;
  }

  /**
   * Returns aligned percentage returns for multiple symbols.
   */
  async getAlignedReturns(
    symbols: string[],
    interval: string,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, number[]>> {
    const alignedCandles = await this.getAlignedCandles(symbols, interval, startDate, endDate);
    const alignedReturns = new Map<string, number[]>();

    for (const [symbol, candles] of alignedCandles) {
      const prices = candles.map(c => c.close);
      alignedReturns.set(symbol, calculateReturns(prices));
    }

    return alignedReturns;
  }
}
