import { ProviderError, type Place, type WeatherData, type WeatherProvider } from '../types';

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

export const backendProvider: WeatherProvider = {
  name: 'backend',
  async geocode(query, lang) {
    return (await get<{ results: Place[] }>(`/geocode?q=${encodeURIComponent(query)}&lang=${lang}&limit=8`)).results;
  },
  async reverse(lat, lon, lang) {
    return get<Place>(`/reverse?lat=${lat}&lon=${lon}&lang=${lang}`);
  },
  async weather(place) {
    const w = await get<BackendWeather>(`/weather?lat=${place.lat.toFixed(4)}&lon=${place.lon.toFixed(4)}`);
    // The backend only knows coordinates; the place the user picked supplies the name.
    return { ...w, location: { ...place, timezone: w.location.timezone, utcOffsetSeconds: w.location.utcOffsetSeconds } };
  },
};
