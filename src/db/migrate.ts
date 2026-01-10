import fs from 'fs/promises';
import path from 'path';
import pool from './index';

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = (await fs.readdir(migrationsDir)).sort();

    // 3. Get applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM migrations');
    const applied = new Set(appliedRows.map(row => row.name));

    // 4. Run pending migrations
    for (const file of files) {
      if (!applied.has(file) && file.endsWith('.sql')) {
        console.log(`Running migration: ${file}`);
        const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');

        // Simple parser: split by '-- Down' to get only the Up part
        const upScript = content.split('-- Down')[0];

        try {
          await client.query('BEGIN');
          await client.query(upScript);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✅ Applied ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`❌ Failed to apply ${file}:`, err);
          process.exit(1);
        }
      }
    }
    console.log('✨ All migrations are up to date.');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Execute if run directly
if (require.main === module) {
  migrate().then(() => pool.end());
}

export default migrate;
