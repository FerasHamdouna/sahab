import { describe, expect, it } from 'vitest';
import { weatherToSceneTarget, skyLuminance, type SceneInput } from './sceneState';
import { wmoToCondition } from '../../data/wmo';
import { sunElevation } from '../../data/time';

const base: SceneInput = { condition: 'clear', elevation: 0.7, temperature: 20, windSpeed: 10, windDirection: 270 };

describe('wmoToCondition', () => {
  it.each([
    [0, 'clear'], [1, 'clear'], [2, 'partly'], [3, 'overcast'], [45, 'fog'], [48, 'fog'],
    [51, 'drizzle'], [57, 'drizzle'], [61, 'rain'], [65, 'rain'], [81, 'rain'],
    [71, 'snow'], [77, 'snow'], [86, 'snow'], [95, 'storm'], [99, 'storm'],
  ])('%i → %s', (code, cond) => expect(wmoToCondition(code)).toBe(cond));
});

describe('weatherToSceneTarget', () => {
  it('clear noon: full sun, no stars, no precipitation', () => {
    const t = weatherToSceneTarget(base);
    expect(t.day).toBeCloseTo(1);
    expect(t.sun).toBeGreaterThan(0.9);
    expect(t.stars).toBeCloseTo(0);
    expect(t.rain + t.snow + t.light).toBe(0);
  });

  it('clear night: moon and stars, no sun', () => {
    const t = weatherToSceneTarget({ ...base, elevation: -0.5 });
    expect(t.day).toBe(0);
    expect(t.sun).toBe(0);
    expect(t.moon).toBeGreaterThan(0.9);
    expect(t.stars).toBeGreaterThan(0.9);
  });

  it('storm: max rain + lightning, sun hidden', () => {
    const t = weatherToSceneTarget({ ...base, condition: 'storm' });
    expect(t.rain).toBe(1);
    expect(t.light).toBe(1);
    expect(t.sun).toBeLessThan(0.15);
  });

  it('snow and fog presets drive their layers', () => {
    expect(weatherToSceneTarget({ ...base, condition: 'snow' }).snow).toBeGreaterThan(0.5);
    expect(weatherToSceneTarget({ ...base, condition: 'fog' }).fog).toBeGreaterThan(0.5);
  });

  it('golden hour peaks near the horizon on clear skies', () => {
    const g = weatherToSceneTarget({ ...base, elevation: 0.03 }).golden;
    expect(g).toBeGreaterThan(0.9);
    expect(weatherToSceneTarget(base).golden).toBe(0);
  });

  it('heat haze above 33°C, cold grade below 0°C', () => {
    expect(weatherToSceneTarget({ ...base, temperature: 41 }).heat).toBe(1);
    expect(weatherToSceneTarget({ ...base, temperature: 20 }).heat).toBe(0);
    expect(weatherToSceneTarget({ ...base, temperature: -12 }).cold).toBe(1);
  });

  it('wind: strength clamps at 70 km/h and direction flips to "toward"', () => {
    const t = weatherToSceneTarget({ ...base, windSpeed: 140, windDirection: 290 });
    expect(t.wind).toBe(1);
    expect(t.windTo).toBe(110);
  });

  it('cloud cover nudges coverage by at most 0.15', () => {
    const lo = weatherToSceneTarget({ ...base, condition: 'partly', cloudCover: 0 }).cov;
    const hi = weatherToSceneTarget({ ...base, condition: 'partly', cloudCover: 100 }).cov;
    expect(lo).toBeGreaterThanOrEqual(0.42 - 0.15 - 1e-9);
    expect(hi).toBeLessThanOrEqual(0.42 + 0.15 + 1e-9);
    expect(hi).toBeGreaterThan(lo);
  });

  it('snowy day is brighter than stormy night', () => {
    const snow = skyLuminance(weatherToSceneTarget({ ...base, condition: 'snow' }));
    const storm = skyLuminance(weatherToSceneTarget({ ...base, condition: 'storm', elevation: -0.5 }));
    expect(snow).toBeGreaterThan(0.6);
    expect(storm).toBeLessThan(0.1);
  });
});

describe('sunElevation', () => {
  it('peaks at solar noon and is negative at night', () => {
    expect(sunElevation(720, 360, 1080)).toBeCloseTo(0.9);
    expect(sunElevation(0, 360, 1080)).toBeLessThan(-0.5);
    expect(sunElevation(1081, 360, 1080)).toBeLessThan(0);
  });
});
