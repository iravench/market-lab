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

export interface Trade {
    timestamp: Date;
    action: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    fee: number;
    totalValue: number; // price * quantity + fee (for BUY) or - fee (for SELL)
}

export interface Position {
    symbol: string;
    quantity: number;
    averagePrice: number;
}

export interface PortfolioState {
    cash: number;
    positions: Map<string, Position>;
    trades: Trade[];
}

export interface CommissionConfig {
    fixed: number;      // Fixed fee per trade (e.g., $10)
    percentage: number; // Percentage fee (e.g., 0.001 for 0.1%)
}
