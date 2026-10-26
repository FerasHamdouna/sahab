import { Color, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { SCALAR_KEYS, type SceneTarget } from './state/sceneState';

/**
 * Uniform objects shared by every scene material. Materials spread these into their own
 * `uniforms`, so one write here updates all of them; no React render is involved.
 */
export const U = {
  uTime: { value: 0 },
  uTop: { value: new Color() },
  uHor: { value: new Color() },
  uFogColor: { value: new Color() },
  uSunDir: { value: new Vector3(0.4, 0.5, -1).normalize() },
  uMoonDir: { value: new Vector3(0.4, 0.45, -1).normalize() },
  uSun: { value: 0 },
  uMoon: { value: 0 },
  uStars: { value: 0 },
  uDay: { value: 1 },
  uGolden: { value: 0 },
  uCov: { value: 0.4 },
  uDark: { value: 0 },
  uRain: { value: 0 },
  uSnow: { value: 0 },
  uFog: { value: 0 },
  uFlash: { value: 0 },
  uHeat: { value: 0 },
  uCold: { value: 0 },
  /** Wind drift in world XZ, scaled by strength. */
  uWind: { value: new Vector2(0.2, 0) },
  /** Clouds' scroll offset, integrated from uWind so speed changes never jump. */
  uCloudOffset: { value: new Vector2() },
};

/** Current (damped) scene values; layers read this inside useFrame. */
export const live: SceneTarget = {
  top: [0, 0, 0], hor: [0, 0, 0], day: 1, golden: 0, sun: 0, moon: 0, stars: 0, cov: 0, dark: 0,
  rain: 0, snow: 0, fog: 0, light: 0, heat: 0, cold: 0, wind: 0, windTo: 90, elev: 0.5,
};

const WHITE = new Color(1, 1, 1);
const tmpTop = new Color();
const tmpHor = new Color();
let initialized = false;

/** Next step jumps straight to the target (used when the canvas is first revealed). */
export function snapScene() { initialized = false; }

/** Moves `live` toward `target` (exponential damping) and pushes it into the uniforms. */
export function stepScene(target: SceneTarget, dt: number, rtl: boolean) {
  const k = initialized ? 1 - Math.exp(-2.2 * dt) : 1;
  initialized = true;
  for (const key of SCALAR_KEYS) live[key] += (target[key] - live[key]) * k;
  // Shortest-arc damping for wind direction.
  const dWind = ((target.windTo - live.windTo + 540) % 360) - 180;
  live.windTo = (live.windTo + dWind * k + 360) % 360;

  tmpTop.setRGB(target.top[0] / 255, target.top[1] / 255, target.top[2] / 255, SRGBColorSpace);
  tmpHor.setRGB(target.hor[0] / 255, target.hor[1] / 255, target.hor[2] / 255, SRGBColorSpace);
  U.uTop.value.lerp(tmpTop, k);
  U.uHor.value.lerp(tmpHor, k);
  U.uFogColor.value.copy(U.uHor.value).lerp(WHITE, 0.18);

  U.uSun.value = live.sun; U.uMoon.value = live.moon; U.uStars.value = live.stars;
  U.uDay.value = live.day; U.uGolden.value = live.golden;
  U.uCov.value = live.cov; U.uDark.value = live.dark;
  U.uRain.value = live.rain; U.uSnow.value = live.snow; U.uFog.value = live.fog;
  U.uHeat.value = live.heat; U.uCold.value = live.cold;

  // Sun sits on the inline-end side so it never collides with the big temperature.
  const side = rtl ? -1 : 1;
  const sunAngle = Math.max(-0.25, live.elev) * 0.62; // radians above horizon
  U.uSunDir.value.set(side * 0.42, Math.sin(sunAngle), -1).normalize();
  U.uMoonDir.value.set(side * 0.38, 0.42, -1).normalize();

  const a = (live.windTo * Math.PI) / 180;
  const speed = 0.004 + live.wind * 0.03;
  U.uWind.value.set(Math.sin(a) * speed, -Math.cos(a) * speed);
  U.uCloudOffset.value.addScaledVector(U.uWind.value, dt);
}
