import pool from '../db';
import { BacktestRepository } from '../db/backtestRepository';
import { OptimizationRunner } from '../logic/optimizer/runner';
import { RegimeProfiler } from '../logic/analysis/regimeProfiler';
import { MarketDataProvider } from '../services/marketDataProvider';
import { Candle, BacktestMetrics } from '../logic/types';

async function main() {
  const args = process.argv.slice(2);
  // Simple argument parsing
  const symbol = args[0];
  if (!symbol || symbol.startsWith('--')) {
    console.error('Usage: npm run profile-asset <SYMBOL> [START_DATE] [END_DATE] [--objective=metric]');
    process.exit(1);
  }

  // Parse optional args
  const startDateArg = args[1] && !args[1].startsWith('--') ? args[1] : '2020-01-01';
  const endDateArg = args[2] && !args[2].startsWith('--') ? args[2] : new Date().toISOString().split('T')[0];

  const startDate = new Date(startDateArg);
  const endDate = new Date(endDateArg);

  // Parse Flag
  let objective: keyof BacktestMetrics = 'sharpeRatio';
  const objArg = args.find(a => a.startsWith('--objective='));
  if (objArg) {
    objective = objArg.split('=')[1] as keyof BacktestMetrics;
  }

  console.log(`
🕵️  Asset Personality Profiler: ${symbol}`);
  console.log(`📅 Range: ${startDate.toISOString().split('T')[0]} -> ${endDate.toISOString().split('T')[0]}`);
  console.log(`🎯 Objective: ${objective}`);

  // 1. Setup Data
  const backtestRepo = new BacktestRepository();
  const marketData = new MarketDataProvider();

  console.log('⏳ Loading Market Data...');
  const universe = await marketData.getAlignedCandles([symbol], '1d', startDate, endDate);
  const candles = universe.get(symbol) || [];

  console.log(`✅ Loaded ${candles.length} candles.`);

  if (candles.length < 200) {
    console.error('❌ Insufficient data for profiling (need at least ~1 year).');
    process.exit(1);
  }

  // 2. Setup Runner
  const runner = new OptimizationRunner(backtestRepo, universe);
  const profiler = new RegimeProfiler(runner);

  // 3. Run Profiler
  const report = await profiler.profileAsset(symbol, startDate, endDate, objective);

  // 4. Output
  console.log('\n==========================================');
  console.log(`🧠 ASSET IDENTITY: ${symbol}`);
  console.log(`📝 Conclusion: ${report.summary}`);
  console.log('==========================================');

  console.table(report.profiles.map(p => ({
    Year: p.year,
    Regime: p.regime,
    'Winner': p.winningStrategy,
    'Score': p.winningScore.toFixed(2),
    'Trend': p.details['Trend'].toFixed(2),
    'MeanRev': p.details['MeanRev'].toFixed(2),
    'Breakout': p.details['Breakout'].toFixed(2),
    'BuyHold': p.details['BuyHold'].toFixed(2),
  })));

  console.log('\n✅ Profiling Complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await pool.end();
});
