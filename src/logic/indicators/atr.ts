import { Candle, IndicatorResult } from '../types';
import { wildersSmoothing } from './smoothing';

/**
 * Calculates the Average True Range (ATR).
 * ATR measures market volatility by decomposing the entire range of an asset price for that period.
 * Uses Wilder's Smoothing Method.
 * 
 * @param candles Array of Candle data
 * @param period Window size (typically 14)
 */
export function calculateATR(candles: Candle[], period: number): IndicatorResult[] {
    if (candles.length === 0) return [];
    if (period <= 0) return candles.map(() => null);

    const trueRanges: number[] = [];

    // 1. Calculate True Range (TR) for each candle
    for (let i = 0; i < candles.length; i++) {
        const current = candles[i];
        if (i === 0) {
            // First candle has no previous close
            trueRanges.push(current.high - current.low);
        } else {
            const previous = candles[i - 1];
            const tr = Math.max(
                current.high - current.low,
                Math.abs(current.high - previous.close),
                Math.abs(current.low - previous.close)
            );
            trueRanges.push(tr);
        }
    }

    // 2. Calculate ATR using Wilder's Smoothing
    return wildersSmoothing(trueRanges, period);
}
