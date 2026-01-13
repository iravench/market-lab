export interface Candle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type IndicatorResult = number | null;

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';

export interface Signal {
  action: SignalAction;
  price: number;
  timestamp: Date;
  reason?: string;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
}

export interface AssetMetadata {
  symbol: string;
  sector: string;
}

export interface RiskConfig {
  riskPerTradePct: number; // e.g. 0.01 for 1%
  maxDrawdownPct: number;  // e.g. 0.1 for 10%
  atrMultiplier: number;   // for stops (e.g. 2.0)
  atrPeriod: number;       // typically 14
  trailingStop: boolean;
  adxThreshold?: number;    // Regime Detection (default 25)
  adxPeriod?: number;       // Regime Detection (default 14)
  dailyLossLimitPct?: number; // Portfolio Guard (e.g. 0.02 for 2%)
  maxCorrelation?: number;    // Portfolio Guard (e.g. 0.7)
  maxSectorExposurePct?: number; // Portfolio Guard (e.g. 0.2 for 20%)
  volumeLimitPct?: number;       // Liquidity Guard (e.g. 0.1 for 10% of candle volume)
  useBollingerTakeProfit?: boolean; // Dynamic Exit
}

/**
 * A Strategy (or Signal Generator) analyzes market data and produces a Signal.
 * It is a pure function or class method that takes history and returns a decision for the latest point.
 */
export interface Strategy {
  name: string;
  analyze(candles: Candle[]): Signal;
}

export interface Trade {
  timestamp: Date;
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  fee: number;
  totalValue: number; // price * quantity + fee (for BUY) or - fee (for SELL)
  realizedPnL?: number; // Only for SELL trades
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface PortfolioState {
  cash: number;
  positions: Map<string, Position>;
  trades: Trade[];
}

export interface CommissionConfig {
  fixed: number;      // Fixed fee per trade (e.g., $10)
  percentage: number; // Percentage fee (e.g., 0.001 for 0.1%)
}

export interface EquitySnapshot {
  timestamp: Date;
  cash: number;
  equity: number;
}

export interface BacktestMetrics {
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  expectancy: number;
  sqn: number;
  winRatePct: number;
  tradeCount: number;
  maxSectorExposurePct?: number;
}

export interface BacktestResult {
  initialCapital: number;
  finalCapital: number;
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: EquitySnapshot[];
}
