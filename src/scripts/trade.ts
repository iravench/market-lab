import { PersistentPortfolio } from '../logic/persistentPortfolio';
import { RsiStrategy } from '../logic/strategies/rsiStrategy';
import { CandleRepository } from '../db/repository';
import pool from '../db';
import yahooFinance from 'yahoo-finance2';
import { Candle } from '../logic/types';

async function main() {
    const args = process.argv.slice(2);
    // Usage: npm run trade <PORTFOLIO_ID> <SYMBOL> <MODE: DRY|LIVE>
    if (args.length < 3) {
        console.error('Usage: npm run trade <PORTFOLIO_ID> <SYMBOL> <MODE: DRY|LIVE>');
        process.exit(1);
    }

    const [portfolioId, symbol, mode] = args;
    const isLive = mode.toUpperCase() === 'LIVE';

    console.log(`🤖 Starting Bot for ${symbol}`);
    console.log(`📂 Portfolio: ${portfolioId}`);
    console.log(`⚠️  Mode: ${mode.toUpperCase()}`);

    try {
        // 1. Fetch Data (History + Latest)
        // We need enough history for the strategy (e.g., RSI 14 needs ~20-30 candles to be safe)
        // Let's fetch last 100 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 200); // 200 days back

        // First, backfill/ensure we have data up to "yesterday" in DB? 
        // Or just fetch live from API entirely for this session?
        // For simplicity in this iteration: Fetch fresh from API to ensure we have "Now".
        
        console.log('📥 Fetching latest market data...');
        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '1d' as const,
        };
        
        const yf = new yahooFinance({ suppressNotices: ['ripHistorical'] });
        const response = await yf.chart(symbol, queryOptions);
        
        if (!response || !response.quotes || response.quotes.length === 0) {
            throw new Error('No data returned from API');
        }

        const candles: Candle[] = response.quotes
            .filter(q => q.open !== null && q.close !== null) // Filter gaps
            .map(q => ({
                time: q.date,
                open: q.open!,
                high: q.high!,
                low: q.low!,
                close: q.close!,
                volume: q.volume || 0
            }));

        console.log(`📊 Analyzed ${candles.length} candles.`);

        // 2. Load Portfolio
        const portfolio = new PersistentPortfolio(portfolioId, 0, { fixed: 10 });
        await portfolio.load();
        
        const state = portfolio.getState();
        console.log(`💰 Cash: $${state.cash.toFixed(2)}`);
        const pos = state.positions.get(symbol);
        if (pos) {
            console.log(`📦 Holding: ${pos.quantity} shares @ $${pos.averagePrice.toFixed(2)}`);
        } else {
            console.log(`📦 Holding: None`);
        }

        // 3. Run Strategy
        const strategy = new RsiStrategy({ period: 14, buyThreshold: 30, sellThreshold: 70 });
        const signal = strategy.analyze(candles);

        console.log(`\n💡 Signal: ${signal.action} @ $${signal.price.toFixed(2)}`);
        console.log(`   Reason: ${signal.reason}`);

        // 4. Execute
        if (signal.action !== 'HOLD') {
            if (isLive) {
                console.log('🚀 Executing LIVE trade...');
                await portfolio.executeSignal(signal, symbol, strategy.name);
                console.log('✅ Trade executed successfully.');
                
                // Show new state
                const newState = portfolio.getState();
                console.log(`💰 New Cash: $${newState.cash.toFixed(2)}`);
            } else {
                console.log('🛑 DRY RUN: Trade NOT executed.');
            }
        } else {
            console.log('💤 No action required.');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

main();
