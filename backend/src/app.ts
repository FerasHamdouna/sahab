import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ApiError } from './contract.js';
import type { WeatherService } from './weatherService.js';
import type { Cache } from './cache/cache.js';

const lang = z.enum(['ar', 'en']).default('ar');
const lat = z.coerce.number().min(-90).max(90);
const lon = z.coerce.number().min(-180).max(180);

const schemas = {
  geocode: z.object({ q: z.string().trim().min(2).max(100), lang, limit: z.coerce.number().int().min(1).max(10).default(8) }),
  weather: z.object({ lat, lon }),
  reverse: z.object({ lat, lon, lang }),
};

function parse<T extends z.ZodType>(schema: T, query: unknown): z.infer<T> {
  const r = schema.safeParse(query);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'query'}: ${i.message}`).join('; ');
    throw new ApiError('BAD_REQUEST', msg);
  }
  return r.data;
}

export interface AppDeps {
  service: WeatherService;
  cache: Cache;
  corsOrigins: string[];
  rateLimitPerMin: number;
  trustProxy?: number;
}

export function createApp({ service, cache, corsOrigins, rateLimitPerMin, trustProxy = 1 }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(cors({ origin: corsOrigins, methods: ['GET'] }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptimeSec: Math.round(process.uptime()), cache: cache.stats() });
  });

  const v1 = express.Router();
  v1.use(rateLimit({
    windowMs: 60_000,
    limit: rateLimitPerMin,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError('RATE_LIMITED', 'Too many requests, slow down for a minute')),
  }));

  v1.get('/geocode', async (req, res) => {
    const { q, lang: l, limit } = parse(schemas.geocode, req.query);
    const results = await service.geocode(q, l, limit);
    res.set('Cache-Control', 'public, max-age=86400').json({ results });
  });

  v1.get('/weather', async (req, res) => {
    const { lat: la, lon: lo } = parse(schemas.weather, req.query);
    const data = await service.weather(la, lo);
    res.set('Cache-Control', 'public, max-age=300').json(data);
  });

  v1.get('/reverse', async (req, res) => {
    const { lat: la, lon: lo, lang: l } = parse(schemas.reverse, req.query);
    res.set('Cache-Control', 'public, max-age=86400').json(await service.reverse(la, lo, l));
  });

  app.use('/api/v1', v1);

  app.use((_req, _res, next) => next(new ApiError('BAD_REQUEST', 'Unknown endpoint', 404)));

  // Contract error shape: { error: { code, message } }
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err instanceof ApiError ? err : new ApiError('INTERNAL', 'Something went wrong on our side');
    if (!(err instanceof ApiError)) console.error('[api] unexpected error', err);
    res.status(e.status).json({ error: { code: e.code, message: e.message } });
  });

  return app;
}
