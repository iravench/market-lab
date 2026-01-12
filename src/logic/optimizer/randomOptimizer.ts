import { Optimizer, OptimizationConfig, ParameterSet } from './types';
import { BacktestRun } from '../../db/backtestRepository';

export class RandomOptimizer implements Optimizer {
  private config: OptimizationConfig;

  constructor(config: OptimizationConfig) {
    this.config = config;
  }

  public getNextParams(history: BacktestRun[]): ParameterSet | null {
    // 1. Check stop condition
    if (this.config.maxIterations && history.length >= this.config.maxIterations) {
      return null;
    }

    // 2. Generate random params
    const params: ParameterSet = {};
    for (const [name, range] of Object.entries(this.config.parameters)) {
      const span = range.max - range.min;
      const raw = range.min + (Math.random() * span);
      
      if (range.type === 'integer') {
        params[name] = Math.round(raw);
      } else {
        // Round to 4 decimal places
        params[name] = Math.round(raw * 10000) / 10000;
      }
    }
    return params;
  }
}
