import { MarketDataProvider } from '../marketDataProvider';
import { CandleRepository } from '../../db/repository';
import { Candle } from '../../logic/types';

// Mock CandleRepository
jest.mock('../../db/repository');

describe('MarketDataProvider', () => {
  let provider: MarketDataProvider;
  let mockRepo: jest.Mocked<CandleRepository>;

  beforeEach(() => {
    // Manually cast the mock since we are mocking the class module above
    mockRepo = new CandleRepository() as any;
    provider = new MarketDataProvider();
    (provider as any).repo = mockRepo; // Inject mock via "any" cast to access private property
  });

  it('should align candles correctly using intersection', async () => {
    const symbolA = 'A';
    const symbolB = 'B';
    const start = new Date('2023-01-01');
    const end = new Date('2023-01-05');

    const candlesA: Candle[] = [
      { time: new Date('2023-01-01T00:00:00Z'), open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
      { time: new Date('2023-01-02T00:00:00Z'), open: 1, high: 2, low: 1, close: 1.6, volume: 100 }, // Missing in B
      { time: new Date('2023-01-03T00:00:00Z'), open: 1, high: 2, low: 1, close: 1.7, volume: 100 },
    ];

    const candlesB: Candle[] = [
      { time: new Date('2023-01-01T00:00:00Z'), open: 2, high: 3, low: 2, close: 2.5, volume: 200 },
      { time: new Date('2023-01-03T00:00:00Z'), open: 2, high: 3, low: 2, close: 2.7, volume: 200 },
      { time: new Date('2023-01-04T00:00:00Z'), open: 2, high: 3, low: 2, close: 2.8, volume: 200 }, // Missing in A
    ];

    const mockMap = new Map<string, Candle[]>();
    mockMap.set(symbolA, candlesA);
    mockMap.set(symbolB, candlesB);

    mockRepo.getMultiSymbolCandles.mockResolvedValue(mockMap);

    const result = await provider.getAlignedCandles([symbolA, symbolB], '1d', start, end);

    expect(result.size).toBe(2);
    expect(result.get(symbolA)!.length).toBe(2);
    expect(result.get(symbolB)!.length).toBe(2);

    // Check timestamps
    const timesA = result.get(symbolA)!.map(c => c.time.toISOString());
    const timesB = result.get(symbolB)!.map(c => c.time.toISOString());

    expect(timesA).toEqual([
      new Date('2023-01-01T00:00:00Z').toISOString(),
      new Date('2023-01-03T00:00:00Z').toISOString()
    ]);
    expect(timesA).toEqual(timesB);
  });

  it('should return aligned returns correctly', async () => {
    const symbolA = 'A';
    const symbolB = 'B';
    const start = new Date('2023-01-01');
    const end = new Date('2023-01-05');

    const candlesA: Candle[] = [
      { time: new Date('2023-01-01T00:00:00Z'), open: 100, high: 105, low: 95, close: 100, volume: 100 },
      { time: new Date('2023-01-02T00:00:00Z'), open: 100, high: 105, low: 95, close: 110, volume: 100 },
    ];

    const candlesB: Candle[] = [
      { time: new Date('2023-01-01T00:00:00Z'), open: 200, high: 210, low: 190, close: 200, volume: 200 },
      { time: new Date('2023-01-02T00:00:00Z'), open: 200, high: 210, low: 190, close: 220, volume: 200 },
    ];

    const mockMap = new Map<string, Candle[]>();
    mockMap.set(symbolA, candlesA);
    mockMap.set(symbolB, candlesB);

    mockRepo.getMultiSymbolCandles.mockResolvedValue(mockMap);

    const result = await provider.getAlignedReturns([symbolA, symbolB], '1d', start, end);

    expect(result.size).toBe(2);
    // returns[0] is 0, returns[1] is (110-100)/100 = 0.1
    expect(result.get(symbolA)).toEqual([0, 0.1]);
    // returns[0] is 0, returns[1] is (220-200)/200 = 0.1
    expect(result.get(symbolB)).toEqual([0, 0.1]);
  });
});
