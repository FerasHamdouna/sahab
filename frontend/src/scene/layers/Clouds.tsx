import { useMemo } from 'react';
import { DoubleSide, ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { U } from '../uniforms';
import { GRADE, NOISE } from '../shaders/common';
import { useSceneStore } from '../state/sceneStore';

const vertex = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragment = /* glsl */ `
uniform float uCov; uniform float uDark; uniform float uDay; uniform float uGolden; uniform float uSun; uniform float uMoon;
uniform float uFlash; uniform float uFog; uniform vec3 uFogColor; uniform vec3 uHor; uniform vec3 uSunDir;
uniform vec2 uCloudOffset; uniform float uScale; uniform float uSeed; uniform float uFadeFar; uniform int uOct; uniform float uLayerCov;
varying vec3 vWorld;
${NOISE}
${GRADE}
void main(){
  // Pixels past the far fade contribute nothing: skip all the noise work for them.
  float dist = length(vWorld.xz - cameraPosition.xz);
  float farFade = 1.0 - smoothstep(uFadeFar * 0.55, uFadeFar, dist);
  if (farFade <= 0.0) discard;

  vec2 uv = vWorld.xz * uScale + uCloudOffset * 10.0 * (1.0 + uSeed * 0.6) + uSeed * 17.0;
  float n = fbm(uv, uOct);
  float cov = clamp(uCov * uLayerCov, 0.0, 1.0);
  float th = 0.64 - cov * 0.58;
  float a = smoothstep(th, th + 0.22, n);
  a = max(a, smoothstep(0.82, 1.0, cov) * 0.92 * smoothstep(th - 0.2, th + 0.1, n + 0.25));
  // Clear sky between clouds: nothing to shade, so skip the second (lighting) noise pass.
  if (a * farFade < 0.002) discard;

  // fake self-shadowing: compare density a step toward the sun
  float n2 = fbm(uv + uSunDir.xz * 0.35, uOct);
  float lit = clamp(0.55 + (n - n2) * 2.4, 0.0, 1.0);
  float lightness = (1.0 - uDark * 0.85) * (0.18 + 0.82 * uDay);
  // colors here are linear: square the lightness so mid-tones match the sRGB prototype
  vec3 darkC = vec3(0.010, 0.013, 0.019);
  float L = clamp(lightness * mix(0.72, 1.06, lit), 0.0, 1.1);
  vec3 col = mix(darkC, vec3(1.0), L * L);
  col *= mix(1.0, 0.72, smoothstep(0.55, 0.95, n) * (0.4 + uDark * 0.6)); // dense bellies are darker
  col = mix(col, col * vec3(1.35, 0.82, 0.62) + vec3(0.18, 0.06, 0.02), uGolden * 0.75);
  col += vec3(0.25, 0.3, 0.42) * uMoon * 0.15 * lit;

  // silver lining around the sun
  vec3 view = normalize(vWorld - cameraPosition);
  float sd = max(dot(view, uSunDir), 0.0);
  col += vec3(1.0, 0.9, 0.7) * pow(sd, 24.0) * uSun * (1.0 - a * 0.6) * 0.35;
  col += vec3(0.8, 0.85, 1.0) * uFlash * 1.4 * (0.4 + lit);

  // aerial perspective + far fade into the horizon
  col = mix(col, uHor, smoothstep(uFadeFar * 0.25, uFadeFar, dist) * 0.7);
  col = mix(col, uFogColor, uFog * 0.6);
  a *= farFade;

  gl_FragColor = vec4(grade(col), a);
  #include <colorspace_fragment>
}`;

function useCloudMaterial(scale: number, seed: number, fadeFar: number, layerCov: number) {
  return useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { ...U, uScale: { value: scale }, uSeed: { value: seed }, uFadeFar: { value: fadeFar }, uOct: { value: 5 }, uLayerCov: { value: layerCov } },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    [scale, seed, fadeFar, layerCov],
  );
}

/** Two cloud decks seen from below; perspective gives real depth and parallax. */
export function Clouds() {
  const high = useCloudMaterial(0.0042, 0, 1600, 1.0);
  const low = useCloudMaterial(0.0085, 1, 900, 0.85);
  const quality = useSceneStore((s) => s.quality);
  const oct = quality === 'high' ? 5 : quality === 'medium' ? 4 : 3;

  useFrame(() => {
    high.uniforms.uOct.value = oct;
    low.uniforms.uOct.value = Math.max(3, oct - 1);
  });

  return (
    <group>
      <mesh material={high} position={[0, 90, -700]} rotation={[Math.PI / 2, 0, 0]} renderOrder={-5} frustumCulled={false}>
        <planeGeometry args={[3600, 1800]} />
      </mesh>
      <mesh material={low} position={[0, 46, -380]} rotation={[Math.PI / 2, 0, 0]} renderOrder={-4} frustumCulled={false}>
        <planeGeometry args={[2000, 900]} />
      </mesh>
    </group>
  );
}
