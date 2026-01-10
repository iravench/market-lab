import pool from '../db';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: npm run create-portfolio <NAME> <INITIAL_CASH>');
    process.exit(1);
  }

  const [name, cashStr] = args;
  const cash = parseFloat(cashStr);

  try {
    const res = await pool.query(
      `INSERT INTO portfolios (name, initial_cash, current_cash)
             VALUES ($1, $2, $2)
             RETURNING id`,
      [name, cash]
    );

    console.log(`✅ Portfolio Created: "${name}"`);
    console.log(`🆔 ID: ${res.rows[0].id}`);
    console.log(`💰 Cash: $${cash}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
