import { RsiStrategy } from './rsiStrategy';
import { EmaAdxStrategy } from './emaAdxStrategy';
import { VolatilityBreakoutStrategy } from './volatilityBreakoutStrategy';
import { BollingerMeanReversionStrategy } from './bollingerStrategy';
import { BuyAndHoldStrategy } from './buyAndHoldStrategy';
import { Strategy } from '../types';

export const STRATEGY_REGISTRY: Record<string, new (...args: any[]) => Strategy> = {
  'RsiStrategy': RsiStrategy,
  'RSI Reversal': RsiStrategy,
  'EmaAdxStrategy': EmaAdxStrategy,
  'EMA-ADX Trend Follower': EmaAdxStrategy,
  'VolatilityBreakoutStrategy': VolatilityBreakoutStrategy,
  'Volatility Breakout': VolatilityBreakoutStrategy,
  'BollingerMeanReversionStrategy': BollingerMeanReversionStrategy,
  'Bollinger Mean Reversion (Vol)': BollingerMeanReversionStrategy,
  'BuyAndHoldStrategy': BuyAndHoldStrategy,
  'Buy & Hold': BuyAndHoldStrategy,
};
