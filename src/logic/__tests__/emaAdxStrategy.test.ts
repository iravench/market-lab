import { EmaAdxStrategy } from '../strategies/emaAdxStrategy';
import { Candle } from '../types';

describe('EmaAdxStrategy', () => {
  const createCandle = (
    close: number,
    high: number,
    low: number
  ): Candle => ({
    time: new Date(),
    open: close,
    high,
    low,
    close,
    volume: 100,
  });

  const generateTrend = (length: number, startPrice: number, step: number): Candle[] => {
    const candles: Candle[] = [];
    let price = startPrice;
    for (let i = 0; i < length; i++) {
      candles.push(createCandle(price, price + 1, price - 1));
      price += step;
    }
    return candles;
  };

  it('should signal BUY on Golden Cross with high ADX', () => {
    // Scenario: "Dip and Resume"
    // 1. Establish a trend to pump ADX.
    // 2. Quick pullback to cause Death Cross.
    // 3. Resume trend to cause Golden Cross while ADX is still high.
    
    // 1. Warmup (60 flat)
    const candles = [];
    for(let i=0; i<60; i++) {
        candles.push(createCandle(10, 11, 9));
    }
    
    // 2. First Uptrend (Pump ADX) - 20 candles
    let price = 10;
    for(let i=0; i<30; i++) {
        price += 2; 
        candles.push(createCandle(price, price+2, price-1));
    }
    
    // 3. Sharp Pullback (Death Cross) - 5 candles
    for(let i=0; i<5; i++) {
        price -= 3;
        candles.push(createCandle(price, price+1, price-2));
    }
    
    // 4. Resume Uptrend (Golden Cross)
    for(let i=0; i<10; i++) {
        price += 3;
        candles.push(createCandle(price, price+2, price-1));
    }

    const strategy = new EmaAdxStrategy({ fastPeriod: 5, slowPeriod: 10, adxThreshold: 20 });
    
    let signalFound = false;
    for (let i = 80; i < candles.length; i++) {
        const slice = candles.slice(0, i+1);
        const signal = strategy.analyze(slice);
        
        if (signal.action === 'BUY') {
            signalFound = true;
            break;
        }
    }
    
    expect(signalFound).toBe(true);
  });

  it('should signal SELL on Death Cross', () => {
      // Uptrend then Downtrend
      const up = generateTrend(30, 10, 1);
      const down = generateTrend(20, 40, -1);
      const candles = [...up, ...down];
      
      const strategy = new EmaAdxStrategy({ fastPeriod: 5, slowPeriod: 10 });
      
      let sellFound = false;
      for(let i=30; i<candles.length; i++) {
          const slice = candles.slice(0, i+1);
          const signal = strategy.analyze(slice);
          if (signal.action === 'SELL') {
              sellFound = true;
              break;
          }
      }
      expect(sellFound).toBe(true);
  });
  
  it('should HOLD if ADX is too low', () => {
      // Gentle slope (low ADX) but crossover
      const flat = Array(20).fill(createCandle(10, 11, 9));
      // Very slow rise
      const slowUp = generateTrend(30, 10, 0.1); 
      
      const candles = [...flat, ...slowUp];
      const strategy = new EmaAdxStrategy({ adxThreshold: 50 }); // High threshold
      
      // We expect no BUY despite crossover because ADX < 50
      let buyFound = false;
      for(let i=25; i<candles.length; i++) {
          const slice = candles.slice(0, i+1);
          const signal = strategy.analyze(slice);
          if (signal.action === 'BUY') buyFound = true;
      }
      expect(buyFound).toBe(false);
  });
});
