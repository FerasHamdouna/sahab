// Ordered, append-only. Never edit a migration that has shipped; add a new one.
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_cache_entries',
    sql: `
      CREATE TABLE IF NOT EXISTS cache_entries (
        key         text PRIMARY KEY,
        value       jsonb NOT NULL,
        expires_at  timestamptz NOT NULL,
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS cache_entries_expires_at_idx ON cache_entries (expires_at);
    `,
  },
];
