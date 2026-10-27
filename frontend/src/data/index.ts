import type { WeatherProvider } from './types';
import { backendProvider, wakeBackend } from './providers/backend';
import { mockProvider } from './providers/mock';
import { openMeteoProvider } from './providers/openMeteo';

/**
 * Data source:
 * - `?mock` in the URL (or VITE_DATA_SOURCE=mock): demo fixtures, no network.
 * - VITE_DATA_SOURCE=open-meteo: call Open-Meteo straight from the browser (no backend needed).
 * - default: our backend at /api/v1 (docs/API_CONTRACT.md).
 */
function pick(): WeatherProvider {
  const fromUrl = typeof location !== 'undefined' && new URLSearchParams(location.search).has('mock');
  const env = import.meta.env.VITE_DATA_SOURCE as string | undefined;
  if (fromUrl || env === 'mock') return mockProvider;
  if (env === 'open-meteo') return openMeteoProvider;
  return backendProvider;
}

export const provider = pick();
if (provider === backendProvider && typeof window !== 'undefined') wakeBackend();
export * from './types';
