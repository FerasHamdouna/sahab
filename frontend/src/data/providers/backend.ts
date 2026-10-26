import { ProviderError, type Place, type WeatherData, type WeatherProvider } from '../types';
import { openMeteoProvider } from './openMeteo';

// Same origin by default: Vite proxies /api to the backend in dev and preview.
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '') + '/api/v1';

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch {
    throw new ProviderError('UPSTREAM_ERROR', 'network');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const code = body?.error?.code;
    throw new ProviderError(
      code === 'LOCATION_NOT_FOUND' || code === 'BAD_REQUEST' ? code : 'UPSTREAM_ERROR',
      body?.error?.message ?? `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

type BackendWeather = Omit<WeatherData, 'location'> & { location: { timezone: string; utcOffsetSeconds: number } };

/**
 * If our backend can't reach the upstream (e.g. Open-Meteo rate-limits the host's shared IP with
 * 429, or the backend is down), the browser asks Open-Meteo directly from the user's own IP.
 * Bad requests are real errors and are not retried.
 */
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (e) {
    if (e instanceof ProviderError && e.code !== 'UPSTREAM_ERROR') throw e;
    return fallback();
  }
}

export const backendProvider: WeatherProvider = {
  name: 'backend',
  geocode(query, lang) {
    return withFallback(
      async () => (await get<{ results: Place[] }>(`/geocode?q=${encodeURIComponent(query)}&lang=${lang}&limit=8`)).results,
      () => openMeteoProvider.geocode(query, lang),
    );
  },
  reverse(lat, lon, lang) {
    return withFallback(() => get<Place>(`/reverse?lat=${lat}&lon=${lon}&lang=${lang}`), () => openMeteoProvider.reverse(lat, lon, lang));
  },
  weather(place) {
    return withFallback(
      async () => {
        const w = await get<BackendWeather>(`/weather?lat=${place.lat.toFixed(4)}&lon=${place.lon.toFixed(4)}`);
        // The backend only knows coordinates; the place the user picked supplies the name.
        return { ...w, location: { ...place, timezone: w.location.timezone, utcOffsetSeconds: w.location.utcOffsetSeconds } };
      },
      () => openMeteoProvider.weather(place),
    );
  },
};
