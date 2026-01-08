import { Candle, Signal, Strategy } from '../types';
import { calculateRSI } from '../indicators/rsi';

export interface RsiStrategyConfig {
    period: number;
    buyThreshold: number;
    sellThreshold: number;
}

export class RsiStrategy implements Strategy {
    public readonly name = 'RSI Reversal';
    private config: RsiStrategyConfig;

    constructor(config: Partial<RsiStrategyConfig> = {}) {
        this.config = {
            period: 14,
            buyThreshold: 30,
            sellThreshold: 70,
            ...config
        };
    }

    analyze(candles: Candle[]): Signal {
        const lastCandle = candles[candles.length - 1];
        
        // Safety check for empty data
        if (!lastCandle) {
            return {
                action: 'HOLD',
                price: 0,
                timestamp: new Date(),
                reason: 'No data'
            };
        }

        const closePrices = candles.map(c => c.close);
        const rsiValues = calculateRSI(closePrices, this.config.period);
        
        // Get the most recent RSI value
        const currentRsi = rsiValues[rsiValues.length - 1];

        if (currentRsi === null) {
            return {
                action: 'HOLD',
                price: lastCandle.close,
                timestamp: lastCandle.time,
                reason: 'Insufficient data for RSI calculation'
            };
        }

        if (currentRsi < this.config.buyThreshold) {
            return {
                action: 'BUY',
                price: lastCandle.close,
                timestamp: lastCandle.time,
                reason: `RSI (${currentRsi.toFixed(2)}) < ${this.config.buyThreshold}`
            };
        }

        if (currentRsi > this.config.sellThreshold) {
            return {
                action: 'SELL',
                price: lastCandle.close,
                timestamp: lastCandle.time,
                reason: `RSI (${currentRsi.toFixed(2)}) > ${this.config.sellThreshold}`
            };
        }

        return {
            action: 'HOLD',
            price: lastCandle.close,
            timestamp: lastCandle.time,
            reason: `RSI (${currentRsi.toFixed(2)}) is neutral`
        };
    }
}
