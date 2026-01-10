import { Portfolio } from '../portfolio';

describe('Portfolio', () => {
    const SYMBOL = 'AAPL';

    it('should initialize with correct cash balance', () => {
        const portfolio = new Portfolio(10000);
        expect(portfolio.getState().cash).toBe(10000);
        expect(portfolio.getState().positions.size).toBe(0);
    });

    it('should allow buying assets', () => {
        const portfolio = new Portfolio(10000);
        // Explicitly requesting 100 shares
        portfolio.buy(SYMBOL, { action: 'BUY', price: 100, timestamp: new Date(), quantity: 100 });

        const state = portfolio.getState();
        expect(state.cash).toBe(0);
        expect(state.positions.get(SYMBOL)?.quantity).toBe(100);
        expect(state.trades.length).toBe(1);
        expect(state.trades[0].action).toBe('BUY');
    });

    it('should respect commission fees on BUY', () => {
        // Cash: 1000, Fee: $10 fixed
        // Max spendable on shares: 990
        // Price: 100.
        // If we request 9 shares: Cost = 900 + 10 = 910. Cash Left = 90.
        const portfolio = new Portfolio(1000, { fixed: 10 });
        portfolio.buy(SYMBOL, { action: 'BUY', price: 100, timestamp: new Date(), quantity: 9 });

        const state = portfolio.getState();
        expect(state.cash).toBe(1000 - 910); // 90
        expect(state.positions.get(SYMBOL)?.quantity).toBe(9);
        expect(state.trades[0].fee).toBe(10);
    });

    it('should respect percentage fees on BUY', () => {
        // Cash: 1000, Fee: 1%
        // Price: 100.
        // If we request 9 shares:
        // Value: 900. Fee: 9. Total: 909. Cash left: 91.
        const portfolio = new Portfolio(1000, { percentage: 0.01 });
        portfolio.buy(SYMBOL, { action: 'BUY', price: 100, timestamp: new Date(), quantity: 9 });

        const state = portfolio.getState();
        expect(state.cash).toBe(91);
        expect(state.trades[0].fee).toBe(9);
    });

    it('should allow selling assets', () => {
        const portfolio = new Portfolio(10000);
        portfolio.buy(SYMBOL, { action: 'BUY', price: 100, timestamp: new Date(), quantity: 100 }); // Buys 100 shares
        portfolio.sell(SYMBOL, { action: 'SELL', price: 110, timestamp: new Date() }); // Sells for $11,000

        const state = portfolio.getState();
        expect(state.cash).toBe(11000);
        expect(state.positions.has(SYMBOL)).toBe(false);
        expect(state.trades.length).toBe(2);
        expect(state.trades[1].action).toBe('SELL');
    });

    it('should deduct fees on SELL', () => {
        const portfolio = new Portfolio(10000, { fixed: 10 });
        portfolio.buy(SYMBOL, { action: 'BUY', price: 100, timestamp: new Date(), quantity: 99 }); 
        // 1. Buy: 99 shares @ 100.
        // Trade Value 9900. Fee 10. Cost 9910. Cash 90.
        
        // 2. Sell: 99 shares @ 110 = 10890.
        // Fee: 10. Net Credit: 10880.
        // Final Cash: 90 + 10880 = 10970.
        portfolio.sell(SYMBOL, { action: 'SELL', price: 110, timestamp: new Date() });
        
        expect(portfolio.getState().cash).toBe(10970);
    });

    it('should not allow buying with insufficient funds', () => {
        const portfolio = new Portfolio(50);
        // Try to buy 1 share at 100
        portfolio.buy(SYMBOL, { action: 'BUY', price: 100, timestamp: new Date(), quantity: 1 });

        expect(portfolio.getState().positions.size).toBe(0);
        expect(portfolio.getState().cash).toBe(50);
    });

    it('should calculate total portfolio value', () => {
        const portfolio = new Portfolio(1000);
        portfolio.buy(SYMBOL, { action: 'BUY', price: 100, timestamp: new Date(), quantity: 10 }); // Buys 10 shares. Cash: 0.
        
        // If price goes to 120, total value should be 1200
        expect(portfolio.getTotalValue(120, SYMBOL)).toBe(1200);
        // If price goes to 80, total value should be 800
        expect(portfolio.getTotalValue(80, SYMBOL)).toBe(800);
    });
});
