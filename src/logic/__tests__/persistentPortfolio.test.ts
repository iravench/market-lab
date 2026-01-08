import pool from '../../db';
import { PersistentPortfolio } from '../persistentPortfolio';

describe('PersistentPortfolio', () => {
    let portfolioId: string;

    beforeAll(async () => {
        // Create a fresh portfolio for testing
        const res = await pool.query(`
            INSERT INTO portfolios (name, initial_cash, current_cash)
            VALUES ('Test Portfolio', 10000, 10000)
            RETURNING id
        `);
        portfolioId = res.rows[0].id;
    });

    afterAll(async () => {
        // Cleanup
        await pool.query('DELETE FROM portfolios WHERE id = $1', [portfolioId]);
        await pool.end();
    });

    it('should load initial state from database', async () => {
        const portfolio = new PersistentPortfolio(portfolioId, 0, { fixed: 10 });
        await portfolio.load();

        const state = portfolio.getState();
        expect(state.cash).toBe(10000);
        expect(state.positions.size).toBe(0);
    });

    it('should persist BUY execution', async () => {
        const portfolio = new PersistentPortfolio(portfolioId, 0, { fixed: 10 });
        await portfolio.load();

        // Buy 10 shares @ 100
        await portfolio.executeSignal({
            action: 'BUY',
            price: 100,
            timestamp: new Date()
        }, 'AAPL', 'TestStrategy');

        // Check In-Memory State
        const state = portfolio.getState();
        expect(state.cash).toBeLessThan(10000); // 10000 - 1000 - 10 = 8990
        expect(state.positions.get('AAPL')?.quantity).toBe(99); // max spendable logic

        // Check Database State
        const resPort = await pool.query('SELECT current_cash FROM portfolios WHERE id = $1', [portfolioId]);
        expect(parseFloat(resPort.rows[0].current_cash)).toBeCloseTo(state.cash);

        const resPos = await pool.query('SELECT quantity FROM positions WHERE portfolio_id = $1', [portfolioId]);
        expect(parseFloat(resPos.rows[0].quantity)).toBe(99);

        const resLedger = await pool.query('SELECT * FROM ledger_entries WHERE portfolio_id = $1', [portfolioId]);
        expect(resLedger.rows.length).toBe(1);
        expect(resLedger.rows[0].action).toBe('BUY');
    });

    it('should persist SELL execution', async () => {
        const portfolio = new PersistentPortfolio(portfolioId, 0, { fixed: 10 });
        await portfolio.load(); // Reloads state (99 shares)

        // Sell all 99 shares @ 110
        await portfolio.executeSignal({
            action: 'SELL',
            price: 110,
            timestamp: new Date()
        }, 'AAPL', 'TestStrategy');

        // Check DB
        const resPos = await pool.query('SELECT * FROM positions WHERE portfolio_id = $1', [portfolioId]);
        expect(resPos.rows.length).toBe(0); // Position deleted

        const resLedger = await pool.query('SELECT * FROM ledger_entries WHERE portfolio_id = $1 ORDER BY created_at DESC', [portfolioId]);
        expect(resLedger.rows[0].action).toBe('SELL');
        expect(parseFloat(resLedger.rows[0].realized_pnl)).toBeGreaterThan(0);
    });
});
