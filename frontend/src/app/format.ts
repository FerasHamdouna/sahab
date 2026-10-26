import type { Units } from '../data/types';

export const toUnit = (c: number, u: Units) => (u === 'metric' ? c : (c * 9) / 5 + 32);
export const tempNum = (c: number, u: Units) => Math.round(toUnit(c, u));
export const windNum = (kmh: number, u: Units) => Math.round(u === 'metric' ? kmh : kmh * 0.621371);
/** Wrap in LRI/PDI so a minus sign never flips inside RTL text (SVG has no `dir` isolation). */
export const isolate = (s: string) => `⁦${s}⁩`;

/** Magnus formula, °C. */
export function dewPoint(tempC: number, rh: number) {
  const a = 17.62, b = 243.12;
  const al = Math.log(Math.max(rh, 1) / 100) + (a * tempC) / (b + tempC);
  return (b * al) / (a - al);
}

const STOPS: [number, [number, number, number]][] = [
  [-10, [110, 182, 255]], [5, [127, 212, 240]], [15, [155, 231, 196]], [25, [255, 211, 107]], [35, [255, 154, 91]], [45, [255, 107, 91]],
];
export function tempColor(c: number) {
  if (c <= STOPS[0][0]) return `rgb(${STOPS[0][1].join(',')})`;
  for (let i = 1; i < STOPS.length; i++) {
    if (c <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
      const t = (c - a) / (b - a);
      return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * t)).join(',')})`;
    }
  }
  return `rgb(${STOPS[STOPS.length - 1][1].join(',')})`;
}
