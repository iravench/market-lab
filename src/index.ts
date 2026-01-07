import pool from './db';

async function main() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to TimescaleDB successfully');
    
    const res = await client.query('SELECT NOW()');
    console.log('🕒 Database time:', res.rows[0].now);
    
    client.release();
  } catch (err) {
    console.error('❌ Failed to connect to database:', err);
  } finally {
    await pool.end();
  }
}

main();
