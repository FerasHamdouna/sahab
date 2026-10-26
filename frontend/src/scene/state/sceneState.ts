import type { Condition } from '../../data/types';

export type RGB = [number, number, number];

/** The numbers the 3D world is driven by (docs/SCENES.md §3). Colors are sRGB 0..255. */
export interface SceneTarget {
  top: RGB;
  hor: RGB;
  day: number;
  golden: number;
  sun: number;
  moon: number;
  stars: number;
  cov: number;
  dark: number;
  rain: number;
  snow: number;
  fog: number;
  light: number;
  heat: number;
  cold: number;
  /** 0..1 wind strength. */
  wind: number;
  /** Degrees the wind blows toward (from + 180). */
  windTo: number;
  elev: number;
}

export const SCALAR_KEYS = ['day', 'golden', 'sun', 'moon', 'stars', 'cov', 'dark', 'rain', 'snow', 'fog', 'light', 'heat', 'cold', 'wind', 'elev'] as const;

interface Preset { d: [string, string]; n: [string, string]; cov: number; dark: number; rain?: number; snow?: number; fog?: number; light?: number }

/** Sky palettes approved in the UI/UX prototype. */
export const PRESETS: Record<Condition, Preset> = {
  clear:    { d: ['#2F7FD6', '#A8D6F2'], n: ['#040A1A', '#1A2A4C'], cov: 0.04, dark: 0 },
  partly:   { d: ['#3A82C8', '#B4D5EC'], n: ['#060C1C', '#1E2B45'], cov: 0.42, dark: 0.06 },
  overcast: { d: ['#6B7A8B', '#AEB8C3'], n: ['#0D121B', '#2A313D'], cov: 0.96, dark: 0.38 },
  fog:      { d: ['#97A3AE', '#CBD2D8'], n: ['#171C23', '#39414A'], cov: 0.5, dark: 0.15, fog: 0.9 },
  drizzle:  { d: ['#5B6C80', '#9AA7B5'], n: ['#0A0F17', '#232B37'], cov: 0.88, dark: 0.4, rain: 0.28 },
  rain:     { d: ['#3C4A5C', '#788695'], n: ['#070B13', '#1C2430'], cov: 0.97, dark: 0.62, rain: 0.78 },
  snow:     { d: ['#8CA3BE', '#DCE5EF'], n: ['#0F1727', '#38475E'], cov: 0.86, dark: 0.18, snow: 0.85 },
  storm:    { d: ['#1D2431', '#465264'], n: ['#04060B', '#141A24'], cov: 1, dark: 0.88, rain: 1, light: 1 },
};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const hexToRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export interface SceneInput {
  condition: Condition;
  /** Sun elevation proxy, see data/time.ts sunElevation. */
  elevation: number;
  temperature: number;
  /** km/h */
  windSpeed: number;
  /** Degrees the wind blows FROM. */
  windDirection: number;
  /** 0..100, optional fine-tune of the preset coverage. */
  cloudCover?: number;
}

export function weatherToSceneTarget(i: SceneInput): SceneTarget {
  const p = PRESETS[i.condition];
  // Real cloud cover nudges the preset by up to ±0.15 without leaving the condition's look.
  const cov = i.cloudCover == null ? p.cov : clamp(p.cov + clamp((i.cloudCover / 100 - p.cov) * 0.5, -0.15, 0.15));
  const day = smooth(-0.14, 0.22, i.elevation);
  const golden = clamp(1 - Math.abs(i.elevation - 0.03) / 0.2) * (1 - cov * 0.75);
  let top = mixRgb(hexToRgb(p.n[0]), hexToRgb(p.d[0]), day);
  let hor = mixRgb(hexToRgb(p.n[1]), hexToRgb(p.d[1]), day);
  top = mixRgb(top, [70, 66, 128], golden * 0.45);
  hor = mixRgb(hor, [255, 146, 98], golden * 0.8);
  const heat = clamp((i.temperature - 33) / 8);
  const cold = clamp(-i.temperature / 12);
  hor = mixRgb(hor, [240, 212, 166], heat * 0.55 * day);
  return {
    top, hor, day, golden,
    sun: day * (1 - cov * 0.88),
    moon: (1 - day) * (1 - cov * 0.85),
    stars: (1 - day) * (1 - cov * 0.95),
    cov, dark: p.dark,
    rain: p.rain ?? 0, snow: p.snow ?? 0, fog: p.fog ?? 0, light: p.light ?? 0,
    heat, cold,
    wind: clamp(i.windSpeed / 70),
    windTo: (i.windDirection + 180) % 360,
    elev: i.elevation,
  };
}

/** Perceived brightness of the sky behind the UI, 0..1. Drives glass opacity + text scrim. */
export function skyLuminance(t: Pick<SceneTarget, 'top' | 'hor'>): number {
  const c = mixRgb(t.top, t.hor, 0.55);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

export const ELEVATION_OVERRIDE = { day: 0.72, golden: 0.03, night: -0.55 } as const;
