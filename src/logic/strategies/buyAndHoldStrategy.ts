import { Candle, Signal, Strategy } from '../types';

export class BuyAndHoldStrategy implements Strategy {
  public readonly name = 'Buy & Hold';

  analyze(candles: Candle[]): Signal {
    const lastCandle = candles[candles.length - 1];
    
    // Always signal BUY.
    // The Execution Engine (Backtester/Live) is responsible for handling 
    // "Already in position" logic (it ignores BUY if position exists).
    // Or, more politely, we can just signal BUY.
    
    return {
      action: 'BUY',
      price: lastCandle?.close || 0,
      timestamp: lastCandle?.time || new Date(),
      reason: 'Buy and Hold Forever'
    };
  }
}
