import { OptimizationConfig, ParameterSet } from './types';
import { OptimizerFactory } from './index';
import { BacktestRepository, BacktestRun } from '../../db/backtestRepository';
import { Backtester } from '../backtester';
import { Portfolio } from '../portfolio';
import { RiskManager } from '../risk/risk_manager';
import { STRATEGY_REGISTRY } from '../strategies/registry';
import { Candle, RiskConfig } from '../types';

export class OptimizationRunner {
  constructor(
    private backtestRepo: BacktestRepository,
    private universe: Map<string, Candle[]> // Fully typed history to return
  ) { }

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

    // 1. Create Optimization Record (Parent)
    // Define consistent RiskConfig for this session
    const riskConfig: RiskConfig = {
      riskPerTradePct: 0.01, // Note: Params can override this locally, but this is the baseline
      maxDrawdownPct: 0.1,
      atrMultiplier: 2.0,
      atrPeriod: 14,
      trailingStop: true,
      adxThreshold: 25,
      dailyLossLimitPct: 0.02,
      maxCorrelation: 0.7,
      maxSectorExposurePct: 0.2,
      volumeLimitPct: 0.1,
      useBollingerTakeProfit: true
    };

    const optimizationId = await this.backtestRepo.createOptimization(
      config.strategyName,
      config,
      riskConfig,
      gitCommit
    );

    try {
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

        // Apply params override to risk config if present (e.g. riskPerTrade)
        const runRiskConfig: RiskConfig = {
          ...riskConfig,
          riskPerTradePct: params['riskPerTrade'] || riskConfig.riskPerTradePct
        };

        const riskManager = new RiskManager(runRiskConfig);
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
          optimizationId
        );

        const runRecord: BacktestRun = {
          id: runId,
          strategy_name: config.strategyName,
          parameters: params,
          metrics: result.metrics,
          time_range_start: startDate,
          time_range_end: endDate,
          optimization_id: optimizationId,
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
        const results = await optimizer.runDelegate(runSingleTest);
        await this.backtestRepo.updateOptimizationStatus(optimizationId, 'COMPLETED');
        return results;
      }

      // Default Iterative Mode (Grid/Random)
      while (true) {
        const params = optimizer.getNextParams(optimizerHistory);
        if (!params) break;

        const runRecord = await runSingleTest(params);
        history.push(runRecord);
        optimizerHistory.push(runRecord);
      }

      await this.backtestRepo.updateOptimizationStatus(optimizationId, 'COMPLETED');
      return history;

    } catch (err) {
      await this.backtestRepo.updateOptimizationStatus(optimizationId, 'FAILED');
      throw err;
    }
  }
}
