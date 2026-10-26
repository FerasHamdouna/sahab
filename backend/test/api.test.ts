import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createCache, MemoryLru } from '../src/cache/cache.js';
import { createWeatherService } from '../src/weatherService.js';
import { normalizeForecast, type ForecastResponse, type WeatherProvider } from '../src/providers/openMeteo.js';
import { ApiError } from '../src/contract.js';

function forecastFixture(): ForecastResponse {
  const hours = Array.from({ length: 8 * 24 }, (_, i) => {
    const d = 26 + Math.floor(i / 24);
    return `2026-10-${String(d).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00`;
  });
  const days = Array.from({ length: 8 }, (_, i) => `2026-10-${26 + i}`);
  return {
    utc_offset_seconds: 10800,
    timezone: 'Asia/Amman',
    current: {
      time: '2026-10-26T14:30', temperature_2m: 24.3, relative_humidity_2m: 41, apparent_temperature: 25.1, is_day: 1,
      precipitation: 0, weather_code: 2, cloud_cover: 35, wind_speed_10m: 14.2, wind_direction_10m: 290, wind_gusts_10m: 22,
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => 15 + (i % 24) / 2),
      weather_code: hours.map((_, i) => (i % 24 < 12 ? 0 : 61)),
      precipitation_probability: hours.map((_, i) => (i % 3 === 0 ? null : 40)),
      is_day: hours.map((_, i) => (i % 24 >= 6 && i % 24 < 17 ? 1 : 0)),
    },
    daily: {
      time: days, weather_code: days.map(() => 3), temperature_2m_max: days.map(() => 27), temperature_2m_min: days.map(() => 16),
      precipitation_probability_max: days.map(() => null), sunrise: days.map((d) => `${d}T06:12`), sunset: days.map((d) => `${d}T17:18`),
    },
  };
}

function fakeProvider(overrides: Partial<WeatherProvider> = {}) {
  const p = {
    name: 'fake',
    geocode: vi.fn(async (q: string) => (q.toLowerCase().startsWith('am') ? [{ id: 'om:1', name: 'Amman', country: 'Jordan', countryCode: 'JO', lat: 31.95, lon: 35.94 }] : [])),
    reverse: vi.fn(async (lat: number, lon: number) => ({ id: 'geo:x', name: 'Amman', country: 'Jordan', countryCode: 'JO', lat, lon })),
    weather: vi.fn(async (lat: number, lon: number) => normalizeForecast(forecastFixture(), lat, lon)),
    ...overrides,
  };
  return p;
}

function setup(provider = fakeProvider(), rateLimitPerMin = 1000) {
  const cache = createCache(null);
  const service = createWeatherService(provider as WeatherProvider, cache);
  const app = createApp({ service, cache, corsOrigins: ['http://localhost:5173'], rateLimitPerMin });
  return { app, provider };
}

describe('GET /api/v1/weather', () => {
  it('returns the contract shape: 24 hours from now, 7 days', async () => {
    const { app } = setup();
    const r = await request(app).get('/api/v1/weather?lat=31.95&lon=35.94').expect(200);
    expect(r.body.hourly).toHaveLength(24);
    expect(r.body.daily).toHaveLength(7);
    expect(r.body.hourly[0].time).toBe('2026-10-26T14:00');
    expect(r.body.hourly[0].temperature).toBe(24.3); // first hour is "now"
    expect(r.body.current.condition).toBe('partly');
    expect(r.body.location).toMatchObject({ timezone: 'Asia/Amman', utcOffsetSeconds: 10800 });
    expect(r.body.daily[0].precipitationProbability).toBe(0); // null → 0
    expect(r.headers['cache-control']).toContain('max-age=300');
  });

  it('serves the second request from cache (~1 km cell) without calling upstream again', async () => {
    const { app, provider } = setup();
    const a = await request(app).get('/api/v1/weather?lat=31.951&lon=35.944');
    const b = await request(app).get('/api/v1/weather?lat=31.953&lon=35.941');
    expect(a.body.meta.cached).toBe(false);
    expect(b.body.meta.cached).toBe(true);
    expect(provider.weather).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent identical requests into one upstream call', async () => {
    const { app, provider } = setup();
    await Promise.all(Array.from({ length: 5 }, () => request(app).get('/api/v1/weather?lat=10&lon=10').expect(200)));
    expect(provider.weather).toHaveBeenCalledTimes(1);
  });

  it('rejects bad coordinates with the contract error shape', async () => {
    const { app } = setup();
    const r = await request(app).get('/api/v1/weather?lat=200&lon=x').expect(400);
    expect(r.body.error.code).toBe('BAD_REQUEST');
    expect(r.body.error.message).toMatch(/lat/);
  });

  it('maps provider failures to 502 UPSTREAM_ERROR', async () => {
    const { app } = setup(fakeProvider({ weather: vi.fn(async () => { throw new ApiError('UPSTREAM_ERROR', 'down'); }) }));
    const r = await request(app).get('/api/v1/weather?lat=1&lon=1').expect(502);
    expect(r.body.error.code).toBe('UPSTREAM_ERROR');
  });

  it('hides unexpected errors behind a 500 INTERNAL', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = setup(fakeProvider({ weather: vi.fn(async () => { throw new Error('secret detail'); }) }));
    const r = await request(app).get('/api/v1/weather?lat=1&lon=1').expect(500);
    expect(r.body.error).toEqual({ code: 'INTERNAL', message: 'Something went wrong on our side' });
    spy.mockRestore();
  });
});

describe('GET /api/v1/geocode', () => {
  it('returns matches and caches by query + lang', async () => {
    const { app, provider } = setup();
    const r = await request(app).get('/api/v1/geocode?q=Amman&lang=en').expect(200);
    expect(r.body.results[0]).toMatchObject({ name: 'Amman', countryCode: 'JO' });
    await request(app).get('/api/v1/geocode?q=amman%20&lang=en').expect(200);
    expect(provider.geocode).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list for no matches and 400 for a too-short query', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/v1/geocode?q=zzzz').expect(200)).body.results).toEqual([]);
    expect((await request(app).get('/api/v1/geocode?q=a').expect(400)).body.error.code).toBe('BAD_REQUEST');
  });
});

describe('GET /api/v1/reverse', () => {
  it('returns a place carrying the caller\'s exact coordinates', async () => {
    const { app } = setup();
    const r = await request(app).get('/api/v1/reverse?lat=31.9512&lon=35.9441&lang=ar').expect(200);
    expect(r.body).toMatchObject({ name: 'Amman', lat: 31.9512, lon: 35.9441 });
  });
});

describe('service edges', () => {
  it('rate-limits per IP with RATE_LIMITED', async () => {
    const { app } = setup(fakeProvider(), 2);
    await request(app).get('/api/v1/geocode?q=amman').expect(200);
    await request(app).get('/api/v1/geocode?q=amman').expect(200);
    const r = await request(app).get('/api/v1/geocode?q=amman').expect(429);
    expect(r.body.error.code).toBe('RATE_LIMITED');
  });

  it('health reports cache mode; unknown routes 404', async () => {
    const { app } = setup();
    const h = await request(app).get('/api/health').expect(200);
    expect(h.body).toMatchObject({ ok: true, cache: { persistent: false } });
    await request(app).get('/api/v1/nope').expect(404);
  });

  it('sends CORS headers only to allowed origins', async () => {
    const { app } = setup();
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('MemoryLru', () => {
  it('expires entries and evicts the least recently used', () => {
    vi.useFakeTimers();
    const lru = new MemoryLru(2);
    lru.set('a', 1, 10);
    lru.set('b', 2, 10);
    lru.get('a');          // a is now most recent
    lru.set('c', 3, 10);   // evicts b
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBe(1);
    vi.advanceTimersByTime(11_000);
    expect(lru.get('a')).toBeUndefined();
    vi.useRealTimers();
  });
});
