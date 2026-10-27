import type { Cache } from './cache/cache.js';
import type { WeatherProvider } from './providers/openMeteo.js';
import type { Lang, Place, WeatherResponse } from './contract.js';
import { config } from './config.js';

/**
 * Cache-first access to the provider. Identical requests that arrive while one is in flight share
 * a single upstream call, so a burst of users opening the same city costs one request.
 */
export function createWeatherService(provider: WeatherProvider, cache: Cache) {
  const inflight = new Map<string, Promise<unknown>>();

  async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
    const hit = await cache.get<T>(key);
    if (hit !== undefined) return { value: hit, cached: true };
    let p = inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = load().then(async (v) => { await cache.set(key, v, ttlSec); return v; }).finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return { value: await p, cached: false };
  }

  // 2 decimals ≈ 1 km: nearby requests share an entry, which is finer than the forecast grid anyway.
  const coord = (n: number) => n.toFixed(2);

  return {
    async weather(lat: number, lon: number): Promise<WeatherResponse> {
      const { value, cached: hit } = await cached(`wx:${coord(lat)}:${coord(lon)}`, config.ttl.weatherSec, () => provider.weather(lat, lon));
      return { ...value, meta: { ...value.meta, cached: hit } };
    },

    async geocode(q: string, lang: Lang, limit: number): Promise<Place[]> {
      const key = `geo:${lang}:${limit}:${q.trim().toLowerCase()}`;
      return (await cached(key, config.ttl.geocodeSec, () => provider.geocode(q.trim(), lang, limit))).value;
    },

    async lookup(id: number, lang: Lang): Promise<Place> {
      return (await cached(`place:${lang}:${id}`, config.ttl.reverseSec, () => provider.lookup(id, lang))).value;
    },

    async reverse(lat: number, lon: number, lang: Lang): Promise<Place> {
      const key = `rev:${lang}:${coord(lat)}:${coord(lon)}`;
      const { value } = await cached(key, config.ttl.reverseSec, () => provider.reverse(lat, lon, lang));
      // Cached by ~1 km cell: report the caller's exact coordinates back.
      return { ...value, lat, lon };
    },
  };
}

export type WeatherService = ReturnType<typeof createWeatherService>;
