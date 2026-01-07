/**
 * Calculates the Relative Strength Index (RSI).
 * Uses Wilder's Smoothing technique.
 * 
 * @param values Array of closing prices
 * @param period Standard period is usually 14
 */
export function calculateRSI(values: number[], period: number = 14): (number | null)[] {
    if (values.length < period + 1) {
        return values.map(() => null);
    }

    const rsiArray: (number | null)[] = [];
    
    // 1. Calculate Changes (Diff)
    const changes: number[] = [];
    for (let i = 1; i < values.length; i++) {
        changes.push(values[i] - values[i - 1]);
    }

    // Arrays to hold the running averages
    let avgGain = 0;
    let avgLoss = 0;

    // 2. Initial Calculation (Simple Average for the first 'period')
    // Note: We need 'period' amount of changes, which means 'period + 1' amount of prices.
    for (let i = 0; i < period; i++) {
        const change = changes[i];
        if (change > 0) avgGain += change;
        else avgLoss += Math.abs(change);
    }
    
    avgGain /= period;
    avgLoss /= period;

    // Fill the initial nulls (0 to period-1)
    // The first RSI value is available at index 'period'
    for (let i = 0; i < period; i++) {
        rsiArray.push(null);
    }

    // Calculate first RSI
    let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    rsiArray.push(rsi);

    // 3. Smooth Calculation for the rest
    for (let i = period; i < changes.length; i++) {
        const change = changes[i];
        const currentGain = change > 0 ? change : 0;
        const currentLoss = change < 0 ? Math.abs(change) : 0;

        // Wilder's Smoothing Formula:
        // ((Previous Avg * (N-1)) + Current) / N
        avgGain = ((avgGain * (period - 1)) + currentGain) / period;
        avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

        rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
        
        rsiArray.push(rsi);
    }

    return rsiArray;
}
