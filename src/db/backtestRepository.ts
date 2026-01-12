import pool from './index';
import { BacktestMetrics } from '../logic/types';

export interface BacktestRun {
  id: string;
  strategy_name: string;
  parameters: any;
  metrics: BacktestMetrics;
  time_range_start: Date;
  time_range_end: Date;
  git_commit: string | null;
  created_at: Date;
}

export class BacktestRepository {
  /**
   * Saves a new backtest run to the database.
   */
  async saveRun(
    strategyName: string,
    parameters: any,
    metrics: BacktestMetrics,
    startDate: Date,
    endDate: Date,
    gitCommit?: string
  ): Promise<string> {
    const queryText = `
      INSERT INTO backtest_runs (
        strategy_name, 
        parameters, 
        metrics, 
        time_range_start, 
        time_range_end, 
        git_commit
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    // pg driver handles JSON serialization for objects passed to JSONB columns?
    // Usually it's safer to pass objects directly if we trust the driver, 
    // but explicit JSON.stringify ensures we send a string that PG casts to JSONB.
    // However, node-postgres usually converts objects to JSON automatically for binding.
    // Let's rely on node-postgres default object serialization.
    
    const result = await pool.query(queryText, [
      strategyName,
      parameters, // node-postgres should handle object -> json
      metrics,
      startDate,
      endDate,
      gitCommit || null
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
      // pg parses JSONB columns to objects automatically
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
