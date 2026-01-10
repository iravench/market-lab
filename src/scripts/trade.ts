import { PersistentPortfolio } from '../logic/persistentPortfolio';
import { RsiStrategy } from '../logic/strategies/rsiStrategy';
import pool from '../db';
import yahooFinance from 'yahoo-finance2';
import { Candle, Signal, RiskConfig } from '../logic/types';
import { RiskManager } from '../logic/risk/risk_manager';
import { calculateATR } from '../logic/indicators/atr';

async function main() {
    const args = process.argv.slice(2);
    // Usage: npm run trade <PORTFOLIO_ID> <SYMBOL> <MODE: DRY|LIVE>
    if (args.length < 3) {
        console.error('Usage: npm run trade <PORTFOLIO_ID> <SYMBOL> <MODE: DRY|LIVE>');
        process.exit(1);
    }

    const [portfolioId, symbol, mode] = args;
    const isLive = mode.toUpperCase() === 'LIVE';

    console.log(`🤖 Starting Bot for ${symbol}`);
    console.log(`📂 Portfolio: ${portfolioId}`);
    console.log(`⚠️  Mode: ${mode.toUpperCase()}`);

    // Risk Configuration
    const riskConfig: RiskConfig = {
        riskPerTradePct: 0.01, // 1%
        maxDrawdownPct: 0.1,
        atrMultiplier: 2.5,
        atrPeriod: 14,
        trailingStop: true
    };
    const riskManager = new RiskManager(riskConfig);

    try {
        // 1. Fetch Data (History + Latest)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 200); 
        
        console.log('📥 Fetching latest market data...');
        const yf = new yahooFinance({ suppressNotices: ['ripHistorical'] });
        const response = await yf.chart(symbol, {
            period1: startDate,
            period2: endDate,
            interval: '1d',
        });
        
        if (!response || !response.quotes || response.quotes.length === 0) {
            throw new Error('No data returned from API');
        }

        const candles: Candle[] = response.quotes
            .filter(q => q.open !== null && q.close !== null)
            .map(q => ({
                time: q.date,
                open: q.open!,
                high: q.high!,
                low: q.low!,
                close: q.close!,
                volume: q.volume || 0
            }));

        const latestCandle = candles[candles.length - 1];
        console.log(`📊 Analyzed ${candles.length} candles. Latest: $${latestCandle.close.toFixed(2)}`);

        // 2. Load Portfolio
        const portfolio = new PersistentPortfolio(portfolioId, 0, { fixed: 10 });
        await portfolio.load();
        
        const state = portfolio.getState();
        console.log(`💰 Cash: $${state.cash.toFixed(2)}`);
        
        // 3. Risk Check: Check Exits for existing positions
        const pos = state.positions.get(symbol);
        let finalSignal: Signal | null = null;

        if (pos) {
            console.log(`📦 Holding: ${pos.quantity} shares @ $${pos.averagePrice.toFixed(2)}`);
            console.log(`   Stops: SL: ${pos.stopLoss?.toFixed(2) || 'None'}, TP: ${pos.takeProfit?.toFixed(2) || 'None'}`);

            const exitReason = riskManager.checkExits(latestCandle, pos);
            if (exitReason) {
                console.log(`🚨 RISK EXIT TRIGGERED: ${exitReason}`);
                finalSignal = {
                    action: 'SELL',
                    price: exitReason === 'STOP_LOSS' ? (pos.stopLoss || latestCandle.close) : (pos.takeProfit || latestCandle.close),
                    timestamp: latestCandle.time,
                    reason: `Risk Management: ${exitReason}`
                };
            } else if (riskConfig.trailingStop && pos.stopLoss) {
                // Update Trailing Stop
                const atrSeries = calculateATR(candles, riskConfig.atrPeriod);
                const latestAtr = atrSeries[atrSeries.length - 1];
                if (latestAtr) {
                    const newStop = riskManager.updateTrailingStop(pos.stopLoss, latestCandle.high, latestCandle.low, latestAtr, 'BUY');
                    if (newStop > pos.stopLoss) {
                        console.log(`📈 Trailing Stop ratcheted up: $${pos.stopLoss.toFixed(2)} -> $${newStop.toFixed(2)}`);
                        if (isLive) {
                            await portfolio.updateRiskParams(symbol, newStop, pos.takeProfit);
                        }
                    }
                }
            }
        } else {
            console.log(`📦 Holding: None`);
        }

        // 4. Run Strategy Logic (if no risk exit triggered)
        if (!finalSignal) {
            const strategy = new RsiStrategy({ period: 14, buyThreshold: 30, sellThreshold: 70 });
            const strategySignal = strategy.analyze(candles);
            
            console.log(`\n💡 Strategy Signal: ${strategySignal.action} @ $${strategySignal.price.toFixed(2)}`);
            if (strategySignal.reason) console.log(`   Reason: ${strategySignal.reason}`);

            if (strategySignal.action === 'BUY') {
                // Enhance BUY signal with Risk Unit sizing
                const atrSeries = calculateATR(candles, riskConfig.atrPeriod);
                const latestAtr = atrSeries[atrSeries.length - 1];
                const equity = portfolio.getTotalValue(latestCandle.close, symbol);

                if (latestAtr) {
                    const stopLoss = riskManager.calculateATRStop(latestCandle.close, latestAtr, 'BUY');
                    const quantity = riskManager.calculatePositionSize(equity, latestCandle.close, stopLoss);
                    
                    finalSignal = {
                        ...strategySignal,
                        quantity,
                        stopLoss
                    };
                    console.log(`🛡️  Risk Sizing: Requested ${quantity} shares, Stop Loss: $${stopLoss.toFixed(2)}`);
                } else {
                    console.warn('⚠️  Could not calculate ATR for sizing. Skipping BUY.');
                }
            } else if (strategySignal.action === 'SELL') {
                finalSignal = strategySignal;
            }
        }

        // 5. Execute Final Signal
        if (finalSignal && finalSignal.action !== 'HOLD') {
            if (isLive) {
                console.log(`🚀 Executing LIVE ${finalSignal.action} trade...`);
                await portfolio.executeSignal(finalSignal, symbol, 'RsiStrategy');
                console.log('✅ Trade executed successfully.');
                
                const newState = portfolio.getState();
                console.log(`💰 New Cash: $${newState.cash.toFixed(2)}`);
            } else {
                console.log('🛑 DRY RUN: Trade NOT executed.');
                if (finalSignal.quantity) {
                    console.log(`   Simulated Quantity: ${finalSignal.quantity}`);
                }
            }
        } else if (!finalSignal) {
            console.log('💤 No action required.');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

main();
