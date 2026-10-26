import 'dotenv/config';

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 8080),
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
    .split(',').map((s) => s.trim()).filter(Boolean),
  rateLimitPerMin: num(process.env.RATE_LIMIT_PER_MIN, 120),
  /** Proxy hops in front of the app (Render/Railway = 1), so rate limiting sees the real client IP. */
  trustProxy: num(process.env.TRUST_PROXY, 1),
  /** Cache lifetimes, docs/API_CONTRACT.md §5. */
  ttl: {
    weatherSec: 10 * 60,
    geocodeSec: 7 * 24 * 60 * 60,
    reverseSec: 30 * 24 * 60 * 60,
  },
  upstreamTimeoutMs: 8000,
  /** Optional paid Open-Meteo key (own quota instead of the shared-IP free limit). */
  openMeteoApiKey: process.env.OPEN_METEO_API_KEY?.trim() || '',
};
