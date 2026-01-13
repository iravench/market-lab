import fs from 'fs';
import path from 'path';
import { WalkForwardConfig, OptimizationConfig } from '../logic/optimizer/types';
import { BacktestRepository, BacktestRun } from '../db/backtestRepository';
import { CandleRepository } from '../db/repository';
import { OptimizationRunner } from '../logic/optimizer/runner';
import { Candle, RiskConfig } from '../logic/types';
import { Portfolio } from '../logic/portfolio';
import { Backtester } from '../logic/backtester';
import { RsiStrategy } from '../logic/strategies/rsiStrategy';
import { RiskManager } from '../logic/risk/risk_manager';

const STRATEGY_REGISTRY: Record<string, any> = {
  'RsiStrategy': RsiStrategy,
  'RSI Reversal': RsiStrategy,
};

async function main() {
  const configFile = process.argv[2];
  if (!configFile) {
    console.error('Usage: npm run walk-forward <config_file.json>');
    process.exit(1);
  }

  const configPath = path.resolve(process.cwd(), configFile);
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }
  
  const wfConfig: WalkForwardConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  console.log(`🚀 Starting Walk-Forward Analysis: ${wfConfig.strategyName}`);
  console.log(`📅 Total Range: ${wfConfig.startDate} to ${wfConfig.endDate}`);
  console.log(`📏 Windows: Train=${wfConfig.trainWindowDays}d, Test=${wfConfig.testWindowDays}d, Anchored=${wfConfig.anchored}`);

  const candleRepo = new CandleRepository();
  const backtestRepo = new BacktestRepository();
  
  // Load ALL Data
  console.log('⏳ Loading Market Data...');
  const universe = new Map<string, Candle[]>();
  const totalStart = new Date(wfConfig.startDate);
  const totalEnd = new Date(wfConfig.endDate);

  for (const symbol of wfConfig.assets) {
    const candles = await candleRepo.getCandles(symbol, '1d', totalStart, totalEnd);
    if (candles.length > 0) {
        universe.set(symbol, candles);
    }
  }
  
  if (universe.size === 0) {
      console.error('❌ No data found.');
      process.exit(1);
  }

  // Generate Windows
  const windows = generateWindows(totalStart, totalEnd, wfConfig);
  console.log(`✅ Generated ${windows.length} Walk-Forward Windows.`);

  const oosResults: BacktestRun[] = [];

  for (const window of windows) {
    console.log(`
🔹 Window ${window.id}: Train [${window.trainStart.toISOString().split('T')[0]} -> ${window.trainEnd.toISOString().split('T')[0]}] | Test [${window.testStart.toISOString().split('T')[0]} -> ${window.testEnd.toISOString().split('T')[0]}]`);

    // 1. Optimize on Train
    const trainConfig: OptimizationConfig = {
      ...wfConfig,
      startDate: window.trainStart.toISOString(),
      endDate: window.trainEnd.toISOString(),
    };

    const runner = new OptimizationRunner(backtestRepo, universe);
    // Suppress inner logs
    const trainResults = await runner.run(trainConfig, 'WF-Train', false); 

    if (trainResults.length === 0) {
      console.warn('⚠️  No results from optimization. Skipping window.');
      continue;
    }

    // 2. Find Best Param
    const bestRun = findBestRun(trainResults, wfConfig.objective);
    console.log(`   🏆 Best Train Params: ${JSON.stringify(bestRun.parameters)} (${wfConfig.objective}: ${(bestRun.metrics as any)[wfConfig.objective]?.toFixed(3)})`);

    // 3. Test on Out-of-Sample (Test Window)
    try {
        const testResult = runBacktest(
           wfConfig.strategyName, 
           bestRun.parameters, 
           universe, 
           window.testStart, 
           window.testEnd, 
           wfConfig.assets
        );

        if (testResult) {
          const metricVal = (testResult.metrics as any)[wfConfig.objective];
          console.log(`   🧪 OOS Result: ${wfConfig.objective}: ${metricVal?.toFixed(3)} | Return: ${testResult.metrics.totalReturnPct.toFixed(2)}% | DD: ${testResult.metrics.maxDrawdownPct.toFixed(2)}%`);
          oosResults.push({
            ...bestRun,
            id: `oos-${window.id}`,
            metrics: testResult.metrics,
            time_range_start: window.testStart,
            time_range_end: window.testEnd,
            created_at: new Date()
          });
        }
    } catch (e: any) {
        console.error(`   ❌ OOS Backtest Failed: ${e.message}`);
    }
  }

  // Aggregate OOS
  if (oosResults.length > 0) {
      const totalOOSReturn = oosResults.reduce((sum, r) => sum + r.metrics.totalReturnPct, 0);
      const avgOOSReturn = totalOOSReturn / oosResults.length;
      console.log(`
🏁 Walk-Forward Complete.`);
      console.log(`📊 Average OOS Return per Window: ${avgOOSReturn.toFixed(2)}%`);
      // Further aggregation (like compounded return) would require stitching equity curves.
  } else {
      console.log('❌ No OOS results generated.');
  }
}

interface Window {
  id: number;
  trainStart: Date;
  trainEnd: Date;
  testStart: Date;
  testEnd: Date;
}

function generateWindows(start: Date, end: Date, config: WalkForwardConfig): Window[] {
  const windows: Window[] = [];
  // Start the first TEST window after the first TRAIN window
  let currentTestStart = new Date(start.getTime() + config.trainWindowDays * 86400000);
  let id = 1;

  while (currentTestStart < end) {
    let testEnd = new Date(currentTestStart.getTime() + config.testWindowDays * 86400000);
    if (testEnd > end) testEnd = end;
    
    // Safety: ensure test window is at least 1 day
    if (testEnd.getTime() <= currentTestStart.getTime()) break;

    let trainStart;
    if (config.anchored) {
      trainStart = new Date(start);
    } else {
      trainStart = new Date(currentTestStart.getTime() - config.trainWindowDays * 86400000);
    }

    windows.push({
      id: id++,
      trainStart,
      trainEnd: currentTestStart, 
      testStart: currentTestStart,
      testEnd
    });

    currentTestStart = new Date(currentTestStart.getTime() + config.testWindowDays * 86400000);
  }

  return windows;
}

function findBestRun(runs: BacktestRun[], objective: string): BacktestRun {
  // Simple descending sort. 
  return runs.sort((a, b) => {
      const valA = (a.metrics as any)[objective] || -Infinity;
      const valB = (b.metrics as any)[objective] || -Infinity;
      return valB - valA;
  })[0];
}

function runBacktest(strategyName: string, params: any, universe: Map<string, Candle[]>, start: Date, end: Date, assets: string[]) {
    const slicedUniverse = new Map<string, Candle[]>();
    for (const asset of assets) {
        const full = universe.get(asset) || [];
        const sliced = full.filter(c => c.time >= start && c.time < end);
        if (sliced.length > 0) slicedUniverse.set(asset, sliced);
    }
    
    if (slicedUniverse.size === 0) throw new Error('No data in OOS window');

    const StrategyClass = STRATEGY_REGISTRY[strategyName];
    if (!StrategyClass) throw new Error(`Unknown Strategy: ${strategyName}`);

    const strategy = new StrategyClass(params);
    const portfolio = new Portfolio(10000);
    const riskConfig: RiskConfig = {
         riskPerTradePct: params['riskPerTrade'] || 0.01,
         maxDrawdownPct: 0.1,
         atrMultiplier: 2.0,
         atrPeriod: 14,
         trailingStop: true,
         adxThreshold: 25,
         dailyLossLimitPct: 0.02,
         maxCorrelation: 0.7,
         maxSectorExposurePct: 0.2,
         volumeLimitPct: 0.1, // Liquidity Guard
         useBollingerTakeProfit: true
    };
    const riskManager = new RiskManager(riskConfig);
    const backtester = new Backtester(strategy, portfolio, riskManager);
    
    return backtester.run(slicedUniverse);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
