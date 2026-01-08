import pool from '../db';
import { Portfolio } from './portfolio';
import { PortfolioState, Position, Trade, Signal, CommissionConfig } from './types';
import { PoolClient } from 'pg';

export class PersistentPortfolio extends Portfolio {
    private portfolioId: string;
    
    constructor(portfolioId: string, initialCash: number = 0, commission: Partial<CommissionConfig> = {}) {
        // We initialize with 0 cash, but we will load the real state from DB immediately after
        super(initialCash, commission);
        this.portfolioId = portfolioId;
    }

    /**
     * Loads the portfolio state (Cash & Positions) from the database.
     */
    public async load(): Promise<void> {
        const client = await pool.connect();
        try {
            // 1. Load Cash
            const resPort = await client.query(
                `SELECT current_cash FROM portfolios WHERE id = $1`, 
                [this.portfolioId]
            );
            
            if (resPort.rows.length === 0) {
                throw new Error(`Portfolio ${this.portfolioId} not found`);
            }
            
            // Hack: access private property via 'any' or setter if we had one.
            // Since we are extending, we can change 'private' to 'protected' in base class 
            // OR just use this hack for now. 
            // Let's refactor the base class to 'protected' in a moment for cleanliness.
            this.cash = parseFloat(resPort.rows[0].current_cash);

            // 2. Load Positions
            const resPos = await client.query(
                `SELECT symbol, quantity, average_price FROM positions WHERE portfolio_id = $1`,
                [this.portfolioId]
            );

            const positionsMap = new Map<string, Position>();
            for (const row of resPos.rows) {
                positionsMap.set(row.symbol, {
                    symbol: row.symbol,
                    quantity: parseFloat(row.quantity),
                    averagePrice: parseFloat(row.average_price)
                });
            }
            this.positions = positionsMap;

            // 3. Load Trades (Optional - usually we don't need full history to trade, just state)
            // But for consistency let's leave trades empty or load last N if needed.
            this.trades = []; 

        } finally {
            client.release();
        }
    }

    /**
     * Overrides executeSignal to persist changes to the DB atomically.
     */
    public async executeSignal(signal: Signal, symbol: string): Promise<void> {
        // 1. Dry Run / InMemory check: 
        // We calculate what SHOULD happen using the base class logic first
        // to ensure validity (enough cash, etc).
        
        // However, the base class updates in-memory state. 
        // We need to wrap the DB update in a transaction.

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (signal.action === 'BUY') {
                await this.persistBuy(client, symbol, signal.price, signal.timestamp);
            } else if (signal.action === 'SELL') {
                await this.persistSell(client, symbol, signal.price, signal.timestamp);
            }

            await client.query('COMMIT');
            
            // Reload state from DB to be 100% in sync
            await this.load();

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    private async persistBuy(client: PoolClient, symbol: string, price: number, timestamp: Date) {
        // Re-implement logic with DB locks? 
        // Or simply calculate logic in memory, then update DB?
        // Safe approach: Read DB state with FOR UPDATE to lock row.

        const resPort = await client.query(
            `SELECT current_cash FROM portfolios WHERE id = $1 FOR UPDATE`, 
            [this.portfolioId]
        );
        const currentCash = parseFloat(resPort.rows[0].current_cash);

        // Get Commission
        const config = this.commission;
        
        // Logic: Max Spendable
        const maxSpendable = currentCash - config.fixed;
        if (maxSpendable <= 0) return; // Not enough cash

        const quantity = Math.floor(maxSpendable / (price * (1 + config.percentage)));
        if (quantity <= 0) return;

        const tradeValue = price * quantity;
        const fee = (tradeValue * config.percentage) + config.fixed;
        const totalCost = tradeValue + fee;

        if (totalCost > currentCash) return;

        // Update Cash
        const newCash = currentCash - totalCost;
        await client.query(
            `UPDATE portfolios SET current_cash = $1, updated_at = NOW() WHERE id = $2`,
            [newCash, this.portfolioId]
        );

        // Upsert Position
        // We need existing position for average price calc
        const resPos = await client.query(
            `SELECT quantity, average_price FROM positions WHERE portfolio_id = $1 AND symbol = $2`,
            [this.portfolioId, symbol]
        );

        let newQty = quantity;
        let newAvgPrice = price; // If new, cost basis is price (ignoring fees for avgPrice usually? No, we included them in base class)

        // In base class: existingPosition.averagePrice = totalCostBasis / totalQty;
        // totalCostBasis = (oldAvg * oldQty) + totalCost (incl fees)
        
        if (resPos.rows.length > 0) {
            const oldQty = parseFloat(resPos.rows[0].quantity);
            const oldAvg = parseFloat(resPos.rows[0].average_price);
            
            const totalCostBasis = (oldAvg * oldQty) + totalCost;
            newQty = oldQty + quantity;
            newAvgPrice = totalCostBasis / newQty;

            await client.query(
                `UPDATE positions SET quantity = $1, average_price = $2, updated_at = NOW() 
                 WHERE portfolio_id = $3 AND symbol = $4`,
                [newQty, newAvgPrice, this.portfolioId, symbol]
            );
        } else {
             // Initial cost basis per share = Total Cost / Qty
             newAvgPrice = totalCost / quantity;
             
             await client.query(
                `INSERT INTO positions (portfolio_id, symbol, quantity, average_price)
                 VALUES ($1, $2, $3, $4)`,
                [this.portfolioId, symbol, quantity, newAvgPrice]
             );
        }

        // Log Trade
        await client.query(
            `INSERT INTO ledger_entries (portfolio_id, timestamp, action, symbol, quantity, price, fee)
             VALUES ($1, $2, 'BUY', $3, $4, $5, $6)`,
            [this.portfolioId, timestamp, symbol, quantity, price, fee]
        );
    }

    private async persistSell(client: PoolClient, symbol: string, price: number, timestamp: Date) {
        // Lock Position
        const resPos = await client.query(
            `SELECT quantity, average_price FROM positions WHERE portfolio_id = $1 AND symbol = $2 FOR UPDATE`,
            [this.portfolioId, symbol]
        );

        if (resPos.rows.length === 0) return; // No position

        const qtyHeld = parseFloat(resPos.rows[0].quantity);
        const avgPrice = parseFloat(resPos.rows[0].average_price);
        
        if (qtyHeld <= 0) return;

        // Sell All (for now)
        const quantity = qtyHeld;
        
        // Calc Financials
        const config = this.commission;
        const tradeValue = price * quantity;
        const fee = (tradeValue * config.percentage) + config.fixed;
        const totalCredit = tradeValue - fee;

        // Calc PnL
        const costBasis = avgPrice * quantity;
        const realizedPnL = totalCredit - costBasis;

        // Update Cash
        await client.query(
            `UPDATE portfolios SET current_cash = current_cash + $1, updated_at = NOW() WHERE id = $2`,
            [totalCredit, this.portfolioId]
        );

        // Delete Position (since we sold all)
        await client.query(
            `DELETE FROM positions WHERE portfolio_id = $1 AND symbol = $2`,
            [this.portfolioId, symbol]
        );

        // Log Trade
        await client.query(
            `INSERT INTO ledger_entries (portfolio_id, timestamp, action, symbol, quantity, price, fee, realized_pnl)
             VALUES ($1, $2, 'SELL', $3, $4, $5, $6, $7)`,
            [this.portfolioId, timestamp, symbol, quantity, price, fee, realizedPnL]
        );
    }
}
