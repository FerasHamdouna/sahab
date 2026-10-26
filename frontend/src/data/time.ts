/** Minutes since local midnight for an "HH:MM" or ISO "YYYY-MM-DDTHH:MM" string. */
export function minutesOf(s: string): number {
  const hm = s.includes('T') ? s.split('T')[1] : s;
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** "HH:MM" of an ISO local string. */
export const hhmm = (s: string) => (s.includes('T') ? s.split('T')[1] : s).slice(0, 5);

/** City-local wall clock right now, as a Date whose UTC fields hold the local time. */
export function cityNow(utcOffsetSeconds: number, now = Date.now()): Date {
  return new Date(now + utcOffsetSeconds * 1000);
}

export function cityClock(utcOffsetSeconds: number, now = Date.now()): string {
  const d = cityNow(utcOffsetSeconds, now);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Sun elevation proxy in [-0.56, 0.9]: sine arc between sunrise and sunset,
 * a shallow negative arc at night. Matches the prototype so scenes look the same.
 */
export function sunElevation(nowMin: number, sunriseMin: number, sunsetMin: number): number {
  if (nowMin >= sunriseMin && nowMin < sunsetMin) {
    return Math.sin((Math.PI * (nowMin - sunriseMin)) / (sunsetMin - sunriseMin)) * 0.9;
  }
  const nightLen = 1440 - (sunsetMin - sunriseMin);
  const into = (nowMin - sunsetMin + 1440) % 1440;
  return -0.06 - 0.5 * Math.sin((Math.PI * into) / nightLen);
}
