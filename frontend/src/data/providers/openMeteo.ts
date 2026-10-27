import { ProviderError, type Lang, type Place, type WeatherData, type WeatherProvider } from '../types';
import { wmoToCondition } from '../wmo';

const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEO_GET = 'https://geocoding-api.open-meteo.com/v1/get';
const REVERSE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/** Only the language-dependent fields: id and coordinates of the place the user picked never change. */
export const pickNames = (p: Place): Pick<Place, 'name' | 'region' | 'country' | 'lang'> =>
  ({ name: p.name, region: p.region, country: p.country, lang: p.lang });

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ProviderError('UPSTREAM_ERROR', 'network');
  }
  if (!res.ok) throw new ProviderError(res.status === 400 ? 'BAD_REQUEST' : 'UPSTREAM_ERROR', `HTTP ${res.status}`);
  return res.json() as Promise<T>;
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

/** Country name in `lang` from its ISO code (lookup-by-id responses omit `country`). */
export function countryName(code: string | undefined, lang: Lang): string {
  if (!code) return '';
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code.toUpperCase()) ?? ''; } catch { return ''; }
}

function toPlace(r: GeoResult, lang: Lang): Place {
  return {
    id: `om:${r.id}`,
    name: r.name,
    region: r.admin1,
    country: r.country || countryName(r.country_code, lang),
    countryCode: (r.country_code ?? '').toUpperCase(),
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
    lang,
  };
}

export const openMeteoProvider: WeatherProvider = {
  name: 'open-meteo',

  async geocode(query: string, lang: Lang): Promise<Place[]> {
    const url = `${GEO}?name=${encodeURIComponent(query)}&count=8&language=${lang}&format=json`;
    const j = await getJson<{ results?: GeoResult[] }>(url);
    return (j.results ?? []).map((r) => toPlace(r, lang));
  },

  async reverse(lat: number, lon: number, lang: Lang): Promise<Place> {
    const url = `${REVERSE}?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`;
    const j = await getJson<{ city?: string; locality?: string; principalSubdivision?: string; countryName?: string; countryCode?: string }>(url);
    return {
      id: `geo:${lat.toFixed(3)},${lon.toFixed(3)}`,
      name: j.city || j.locality || j.principalSubdivision || '',
      region: j.principalSubdivision,
      country: j.countryName ?? '',
      countryCode: (j.countryCode ?? '').toUpperCase(),
      lat,
      lon,
      lang,
    };
  },

  async localize(place: Place, lang: Lang): Promise<Place> {
    if (place.id.startsWith('om:')) {
      const j = await getJson<Partial<GeoResult>>(`${GEO_GET}?id=${place.id.slice(3)}&language=${lang}`);
      if (!j.id || !j.name) return place;
      return { ...place, ...pickNames(toPlace(j as GeoResult, lang)) };
    }
    if (place.id.startsWith('geo:')) {
      const p = await openMeteoProvider.reverse(place.lat, place.lon, lang);
      return p.name ? { ...place, ...pickNames(p) } : place;
    }
    return place;
  },

  async weather(place: Place): Promise<WeatherData> {
    const params = new URLSearchParams({
      latitude: place.lat.toFixed(4),
      longitude: place.lon.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      timezone: 'auto',
      forecast_days: '8',
      wind_speed_unit: 'kmh',
    });
    const j = await getJson<ForecastResponse>(`${FORECAST}?${params}`);
    const c = j.current;
    const hourKey = c.time.slice(0, 13);
    let start = j.hourly.time.findIndex((t) => t.slice(0, 13) === hourKey);
    if (start < 0) start = 0;

    return {
      location: { ...place, timezone: j.timezone, utcOffsetSeconds: j.utc_offset_seconds },
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
        return {
          time: j.hourly.time[i],
          temperature: k === 0 ? c.temperature_2m : j.hourly.temperature_2m[i],
          weatherCode: k === 0 ? c.weather_code : j.hourly.weather_code[i],
          condition: wmoToCondition(k === 0 ? c.weather_code : j.hourly.weather_code[i]),
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
      meta: { provider: 'open-meteo', fetchedAt: new Date().toISOString(), units: 'metric' },
    };
  },
};
