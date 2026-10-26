import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, ShaderMaterial } from 'three';
import { U } from '../uniforms';
import { GRADE, NOISE, SKY_FN } from '../shaders/common';

/* ---------------- mountain ridges ---------------- */

const ridgeVertex = /* glsl */ `
attribute float aH;
varying float vH;
varying vec3 vWorld;
void main(){
  vH = aH;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const ridgeFragment = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uFogColor; uniform float uFog; uniform float uSnow; uniform float uDay;
uniform float uFlash; uniform float uDepth; uniform float uGolden; uniform float uSun;
varying float vH;
varying vec3 vWorld;
${GRADE}
void main(){
  // nearer ridges are darker; far ones dissolve into the horizon haze
  vec3 base = mix(mix(uHor, uTop, 0.3), vec3(0.03, 0.045, 0.07), 0.62 - uDepth * 0.38);
  base = mix(base, uHor, uDepth * 0.55);
  base += vec3(0.6, 0.3, 0.15) * uGolden * uSun * 0.12 * (1.0 - uDepth);
  // snow caps on the upper slopes
  float cap = smoothstep(0.45, 0.8, vH) * uSnow;
  base = mix(base, vec3(0.86, 0.9, 0.95) * (0.3 + 0.7 * uDay), cap * 0.85);
  // horizon glow at the foot
  base = mix(base, uHor, (1.0 - smoothstep(0.0, 0.25, vH)) * 0.35);
  base = mix(base, uFogColor, uFog * (0.55 + uDepth * 0.4));
  base += vec3(0.7, 0.75, 0.9) * uFlash * 0.25;
  gl_FragColor = vec4(grade(base), 1.0);
  #include <colorspace_fragment>
}`;

function ridgeGeometry(width: number, height: number, seed: number) {
  const n = 220;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const h = new Float32Array((n + 1) * 2);
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (t - 0.5) * width;
    let y = 0;
    y += 0.5 * Math.sin(t * 9.1 + seed) + 0.28 * Math.sin(t * 23.7 + seed * 2.1) + 0.13 * Math.sin(t * 57.3 + seed * 0.7) + 0.06 * Math.sin(t * 131 + seed * 3.3);
    y = (y * 0.5 + 0.55) * height;
    const k = i * 2;
    pos.set([x, -2, 0], k * 3);
    pos.set([x, Math.max(1, y), 0], (k + 1) * 3);
    h[k] = 0;
    h[k + 1] = Math.max(0, y / height);
    if (i < n) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aH', new BufferAttribute(h, 1));
  g.setIndex(idx);
  return g;
}

function Ridge({ z, width, height, seed, depth }: { z: number; width: number; height: number; seed: number; depth: number }) {
  const geometry = useMemo(() => ridgeGeometry(width, height, seed), [width, height, seed]);
  const material = useMemo(
    () => new ShaderMaterial({ vertexShader: ridgeVertex, fragmentShader: ridgeFragment, uniforms: { ...U, uDepth: { value: depth } } }),
    [depth],
  );
  return <mesh geometry={geometry} material={material} position={[0, 0, z]} frustumCulled={false} />;
}

/* ---------------- reflective ground ---------------- */

const groundVertex = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const groundFragment = /* glsl */ `
uniform float uTime; uniform float uRain; uniform float uSnow; uniform float uFog; uniform vec3 uFogColor; uniform float uMoon; uniform vec3 uMoonDir;
varying vec3 vWorld;
${NOISE}
${SKY_FN}
${GRADE}
void main(){
  vec3 v = normalize(vWorld - cameraPosition);
  float dist = length(vWorld.xz - cameraPosition.xz);
  float wet = max(uRain, uFog * 0.3);

  // gentle swell + wind ripples perturb the reflection normal
  vec2 p = vWorld.xz * 0.35;
  float e = 0.15;
  float n0 = vnoise(p + uTime * 0.15);
  vec2 grad = vec2(vnoise(p + vec2(e, 0.0) + uTime * 0.15) - n0, vnoise(p + vec2(0.0, e) + uTime * 0.15) - n0) / e;
  vec3 nrm = normalize(vec3(-grad.x * (0.05 + wet * 0.06), 1.0, -grad.y * (0.05 + wet * 0.06)));

  // rain rings close to the camera
  float rings = 0.0;
  if (uRain > 0.01 && dist < 70.0) {
    vec2 gp = vWorld.xz * 0.9;
    vec2 cell = floor(gp);
    for (int i = 0; i < 2; i++) {
      vec2 c2 = cell + vec2(float(i), 0.0);
      float hs = hash12(c2);
      float t = fract(uTime * (0.8 + hs * 0.6) + hs * 9.0);
      vec2 center = c2 + vec2(hash12(c2 + 3.1), hash12(c2 + 5.7));
      float r = length(gp - center);
      rings += smoothstep(0.05, 0.0, abs(r - t * 0.55)) * (1.0 - t) * step(hs, uRain);
    }
    rings *= 1.0 - smoothstep(25.0, 70.0, dist);
  }

  vec3 r = reflect(v, nrm);
  r.y = abs(r.y);
  vec3 refl = skyColor(r);
  refl += vec3(1.0, 0.85, 0.6) * pow(max(dot(r, uSunDir), 0.0), 220.0) * uSun * 2.5;
  refl += vec3(0.8, 0.85, 1.0) * pow(max(dot(r, uMoonDir), 0.0), 400.0) * uMoon * 1.2;

  float fres = 0.22 + 0.78 * pow(1.0 - max(dot(-v, nrm), 0.0), 3.0);
  vec3 ground = mix(uHor, vec3(0.015, 0.025, 0.04), 0.6);
  vec3 col = mix(ground, refl, clamp(fres * (0.55 + wet * 0.4), 0.0, 1.0));
  col += vec3(0.75, 0.8, 0.9) * rings * 0.22 * (0.4 + uDay * 0.6);
  col = mix(col, vec3(0.86, 0.9, 0.95) * (0.32 + 0.68 * uDay), uSnow * 0.62);
  col += vec3(0.7, 0.75, 1.0) * uFlash * 0.12;

  // melt into the horizon
  col = mix(col, uHor, smoothstep(250.0, 1100.0, dist) * 0.85);
  col = mix(col, uFogColor, uFog * (0.3 + 0.6 * smoothstep(10.0, 160.0, dist)));
  gl_FragColor = vec4(grade(col), 1.0);
  #include <colorspace_fragment>
}`;

function Ground() {
  const material = useMemo(() => new ShaderMaterial({ vertexShader: groundVertex, fragmentShader: groundFragment, uniforms: { ...U } }), []);
  return (
    <mesh material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1000]} frustumCulled={false}>
      <planeGeometry args={[6000, 2200]} />
    </mesh>
  );
}

export function Landscape() {
  return (
    <group>
      <Ridge z={-900} width={4200} height={70} seed={1.3} depth={1} />
      <Ridge z={-560} width={2800} height={42} seed={4.1} depth={0.6} />
      <Ridge z={-330} width={1800} height={20} seed={2.7} depth={0.2} />
      <Ground />
    </group>
  );
}
