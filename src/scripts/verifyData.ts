import pool from '../db';

const symbol = process.argv[2] || 'CBA.AX';

async function verify() {
  console.log(`📊 Data Stats for ${symbol}:`);
  const client = await pool.connect();

  try {
    // 1. Check total count and date range per interval
    const summary = await client.query(`
      SELECT 
        interval,
        count(*) as total_candles,
        min(time) as first_candle,
        max(time) as last_candle
      FROM candles 
      WHERE symbol = $1
      GROUP BY interval
    `, [symbol]);

    if (summary.rows.length === 0) {
      console.log(`❌ No data found for ${symbol}.`);
    } else {
      console.table(summary.rows);

      // 2. Show the latest 5 candles
      console.log('\n📅 Latest 5 candles:');
      const latest = await client.query(`
        SELECT time, open, high, low, close, volume
        FROM candles
        WHERE symbol = $1
        ORDER BY time DESC
        LIMIT 5
      `, [symbol]);
      console.table(latest.rows);
    }
  } catch (err) {
    console.error('❌ Error querying database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

verify();
