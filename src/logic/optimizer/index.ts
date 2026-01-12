import { OptimizationConfig, Optimizer } from './types';
import { GridOptimizer } from './gridOptimizer';
import { RandomOptimizer } from './randomOptimizer';

export class OptimizerFactory {
  static create(config: OptimizationConfig): Optimizer {
    switch (config.searchMethod) {
      case 'grid':
        return new GridOptimizer(config);
      case 'random':
        return new RandomOptimizer(config);
      case 'bayesian':
        throw new Error('Bayesian optimization not yet implemented. Use "random" or "grid".');
      default:
        throw new Error(`Unknown search method: ${config.searchMethod}`);
    }
  }
}
