import { BacktestMetrics } from '../types';

export type Regime = 'TRENDING' | 'MEAN_REVERSION' | 'VOLATILE_BREAKOUT' | 'CHOPPY' | 'BULL_MARKET';

export interface ClassificationResult {
  regime: Regime;
  winner: string;
  winningScore: number;
}

export interface RegimeClassifier {
  classify(scores: Record<string, number>): ClassificationResult;
}

/**
 * Classifier optimized for Sharpe Ratio.
 * Logic:
 * - Bull Market: Buy & Hold Sharpe > 2.5 AND better than Trend.
 * - Choppy: Best active strategy Sharpe < 0.5.
 */
export class SharpeRegimeClassifier implements RegimeClassifier {
  classify(scores: Record<string, number>): ClassificationResult {
    const buyHold = scores['BuyHold'] || -999;
    const trend = scores['Trend'] || -999;
    const meanRev = scores['MeanRev'] || -999;
    const breakout = scores['Breakout'] || -999;

    // 1. Check for strong Bull Market (Passive Beta is best)
    if (buyHold > 2.5 && buyHold > trend) {
      return {
        regime: 'BULL_MARKET',
        winner: 'Buy & Hold',
        winningScore: buyHold
      };
    }

    // 2. Compare Active Strategies
    const activeBest = Math.max(trend, meanRev, breakout);

    // 3. Check for Chop (No strategy works well)
    if (activeBest < 0.5) {
      return {
        regime: 'CHOPPY',
        winner: 'None',
        winningScore: activeBest
      };
    }

    // 4. Identify Winning Active Regime
    if (trend >= activeBest) {
      return { regime: 'TRENDING', winner: 'Trend Following', winningScore: trend };
    }
    if (meanRev >= activeBest) {
      return { regime: 'MEAN_REVERSION', winner: 'Mean Reversion', winningScore: meanRev };
    }

    return { regime: 'VOLATILE_BREAKOUT', winner: 'Volatility Breakout', winningScore: breakout };
  }
}

/**
 * Generic Classifier for metrics where "Higher is Better" (e.g., Calmar, Sortino, TotalReturn).
 * Uses a simpler logic: Winner takes all.
 * Optional threshold can be provided to declare "Choppy" (defaults to 0).
 */
export class GenericHighBetterClassifier implements RegimeClassifier {
  constructor(private minThreshold: number = 0) { }

  classify(scores: Record<string, number>): ClassificationResult {
    const buyHold = scores['BuyHold'] || -Infinity;
    const trend = scores['Trend'] || -Infinity;
    const meanRev = scores['MeanRev'] || -Infinity;
    const breakout = scores['Breakout'] || -Infinity;

    const bestScore = Math.max(buyHold, trend, meanRev, breakout);

    if (bestScore <= this.minThreshold) {
      return {
        regime: 'CHOPPY',
        winner: 'None',
        winningScore: bestScore
      };
    }

    // Prioritize Buy & Hold if it's the winner (simplest explanation)
    if (buyHold === bestScore) {
      return { regime: 'BULL_MARKET', winner: 'Buy & Hold', winningScore: buyHold };
    }
    if (trend === bestScore) {
      return { regime: 'TRENDING', winner: 'Trend Following', winningScore: trend };
    }
    if (meanRev === bestScore) {
      return { regime: 'MEAN_REVERSION', winner: 'Mean Reversion', winningScore: meanRev };
    }

    return { regime: 'VOLATILE_BREAKOUT', winner: 'Volatility Breakout', winningScore: breakout };
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
