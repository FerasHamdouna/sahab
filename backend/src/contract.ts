// Response shapes from docs/API_CONTRACT.md. Mirrors frontend/src/data/types.ts — keep both in sync.

export type Condition = 'clear' | 'partly' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
export type Lang = 'ar' | 'en';

export interface Place {
  id: string;
  name: string;
  region?: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timezone?: string;
}

export interface CurrentWeather {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  cloudCover: number;
  precipitation: number;
  weatherCode: number;
  condition: Condition;
  isDay: boolean;
}

export interface HourlyPoint {
  time: string;
  temperature: number;
  weatherCode: number;
  condition: Condition;
  precipitationProbability: number;
  isDay: boolean;
}

export interface DailyPoint {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  condition: Condition;
  precipitationProbability: number;
  sunrise: string;
  sunset: string;
}

/** The backend knows coordinates, not the place the user picked; the client merges its Place in. */
export interface WeatherResponse {
  location: { lat: number; lon: number; timezone: string; utcOffsetSeconds: number };
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  meta: { provider: string; fetchedAt: string; units: 'metric'; cached: boolean };
}

export type ErrorCode = 'BAD_REQUEST' | 'LOCATION_NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM_ERROR' | 'INTERNAL';

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string, public status = codeStatus(code)) {
    super(message);
  }
}

function codeStatus(code: ErrorCode): number {
  return { BAD_REQUEST: 400, LOCATION_NOT_FOUND: 404, RATE_LIMITED: 429, UPSTREAM_ERROR: 502, INTERNAL: 500 }[code];
}
