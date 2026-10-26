import { useMemo, useRef } from 'react';
import {
  BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, PlaneGeometry, Points, ShaderMaterial,
} from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { U } from '../uniforms';
import { useSceneStore, type Quality } from '../state/sceneStore';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOTION = reduceMotion ? 0.45 : 1;

// Particles move entirely on the GPU and cost little, so the fixed "low" tier keeps the densest
// rain and snow (user asked for more than the old high tier).
export const RAIN_MAX: Record<Quality, number> = { high: 16000, medium: 16000, low: 16000 };
export const SNOW_MAX: Record<Quality, number> = { high: 7000, medium: 7000, low: 7000 };

/* ---------------- rain: instanced streak quads, motion computed on the GPU ---------------- */

const rainVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec2 uWind; uniform float uMotion;
varying vec2 vUv;
varying float vFade;
const vec3 BOX = vec3(70.0, 32.0, 70.0);
void main(){
  vUv = uv;
  float speed = (24.0 + aSeed.w * 12.0) * uMotion;
  vec2 drift = uWind * 420.0 * uMotion;           // horizontal velocity from wind
  float fall = mod(aSeed.y * BOX.y + uTime * speed, BOX.y);
  float tt = fall / speed;
  vec3 p;
  p.y = BOX.y - fall;
  p.x = mod((aSeed.x - 0.5) * BOX.x + drift.x * tt + BOX.x * 0.5, BOX.x) - BOX.x * 0.5;
  p.z = -mod(aSeed.z * BOX.z - drift.y * tt, BOX.z) + 8.0;
  p += vec3(cameraPosition.x, 0.0, 0.0);

  vec3 dir = normalize(vec3(drift.x, -speed, drift.y));
  vec3 toCam = normalize(cameraPosition - p);
  vec3 side = normalize(cross(dir, toCam));
  float len = 0.45 + aSeed.w * 0.75;
  float dist = length(cameraPosition - p);
  float width = 0.012 * (1.0 + dist * 0.035);
  vec3 world = p + dir * position.y * len + side * position.x * width;
  vFade = smoothstep(0.0, 2.0, p.y) * (1.0 - smoothstep(35.0, 62.0, dist)) * smoothstep(0.6, 2.5, dist);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const rainFragment = /* glsl */ `
uniform float uDay; uniform float uFlash;
varying vec2 vUv;
varying float vFade;
void main(){
  float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float along = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  float a = across * along * vFade * (0.28 + 0.18 * uDay + uFlash * 0.4);
  vec3 c = mix(vec3(0.22, 0.25, 0.3), vec3(0.75, 0.8, 0.88), uDay) + uFlash * 0.5;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;

function Rain() {
  const quality = useSceneStore((s) => s.quality);
  const ref = useRef<Mesh>(null);
  const max = RAIN_MAX.high;
  const geometry = useMemo(() => {
    const quad = new PlaneGeometry(1, 1);
    const g = new InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    const seeds = new Float32Array(max * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    g.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
    g.instanceCount = max;
    return g;
  }, [max]);
  const material = useMemo(
    () => new ShaderMaterial({
      vertexShader: rainVertex, fragmentShader: rainFragment,
      uniforms: { ...U, uMotion: { value: MOTION } },
      transparent: true, depthWrite: false,
    }),
    [],
  );

  useFrame(() => {
    const n = Math.floor(U.uRain.value * RAIN_MAX[quality]);
    geometry.instanceCount = n;
    if (ref.current) ref.current.visible = n > 0;
  });

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

/* ---------------- snow: GPU points with sway ---------------- */

const snowVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec2 uWind; uniform float uMotion; uniform float uPx;
varying float vFade;
const vec3 BOX = vec3(70.0, 30.0, 60.0);
void main(){
  float speed = (1.1 + aSeed.w * 1.6) * uMotion;
  float fall = mod(aSeed.y * BOX.y + uTime * speed, BOX.y);
  vec3 p;
  p.y = BOX.y - fall;
  vec2 drift = uWind * 160.0 * uMotion * (fall / speed);
  float sway = sin(uTime * (0.6 + aSeed.w) + aSeed.x * 40.0) * (0.4 + aSeed.w * 0.6);
  p.x = mod((aSeed.x - 0.5) * BOX.x + drift.x + sway + BOX.x * 0.5, BOX.x) - BOX.x * 0.5 + cameraPosition.x;
  p.z = -mod(aSeed.z * BOX.z - drift.y, BOX.z) + 8.0;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vFade = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(30.0, 55.0, dist)) * smoothstep(0.8, 3.0, dist);
  gl_PointSize = (0.06 + aSeed.w * 0.1) * uPx / max(dist, 0.5);
  gl_Position = projectionMatrix * mv;
}`;

const snowFragment = /* glsl */ `
uniform float uDay; uniform float uFlash;
varying float vFade;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d) * vFade * 0.9;
  vec3 c = vec3(0.93, 0.95, 1.0) * (0.45 + 0.55 * uDay) + uFlash * 0.4;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;

function Snow() {
  const quality = useSceneStore((s) => s.quality);
  const size = useThree((s) => s.size);
  const ref = useRef<Points>(null);
  const max = SNOW_MAX.high;
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const seeds = new Float32Array(max * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    g.setAttribute('position', new BufferAttribute(new Float32Array(max * 3), 3));
    return g;
  }, [max]);
  const material = useMemo(
    () => new ShaderMaterial({
      vertexShader: snowVertex, fragmentShader: snowFragment,
      uniforms: { ...U, uMotion: { value: MOTION }, uPx: { value: 800 } },
      transparent: true, depthWrite: false,
    }),
    [],
  );

  useFrame(({ viewport }) => {
    const n = Math.floor(U.uSnow.value * SNOW_MAX[quality]);
    geometry.setDrawRange(0, n);
    material.uniforms.uPx.value = size.height * viewport.dpr * 0.9;
    if (ref.current) ref.current.visible = n > 0;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />;
}

export function Precipitation() {
  return (
    <>
      <Rain />
      <Snow />
    </>
  );
}
