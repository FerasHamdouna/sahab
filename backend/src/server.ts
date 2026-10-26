import { config } from './config.js';
import { connectDb } from './db/db.js';
import { createCache, startCacheJanitor } from './cache/cache.js';
import { openMeteo } from './providers/openMeteo.js';
import { createWeatherService } from './weatherService.js';
import { createApp } from './app.js';

const pool = await connectDb(config.databaseUrl);
if (pool) startCacheJanitor(pool);
const cache = createCache(pool);
const service = createWeatherService(openMeteo, cache);
const app = createApp({ service, cache, corsOrigins: config.corsOrigins, rateLimitPerMin: config.rateLimitPerMin, trustProxy: config.trustProxy });

const server = app.listen(config.port, () => {
  console.log(`[api] Sahab backend on http://localhost:${config.port} (provider: ${openMeteo.name}, cache: ${pool ? 'memory + PostgreSQL' : 'memory'})`);
});

const shutdown = async () => {
  server.close();
  await pool?.end().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
