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

    constructor(initialCash: number, commission: Partial<CommissionConfig> = {}) {
        this.cash = initialCash;
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

    public buy(symbol: string, signal: Signal): void {
        const { price, timestamp, quantity, stopLoss, takeProfit } = signal;

        // In this version, we REQUIRE an explicit quantity for buys (provided by Risk Manager).
        if (quantity === undefined || quantity <= 0) {
            return;
        }

        const maxSpendable = this.cash - this.commission.fixed;
        if (maxSpendable <= 0) return;

        // Calculate maximum affordable quantity considering commission
        const maxAffordableQty = Math.floor(maxSpendable / (price * (1 + this.commission.percentage)));
        
        // Final quantity is the lesser of what Risk Manager requested and what we can afford.
        const finalQuantity = Math.min(quantity, maxAffordableQty);

        if (finalQuantity <= 0) return;

        const tradeValue = price * finalQuantity;
        const fee = (tradeValue * this.commission.percentage) + this.commission.fixed;
        const totalCost = tradeValue + fee;

        // Double check cost (should be safe due to math above, but floats can be tricky)
        if (totalCost > this.cash) return; 

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
            action: 'BUY',
            price,
            quantity: finalQuantity,
            fee,
            totalValue: totalCost
        });
    }

    public sell(symbol: string, signal: Signal): void {
        const { price, timestamp } = signal;
        const position = this.positions.get(symbol);
        if (!position || position.quantity <= 0) return;

        const quantity = position.quantity;
        const tradeValue = price * quantity;
        const fee = (tradeValue * this.commission.percentage) + this.commission.fixed;
        const totalCredit = tradeValue - fee;

        // Calculate Realized PnL
        const costBasis = position.averagePrice * quantity;
        const realizedPnL = totalCredit - costBasis;

        this.cash += totalCredit;
        this.positions.delete(symbol);

        this.trades.push({
            timestamp,
            action: 'SELL',
            price,
            quantity,
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
