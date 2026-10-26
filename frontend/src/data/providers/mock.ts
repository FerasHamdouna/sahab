import type { Condition, Lang, Place, WeatherData, WeatherProvider } from '../types';
import { CONDITION_CODE } from '../wmo';
import { minutesOf } from '../time';

// Demo cities that cover every scene. Each has a fixed local clock so scenes are reproducible.
type Day = [Condition, number, number, number];
interface Fixture {
  key: string; cc: string; lat: number; lon: number;
  ar: [string, string]; en: [string, string];
  clock: string; cond: Condition; temp: number; feels: number;
  wind: number; gust: number; dir: number; hum: number; cloud: number;
  sunrise: string; sunset: string; days: Day[];
}

export const FIXTURES: Fixture[] = [
  { key: 'amman', cc: 'JO', lat: 31.955, lon: 35.945, ar: ['عمّان', 'الأردن'], en: ['Amman', 'Jordan'], clock: '14:32', cond: 'partly', temp: 24, feels: 25, wind: 14, gust: 22, dir: 290, hum: 41, cloud: 40, sunrise: '06:12', sunset: '17:18',
    days: [['partly', 27, 16, 5], ['clear', 28, 17, 0], ['clear', 29, 17, 0], ['partly', 26, 15, 10], ['rain', 21, 13, 60], ['overcast', 22, 13, 20], ['clear', 25, 14, 0]] },
  { key: 'dubai', cc: 'AE', lat: 25.276, lon: 55.296, ar: ['دبي', 'الإمارات'], en: ['Dubai', 'UAE'], clock: '12:10', cond: 'clear', temp: 39, feels: 42, wind: 12, gust: 18, dir: 320, hum: 48, cloud: 0, sunrise: '06:22', sunset: '17:50',
    days: [['clear', 41, 30, 0], ['clear', 40, 29, 0], ['clear', 39, 29, 0], ['partly', 38, 28, 0], ['clear', 39, 28, 0], ['clear', 40, 29, 0], ['clear', 41, 30, 0]] },
  { key: 'london', cc: 'GB', lat: 51.507, lon: -0.128, ar: ['لندن', 'المملكة المتحدة'], en: ['London', 'United Kingdom'], clock: '16:05', cond: 'rain', temp: 11, feels: 8, wind: 28, gust: 46, dir: 225, hum: 88, cloud: 100, sunrise: '06:58', sunset: '16:40',
    days: [['rain', 13, 8, 90], ['drizzle', 12, 7, 60], ['overcast', 13, 8, 30], ['partly', 14, 7, 10], ['rain', 12, 9, 80], ['rain', 11, 7, 70], ['partly', 12, 6, 20]] },
  { key: 'moscow', cc: 'RU', lat: 55.756, lon: 37.617, ar: ['موسكو', 'روسيا'], en: ['Moscow', 'Russia'], clock: '11:20', cond: 'snow', temp: -4, feels: -10, wind: 18, gust: 30, dir: 340, hum: 85, cloud: 90, sunrise: '07:44', sunset: '16:38',
    days: [['snow', -2, -7, 80], ['snow', -3, -9, 70], ['overcast', -5, -11, 20], ['clear', -6, -14, 0], ['partly', -4, -10, 10], ['snow', -1, -6, 60], ['overcast', -2, -7, 30]] },
  { key: 'tokyo', cc: 'JP', lat: 35.69, lon: 139.692, ar: ['طوكيو', 'اليابان'], en: ['Tokyo', 'Japan'], clock: '22:40', cond: 'clear', temp: 14, feels: 13, wind: 6, gust: 10, dir: 20, hum: 60, cloud: 5, sunrise: '05:56', sunset: '16:47',
    days: [['clear', 19, 12, 0], ['partly', 20, 13, 10], ['rain', 17, 13, 70], ['overcast', 18, 12, 30], ['clear', 20, 11, 0], ['clear', 21, 12, 0], ['partly', 19, 12, 10]] },
  { key: 'miami', cc: 'US', lat: 25.774, lon: -80.194, ar: ['ميامي', 'الولايات المتحدة'], en: ['Miami', 'United States'], clock: '15:30', cond: 'storm', temp: 27, feels: 31, wind: 42, gust: 70, dir: 135, hum: 90, cloud: 100, sunrise: '07:28', sunset: '18:46',
    days: [['storm', 30, 24, 90], ['rain', 29, 24, 70], ['partly', 30, 24, 20], ['storm', 29, 23, 80], ['partly', 30, 24, 20], ['clear', 31, 24, 0], ['partly', 30, 25, 10]] },
  { key: 'sf', cc: 'US', lat: 37.775, lon: -122.419, ar: ['سان فرانسيسكو', 'الولايات المتحدة'], en: ['San Francisco', 'United States'], clock: '08:10', cond: 'fog', temp: 13, feels: 12, wind: 10, gust: 16, dir: 260, hum: 95, cloud: 60, sunrise: '07:24', sunset: '18:12',
    days: [['fog', 18, 12, 10], ['partly', 19, 12, 0], ['clear', 21, 13, 0], ['fog', 17, 12, 10], ['overcast', 17, 12, 20], ['partly', 19, 12, 0], ['clear', 22, 13, 0]] },
  { key: 'berlin', cc: 'DE', lat: 52.52, lon: 13.405, ar: ['برلين', 'ألمانيا'], en: ['Berlin', 'Germany'], clock: '13:00', cond: 'overcast', temp: 9, feels: 7, wind: 16, gust: 28, dir: 250, hum: 76, cloud: 100, sunrise: '07:02', sunset: '16:42',
    days: [['overcast', 10, 5, 20], ['rain', 9, 5, 70], ['drizzle', 8, 4, 50], ['overcast', 9, 3, 20], ['partly', 10, 3, 10], ['clear', 11, 2, 0], ['partly', 10, 4, 10]] },
  { key: 'dublin', cc: 'IE', lat: 53.35, lon: -6.26, ar: ['دبلن', 'أيرلندا'], en: ['Dublin', 'Ireland'], clock: '10:15', cond: 'drizzle', temp: 12, feels: 10, wind: 22, gust: 35, dir: 240, hum: 92, cloud: 95, sunrise: '07:22', sunset: '17:00',
    days: [['drizzle', 13, 9, 70], ['rain', 12, 8, 80], ['partly', 13, 7, 20], ['overcast', 12, 8, 30], ['drizzle', 12, 9, 60], ['partly', 13, 8, 10], ['rain', 11, 7, 70]] },
];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[̀-ͯ]/g, '').trim();

export function fixturePlace(f: Fixture, lang: Lang): Place {
  const [name, country] = f[lang];
  return { id: `mock:${f.key}`, name, country, countryCode: f.cc, lat: f.lat, lon: f.lon };
}

const findFixture = (p: Place) =>
  FIXTURES.find((f) => p.id === `mock:${f.key}`) ??
  FIXTURES.reduce((best, f) => (Math.hypot(f.lat - p.lat, f.lon - p.lon) < Math.hypot(best.lat - p.lat, best.lon - p.lon) ? f : best));

const pad = (n: number) => String(n).padStart(2, '0');
const isoLocal = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

export function buildMockWeather(f: Fixture, place: Place, now = Date.now()): WeatherData {
  // Pick the UTC offset that makes the city's clock read the fixture time right now.
  const nowUtcMin = Math.floor(now / 60000) % 1440;
  let offMin = minutesOf(f.clock) - nowUtcMin;
  if (offMin > 720) offMin -= 1440;
  if (offMin < -720) offMin += 1440;
  const local = new Date(now + offMin * 60000);
  const today = isoLocal(local).slice(0, 10);
  const dayDate = (i: number) => isoLocal(new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + i))).slice(0, 10);
  const h0 = local.getUTCHours();
  const srMin = minutesOf(f.sunrise), ssMin = minutesOf(f.sunset);
  const base = (h: number, d: Day) => d[2] + (d[1] - d[2]) * (0.5 + 0.5 * Math.cos(((h - 14) / 24) * 2 * Math.PI));
  const off = f.temp - base(h0, f.days[0]);

  return {
    location: { ...place, utcOffsetSeconds: offMin * 60 },
    current: {
      time: isoLocal(local), temperature: f.temp, feelsLike: f.feels, humidity: f.hum,
      windSpeed: f.wind, windGusts: f.gust, windDirection: f.dir, cloudCover: f.cloud,
      precipitation: ['rain', 'storm', 'drizzle'].includes(f.cond) ? 1.2 : 0,
      weatherCode: CONDITION_CODE[f.cond], condition: f.cond,
      isDay: h0 * 60 + local.getUTCMinutes() >= srMin && h0 * 60 + local.getUTCMinutes() < ssMin,
    },
    hourly: Array.from({ length: 24 }, (_, i) => {
      const abs = h0 + i, hr = abs % 24, di = abs >= 24 ? 1 : 0, d = f.days[di];
      const cond = i < 9 ? f.cond : d[0];
      const rainy = ['rain', 'drizzle', 'storm', 'snow'].includes(cond);
      const p = Math.round(Math.min(100, d[3] * (rainy ? 1 : 0.3) * (0.7 + ((i * 37) % 17) / 28)) / 5) * 5;
      return {
        time: `${dayDate(di)}T${pad(hr)}:00`,
        temperature: i === 0 ? f.temp : base(hr, d) + off * Math.max(0, 1 - i / 6),
        weatherCode: CONDITION_CODE[cond], condition: cond,
        precipitationProbability: rainy || p >= 30 ? p : 0,
        isDay: hr * 60 + 30 >= srMin && hr * 60 + 30 < ssMin,
      };
    }),
    daily: f.days.map(([cond, hi, lo, p], i) => ({
      date: i === 0 ? today : dayDate(i), tempMax: hi, tempMin: lo,
      weatherCode: CONDITION_CODE[cond], condition: cond, precipitationProbability: p,
      sunrise: `${dayDate(i)}T${f.sunrise}`, sunset: `${dayDate(i)}T${f.sunset}`,
    })),
    meta: { provider: 'mock', fetchedAt: new Date(now).toISOString(), units: 'metric' },
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockProvider: WeatherProvider = {
  name: 'mock',
  async geocode(query, lang) {
    await delay(120);
    const q = norm(query);
    return FIXTURES.filter((f) => [...f.ar, ...f.en].some((s) => norm(s).includes(q))).map((f) => fixturePlace(f, lang));
  },
  async reverse(_lat, _lon, lang) {
    await delay(300);
    return { ...fixturePlace(FIXTURES[0], lang), id: 'geo:mock' };
  },
  async weather(place) {
    await delay(450);
    return buildMockWeather(findFixture(place), place);
  },
};
