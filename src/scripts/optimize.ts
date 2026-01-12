import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { OptimizationConfig } from '../logic/optimizer/types';
import { BacktestRepository } from '../db/backtestRepository';
import { CandleRepository } from '../db/repository';
import { OptimizationRunner } from '../logic/optimizer/runner';
import { Candle } from '../logic/types';

async function main() {
  const configFile = process.argv[2];
  if (!configFile) {
    console.error('Usage: npm run optimize <config_file.json>');
    process.exit(1);
  }

  // 1. Load Config
  const configPath = path.resolve(process.cwd(), configFile);
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }
  
  const config: OptimizationConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  console.log(`🚀 Starting Optimization: ${config.strategyName}`);
  console.log(`🎯 Objective: ${config.objective}`);
  console.log(`🔎 Method: ${config.searchMethod}`);
  console.log(`📅 Date Range: ${config.startDate} to ${config.endDate}`);
  console.log(`📈 Assets: ${config.assets.join(', ')}`);

  // 2. Setup Dependencies
  const candleRepo = new CandleRepository();
  const backtestRepo = new BacktestRepository();

  // Get Git Commit for reproducibility
  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse HEAD').toString().trim();
  } catch (e) {
    console.warn('⚠️  Could not retrieve git commit hash.');
  }

  // 3. Load Data (Memory Heavy, but simple)
  console.log('⏳ Loading Market Data...');
  const universe = new Map<string, Candle[]>();
  
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);

  for (const symbol of config.assets) {
    const candles = await candleRepo.getCandles(symbol, '1d', startDate, endDate); // Assuming 1d for now
    if (candles.length === 0) {
      console.warn(`⚠️  No data found for ${symbol} in range.`);
    }
    universe.set(symbol, candles);
  }

  if (universe.size === 0) {
    console.error('❌ No data loaded. Aborting.');
    process.exit(1);
  }

  // 4. Run Optimization
  const runner = new OptimizationRunner(backtestRepo, universe);
  await runner.run(config, gitCommit, true);
  
  console.log('✅ Optimization Session Complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
