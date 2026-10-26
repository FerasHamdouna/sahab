// Mirrors docs/API_CONTRACT.md. Every provider (mock, open-meteo, backend) returns these shapes.

export type Condition = 'clear' | 'partly' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
export type Lang = 'ar' | 'en';
export type Units = 'metric' | 'imperial';

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
  /** City-local ISO time, no zone suffix. */
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  /** Degrees the wind blows FROM, 0 = north, clockwise. */
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

export interface WeatherData {
  location: Place & { utcOffsetSeconds: number };
  current: CurrentWeather;
  /** Exactly 24 points, starting at the current hour. */
  hourly: HourlyPoint[];
  /** Exactly 7 points, starting today. */
  daily: DailyPoint[];
  meta: { provider: string; fetchedAt: string; units: 'metric' };
}

export interface WeatherProvider {
  readonly name: string;
  geocode(query: string, lang: Lang): Promise<Place[]>;
  weather(place: Place): Promise<WeatherData>;
  reverse(lat: number, lon: number, lang: Lang): Promise<Place>;
}

export class ProviderError extends Error {
  constructor(public code: 'LOCATION_NOT_FOUND' | 'UPSTREAM_ERROR' | 'BAD_REQUEST', message: string) {
    super(message);
  }
}
