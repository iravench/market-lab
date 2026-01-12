import { Candle, IndicatorResult } from '../types';

/**
 * On-Balance Volume (OBV)
 * Measures buying and selling pressure as a cumulative indicator.
 */
export function calculateOBV(candles: Candle[]): IndicatorResult[] {
  if (candles.length === 0) return [];

  const results: IndicatorResult[] = new Array(candles.length).fill(null);
  
  // Initialize with the first candle's volume
  // Some variations start at 0, but starting at first volume is common.
  // Actually, standard definition: "If today close > yest close, OBV = prevOBV + todayVol".
  // What is the base OBV? Usually 0.
  // Let's stick to the test expectation: First value is just its volume (as if added to 0).
  // Or usually, the first OBV value is arbitrary. Let's start with candles[0].volume as the baseline.
  
  let currentOBV = candles[0].volume;
  results[0] = currentOBV;

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];

    if (current.close > prev.close) {
      currentOBV += current.volume;
    } else if (current.close < prev.close) {
      currentOBV -= current.volume;
    }
    // If equal, OBV remains same

    results[i] = currentOBV;
  }

  return results;
}

/**
 * Volume Weighted Average Price (VWAP)
 * Note: This implements a "Rolling VWAP" over the provided dataset, 
 * not an "Anchored VWAP" that resets daily (unless the dataset is 1 day).
 * In backtesting context, this is the cumulative VWAP of the loaded history.
 */
export function calculateVWAP(candles: Candle[]): IndicatorResult[] {
  const results: IndicatorResult[] = new Array(candles.length).fill(null);
  
  let cumTPV = 0; // Cumulative (Typical Price * Volume)
  let cumVol = 0; // Cumulative Volume

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    const tpv = tp * c.volume;

    cumTPV += tpv;
    cumVol += c.volume;

    if (cumVol === 0) {
      results[i] = null;
    } else {
      results[i] = cumTPV / cumVol;
    }
  }

  return results;
}

/**
 * Money Flow Index (MFI)
 * A volume-weighted RSI.
 * @param period Default 14
 */
export function calculateMFI(candles: Candle[], period: number = 14): IndicatorResult[] {
  const results: IndicatorResult[] = new Array(candles.length).fill(null);
  
  if (candles.length < period + 1) return results;

  const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
  const rawMoneyFlow = candles.map((c, i) => typicalPrices[i] * c.volume);

  // We need to determine Positive/Negative flow based on CHANGE in Typical Price
  // Flow[i] depends on TP[i] vs TP[i-1]
  
  const posFlow: number[] = new Array(candles.length).fill(0);
  const negFlow: number[] = new Array(candles.length).fill(0);

  for (let i = 1; i < candles.length; i++) {
    if (typicalPrices[i] > typicalPrices[i - 1]) {
      posFlow[i] = rawMoneyFlow[i];
    } else if (typicalPrices[i] < typicalPrices[i - 1]) {
      negFlow[i] = rawMoneyFlow[i];
    }
    // If equal, flow is discarded (0)
  }

  // Calculate MFI
  // MFI[i] uses sum of flows from i-period+1 to i
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) continue; // Need 'period' amount of flow data (which starts at index 1)
    
    // Actually, standard RSI/MFI usually needs period+1 data points to get 'period' changes.
    // Flow starts at index 1.
    // To have 'period' flows, we need index >= period.
    // e.g. Period 2. Flow available at 1, 2. Sum(1,2). Current index 2.
    
    let sumPos = 0;
    let sumNeg = 0;

    for (let j = 0; j < period; j++) {
      const idx = i - j;
      sumPos += posFlow[idx];
      sumNeg += negFlow[idx];
    }

    if (sumNeg === 0) {
      results[i] = 100;
    } else {
      const moneyFlowRatio = sumPos / sumNeg;
      results[i] = 100 - (100 / (1 + moneyFlowRatio));
    }
  }

  return results;
}
