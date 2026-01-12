import { Candle, IndicatorResult } from '../types';

export interface DonchianChannelsResult {
  upper: IndicatorResult[];
  lower: IndicatorResult[];
  middle: IndicatorResult[];
}

/**
 * Calculates Donchian Channels.
 * Upper = Max High of last N periods.
 * Lower = Min Low of last N periods.
 * Middle = (Upper + Lower) / 2.
 * 
 * @param candles 
 * @param period 
 */
export function calculateDonchianChannels(candles: Candle[], period: number = 20): DonchianChannelsResult {
  const upper: IndicatorResult[] = new Array(candles.length).fill(null);
  const lower: IndicatorResult[] = new Array(candles.length).fill(null);
  const middle: IndicatorResult[] = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i++) {
    // We need at least 1 candle to have a max/min, but usually indicators return null 
    // until full period is reached? 
    // For Donchian, it's often useful to have expanding channels from start.
    // But for consistency with SMA/Bollinger, let's look at the window.
    
    // Actually, simple max/min of available window if i < period is safer for some usages,
    // but strictly, it's defined over N periods.
    // Let's allow expanding window for i < period? 
    // No, standard is consistent nulls or strict window.
    // However, if we do window = slice(max(0, i-period+1), i+1), it handles both.
    
    const start = Math.max(0, i - period + 1);
    const window = candles.slice(start, i + 1);
    
    // Only calculate if we have at least 1 candle.
    // If strict compliance with "period", we should ensure window.length === period.
    // But expanding window is often preferred for Donchian to avoid massive null gaps at start.
    // Let's stick to expanding window (like TradingView often does for early bars).
    
    let maxHigh = -Infinity;
    let minLow = Infinity;

    for (const c of window) {
      if (c.high > maxHigh) maxHigh = c.high;
      if (c.low < minLow) minLow = c.low;
    }

    upper[i] = maxHigh;
    lower[i] = minLow;
    middle[i] = (maxHigh + minLow) / 2;
  }

  return { upper, lower, middle };
}
