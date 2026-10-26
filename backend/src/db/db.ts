import pg from 'pg';
import { MIGRATIONS } from './migrations.js';

const { Pool, Client } = pg;

/** Creates the target database if it's missing (local dev convenience). */
async function ensureDatabase(url: string) {
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  if (!dbName || dbName === 'postgres') return;
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString(), connectionTimeoutMillis: 4000 });
  await client.connect();
  try {
    const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (r.rowCount === 0) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }
}

export async function migrate(pool: pg.Pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await pool.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map((r) => r.id));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(m.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
      await client.query('COMMIT');
      applied.push(m.id);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return applied;
}

/**
 * Connects, creates the database if needed and runs migrations.
 * Returns null (memory-only mode) when no URL is set or the server can't be reached.
 */
export async function connectDb(url: string, log: (msg: string) => void = console.log): Promise<pg.Pool | null> {
  if (!url) {
    log('[db] DATABASE_URL not set: running with the in-memory cache only');
    return null;
  }
  try {
    await ensureDatabase(url);
    const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 4000, idleTimeoutMillis: 30_000 });
    pool.on('error', (e) => log(`[db] idle client error: ${e.message}`));
    const applied = await migrate(pool);
    log(`[db] connected${applied.length ? `, applied migrations: ${applied.join(', ')}` : ''}`);
    return pool;
  } catch (e) {
    log(`[db] could not connect (${(e as Error).message}): running with the in-memory cache only`);
    return null;
  }
}
