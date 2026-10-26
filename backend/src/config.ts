import 'dotenv/config';

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 8080),
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
    .split(',').map((s) => s.trim()).filter(Boolean),
  rateLimitPerMin: num(process.env.RATE_LIMIT_PER_MIN, 120),
  /** Cache lifetimes, docs/API_CONTRACT.md §5. */
  ttl: {
    weatherSec: 10 * 60,
    geocodeSec: 7 * 24 * 60 * 60,
    reverseSec: 30 * 24 * 60 * 60,
  },
  upstreamTimeoutMs: 8000,
};
