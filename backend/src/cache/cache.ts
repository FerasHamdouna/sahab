import type { Pool } from 'pg';

/**
 * Two-level cache: a small in-memory LRU in front of PostgreSQL. Postgres keeps entries across
 * restarts and shares them between server instances; if it's down, the memory layer still works
 * and the API never fails because of the cache.
 */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSec: number): Promise<void>;
  stats(): { memoryEntries: number; persistent: boolean };
}

interface Entry { value: unknown; expires: number }

export class MemoryLru {
  private map = new Map<string, Entry>();
  constructor(private max = 500) {}

  get<T>(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expires <= Date.now()) { this.map.delete(key); return undefined; }
    this.map.delete(key); // refresh recency
    this.map.set(key, e);
    return e.value as T;
  }

  set(key: string, value: unknown, ttlSec: number) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + ttlSec * 1000 });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }

  get size() { return this.map.size; }
}

export function createCache(pool: Pool | null, log: (msg: string) => void = console.warn): Cache {
  const mem = new MemoryLru();
  let dbOk = !!pool;
  const dbFailed = (e: unknown) => {
    if (dbOk) log(`[cache] PostgreSQL unavailable, using memory only: ${(e as Error).message}`);
    dbOk = false;
    // Try the database again in a minute.
    setTimeout(() => { dbOk = !!pool; }, 60_000).unref();
  };

  return {
    async get<T>(key: string) {
      const hit = mem.get<T>(key);
      if (hit !== undefined || !pool || !dbOk) return hit;
      try {
        const r = await pool.query<{ value: T; ttl: number }>(
          'SELECT value, EXTRACT(EPOCH FROM (expires_at - now()))::int AS ttl FROM cache_entries WHERE key = $1 AND expires_at > now()',
          [key],
        );
        if (!r.rows[0]) return undefined;
        mem.set(key, r.rows[0].value, Math.max(1, r.rows[0].ttl));
        return r.rows[0].value;
      } catch (e) {
        dbFailed(e);
        return undefined;
      }
    },

    async set(key, value, ttlSec) {
      mem.set(key, value, ttlSec);
      if (!pool || !dbOk) return;
      try {
        await pool.query(
          `INSERT INTO cache_entries (key, value, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at, updated_at = now()`,
          [key, JSON.stringify(value), ttlSec],
        );
      } catch (e) {
        dbFailed(e);
      }
    },

    stats: () => ({ memoryEntries: mem.size, persistent: !!pool && dbOk }),
  };
}

/** Deletes expired rows periodically so the table doesn't grow forever. */
export function startCacheJanitor(pool: Pool, everyMs = 30 * 60 * 1000) {
  const run = () => pool.query('DELETE FROM cache_entries WHERE expires_at < now()').catch(() => {});
  return setInterval(run, everyMs).unref();
}
