import { useMemo } from 'react';
import { BackSide, ShaderMaterial } from 'three';
import { U } from '../uniforms';
import { GRADE, NOISE, SKY_FN } from '../shaders/common';

const vertex = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;

const fragment = /* glsl */ `
uniform float uTime; uniform float uStars; uniform float uMoon; uniform vec3 uMoonDir;
uniform float uFog; uniform vec3 uFogColor;
varying vec3 vDir;
${NOISE}
${SKY_FN}
${GRADE}
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 c = skyColor(d);

  // stars: hashed points on a lat/long grid, twinkling, fading toward the horizon
  if (uStars > 0.01) {
    vec2 g = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 140.0;
    vec2 cell = floor(g);
    float hs = hash12(cell);
    if (hs > 0.972) {
      vec2 off = vec2(hash12(cell + 7.1), hash12(cell + 3.7)) * 0.7 + 0.15;
      float dist = length(fract(g) - off);
      float tw = 0.55 + 0.45 * sin(uTime * (1.0 + hs * 3.0) + hs * 80.0);
      float size = 0.06 + (hs - 0.972) * 4.0;
      c += vec3(0.92, 0.95, 1.0) * smoothstep(size, 0.0, dist) * tw * uStars * smoothstep(0.02, 0.25, h) * 1.4;
    }
  }

  // sun disc (values > 1 feed the bloom pass)
  float sd = dot(d, uSunDir);
  vec3 sunCol = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.62, 0.36), uGolden);
  c += sunCol * smoothstep(0.99935, 0.99965, sd) * uSun * 3.0;

  // moon with a crescent shadow and a soft halo
  float md = dot(d, uMoonDir);
  vec3 shadowDir = normalize(uMoonDir + vec3(0.011, 0.006, 0.0));
  float disc = smoothstep(0.99975, 0.99984, md);
  float shade = smoothstep(0.99975, 0.99984, dot(d, shadowDir));
  c += vec3(0.62, 0.7, 0.9) * pow(max(md, 0.0), 900.0) * 0.25 * uMoon;
  c = mix(c, vec3(0.93, 0.95, 1.0) * 1.6, disc * (1.0 - shade * 0.92) * uMoon);

  // lightning lights the whole sky
  c += vec3(0.75, 0.8, 1.0) * uFlash * 0.35;

  // fog thickens toward the horizon
  c = mix(c, uFogColor, uFog * (0.25 + 0.65 * (1.0 - smoothstep(0.0, 0.35, h))));

  gl_FragColor = vec4(grade(c), 1.0);
  #include <colorspace_fragment>
}`;

export function Sky() {
  const material = useMemo(
    () => new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { ...U }, side: BackSide, depthWrite: false }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1500, 48, 24]} />
    </mesh>
  );
}
