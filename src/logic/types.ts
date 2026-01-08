export interface Candle {
    time: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export type IndicatorResult = number | null;

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';

export interface Signal {
    action: SignalAction;
    price: number;
    timestamp: Date;
    reason?: string;
}

/**
 * A Strategy (or Signal Generator) analyzes market data and produces a Signal.
 * It is a pure function or class method that takes history and returns a decision for the latest point.
 */
export interface Strategy {
    name: string;
    analyze(candles: Candle[]): Signal;
}