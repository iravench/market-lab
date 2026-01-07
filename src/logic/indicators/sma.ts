import { Candle } from '../types';

/**
 * Calculates the Simple Moving Average (SMA) of a series.
 * SMA = (Sum of Prices over N periods) / N
 * 
 * @param values Array of numbers (usually close prices)
 * @param period The window size
 */
export function calculateSMA(values: number[], period: number): (number | null)[] {
    if (period <= 0) return values.map(() => null);
    
    return values.map((_, index) => {
        const start = index - period + 1;
        if (start < 0) return null; // Not enough data points yet
        
        const window = values.slice(start, index + 1);
        const sum = window.reduce((acc, val) => acc + val, 0);
        return sum / period;
    });
}
