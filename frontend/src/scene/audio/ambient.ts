import { live } from '../uniforms';

/**
 * Ambient weather sound, driven by the same live scene values as the visuals so sound and
 * picture always crossfade together. Synthesized with Web Audio for now (no asset downloads);
 * recorded loops can replace the noise sources later behind the same functions.
 *
 * Browsers only allow audio after a user gesture: `unlockAudio()` is called on the first
 * pointerdown/keydown, and sound is on by default (docs/PRD.md F9).
 */

let ctx: AudioContext | null = null;
let master: GainNode, rainGain: GainNode, windGain: GainNode, calmGain: GainNode;
let enabled = true;
let lastTick = 0;
let brownBuf: AudioBuffer;

function noise(brown: boolean): AudioBuffer {
  const c = ctx!;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const r = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * r) / 1.02; d[i] = last * 3.5; } else d[i] = r;
  }
  return buf;
}

function loop(buf: AudioBuffer) {
  const s = ctx!.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start();
  return s;
}

function build() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const white = noise(false);
  brownBuf = noise(true);

  // rain: band-passed white noise
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
  rainGain = ctx.createGain(); rainGain.gain.value = 0;
  loop(white).connect(hp).connect(lp).connect(rainGain).connect(master);

  // wind: resonant low-passed brown noise with a slow gust LFO
  const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420; wf.Q.value = 2;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
  lfo.connect(lfoGain).connect(wf.frequency); lfo.start();
  windGain = ctx.createGain(); windGain.gain.value = 0;
  loop(brownBuf).connect(wf).connect(windGain).connect(master);

  // calm air: a very soft high shimmer for clear days/nights so silence never feels broken
  const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 3200; cf.Q.value = 0.7;
  calmGain = ctx.createGain(); calmGain.gain.value = 0;
  loop(white).connect(cf).connect(calmGain).connect(master);
}

function applyMaster() {
  if (!ctx) return;
  const on = enabled && !document.hidden;
  master.gain.setTargetAtTime(on ? 0.42 : 0, ctx.currentTime, 0.4);
}

/**
 * Must be called synchronously inside a gesture handler the browser counts as user activation
 * (click, pointerup/touchend, keydown — not touch pointerdown). Resolves once audio is running.
 */
export async function unlockAudio(): Promise<boolean> {
  if (!enabled) return false;
  if (!ctx) build();
  if (!ctx) return false;
  if (ctx.state !== 'running') {
    try { await ctx.resume(); } catch { /* not a valid gesture: try again on the next one */ }
  }
  applyMaster();
  return ctx.state === 'running';
}

/**
 * Only flips the preference. It never creates or resumes the AudioContext: that must happen inside
 * a user gesture (`unlockAudio`), otherwise the browser leaves the context suspended for good.
 */
export function setSoundEnabled(on: boolean) {
  enabled = on;
  applyMaster();
}

/** True only once the browser actually lets audio play. */
export const isAudioUnlocked = () => ctx?.state === 'running';

/** For the ?debug panel. */
export const audioState = () => (ctx ? ctx.state : 'not started');

/** Called from the render loop; throttled to ~8 Hz. */
export function audioTick(now: number) {
  if (!ctx || now - lastTick < 120) return;
  lastTick = now;
  const t = ctx.currentTime;
  rainGain.gain.setTargetAtTime(live.rain * 0.5, t, 0.35);
  windGain.gain.setTargetAtTime(0.05 + live.wind * 0.55 + live.light * 0.15 + live.snow * 0.08, t, 0.5);
  calmGain.gain.setTargetAtTime((1 - live.cov) * 0.012, t, 0.8);
}

/** Thunder rumble after a lightning strike, delayed by the "distance". */
export function onStrike(delaySec: number) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + delaySec;
  const src = ctx.createBufferSource();
  src.buffer = brownBuf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(1.1, t0 + 0.09);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + 3);
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', applyMaster);
