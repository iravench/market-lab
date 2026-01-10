import { Candle, IndicatorResult } from '../types';
import { wildersSmoothing } from './smoothing';

/**
 * Calculates the Average Directional Index (ADX).
 * ADX measures the strength of a trend regardless of direction.
 * 
 * @param candles Array of Candle data
 * @param period Window size (typically 14)
 */
export function calculateADX(candles: Candle[], period: number): IndicatorResult[] {
  if (candles.length < period * 2 - 1) {
    return candles.map(() => null);
  }

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  // 1. Calculate TR and DM
  for (let i = 0; i < candles.length; i++) {
    const curr = candles[i];
    if (i === 0) {
      tr.push(curr.high - curr.low);
      plusDM.push(0);
      minusDM.push(0);
    } else {
      const prev = candles[i - 1];

      // True Range
      tr.push(Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      ));

      // Directional Movement
      const upMove = curr.high - prev.high;
      const downMove = prev.low - curr.low;

      if (upMove > downMove && upMove > 0) {
        plusDM.push(upMove);
        minusDM.push(0);
      } else if (downMove > upMove && downMove > 0) {
        plusDM.push(0);
        minusDM.push(downMove);
      } else {
        plusDM.push(0);
        minusDM.push(0);
      }
    }
  }

  // 2. Smooth TR, +DM, -DM (Wilder's Smoothing)
  const smoothedTR = wildersSmoothing(tr, period);
  const smoothedPlusDM = wildersSmoothing(plusDM, period);
  const smoothedMinusDM = wildersSmoothing(minusDM, period);

  // 3. Calculate DX
  const dx: number[] = [];

  // We can only calculate DX where smoothed values are not null
  for (let i = 0; i < candles.length; i++) {
    const sTR = smoothedTR[i];
    const sPDM = smoothedPlusDM[i];
    const sMDM = smoothedMinusDM[i];

    if (sTR === null || sPDM === null || sMDM === null || sTR === 0) {
      dx.push(0); // Using 0 for pre-period values to simplify next smoothing step logic
      continue;
    }

    const plusDI = (sPDM / sTR) * 100;
    const minusDI = (sMDM / sTR) * 100;
    const sum = plusDI + minusDI;

    const val = sum === 0 ? 0 : (Math.abs(plusDI - minusDI) / sum) * 100;
    dx.push(val);
  }

  // 4. Calculate ADX: The SMA of the DX values over the period
  // Note: The standard definition says ADX is the *Smoothed* average of DX.
  // However, classical calculation often treats the first ADX as SMA of DX, then Wilder's thereafter.
  // Or simpler: Just apply Wilder's Smoothing to DX.
  // Let's use Wilder's Smoothing on DX to be consistent with standard libraries.

  // BUT: The input to this second smoothing must align.
  // The first valid DX appears at index `period - 1`.
  // So the DX array has `period - 1` leading zeros/garbage.

  // To handle this correctly with our generic `wildersSmoothing`, we should strip the invalid prefix, 
  // smooth, then pad back, or just pass it in if the helper handles leading zeros correctly (it doesn't, it treats them as data).

  // Let's slice the valid DX part.
  const validDXStartIndex = period - 1;
  const validDX = dx.slice(validDXStartIndex);

  // Smooth the valid DX values
  const validADX = wildersSmoothing(validDX, period);

  // Pad the result back to match candle length
  const finalADX: IndicatorResult[] = [];

  // Fill nulls for the prefix where DX wasn't valid + the prefix where ADX smoothing wasn't valid
  for (let i = 0; i < validDXStartIndex; i++) {
    finalADX.push(null);
  }

  // Push the smoothed values (which will also have `period-1` nulls at their start)
  for (let val of validADX) {
    finalADX.push(val);
  }

  return finalADX;
}
