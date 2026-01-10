import { Candle, Position, RiskConfig, SignalAction } from '../types';

export class RiskManager {
    public config: RiskConfig;

    constructor(config: RiskConfig) {
        this.config = config;
    }

    /**
     * Calculates the position size based on the "Risk Unit" logic.
     * Formula: Units = (Equity * Risk%) / (Entry - Stop)
     */
    public calculatePositionSize(
        equity: number, 
        entryPrice: number, 
        stopLossPrice: number
    ): number {
        const riskAmount = equity * this.config.riskPerTradePct;
        const riskPerShare = Math.abs(entryPrice - stopLossPrice);

        if (riskPerShare === 0) return 0;

        return Math.floor(riskAmount / riskPerShare);
    }

    /**
     * Calculates an ATR-based stop loss price.
     */
    public calculateATRStop(
        entryPrice: number, 
        atr: number, 
        action: SignalAction
    ): number {
        const distance = atr * this.config.atrMultiplier;
        return action === 'BUY' 
            ? entryPrice - distance 
            : entryPrice + distance;
    }

    /**
     * Updates a trailing stop (Chandelier Exit style).
     * The stop only moves in the direction of the trade.
     */
    public updateTrailingStop(
        currentStop: number, 
        currentHigh: number, // or Low for shorts
        currentLow: number,
        atr: number, 
        action: SignalAction
    ): number {
        if (!this.config.trailingStop) return currentStop;

        const distance = atr * this.config.atrMultiplier;
        
        if (action === 'BUY') {
            const newPotentialStop = currentHigh - distance;
            return Math.max(currentStop, newPotentialStop);
        } else {
            const newPotentialStop = currentLow + distance;
            return Math.min(currentStop, newPotentialStop);
        }
    }

    /**
     * Checks if any risk-based exit conditions are met.
     */
    public checkExits(candle: Candle, position: Position): 'STOP_LOSS' | 'TAKE_PROFIT' | null {
        // Check Stop Loss
        if (position.stopLoss) {
            // For a Long position (quantity > 0)
            if (position.quantity > 0 && candle.low <= position.stopLoss) {
                return 'STOP_LOSS';
            }
            // For a Short position (not fully supported yet, but for completeness)
            if (position.quantity < 0 && candle.high >= position.stopLoss) {
                return 'STOP_LOSS';
            }
        }

        // Check Take Profit
        if (position.takeProfit) {
            if (position.quantity > 0 && candle.high >= position.takeProfit) {
                return 'TAKE_PROFIT';
            }
            if (position.quantity < 0 && candle.low <= position.takeProfit) {
                return 'TAKE_PROFIT';
            }
        }

        return null;
    }
}
