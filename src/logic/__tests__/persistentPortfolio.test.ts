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

    // Buy 50 shares @ 100. Cost = 5000 + 10 = 5010.
    await portfolio.executeSignal({
      action: 'BUY',
      price: 100,
      timestamp: new Date(),
      quantity: 50
    }, 'AAPL', 'TestStrategy');

    // Check In-Memory State
    const state = portfolio.getState();
    expect(state.cash).toBe(10000 - 5010); // 4990
    expect(state.positions.get('AAPL')?.quantity).toBe(50);

    // Check Database State
    const resPort = await pool.query('SELECT current_cash FROM portfolios WHERE id = $1', [portfolioId]);
    expect(parseFloat(resPort.rows[0].current_cash)).toBeCloseTo(4990);

    const resPos = await pool.query('SELECT quantity FROM positions WHERE portfolio_id = $1', [portfolioId]);
    expect(parseFloat(resPos.rows[0].quantity)).toBe(50);

    const resLedger = await pool.query('SELECT * FROM ledger_entries WHERE portfolio_id = $1', [portfolioId]);
    expect(resLedger.rows.length).toBe(1);
    expect(resLedger.rows[0].action).toBe('BUY');
  });

  it('should persist SELL execution', async () => {
    const portfolio = new PersistentPortfolio(portfolioId, 0, { fixed: 10 });
    await portfolio.load(); // Reloads state (50 shares)

    // Sell all 50 shares @ 110. Credit = 5500 - 10 = 5490.
    // New Cash = 4990 + 5490 = 10480.
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

  it('should load daily trades correctly', async () => {
    const portfolio = new PersistentPortfolio(portfolioId);
    
    // We already have a BUY and a SELL from previous tests executed "today" (new Date())
    const trades = await portfolio.loadDailyTrades(new Date());

    expect(trades.length).toBeGreaterThanOrEqual(2); // At least the Buy and Sell from above
    expect(trades.some(t => t.action === 'BUY')).toBe(true);
    expect(trades.some(t => t.action === 'SELL')).toBe(true);

    // Verify PnL is present on the SELL
    const sellTrade = trades.find(t => t.action === 'SELL');
    expect(sellTrade?.realizedPnL).toBeDefined();
    expect(sellTrade?.realizedPnL).not.toBe(0);

    // Verify requesting a different date returns nothing
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const oldTrades = await portfolio.loadDailyTrades(yesterday);
    expect(oldTrades.length).toBe(0);
  });
});
