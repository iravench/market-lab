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
     * We also assume a simple "all-in" or "all-out" strategy for position sizing.
     */
    public executeSignal(signal: Signal, symbol: string, strategyName?: string): void {
        if (signal.action === 'BUY') {
            this.buy(symbol, signal.price, signal.timestamp);
        } else if (signal.action === 'SELL') {
            this.sell(symbol, signal.price, signal.timestamp);
        }
    }

    public buy(symbol: string, price: number, timestamp: Date): void {
        // Simple sizing: Use all available cash minus expected fees
        // To handle fees correctly: (Price * Qty) + Fee <= Cash
        // Let Fp = commission.percentage, Ff = commission.fixed
        // (Price * Qty) + (Price * Qty * Fp) + Ff <= Cash
        // Price * Qty * (1 + Fp) <= Cash - Ff
        // Qty = (Cash - Ff) / (Price * (1 + Fp))

        const maxSpendable = this.cash - this.commission.fixed;
        if (maxSpendable <= 0) return;

        const quantity = Math.floor(maxSpendable / (price * (1 + this.commission.percentage)));
        if (quantity <= 0) return;

        const tradeValue = price * quantity;
        const fee = (tradeValue * this.commission.percentage) + this.commission.fixed;
        const totalCost = tradeValue + fee;

        if (totalCost > this.cash) return; // Safety check

        this.cash -= totalCost;
        
        const existingPosition = this.positions.get(symbol);
        if (existingPosition) {
            const totalQty = existingPosition.quantity + quantity;
            const totalCostBasis = (existingPosition.averagePrice * existingPosition.quantity) + totalCost;
            existingPosition.quantity = totalQty;
            existingPosition.averagePrice = totalCostBasis / totalQty;
        } else {
            this.positions.set(symbol, {
                symbol,
                quantity,
                averagePrice: price
            });
        }

        this.trades.push({
            timestamp,
            action: 'BUY',
            price,
            quantity,
            fee,
            totalValue: totalCost
        });
    }

    public sell(symbol: string, price: number, timestamp: Date): void {
        const position = this.positions.get(symbol);
        if (!position || position.quantity <= 0) return;

        const quantity = position.quantity;
        const tradeValue = price * quantity;
        const fee = (tradeValue * this.commission.percentage) + this.commission.fixed;
        const totalCredit = tradeValue - fee;

        // Calculate Realized PnL
        // Cost Basis = Average Buy Price (incl fees) * Quantity
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
