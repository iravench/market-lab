import { OptimizationRunner } from '../optimizer/runner';
import { OptimizationConfig } from '../optimizer/types';
import { BacktestRepository } from '../../db/backtestRepository';
import { Candle, BacktestMetrics } from '../types';
import { ClassifierFactory, Regime } from './regimeClassifier';

export interface RegimeProfile {
  symbol: string;
  profiles: WindowProfile[];
  summary: string;
}

export interface WindowProfile {
  year: number;
  startDate: Date;
  endDate: Date;
  winningStrategy: string;
  winningScore: number;
  regime: Regime;
  details: {
    [strategy: string]: number; // Scores based on chosen objective
  };
}

export class RegimeProfiler {
  constructor(
    private runner: OptimizationRunner
  ) { }

  async profileAsset(
    symbol: string,
    startDate: Date,
    endDate: Date,
    objective: keyof BacktestMetrics = 'sharpeRatio'
  ): Promise<RegimeProfile> {
    const years = this.generateYearlyWindows(startDate, endDate);
    const profiles: WindowProfile[] = [];
    const classifier = ClassifierFactory.get(objective);

    for (const window of years) {
      console.log(`\n🔍 Profiling ${symbol} for ${window.year} (Objective: ${objective})...`);

      // Run Optimizations
      const trendScore = await this.optimizeTrend(symbol, window.start, window.end, objective);
      const mrScore = await this.optimizeMeanReversion(symbol, window.start, window.end, objective);
      const breakoutScore = await this.optimizeBreakout(symbol, window.start, window.end, objective);
      const buyHoldScore = await this.runBuyAndHold(symbol, window.start, window.end, objective);

      const scores: Record<string, number> = {
        'Trend': trendScore,
        'MeanRev': mrScore,
        'Breakout': breakoutScore,
        'BuyHold': buyHoldScore
      };

      // Delegate classification
      const result = classifier.classify(scores);

      profiles.push({
        year: window.year,
        startDate: window.start,
        endDate: window.end,
        winningStrategy: result.winner,
        winningScore: result.winningScore,
        regime: result.regime,
        details: scores
      });
    }

    // Generate Summary
    const regimes = profiles.map(p => p.regime);
    const mode = this.mode(regimes);

    return {
      symbol,
      profiles,
      summary: `Asset ${symbol} is predominantly ${mode}.`
    };
  }

  private generateYearlyWindows(start: Date, end: Date) {
    const windows = [];
    let current = new Date(start);

    while (current < end) {
      const year = current.getFullYear();
      const nextYear = new Date(current);
      nextYear.setFullYear(year + 1);

      const windowEnd = nextYear > end ? end : nextYear;

      windows.push({
        year,
        start: new Date(current),
        end: new Date(windowEnd)
      });

      current = nextYear;
    }
    return windows;
  }

  // --- Optimization Helpers ---

  private async optimizeTrend(symbol: string, start: Date, end: Date, objective: keyof BacktestMetrics): Promise<number> {
    const config: OptimizationConfig = {
      strategyName: 'EmaAdxStrategy',
      assets: [symbol],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      objective,
      searchMethod: 'bayesian',
      maxIterations: 20, // Fast scan
      parameters: {
        fastPeriod: { min: 5, max: 20, type: 'integer' },
        slowPeriod: { min: 21, max: 60, type: 'integer' },
        adxThreshold: { min: 20, max: 30, type: 'integer' }
      }
    };
    return this.getBestScore(config);
  }

  private async optimizeMeanReversion(symbol: string, start: Date, end: Date, objective: keyof BacktestMetrics): Promise<number> {
    const config: OptimizationConfig = {
      strategyName: 'BollingerMeanReversionStrategy',
      assets: [symbol],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      objective,
      searchMethod: 'bayesian',
      maxIterations: 20,
      parameters: {
        bbPeriod: { min: 10, max: 30, type: 'integer' },
        mfiBuyThreshold: { min: 10, max: 30, type: 'integer' }
      }
    };
    return this.getBestScore(config);
  }

  private async optimizeBreakout(symbol: string, start: Date, end: Date, objective: keyof BacktestMetrics): Promise<number> {
    const config: OptimizationConfig = {
      strategyName: 'VolatilityBreakoutStrategy',
      assets: [symbol],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      objective,
      searchMethod: 'bayesian',
      maxIterations: 20,
      parameters: {
        donchianPeriod: { min: 10, max: 60, type: 'integer' },
        volumeMultiplier: { min: 1.2, max: 2.5, type: 'float' }
      }
    };
    return this.getBestScore(config);
  }

  private async runBuyAndHold(symbol: string, start: Date, end: Date, objective: keyof BacktestMetrics): Promise<number> {
    // Single iteration
    const config: OptimizationConfig = {
      strategyName: 'BuyAndHoldStrategy',
      assets: [symbol],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      objective,
      searchMethod: 'grid',
      maxIterations: 1,
      parameters: {}
    };
    return this.getBestScore(config);
  }

  private async getBestScore(config: OptimizationConfig): Promise<number> {
    try {
      // Run with logging disabled to avoid spamming stdout
      const runs = await this.runner.run(config, 'profiler', false);
      if (runs.length === 0) return -1;

      let maxScore = -999;
      const objective = config.objective;
      for (const run of runs) {
        const score = (run.metrics as any)[objective] || 0;
        if (score > maxScore) {
          maxScore = score;
        }
      }
      return maxScore;
    } catch (error) {
      // e.g. No data
      console.warn(`Optimization failed for ${config.strategyName}: ${error}`);
      return -999;
    }
  }

  private mode(array: string[]): string {
    if (array.length === 0) return 'Unknown';
    const modeMap: any = {};
    let maxEl = array[0], maxCount = 1;
    for (let i = 0; i < array.length; i++) {
      let el = array[i];
      if (modeMap[el] == null)
        modeMap[el] = 1;
      else
        modeMap[el]++;
      if (modeMap[el] > maxCount) {
        maxEl = el;
        maxCount = modeMap[el];
      }
    }
    return maxEl;
  }
}
