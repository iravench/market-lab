import { OptimizationConfig, Optimizer } from './types';
import { GridOptimizer } from './gridOptimizer';
import { RandomOptimizer } from './randomOptimizer';
import { TpeOptimizer } from './tpeOptimizer';

export class OptimizerFactory {
  static create(config: OptimizationConfig): Optimizer {
    switch (config.searchMethod) {
      case 'grid':
        return new GridOptimizer(config);
      case 'random':
        return new RandomOptimizer(config);
      case 'bayesian':
        return new TpeOptimizer(config);
      default:
        throw new Error(`Unknown search method: ${config.searchMethod}`);
    }
  }
}
