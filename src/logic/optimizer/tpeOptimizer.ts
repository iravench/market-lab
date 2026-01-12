import { Optimizer, OptimizationConfig, ParameterSet } from './types';
import { BacktestRun } from '../../db/backtestRepository';

/**
 * Tree-structured Parzen Estimator (TPE) Optimizer.
 * Native TypeScript implementation of the Bayesian optimization algorithm.
 */
export class TpeOptimizer implements Optimizer {
  private config: OptimizationConfig;
  private gamma: number = 0.15; // Quantile for splitting good/bad observations
  private numCandidates: number = 100; // Candidates to sample from l(x) to find max EI

  constructor(config: OptimizationConfig) {
    this.config = config;
  }

  // Iterative mode is technically possible but TPE works better in batches or full control.
  // We'll support runDelegate for optimal performance.
  public getNextParams(): ParameterSet | null {
    throw new Error('TpeOptimizer only supports runDelegate mode.');
  }

  public async runDelegate(
    runner: (params: ParameterSet) => Promise<BacktestRun>
  ): Promise<BacktestRun[]> {
    const history: BacktestRun[] = [];
    const maxIterations = this.config.maxIterations || 50;
    const initialRandom = Math.max(5, Math.floor(maxIterations * 0.2));

    // 1. Initial Random Search to seed the model
    for (let i = 0; i < initialRandom && i < maxIterations; i++) {
      const params = this.sampleRandomConfig();
      const run = await runner(params);
      history.push(run);
    }

    // 2. TPE Guided Search
    for (let i = history.length; i < maxIterations; i++) {
      const nextParams = this.proposeNext(history);
      const run = await runner(nextParams);
      history.push(run);
    }

    return history;
  }

  private sampleRandomConfig(): ParameterSet {
    const config: ParameterSet = {};
    for (const [name, range] of Object.entries(this.config.parameters)) {
      const val = Math.random() * (range.max - range.min) + range.min;
      config[name] = range.type === 'integer' ? Math.round(val) : val;
    }
    return config;
  }

  private proposeNext(history: BacktestRun[]): ParameterSet {
    // Split history into good and bad based on objective (maximize)
    const sorted = [...history].sort((a, b) => {
      const valA = (a.metrics as any)[this.config.objective] || 0;
      const valB = (b.metrics as any)[this.config.objective] || 0;
      return valB - valA; // Descending (best first)
    });

    const splitIndex = Math.max(1, Math.ceil(sorted.length * this.gamma));
    const goodRuns = sorted.slice(0, splitIndex);
    const badRuns = sorted.slice(splitIndex);

    // Sample candidates from "good" distributions and pick one with best EI
    let bestCandidate: ParameterSet | null = null;
    let maxEI = -Infinity;

    for (let i = 0; i < this.numCandidates; i++) {
      const candidate = this.sampleFromRuns(goodRuns);
      const ei = this.calculateEI(candidate, goodRuns, badRuns);
      
      if (ei > maxEI) {
        maxEI = ei;
        bestCandidate = candidate;
      }
    }

    return bestCandidate || this.sampleRandomConfig();
  }

  private sampleFromRuns(runs: BacktestRun[]): ParameterSet {
    // Pick a random "good" run and add some noise (KDE sampling)
    const baseRun = runs[Math.floor(Math.random() * runs.length)];
    const candidate: ParameterSet = {};

    for (const [name, range] of Object.entries(this.config.parameters)) {
      const baseVal = baseRun.parameters[name];
      
      // Heuristic bandwidth: 10% of range
      const bandwidth = (range.max - range.min) * 0.1;
      let val = baseVal + (this.gaussianRandom() * bandwidth);
      
      // Clip to range
      val = Math.max(range.min, Math.min(range.max, val));
      candidate[name] = range.type === 'integer' ? Math.round(val) : val;
    }

    return candidate;
  }

  private calculateEI(candidate: ParameterSet, goodRuns: BacktestRun[], badRuns: BacktestRun[]): number {
    // EI is proportional to l(x) / g(x)
    // l(x) is density of good runs, g(x) is density of bad runs
    let logL = 0;
    let logG = 0;

    for (const [name, range] of Object.entries(this.config.parameters)) {
      const val = candidate[name];
      const bandwidth = (range.max - range.min) * 0.1;

      logL += Math.log(this.calculateKdeDensity(val, goodRuns.map(r => r.parameters[name]), bandwidth) + 1e-10);
      logG += Math.log(this.calculateKdeDensity(val, badRuns.map(r => r.parameters[name]), bandwidth) + 1e-10);
    }

    return logL - logG;
  }

  private calculateKdeDensity(x: number, observations: number[], bandwidth: number): number {
    if (observations.length === 0) return 1;
    let density = 0;
    for (const obs of observations) {
      density += this.gaussianPdf(x, obs, bandwidth);
    }
    return density / observations.length;
  }

  private gaussianPdf(x: number, mean: number, stdDev: number): number {
    const s = Math.max(stdDev, 1e-9);
    const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(s, 2));
    return (1 / (s * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  }

  private gaussianRandom(): number {
    // Box-Muller transform
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}
