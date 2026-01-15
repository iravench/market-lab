import { Command } from 'commander';
import { MarketDataService } from './services/marketData';
import { runBacktestSimulation } from './scripts/runBacktest';
import pool from './db';

const program = new Command();

program
  .name('ml')
  .description('Market Lab CLI - Algorithmic Backtesting & Paper Trading Engine')
  .version('1.0.0');

// --- Command: Backfill ---
program
  .command('backfill')
  .alias('bf')
  .description('Download historical data for a symbol')
  .argument('<symbol>', 'Asset symbol (e.g., CBA.AX)')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)', '2023-01-01')
  .option('-i, --interval <interval>', 'Candle interval (1d, 1h)', '1d')
  .action(async (symbol, options) => {
    try {
      const service = new MarketDataService();
      await service.backfill(symbol, options.start, options.interval);
    } catch (err) {
      console.error('❌ Error during backfill:', err);
      process.exit(1);
    } finally {
        // MarketDataService manages its own connection but we should ensure everything is clean.
        // The service connects and releases.
    }
  });

// --- Command: Backtest ---
program
  .command('backtest')
  .alias('bt')
  .description('Run a backtest simulation')
  .argument('<symbols>', 'Comma-separated list of symbols (e.g., "BTC-USD,ETH-USD")')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)', '2023-01-01')
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)', '2023-12-31')
  .option('--strategy <name>', 'Strategy name', 'RsiStrategy')
  .action(async (symbolsStr, options) => {
    const symbols = symbolsStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const startDate = new Date(options.start);
    const endDate = new Date(options.end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('❌ Invalid dates provided.');
      process.exit(1);
    }

    try {
      await runBacktestSimulation(symbols, startDate, endDate, options.strategy);
    } catch (err) {
      console.error('❌ Error during backtest:', err);
      process.exit(1);
    } finally {
      // We must explicitly close the pool because runBacktestSimulation keeps it open
      // to support CLI usage without premature closing.
      await pool.end();
    }
  });

program.parse(process.argv);
