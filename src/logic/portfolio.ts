import {
  Trade,
  Position,
  PortfolioState,
  CommissionConfig,
  SignalAction,
  Signal
} from './types';

export class Portfolio {
  protected cash: number;
  protected positions: Map<string, Position>;
  protected trades: Trade[];
  protected commission: CommissionConfig;
  public highWaterMark: number;

  constructor(initialCash: number, commission: Partial<CommissionConfig> = {}) {
    this.cash = initialCash;
    this.highWaterMark = initialCash;
    this.positions = new Map();
    this.trades = [];
    this.commission = {
      fixed: 0,
      percentage: 0,
      ...commission
    };
  }

  /**
   * Executes a signal.
   * For simplicity in this early version, we assume a single symbol.
   */
  public executeSignal(signal: Signal, symbol: string, strategyName?: string): void {
    if (signal.action === 'BUY') {
      this.buy(symbol, signal);
    } else if (signal.action === 'SELL') {
      this.sell(symbol, signal);
    }
  }

  /**
   * Calculates the financial details of a BUY trade.
   * Pure math: determines max affordable quantity, fees, and total cost.
   */
  public calculateBuyDetails(availableCash: number, price: number, requestedQuantity: number) {
    if (requestedQuantity <= 0) return null;

    const maxSpendable = availableCash - this.commission.fixed;
    if (maxSpendable <= 0) return null;

    // Calculate maximum affordable quantity considering commission
    const maxAffordableQty = Math.floor(maxSpendable / (price * (1 + this.commission.percentage)));

    // Final quantity is the lesser of what Risk Manager requested and what we can afford.
    const finalQuantity = Math.min(requestedQuantity, maxAffordableQty);

    if (finalQuantity <= 0) return null;

    const tradeValue = price * finalQuantity;
    const fee = (tradeValue * this.commission.percentage) + this.commission.fixed;
    const totalCost = tradeValue + fee;

    // Safety check
    if (totalCost > availableCash) return null;

    return { finalQuantity, fee, totalCost, tradeValue };
  }

  /**
   * Calculates the financial details of a SELL trade.
   * Pure math: determines fees, credit, and realized PnL.
   */
  public calculateSellDetails(quantityToSell: number, price: number, avgEntryPrice: number) {
    if (quantityToSell <= 0) return null;

    const tradeValue = price * quantityToSell;
    const fee = (tradeValue * this.commission.percentage) + this.commission.fixed;
    const totalCredit = tradeValue - fee;

    // Calculate Realized PnL
    const costBasis = avgEntryPrice * quantityToSell;
    const realizedPnL = totalCredit - costBasis;

    return { fee, totalCredit, realizedPnL, tradeValue };
  }

  public buy(symbol: string, signal: Signal): void {
    const { price, timestamp, quantity, stopLoss, takeProfit } = signal;

    if (quantity === undefined || quantity <= 0) return;

    const details = this.calculateBuyDetails(this.cash, price, quantity);
    if (!details) return;

    const { finalQuantity, fee, totalCost } = details;

    this.cash -= totalCost;

    const existingPosition = this.positions.get(symbol);
    if (existingPosition) {
      const totalQty = existingPosition.quantity + finalQuantity;
      const totalCostBasis = (existingPosition.averagePrice * existingPosition.quantity) + totalCost;
      existingPosition.quantity = totalQty;
      existingPosition.averagePrice = totalCostBasis / totalQty;

      // Update stops if provided (overwrite)
      if (stopLoss !== undefined) existingPosition.stopLoss = stopLoss;
      if (takeProfit !== undefined) existingPosition.takeProfit = takeProfit;
    } else {
      this.positions.set(symbol, {
        symbol,
        quantity: finalQuantity,
        averagePrice: price,
        stopLoss,
        takeProfit
      });
    }

    this.trades.push({
      timestamp,
      symbol,
      action: 'BUY',
      price,
      quantity: finalQuantity,
      fee,
      totalValue: totalCost
    });
  }

  public sell(symbol: string, signal: Signal): void {
    const { price, timestamp, quantity } = signal;
    const position = this.positions.get(symbol);
    if (!position || position.quantity <= 0) return;

    // Determine quantity to sell: Use signal quantity if valid, else sell all.
    // Also clamp to position quantity.
    let quantityToSell = position.quantity;
    if (quantity !== undefined && quantity > 0) {
      quantityToSell = Math.min(quantity, position.quantity);
    }

    const details = this.calculateSellDetails(quantityToSell, price, position.averagePrice);
    if (!details) return;

    const { fee, totalCredit, realizedPnL } = details;

    this.cash += totalCredit;

    // Update position
    if (quantityToSell >= position.quantity) {
      this.positions.delete(symbol);
    } else {
      position.quantity -= quantityToSell;
    }

    this.trades.push({
      timestamp,
      symbol,
      action: 'SELL',
      price,
      quantity: quantityToSell,
      fee,
      totalValue: totalCredit,
      realizedPnL
    });
  }

  public getState(): PortfolioState {
    return {
      cash: this.cash,
      positions: new Map(this.positions),
      trades: [...this.trades]
    };
  }

  public getTotalValue(currentPrice: number, symbol: string): number {
    const position = this.positions.get(symbol);
    const positionValue = position ? position.quantity * currentPrice : 0;
    return this.cash + positionValue;
  }
}
