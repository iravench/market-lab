import { BacktestMetrics } from '../types';

export type Regime = 
  | 'TREND_RUNNER' 
  | 'MEAN_REVERTER'
  | 'REGIME_SHIFTER' 
  | 'CHOPPY' 
  | 'RANDOM_WALK' 
  | 'BULL_MARKET';

export interface PhysicsMetrics {
  hurst: number;
  ker: number;
  kurtosis: number;
}

export interface ClassificationResult {
  regime: Regime;
  winner: string;
  winningScore: number;
}

export interface RegimeClassifier {
  classify(scores: Record<string, number>, physics?: PhysicsMetrics): ClassificationResult;
}

/**
 * Classifier optimized for Sharpe Ratio.
 * Logic:
 * - Phase 9 Physics Filter: Identifies RANDOM_WALK and REGIME_SHIFTER.
 * - Bull Market: Buy & Hold Sharpe > 2.5 AND better than Trend.
 * - Active: Identifies TREND_RUNNER, MEAN_REVERTER, or REGIME_SHIFTER based on best performer.
 * - Choppy: Best active strategy Sharpe < 0.5.
 */
export class SharpeRegimeClassifier implements RegimeClassifier {
  classify(scores: Record<string, number>, physics?: PhysicsMetrics): ClassificationResult {
    const buyHold = scores['BuyHold'] || -999;
    const trend = scores['Trend'] || -999;
    const meanRev = scores['MeanRev'] || -999;
    const breakout = scores['Breakout'] || -999;

    // 1. Physics Filter (Phase 9)
    if (physics) {
      // Noise Check: If Hurst is near 0.5 and Efficiency is near 0, it's a Random Walk
      if (physics.hurst >= 0.45 && physics.hurst <= 0.55 && physics.ker < 0.05) {
        return {
          regime: 'RANDOM_WALK',
          winner: 'None',
          winningScore: 0
        };
      }

      // Volatility Check: High Kurtosis indicates fat tails / regime shifts
      if (physics.kurtosis > 10) {
        return {
          regime: 'REGIME_SHIFTER',
          winner: 'Volatility Breakout',
          winningScore: breakout
        };
      }
    }

    // 2. Check for strong Bull Market (Passive Beta is best)
    if (buyHold > 2.5 && buyHold > trend) {
      return {
        regime: 'BULL_MARKET',
        winner: 'Buy & Hold',
        winningScore: buyHold
      };
    }

    // 3. Compare Active Strategies
    const activeBest = Math.max(trend, meanRev, breakout);

    // 4. Check for Chop (No active strategy works well)
    if (activeBest < 0.5) {
      return {
        regime: 'CHOPPY',
        winner: 'None',
        winningScore: activeBest
      };
    }

    // 5. Identify Winning Active Regime
    if (trend >= activeBest) {
      return { regime: 'TREND_RUNNER', winner: 'Trend Following', winningScore: trend };
    }
    if (meanRev >= activeBest) {
      return { regime: 'MEAN_REVERTER', winner: 'Mean Reversion', winningScore: meanRev };
    }

    return { regime: 'REGIME_SHIFTER', winner: 'Volatility Breakout', winningScore: breakout };
  }
}

/**
 * Generic Classifier for metrics where "Higher is Better" (e.g., Calmar, Sortino, TotalReturn).
 * Uses a simpler logic: Winner takes all.
 * Optional threshold can be provided to declare "CHOPPY" (defaults to 0).
 */
export class GenericHighBetterClassifier implements RegimeClassifier {
  constructor(private minThreshold: number = 0) { }

  classify(scores: Record<string, number>, physics?: PhysicsMetrics): ClassificationResult {
    const buyHold = scores['BuyHold'] || -Infinity;
    const trend = scores['Trend'] || -Infinity;
    const meanRev = scores['MeanRev'] || -Infinity;
    const breakout = scores['Breakout'] || -Infinity;

    // Apply basic Physics filter for Random Walks if provided
    if (physics && physics.hurst >= 0.48 && physics.hurst <= 0.52 && physics.ker < 0.03) {
      return { regime: 'RANDOM_WALK', winner: 'None', winningScore: 0 };
    }

    const bestScore = Math.max(buyHold, trend, meanRev, breakout);

    if (bestScore <= this.minThreshold) {
      return {
        regime: 'CHOPPY',
        winner: 'None',
        winningScore: bestScore
      };
    }

    // Map winners to new Regime types
    if (buyHold === bestScore) {
      return { regime: 'BULL_MARKET', winner: 'Buy & Hold', winningScore: buyHold };
    }
    if (trend === bestScore) {
      return { regime: 'TREND_RUNNER', winner: 'Trend Following', winningScore: trend };
    }
    if (meanRev === bestScore) {
      return { regime: 'MEAN_REVERTER', winner: 'Mean Reversion', winningScore: meanRev };
    }

    return { regime: 'REGIME_SHIFTER', winner: 'Volatility Breakout', winningScore: breakout };
  }
}

export class ClassifierFactory {
  static get(objective: keyof BacktestMetrics): RegimeClassifier {
    switch (objective) {
      case 'sharpeRatio':
        return new SharpeRegimeClassifier();
      case 'calmarRatio':
        return new GenericHighBetterClassifier(0.5); // Calmar < 0.5 is poor
      case 'sortinoRatio':
        return new GenericHighBetterClassifier(0.5); // Sortino < 0.5 is poor
      case 'totalReturnPct':
        return new GenericHighBetterClassifier(0); // Negative return is bad
      default:
        return new GenericHighBetterClassifier(0);
    }
  }
}
