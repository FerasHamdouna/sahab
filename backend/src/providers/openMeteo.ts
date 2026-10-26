import { ApiError, type Lang, type Place, type WeatherResponse } from '../contract.js';
import { config } from '../config.js';
import { wmoToCondition } from './wmo.js';

/** What the API layer needs from an upstream. Swap implementations without touching routes. */
export interface WeatherProvider {
  readonly name: string;
  geocode(query: string, lang: Lang, limit: number): Promise<Place[]>;
  reverse(lat: number, lon: number, lang: Lang): Promise<Place>;
  weather(lat: number, lon: number): Promise<Omit<WeatherResponse, 'meta'> & { meta: Omit<WeatherResponse['meta'], 'cached'> }>;
}

// With an Open-Meteo API key the server uses the commercial hosts and its own quota. The free
// hosts limit by IP, and free cloud plans (Render) share outbound IPs, so they often answer 429.
const KEY = config.openMeteoApiKey;
const GEO = KEY ? 'https://customer-geocoding-api.open-meteo.com/v1/search' : 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = KEY ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast';
const withKey = (url: string) => (KEY ? `${url}&apikey=${encodeURIComponent(KEY)}` : url);
const REVERSE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(config.upstreamTimeoutMs), headers: { 'user-agent': 'sahab-weather/0.1' } });
  } catch {
    throw new ApiError('UPSTREAM_ERROR', 'Weather provider is unreachable');
  }
  if (!res.ok) {
    const reason = await res.text().catch(() => '');
    console.warn(`[upstream] ${new URL(url).host} answered ${res.status}: ${reason.slice(0, 200)}`);
    throw new ApiError('UPSTREAM_ERROR', `Weather provider answered ${res.status}`);
  }
  return (await res.json()) as T;
}

interface GeoResult {
  id: number; name: string; latitude: number; longitude: number;
  country?: string; country_code?: string; admin1?: string; timezone?: string;
}

interface ForecastResponse {
  utc_offset_seconds: number;
  timezone: string;
  current: {
    time: string; temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number;
    is_day: number; precipitation: number; weather_code: number; cloud_cover: number;
    wind_speed_10m: number; wind_direction_10m: number; wind_gusts_10m: number;
  };
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[]; precipitation_probability: (number | null)[]; is_day: number[] };
  daily: {
    time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[]; sunrise: string[]; sunset: string[];
  };
}

export const openMeteo: WeatherProvider = {
  name: 'open-meteo',

  async geocode(query, lang, limit) {
    const url = `${GEO}?name=${encodeURIComponent(query)}&count=${limit}&language=${lang}&format=json`;
    const j = await getJson<{ results?: GeoResult[] }>(withKey(url));
    return (j.results ?? []).map((r) => ({
      id: `om:${r.id}`,
      name: r.name,
      region: r.admin1,
      country: r.country ?? '',
      countryCode: (r.country_code ?? '').toUpperCase(),
      lat: r.latitude,
      lon: r.longitude,
      timezone: r.timezone,
    }));
  },

  async reverse(lat, lon, lang) {
    const url = `${REVERSE}?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`;
    const j = await getJson<{ city?: string; locality?: string; principalSubdivision?: string; countryName?: string; countryCode?: string }>(url);
    const name = j.city || j.locality || j.principalSubdivision || '';
    if (!name) throw new ApiError('LOCATION_NOT_FOUND', 'No place found at these coordinates');
    return {
      id: `geo:${lat.toFixed(3)},${lon.toFixed(3)}`,
      name,
      region: j.principalSubdivision,
      country: j.countryName ?? '',
      countryCode: (j.countryCode ?? '').toUpperCase(),
      lat,
      lon,
    };
  },

  async weather(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      timezone: 'auto',
      forecast_days: '8',
      wind_speed_unit: 'kmh',
    });
    return normalizeForecast(await getJson<ForecastResponse>(withKey(`${FORECAST}?${params}`)), lat, lon);
  },
};

/** Open-Meteo forecast → contract shape: 24 hours from the current hour, 7 days from today. */
export function normalizeForecast(j: ForecastResponse, lat: number, lon: number) {
  const c = j.current;
  const hourKey = c.time.slice(0, 13);
  let start = j.hourly.time.findIndex((t) => t.slice(0, 13) === hourKey);
  if (start < 0) start = 0;
  if (j.hourly.time.length < start + 24 || j.daily.time.length < 7) {
    throw new ApiError('UPSTREAM_ERROR', 'Weather provider returned an incomplete forecast');
  }
  return {
    location: { lat, lon, timezone: j.timezone, utcOffsetSeconds: j.utc_offset_seconds },
    current: {
      time: c.time,
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      windGusts: c.wind_gusts_10m,
      windDirection: c.wind_direction_10m,
      cloudCover: c.cloud_cover,
      precipitation: c.precipitation,
      weatherCode: c.weather_code,
      condition: wmoToCondition(c.weather_code),
      isDay: c.is_day === 1,
    },
    hourly: Array.from({ length: 24 }, (_, k) => {
      const i = start + k;
      const code = k === 0 ? c.weather_code : j.hourly.weather_code[i];
      return {
        time: j.hourly.time[i],
        temperature: k === 0 ? c.temperature_2m : j.hourly.temperature_2m[i],
        weatherCode: code,
        condition: wmoToCondition(code),
        precipitationProbability: j.hourly.precipitation_probability[i] ?? 0,
        isDay: j.hourly.is_day[i] === 1,
      };
    }),
    daily: Array.from({ length: 7 }, (_, i) => ({
      date: j.daily.time[i],
      tempMax: j.daily.temperature_2m_max[i],
      tempMin: j.daily.temperature_2m_min[i],
      weatherCode: j.daily.weather_code[i],
      condition: wmoToCondition(j.daily.weather_code[i]),
      precipitationProbability: j.daily.precipitation_probability_max[i] ?? 0,
      sunrise: j.daily.sunrise[i],
      sunset: j.daily.sunset[i],
    })),
    meta: { provider: 'open-meteo', fetchedAt: new Date().toISOString(), units: 'metric' as const },
  };
}

export type { ForecastResponse };
