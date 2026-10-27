import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_TIMEOUT_MS, backendProvider } from './backend';
import { openMeteoProvider } from './openMeteo';
import { localizeFixture } from './mock';
import type { Place, WeatherData } from '../types';

const place: Place = { id: 'om:1', name: 'Amman', country: 'Jordan', countryCode: 'JO', lat: 31.95, lon: 35.94 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('backendProvider fallback', () => {
  it('uses the backend when it answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { location: { timezone: 'Asia/Amman', utcOffsetSeconds: 10800 }, current: {}, hourly: [], daily: [], meta: {} })));
    const direct = vi.spyOn(openMeteoProvider, 'weather');
    const w = await backendProvider.weather(place);
    expect(w.location).toMatchObject({ name: 'Amman', timezone: 'Asia/Amman', utcOffsetSeconds: 10800 });
    expect(direct).not.toHaveBeenCalled();
  });

  it('falls back to Open-Meteo from the browser when the backend gets 429 upstream (502)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(502, { error: { code: 'UPSTREAM_ERROR', message: 'Weather provider answered 429' } })));
    const direct = vi.spyOn(openMeteoProvider, 'weather').mockResolvedValue({ location: { ...place, utcOffsetSeconds: 0 } } as WeatherData);
    await backendProvider.weather(place);
    expect(direct).toHaveBeenCalledWith(place);
  });

  it('falls back when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const direct = vi.spyOn(openMeteoProvider, 'geocode').mockResolvedValue([place]);
    expect(await backendProvider.geocode('amman', 'en')).toEqual([place]);
    expect(direct).toHaveBeenCalled();
  });

  it('stops waiting for a sleeping backend and fetches directly', async () => {
    vi.useFakeTimers();
    // A cold free-tier host: the request just hangs until it's aborted.
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const direct = vi.spyOn(openMeteoProvider, 'weather').mockResolvedValue({ location: { ...place, utcOffsetSeconds: 0 } } as WeatherData);
    const pending = backendProvider.weather(place);
    await vi.advanceTimersByTimeAsync(BACKEND_TIMEOUT_MS - 1);
    expect(direct).not.toHaveBeenCalled(); // still giving the backend its chance
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(direct).toHaveBeenCalledWith(place);
    vi.useRealTimers();
  });

  it('localize: renames a searched city via /place, keeping id and coordinates', async () => {
    const fetchMock = vi.fn(async (_url: string) => json(200, { id: 'om:281133', name: 'Gaza', region: 'Gaza Strip', country: 'Palestinian Territories', countryCode: 'PS', lat: 31.5016, lon: 34.4667 }));
    vi.stubGlobal('fetch', fetchMock);
    const gazaAr: Place = { id: 'om:281133', name: 'غزة', region: 'قطاع غزة', country: 'فلسطين', countryCode: 'PS', lat: 31.5, lon: 34.47, lang: 'ar' };
    const p = await backendProvider.localize(gazaAr, 'en');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/place?id=om:281133&lang=en');
    expect(p).toMatchObject({ id: 'om:281133', name: 'Gaza', region: 'Gaza Strip', lat: 31.5, lon: 34.47, lang: 'en' });
  });

  it('localize: renames a "my location" place by reverse-geocoding its coordinates', async () => {
    const fetchMock = vi.fn(async (_url: string) => json(200, { id: 'geo:31.500,34.470', name: 'Gaza', country: 'Palestine', countryCode: 'PS', lat: 31.5, lon: 34.47 }));
    vi.stubGlobal('fetch', fetchMock);
    const here: Place = { id: 'geo:31.500,34.470', name: 'غزة', country: 'دولة فلسطين', countryCode: 'PS', lat: 31.5, lon: 34.47, lang: 'ar' };
    const p = await backendProvider.localize(here, 'en');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/reverse?lat=31.5&lon=34.47&lang=en');
    expect(p).toMatchObject({ id: here.id, name: 'Gaza', country: 'Palestine', lang: 'en' });
  });

  it('localize: demo cities switch language without any request', () => {
    expect(localizeFixture({ id: 'fx:amman', name: 'عمّان', country: 'الأردن', countryCode: 'JO', lat: 31.9, lon: 35.9 }, 'en'))
      .toMatchObject({ name: 'Amman', country: 'Jordan', lang: 'en' });
    expect(localizeFixture({ id: 'om:1', name: 'x', country: '', countryCode: '', lat: 0, lon: 0 }, 'en')).toBeNull();
  });

  it('does not hide real request errors behind the fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(400, { error: { code: 'BAD_REQUEST', message: 'lat: too big' } })));
    const direct = vi.spyOn(openMeteoProvider, 'weather');
    await expect(backendProvider.weather(place)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(direct).not.toHaveBeenCalled();
  });
});
