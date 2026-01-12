import { BacktestMetrics } from '../types';
import { BacktestRun } from '../../db/backtestRepository';

export interface ParameterRange {
  min: number;
  max: number;
  step?: number; // Required for Grid Search, optional for others
  type: 'integer' | 'float';
}

export interface OptimizationConfig {
  strategyName: string;
  assets: string[]; // e.g. ["CBA.AX", "NAB.AX"]
  startDate: string; // ISO Date string
  endDate: string;   // ISO Date string
  objective: keyof BacktestMetrics; // e.g. 'calmarRatio'
  searchMethod: 'grid' | 'random' | 'bayesian';
  parameters: Record<string, ParameterRange>;
  maxIterations?: number; // Optional for Grid (it terminates naturally), required for Random/Bayes
}

export interface WalkForwardConfig extends OptimizationConfig {
  trainWindowDays: number;
  testWindowDays: number;
  anchored: boolean; // true: start date is fixed (expanding window), false: start date moves (rolling window)
}

export interface ParameterSet {
  [key: string]: number;
}

export interface Optimizer {
  /**
   * Generates the next set of parameters to test.
   * Returns null if the search space is exhausted or max iterations reached.
   */
  getNextParams(history: BacktestRun[]): ParameterSet | null;
}
