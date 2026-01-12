import { OptimizationConfig, ParameterSet } from './types';
import { OptimizerFactory } from './index';
import { BacktestRepository, BacktestRun } from '../../db/backtestRepository';
import { Backtester } from '../backtester';
import { Portfolio } from '../portfolio';
import { RiskManager } from '../risk/risk_manager';
import { RsiStrategy } from '../strategies/rsiStrategy';
import { Candle, RiskConfig } from '../types';

// Strategy Registry
const STRATEGY_REGISTRY: Record<string, any> = {
  'RsiStrategy': RsiStrategy,
  'RSI Reversal': RsiStrategy,
};

export class OptimizationRunner {
  constructor(
    private backtestRepo: BacktestRepository,
    private universe: Map<string, Candle[]> // Fully typed history to return
  ) {}

  /**
   * Runs a full optimization session based on the config.
   * Returns all backtest runs generated.
   */
  async run(config: OptimizationConfig, gitCommit: string = 'unknown', logProgress: boolean = true): Promise<BacktestRun[]> {
    const optimizer = OptimizerFactory.create(config);
    const history: BacktestRun[] = []; // Fully typed history to return
    const optimizerHistory: any[] = []; // Lightweight history for the optimizer logic

    let iteration = 0;

    const StrategyClass = STRATEGY_REGISTRY[config.strategyName];
    if (!StrategyClass) {
      throw new Error(`Unknown Strategy: ${config.strategyName}`);
    }

        // Filter universe to match config assets AND time range
        const activeUniverse = new Map<string, Candle[]>();
        const start = new Date(config.startDate);
        const end = new Date(config.endDate);
    
        for (const asset of config.assets) {
          if (this.universe.has(asset)) {
            const fullCandles = this.universe.get(asset)!;
            const slicedCandles = fullCandles.filter(c => c.time >= start && c.time < end);
            
            if (slicedCandles.length > 0) {
              activeUniverse.set(asset, slicedCandles);
            }
          }
        }
    
        if (activeUniverse.size === 0) {
          throw new Error(`No data found for [${config.startDate} -> ${config.endDate}]`);
        }
    
        // Define the "Single Test" logic as a reusable function
        const runSingleTest = async (params: ParameterSet): Promise<BacktestRun> => {
          iteration++;
          if (logProgress) {
            process.stdout.write(`\r🔄 Iteration ${iteration}: Testing ${JSON.stringify(params)}...`);
          }

          const strategy = new StrategyClass(params);
          const portfolio = new Portfolio(10000); // Fixed 10k
          
          const riskConfig: RiskConfig = {
             riskPerTradePct: params['riskPerTrade'] || 0.01,
             maxDrawdownPct: 0.1,
             atrMultiplier: 2.0,
             atrPeriod: 14,
             trailingStop: true,
          };
          
          const riskManager = new RiskManager(riskConfig);
          const backtester = new Backtester(strategy, portfolio, riskManager);

          const result = backtester.run(activeUniverse);

          const startDate = new Date(config.startDate);
          const endDate = new Date(config.endDate);

          const runId = await this.backtestRepo.saveRun(
            config.strategyName,
            params,
            result.metrics,
            startDate,
            endDate,
            gitCommit
          );

          const runRecord: BacktestRun = {
            id: runId,
            strategy_name: config.strategyName,
            parameters: params,
            metrics: result.metrics,
            time_range_start: startDate,
            time_range_end: endDate,
            git_commit: gitCommit,
            created_at: new Date()
          };

          if (logProgress) {
            const objectiveValue = (result.metrics as any)[config.objective];
            process.stdout.write(` Done. ${config.objective}: ${objectiveValue?.toFixed(3)}\n`);
          }

          return runRecord;
        };

        // --- Execution Logic ---
        
        // Check if Optimizer supports Delegate Mode (e.g. Bayesian)
        if (optimizer.runDelegate) {
           return await optimizer.runDelegate(runSingleTest);
        }

        // Default Iterative Mode (Grid/Random)
        while (true) {
          const params = optimizer.getNextParams(optimizerHistory);
          if (!params) break;

          const runRecord = await runSingleTest(params);
          history.push(runRecord);
          optimizerHistory.push(runRecord);
        }

    return history;
  }
}