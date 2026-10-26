// GLSL chunks shared by the scene materials.

export const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1,0)), u.x), mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p, int oct){
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * vnoise(p); p = r * p * 2.03; a *= 0.5;
  }
  return s;
}
`;

/** Sky radiance for a view direction: same function the sky dome and the reflective ground use. */
export const SKY_FN = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir;
uniform float uSun; uniform float uGolden; uniform float uFlash; uniform float uCov; uniform float uDark; uniform float uDay;
vec3 skyColor(vec3 d){
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uHor, mix(uHor, uTop, 0.55), smoothstep(0.0, 0.18, h));
  c = mix(c, uTop, smoothstep(0.12, 0.65, h));
  float sd = max(dot(d, uSunDir), 0.0);
  vec3 warm = mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.45, 0.2), uGolden);
  c += warm * (pow(sd, 8.0) * 0.22 + pow(sd, 90.0) * 0.45) * uSun;
  return c;
}
`;

/** Shared final grade: heat/cold tint + lightning flash. */
export const GRADE = /* glsl */ `
uniform float uHeat; uniform float uCold;
vec3 grade(vec3 c){
  c = mix(c, c * vec3(1.12, 0.98, 0.84) + vec3(0.03, 0.01, 0.0), uHeat * 0.6);
  c = mix(c, c * vec3(0.9, 0.97, 1.12), uCold * 0.5);
  return c;
}
`;
