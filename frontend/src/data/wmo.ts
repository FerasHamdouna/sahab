import type { Condition } from './types';

/** WMO weather interpretation codes → scene condition. Table lives in docs/SCENES.md §4. */
export function wmoToCondition(code: number): Condition {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'partly';
}

/** A representative WMO code per condition, used by mock fixtures. */
export const CONDITION_CODE: Record<Condition, number> = {
  clear: 0, partly: 2, overcast: 3, fog: 45, drizzle: 53, rain: 63, snow: 73, storm: 95,
};
