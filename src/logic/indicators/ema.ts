/**
 * Calculates the Exponential Moving Average (EMA).
 * Reacts faster to recent price changes than SMA.
 * 
 * @param values Array of prices
 * @param period Window size
 */
export function calculateEMA(values: number[], period: number): (number | null)[] {
    const emaArray: (number | null)[] = [];
    const k = 2 / (period + 1);

    if (values.length < period) {
        return values.map(() => null);
    }

    // 1. Fill initial nulls
    // For a period of N, the first N-1 points are null.
    for (let i = 0; i < period - 1; i++) {
        emaArray.push(null);
    }

    // 2. Initial Seed: SMA of the first 'period' values
    // The Nth point (index N-1) is the simple average of the first N points.
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += values[i];
    }
    let prevEMA = sum / period;
    emaArray.push(prevEMA);

    // 3. Calculate the rest using the recursive formula
    for (let i = period; i < values.length; i++) {
        const price = values[i];
        // EMA_today = (Price_today * k) + (EMA_yesterday * (1 - k))
        const ema = (price * k) + (prevEMA * (1 - k));
        emaArray.push(ema);
        prevEMA = ema;
    }

    return emaArray;
}
