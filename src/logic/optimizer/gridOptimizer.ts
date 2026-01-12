import { Optimizer, OptimizationConfig, ParameterSet, ParameterRange } from './types';
import { BacktestRun } from '../../db/backtestRepository';

export class GridOptimizer implements Optimizer {
  private config: OptimizationConfig;
  private parameterNames: string[];
  private grids: number[][];
  private totalCombinations: number;

  constructor(config: OptimizationConfig) {
    this.config = config;
    this.parameterNames = Object.keys(config.parameters);
    this.grids = this.parameterNames.map(name => this.generateGrid(config.parameters[name]));
    this.totalCombinations = this.grids.reduce((acc, curr) => acc * curr.length, 1);
  }

  public getNextParams(history: BacktestRun[]): ParameterSet | null {
    // 1. Check if we've exhausted the grid
    if (history.length >= this.totalCombinations) {
      return null;
    }

    // 2. Determine the current index in the "flat" grid
    // If history has 0 items, we want index 0. 
    // If history has 5 items (indices 0-4), we want index 5.
    const currentIndex = history.length;

    // 3. Convert flat index to coordinate in N-dimensional grid
    return this.getParamsAtIndex(currentIndex);
  }

  private getParamsAtIndex(index: number): ParameterSet {
    const result: ParameterSet = {};
    let tempIndex = index;

    // Iterate in reverse to handle "odometer" logic correctly
    // (Last param varies fastest)
    for (let i = this.parameterNames.length - 1; i >= 0; i--) {
      const name = this.parameterNames[i];
      const grid = this.grids[i];
      const size = grid.length;

      const gridIndex = tempIndex % size;
      result[name] = grid[gridIndex];
      
      tempIndex = Math.floor(tempIndex / size);
    }

    return result;
  }

  private generateGrid(range: ParameterRange): number[] {
    const { min, max, type } = range;
    const step = range.step || (max - min) / 10; // Default to 10 steps if undefined
    
    const values: number[] = [];
    let current = min;

    // Avoid infinite loops with float precision issues
    while (current <= max + 1e-9) {
      values.push(current);
      current += step;
    }

    if (type === 'integer') {
      // Deduplicate and round
      const unique = new Set(values.map(v => Math.round(v)));
      return Array.from(unique).sort((a, b) => a - b);
    }

    return values;
  }
}
