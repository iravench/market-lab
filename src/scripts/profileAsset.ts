import pool from '../db';
import { BacktestRepository } from '../db/backtestRepository';
import { OptimizationRunner } from '../logic/optimizer/runner';
import { RegimeProfiler } from '../logic/analysis/regimeProfiler';
import { MarketDataProvider } from '../services/marketDataProvider';
import { Candle } from '../logic/types';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: npm run profile-asset <SYMBOL> [START_DATE] [END_DATE]');
    process.exit(1);
  }

  const symbol = args[0];
  const startDate = args[1] ? new Date(args[1]) : new Date('2020-01-01');
  const endDate = args[2] ? new Date(args[2]) : new Date(); // Now

  console.log(`
🕵️  Asset Personality Profiler: ${symbol}`);
  console.log(`📅 Range: ${startDate.toISOString().split('T')[0]} -> ${endDate.toISOString().split('T')[0]}`);

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
  const report = await profiler.profileAsset(symbol, startDate, endDate);

  // 4. Output
  console.log('\n==========================================');
  console.log(`🧠 ASSET IDENTITY: ${symbol}`);
  console.log(`📝 Conclusion: ${report.summary}`);
  console.log('==========================================');
  
  console.table(report.profiles.map(p => ({
    Year: p.year,
    Regime: p.regime,
    'Winner': p.winningStrategy,
    'Sharpe': p.winningSharpe.toFixed(2),
    'Trend (SR)': p.details['Trend'].toFixed(2),
    'MeanRev (SR)': p.details['MeanRev'].toFixed(2),
    'Breakout (SR)': p.details['Breakout'].toFixed(2),
    'BuyHold (SR)': p.details['BuyHold'].toFixed(2),
  })));

  console.log('\n✅ Profiling Complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await pool.end();
});
