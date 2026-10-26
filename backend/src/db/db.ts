import pg from 'pg';
import { MIGRATIONS } from './migrations.js';

const { Pool, Client } = pg;

// Hosted Postgres (Render/Railway public URLs) needs TLS; local and private-network URLs don't.
const sslFor = (url: string) =>
  process.env.DATABASE_SSL === 'true' || /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined;

/**
 * Local dev convenience: create the database when the server says it doesn't exist (3D000).
 * Hosted databases always exist and their users usually can't create databases, so this only
 * runs on that specific error.
 */
async function createDatabase(url: string) {
  const dbName = decodeURIComponent(new URL(url).pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString(), connectionTimeoutMillis: 4000, ssl: sslFor(url) });
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
  const open = () => {
    const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 8000, idleTimeoutMillis: 30_000, ssl: sslFor(url) });
    pool.on('error', (e) => log(`[db] idle client error: ${e.message}`));
    return pool;
  };
  try {
    let pool = open();
    let applied: string[];
    try {
      applied = await migrate(pool);
    } catch (e) {
      if ((e as { code?: string }).code !== '3D000') throw e; // 3D000 = database does not exist
      await pool.end();
      await createDatabase(url);
      log('[db] created database');
      pool = open();
      applied = await migrate(pool);
    }
    log(`[db] connected${applied.length ? `, applied migrations: ${applied.join(', ')}` : ''}`);
    return pool;
  } catch (e) {
    log(`[db] could not connect (${(e as Error).message}): running with the in-memory cache only`);
    return null;
  }
}
