import { CandleRepository } from '../db/repository';
import { Backtester } from '../logic/backtester';
import { Portfolio } from '../logic/portfolio';
import { RsiStrategy } from '../logic/strategies/rsiStrategy';
import pool from '../db';

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.error('Usage: npm run backtest <SYMBOL> <START_DATE> <END_DATE>');
        console.error('Example: npm run backtest BTC-USD 2023-01-01 2023-12-31');
        process.exit(1);
    }

    const [symbol, startStr, endStr] = args;
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const interval = '1d'; // Default to daily for now

    console.log(`🚀 Starting Backtest for ${symbol} (${interval})`);
    console.log(`📅 Period: ${startDate.toDateString()} - ${endDate.toDateString()}`);

    try {
        // 1. Fetch Data
        const repo = new CandleRepository();
        const candles = await repo.getCandles(symbol, interval, startDate, endDate);

        if (candles.length === 0) {
            console.error('❌ No data found for the specified range. Did you run "npm run backfill"?');
            process.exit(1);
        }
        console.log(`📊 Loaded ${candles.length} candles.`);

        // 2. Setup Components
        const initialCapital = 10000;
        const portfolio = new Portfolio(initialCapital, { fixed: 10 }); // $10 commission per trade
        const strategy = new RsiStrategy({ period: 14, buyThreshold: 30, sellThreshold: 70 });
        const backtester = new Backtester(strategy, portfolio, symbol);

        // 3. Run Simulation
        const result = backtester.run(candles);

        // 4. Report
        console.log('\n=======================================');
        console.log(`🏁 Backtest Complete: ${strategy.name}`);
        console.log('=======================================');
        console.log(`Initial Capital: $${result.initialCapital.toFixed(2)}`);
        console.log(`Final Capital:   $${result.finalCapital.toFixed(2)}`);
        console.log(`Total Return:    ${result.metrics.totalReturnPct.toFixed(2)}%`);
        console.log(`Max Drawdown:    ${result.metrics.maxDrawdownPct.toFixed(2)}%`);
        console.log(`Sharpe Ratio:    ${result.metrics.sharpeRatio.toFixed(3)}`);
        console.log(`Win Rate:        ${result.metrics.winRatePct.toFixed(2)}%`);
        console.log(`Total Trades:    ${result.trades.length}`);
        
        if (result.trades.length > 0) {
            console.log('\n📜 Trade History (Last 5):');
            result.trades.slice(-5).forEach(t => {
                console.log(`  [${t.timestamp.toISOString().split('T')[0]}] ${t.action} ${t.quantity} @ $${t.price.toFixed(2)} (Fee: $${t.fee.toFixed(2)})`);
            });
        }

    } catch (err) {
        console.error('❌ Error running backtest:', err);
    } finally {
        await pool.end();
    }
}

main();
