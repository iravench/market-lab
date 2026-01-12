import { OptimizationRunner } from '../optimizer/runner';
import { OptimizationConfig } from '../optimizer/types';
import { BacktestRepository } from '../../db/backtestRepository';
import { Candle } from '../types';

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
  winningSharpe: number;
  regime: 'TRENDING' | 'MEAN_REVERSION' | 'VOLATILE_BREAKOUT' | 'CHOPPY' | 'BULL_MARKET';
  details: {
    [strategy: string]: number; // Sharpe Ratios
  };
}

export class RegimeProfiler {
  constructor(
    private runner: OptimizationRunner
  ) {}

  async profileAsset(symbol: string, startDate: Date, endDate: Date): Promise<RegimeProfile> {
    const years = this.generateYearlyWindows(startDate, endDate);
    const profiles: WindowProfile[] = [];

    for (const window of years) {
      console.log(`\n🔍 Profiling ${symbol} for ${window.year}...`);
      
      // Run Optimizations
      const trendSharpe = await this.optimizeTrend(symbol, window.start, window.end);
      const mrSharpe = await this.optimizeMeanReversion(symbol, window.start, window.end);
      const breakoutSharpe = await this.optimizeBreakout(symbol, window.start, window.end);
      const buyHoldSharpe = await this.runBuyAndHold(symbol, window.start, window.end);

      // Determine Winner
      // Bias towards Buy & Hold if it's just a bull run (often trend followers correlate, but B&H is simpler).
      // Logic:
      // If B&H > 2.0 -> Bull Market.
      // Else compare active strategies.
      
      let winner = 'Choppy';
      let maxSharpe = -999;
      let regime: WindowProfile['regime'] = 'CHOPPY';

      const scores: Record<string, number> = {
        'Trend': trendSharpe,
        'MeanRev': mrSharpe,
        'Breakout': breakoutSharpe,
        'BuyHold': buyHoldSharpe
      };

      // Classification Logic
      if (buyHoldSharpe > 2.5 && buyHoldSharpe > trendSharpe) {
        winner = 'Buy & Hold';
        regime = 'BULL_MARKET';
        maxSharpe = buyHoldSharpe;
      } else {
        // Compare Active Strategies
        const activeBest = Math.max(trendSharpe, mrSharpe, breakoutSharpe);
        
        if (activeBest < 0.5) {
          regime = 'CHOPPY';
          winner = 'None';
          maxSharpe = activeBest;
        } else {
          if (trendSharpe >= activeBest) {
             winner = 'Trend Following';
             regime = 'TRENDING';
             maxSharpe = trendSharpe;
          } else if (mrSharpe >= activeBest) {
             winner = 'Mean Reversion';
             regime = 'MEAN_REVERSION';
             maxSharpe = mrSharpe;
          } else {
             winner = 'Volatility Breakout';
             regime = 'VOLATILE_BREAKOUT';
             maxSharpe = breakoutSharpe;
          }
        }
      }

      profiles.push({
        year: window.year,
        startDate: window.start,
        endDate: window.end,
        winningStrategy: winner,
        winningSharpe: maxSharpe,
        regime,
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

  private async optimizeTrend(symbol: string, start: Date, end: Date): Promise<number> {
    const config: OptimizationConfig = {
      strategyName: 'EmaAdxStrategy',
      assets: [symbol],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      objective: 'sharpeRatio',
      searchMethod: 'bayesian',
      maxIterations: 20, // Fast scan
      parameters: {
        fastPeriod: { min: 5, max: 20, type: 'integer' },
        slowPeriod: { min: 21, max: 60, type: 'integer' },
        adxThreshold: { min: 20, max: 30, type: 'integer' }
      }
    };
    return this.getBestSharpe(config);
  }

  private async optimizeMeanReversion(symbol: string, start: Date, end: Date): Promise<number> {
    const config: OptimizationConfig = {
      strategyName: 'BollingerMeanReversionStrategy',
      assets: [symbol],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      objective: 'sharpeRatio',
      searchMethod: 'bayesian',
      maxIterations: 20,
      parameters: {
        bbPeriod: { min: 10, max: 30, type: 'integer' },
        mfiBuyThreshold: { min: 10, max: 30, type: 'integer' }
      }
    };
    return this.getBestSharpe(config);
  }

  private async optimizeBreakout(symbol: string, start: Date, end: Date): Promise<number> {
    const config: OptimizationConfig = {
      strategyName: 'VolatilityBreakoutStrategy',
      assets: [symbol],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      objective: 'sharpeRatio',
      searchMethod: 'bayesian',
      maxIterations: 20,
      parameters: {
        donchianPeriod: { min: 10, max: 60, type: 'integer' },
        volumeMultiplier: { min: 1.2, max: 2.5, type: 'float' }
      }
    };
    return this.getBestSharpe(config);
  }

  private async runBuyAndHold(symbol: string, start: Date, end: Date): Promise<number> {
    // Single iteration
    const config: OptimizationConfig = {
      strategyName: 'BuyAndHoldStrategy',
      assets: [symbol],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      objective: 'sharpeRatio',
      searchMethod: 'grid',
      maxIterations: 1,
      parameters: {}
    };
    return this.getBestSharpe(config);
  }

  private async getBestSharpe(config: OptimizationConfig): Promise<number> {
    try {
        // Run with logging disabled to avoid spamming stdout
        const runs = await this.runner.run(config, 'profiler', false);
        if (runs.length === 0) return -1;
        
        // Find best Sharpe
        let maxSharpe = -999;
        for (const run of runs) {
            if (run.metrics.sharpeRatio > maxSharpe) {
                maxSharpe = run.metrics.sharpeRatio;
            }
        }
        return maxSharpe;
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
          if(modeMap[el] == null)
              modeMap[el] = 1;
          else
              modeMap[el]++;  
          if(modeMap[el] > maxCount)
          {
              maxEl = el;
              maxCount = modeMap[el];
          }
      }
      return maxEl;
  }
}
