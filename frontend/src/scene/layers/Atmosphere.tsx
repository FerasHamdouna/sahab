import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { U, live } from '../uniforms';
import { NOISE } from '../shaders/common';
import { onStrike } from '../audio/ambient';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- fog banks: layered billboards near the ground ---------------- */

const fogVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fogFragment = /* glsl */ `
uniform float uTime; uniform float uFog; uniform float uRain; uniform float uDay; uniform float uFlash;
uniform vec3 uFogColor; uniform vec2 uCloudOffset; uniform float uSeed;
varying vec2 vUv;
varying vec3 vWorld;
${NOISE}
void main(){
  float amount = clamp(uFog + uRain * 0.22, 0.0, 1.0);
  float vert = smoothstep(1.0, 0.0, vUv.y) * smoothstep(0.0, 0.12, vUv.y);
  float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
  float env = vert * edge * amount * 0.75;
  if (env < 0.002) discard; // invisible part of the bank: skip the noise
  vec2 p = vec2(vWorld.x * 0.012, vUv.y * 2.2) + vec2(uCloudOffset.x * 8.0 + uTime * 0.01, 0.0) + uSeed * 11.0;
  float n = fbm(p, 4);
  float a = smoothstep(0.25, 0.85, n) * env;
  vec3 c = uFogColor * (0.5 + 0.5 * uDay) + uFlash * 0.3;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;

const BANKS = [
  { z: -40, w: 260, h: 22, seed: 0.1 },
  { z: -110, w: 520, h: 40, seed: 0.5 },
  { z: -240, w: 1000, h: 70, seed: 0.9 },
  { z: -420, w: 1700, h: 95, seed: 1.4 },
];

export function FogBanks() {
  const group = useRef<Group>(null);
  const materials = useMemo(
    () => BANKS.map((b) => new ShaderMaterial({
      vertexShader: fogVertex, fragmentShader: fogFragment,
      uniforms: { ...U, uSeed: { value: b.seed } }, transparent: true, depthWrite: false,
    })),
    [],
  );
  useFrame(() => {
    if (group.current) group.current.visible = U.uFog.value + U.uRain.value * 0.22 > 0.01;
  });
  return (
    <group ref={group}>
      {BANKS.map((b, i) => (
        <mesh key={b.z} material={materials[i]} position={[0, b.h * 0.42, b.z]} renderOrder={4} frustumCulled={false}>
          <planeGeometry args={[b.w, b.h]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- lightning: bolt ribbon + global flash ---------------- */

function boltGeometry(): BufferGeometry {
  const pts: [number, number][] = [];
  let x = (Math.random() - 0.5) * 520;
  let y = 95;
  pts.push([x, y]);
  while (y > 2) {
    y = Math.max(2, y - (4 + Math.random() * 7));
    x += (Math.random() - 0.5) * 16;
    pts.push([x, y]);
  }
  // one branch off the middle
  const k = 2 + Math.floor(Math.random() * Math.max(1, pts.length - 4));
  const branch: [number, number][] = [pts[k]];
  let [bx, by] = pts[k];
  const dir = Math.random() < 0.5 ? -1 : 1;
  for (let j = 0; j < 5; j++) { by -= 4 + Math.random() * 5; bx += dir * (3 + Math.random() * 6); branch.push([bx, by]); }

  const verts: number[] = [];
  const ribbon = (line: [number, number][], w: number) => {
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, y1] = line[i], [x2, y2] = line[i + 1];
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
      const nx = (-dy / l) * w, ny = (dx / l) * w;
      verts.push(x1 - nx, y1 - ny, 0, x1 + nx, y1 + ny, 0, x2 + nx, y2 + ny, 0);
      verts.push(x1 - nx, y1 - ny, 0, x2 + nx, y2 + ny, 0, x2 - nx, y2 - ny, 0);
    }
  };
  ribbon(pts, 2.2);
  ribbon(branch, 1.2);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  return g;
}

export function Lightning() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: new Color(3, 3.2, 4), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  const state = useRef({ next: 2, life: 0, flash: 0 });

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime, s = state.current;
    if (live.light > 0.4 && t > s.next) {
      s.next = t + 2.5 + Math.random() * 5;
      s.life = 0.24;
      s.flash = reduceMotion ? 0.35 : 1;
      if (mesh.current) {
        mesh.current.geometry.dispose();
        mesh.current.geometry = boltGeometry();
      }
      onStrike(0.3 + Math.random() * 1.4);
    }
    s.flash *= Math.exp(-dt * 7);
    if (s.flash < 0.3 && s.flash > 0.24 && Math.random() < 0.4) s.flash = 0.75; // re-strike flicker
    s.life = Math.max(0, s.life - dt);
    U.uFlash.value = s.flash * live.light;
    material.opacity = Math.min(1, s.life / 0.24) * live.light;
    if (mesh.current) mesh.current.visible = s.life > 0;
  });

  return (
    <mesh ref={mesh} material={material} position={[0, 0, -620]} frustumCulled={false} renderOrder={-3}>
      <bufferGeometry />
    </mesh>
  );
}
