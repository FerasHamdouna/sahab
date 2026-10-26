import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Vector3 } from 'three';
import { Sky } from './layers/Sky';
import { Clouds } from './layers/Clouds';
import { Landscape } from './layers/Landscape';
import { Precipitation } from './layers/Precipitation';
import { FogBanks, Lightning } from './layers/Atmosphere';
import { U, snapScene, stepScene } from './uniforms';
import { useSceneStore, type Quality } from './state/sceneStore';
import { audioTick } from './audio/ambient';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEVICE_DPR = window.devicePixelRatio || 1;
// Tiers keep the same look (bloom stays on until "low"); they trade resolution and particle count.
const DPR: Record<Quality, number> = { high: Math.min(2, DEVICE_DPR), medium: Math.min(1.5, DEVICE_DPR), low: 1 };
const PITCH = (13 * Math.PI) / 180; // puts the horizon ~72% down the screen, like the prototype
const REVEAL_TIMEOUT = 4000;

/** Runs first every frame: damp scene values toward the target and push them to the GPU. */
function SceneDriver() {
  useFrame(({ clock }, dt) => {
    U.uTime.value = clock.elapsedTime;
    stepScene(useSceneStore.getState().target, Math.min(dt, 0.05), document.documentElement.dir === 'rtl');
    audioTick(performance.now());
  });
  return null;
}

/** Slow "breathing" drift + subtle mouse parallax. */
function CameraRig() {
  const look = useRef(new Vector3());
  const smoothed = useRef({ x: 0, y: 0 });
  useFrame(({ camera, clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-1.5 * dt);
    smoothed.current.x += (pointer.x - smoothed.current.x) * k;
    smoothed.current.y += (pointer.y - smoothed.current.y) * k;
    const sway = reduceMotion ? 0 : 1;
    camera.position.set(
      Math.sin(t * 0.07) * 0.8 * sway + smoothed.current.x * 0.9 * sway,
      2 + Math.sin(t * 0.11) * 0.15 * sway + smoothed.current.y * 0.25 * sway,
      12,
    );
    look.current.set(camera.position.x * 0.5, camera.position.y + Math.sin(PITCH) * 100, 12 - Math.cos(PITCH) * 100);
    camera.lookAt(look.current);
  });
  return null;
}

/**
 * Compiles every layer's shader before the first frame is drawn (the loop is paused until then),
 * so compilation never blocks a visible frame and the first rain/snow/storm never hitches.
 */
function Precompile({ onDone }: { onDone: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let alive = true;
    gl.compileAsync(scene, camera)
      .catch(() => gl.compile(scene, camera))
      .finally(() => { if (alive) onDone(); });
    return () => { alive = false; };
  }, [gl, scene, camera, onDone]);
  return null;
}

function Effects({ quality }: { quality: Quality }) {
  if (quality === 'low') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Vignette offset={0.32} darkness={0.55} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom luminanceThreshold={0.96} luminanceSmoothing={0.12} intensity={0.55} mipmapBlur />
      <Vignette offset={0.32} darkness={0.55} />
    </EffectComposer>
  );
}

export function WeatherCanvas() {
  const quality = useSceneStore((s) => s.quality);
  const hasRealTarget = useSceneStore((s) => s.hasRealTarget);
  const [compiled, setCompiled] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [shown, setShown] = useState(false);
  const onCompiled = useRef(() => setCompiled(true)).current;

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), REVEAL_TIMEOUT);
    return () => clearTimeout(id);
  }, []);

  // Reveal once shaders are ready AND the scene shows real weather (cached or fresh), so the
  // first visible frame is already the right sky. Two frames later, fade in over the CSS sky.
  const ready = compiled && (hasRealTarget || timedOut);
  useEffect(() => {
    if (!ready || shown) return;
    snapScene();
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [ready, shown]);

  return (
    <div className={`sky-canvas ${shown ? 'shown' : ''}`} aria-hidden="true">
      <Canvas
        flat
        frameloop={compiled ? 'always' : 'never'}
        dpr={DPR[quality]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
        camera={{ fov: 55, near: 0.1, far: 5000, position: [0, 2, 12] }}
      >
        <SceneDriver />
        <CameraRig />
        <Sky />
        <Clouds />
        <Lightning />
        <Landscape />
        <FogBanks />
        <Precipitation />
        <Precompile onDone={onCompiled} />
        <Effects quality={quality} />
      </Canvas>
    </div>
  );
}
