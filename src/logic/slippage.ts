import { Candle, SignalAction } from './types';

export interface SlippageModel {
  /**
   * Calculates the actual execution price including slippage.
   * @param price The ideal signal price
   * @param quantity The size of the order
   * @param candle The current market context (candle)
   * @param action BUY or SELL
   */
  calculateExecutionPrice(price: number, quantity: number, candle: Candle, action: SignalAction): number;
}

export class ZeroSlippage implements SlippageModel {
  calculateExecutionPrice(price: number, _qty: number, _candle: Candle, _action: SignalAction): number {
    return price;
  }
}

export class FixedPercentageSlippage implements SlippageModel {
  private percentage: number;

  constructor(percentage: number = 0.001) { // Default 0.1%
    this.percentage = percentage;
  }

  calculateExecutionPrice(price: number, _qty: number, _candle: Candle, action: SignalAction): number {
    if (action === 'BUY') {
      return price * (1 + this.percentage);
    } else if (action === 'SELL') {
      return price * (1 - this.percentage);
    }
    return price;
  }
}

export class VolatilitySlippage implements SlippageModel {
  private factor: number;

  constructor(factor: number = 0.1) { // e.g., 10% of the candle's range
    this.factor = factor;
  }

  calculateExecutionPrice(price: number, _qty: number, candle: Candle, action: SignalAction): number {
    const range = candle.high - candle.low;
    const slippage = range * this.factor;

    if (action === 'BUY') {
      return price + slippage;
    } else if (action === 'SELL') {
      return price - slippage;
    }
    return price;
  }
}
