import pool from './index';
import { BacktestMetrics, RiskConfig } from '../logic/types';
import { OptimizationConfig } from '../logic/optimizer/types';

export interface BacktestRun {
  id: string;
  strategy_name: string;
  parameters: any;
  metrics: BacktestMetrics;
  time_range_start: Date;
  time_range_end: Date;
  optimization_id: string | null;
  created_at: Date;
}

export interface OptimizationRecord {
  id: string;
  strategy_name: string;
  config: OptimizationConfig;
  risk_config: RiskConfig;
  git_commit: string | null;
  status: string;
  created_at: Date;
}

export interface AssetProfileRecord {
  symbol: string;
  year: number;
  metric_used: string;
  regime: string;
  winning_strategy: string;
  winning_score: number;
  optimization_id: string | null;
  details: Record<string, number>;
}

export class BacktestRepository {
  /**
   * Creates a parent optimization record.
   */
  async createOptimization(
    strategyName: string,
    config: OptimizationConfig,
    riskConfig: RiskConfig,
    gitCommit: string
  ): Promise<string> {
    const queryText = `
      INSERT INTO optimizations (
        strategy_name,
        config,
        risk_config,
        git_commit,
        status
      )
      VALUES ($1, $2, $3, $4, 'RUNNING')
      RETURNING id
    `;
    const result = await pool.query(queryText, [
      strategyName,
      config,
      riskConfig,
      gitCommit
    ]);
    return result.rows[0].id;
  }

  /**
   * Updates the status of an optimization.
   */
  async updateOptimizationStatus(id: string, status: 'COMPLETED' | 'FAILED') {
    await pool.query('UPDATE optimizations SET status = $1 WHERE id = $2', [status, id]);
  }

  /**
   * Saves a new backtest run to the database.
   */
  async saveRun(
    strategyName: string,
    parameters: any,
    metrics: BacktestMetrics,
    startDate: Date,
    endDate: Date,
    optimizationId?: string
  ): Promise<string> {
    const queryText = `
      INSERT INTO backtest_runs (
        strategy_name, 
        parameters, 
        metrics, 
        time_range_start, 
        time_range_end, 
        optimization_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const result = await pool.query(queryText, [
      strategyName,
      parameters, 
      metrics,
      startDate,
      endDate,
      optimizationId || null
    ]);

    return result.rows[0].id;
  }

  /**
   * Saves an asset profile result.
   */
  async saveAssetProfile(profile: AssetProfileRecord): Promise<string> {
    const queryText = `
      INSERT INTO asset_profiles (
        symbol,
        year,
        metric_used,
        regime,
        winning_strategy,
        winning_score,
        optimization_id,
        details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    const result = await pool.query(queryText, [
      profile.symbol,
      profile.year,
      profile.metric_used,
      profile.regime,
      profile.winning_strategy,
      profile.winning_score,
      profile.optimization_id || null,
      profile.details
    ]);
    
    return result.rows[0].id;
  }

  /**
   * Retrieves recent runs for a strategy.
   */
  async getRuns(strategyName: string, limit: number = 100): Promise<BacktestRun[]> {
    const queryText = `
      SELECT * FROM backtest_runs
      WHERE strategy_name = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(queryText, [strategyName, limit]);
    
    return result.rows.map(row => ({
      ...row,
    }));
  }

  /**
   * Finds the best run for a given strategy based on a specific metric.
   */
  async findBestRun(
    strategyName: string, 
    metricKey: keyof BacktestMetrics, 
    direction: 'ASC' | 'DESC' = 'DESC'
  ): Promise<BacktestRun | null> {
    // Validate direction to prevent SQL injection
    const safeDirection = direction === 'ASC' ? 'ASC' : 'DESC';
    
    // We cannot bind column names or JSON keys as parameters in postgres ($1), 
    // so we must interpolate them safely.
    // We trust metricKey because it comes from our typed code, but for extra safety:
    const safeKey = metricKey.replace(/[^a-zA-Z0-9_]/g, '');

    const queryText = `
      SELECT * FROM backtest_runs
      WHERE strategy_name = $1
      ORDER BY (metrics->>$2)::numeric ${safeDirection}
      LIMIT 1
    `;
    
    const result = await pool.query(queryText, [strategyName, safeKey]);
    
    if (result.rows.length === 0) return null;
    return result.rows[0] as BacktestRun;
  }
}
