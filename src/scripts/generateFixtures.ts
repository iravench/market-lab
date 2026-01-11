import yahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';

async function generate() {
  const symbol = 'CBA.AX';
  const startDate = '2023-01-01';
  const endDate = '2023-07-01'; // 6 months of data

  console.log(`Fetching ${symbol} from ${startDate} to ${endDate}...`);
  
  try {
    const yf = new yahooFinance({ suppressNotices: ['ripHistorical'] });
    const result = await yf.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });

    if (!result || !result.quotes) {
      throw new Error('No quotes found');
    }

    const candles = (result.quotes as any[]).map(q => ({
      time: q.date.toISOString(), // Save as string for JSON
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume
    }));

    const outputPath = path.join(__dirname, '../logic/__tests__/fixtures/cba_2023.json');
    fs.writeFileSync(outputPath, JSON.stringify(candles, null, 2));
    
    console.log(`✅ Saved ${candles.length} candles to ${outputPath}`);

  } catch (err) {
    console.error('Failed to fetch data:', err);
  }
}

generate();
