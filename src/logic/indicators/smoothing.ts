/**
 * Applies Wilder's Smoothing (Modified Moving Average) to a data series.
 * 
 * Formula:
 * Val_t = ((Val_t-1 * (n-1)) + Data_t) / n
 * 
 * The first value is typically a Simple Moving Average (SMA) of the first 'n' elements.
 * 
 * @param data Array of numbers to smooth
 * @param period Smoothing period
 * @returns Array of smoothed values (same length as input, with nulls at start)
 */
export function wildersSmoothing(data: number[], period: number): (number | null)[] {
    const smoothed: (number | null)[] = [];
    
    if (data.length < period) {
        return data.map(() => null);
    }

    let prev: number = 0;

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            smoothed.push(null);
        } else if (i === period - 1) {
            // Initial seed: SMA
            let sum = 0;
            for (let j = 0; j <= i; j++) {
                sum += data[j];
            }
            prev = sum / period;
            smoothed.push(prev);
        } else {
            // Recursive smoothing
            const val = ((prev * (period - 1)) + data[i]) / period;
            smoothed.push(val);
            prev = val;
        }
    }

    return smoothed;
}
