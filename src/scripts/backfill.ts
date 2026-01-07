import { MarketDataService } from '../services/marketData';

const symbol = process.argv[2];
const startDate = process.argv[3] || '2023-01-01';
const intervalArg = process.argv[4] || '1d';

if (!symbol) {
  console.error('Usage: npm run backfill <SYMBOL> [START_DATE] [INTERVAL]');
  console.error('Example: npm run backfill CBA.AX 2023-01-01 1d');
  process.exit(1);
}

if (intervalArg !== '1d' && intervalArg !== '1h') {
  console.error('❌ Invalid interval. Supported: 1d, 1h');
  process.exit(1);
}

async function run() {
  const service = new MarketDataService();
  await service.backfill(symbol, startDate, intervalArg as '1d' | '1h');
}

run();
