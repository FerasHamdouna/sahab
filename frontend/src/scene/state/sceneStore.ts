import { create } from 'zustand';
import { weatherToSceneTarget, type SceneTarget } from './sceneState';

export type Quality = 'high' | 'medium' | 'low';

interface SceneStore {
  target: SceneTarget;
  /** True once `target` reflects real weather (live data or the last visit's cached sky). */
  hasRealTarget: boolean;
  quality: Quality;
  setTarget: (t: SceneTarget) => void;
  setQuality: (q: Quality) => void;
}

const CACHE_KEY = 'sahab.scene';

function cachedTarget(): SceneTarget | null {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return v ? (JSON.parse(v) as SceneTarget) : null;
  } catch {
    return null;
  }
}

// Reloads start from the last sky the user saw, so there's no flash of a default scene.
const cached = typeof window !== 'undefined' ? cachedTarget() : null;
const fallback = weatherToSceneTarget({ condition: 'partly', elevation: 0.6, temperature: 22, windSpeed: 12, windDirection: 270 });

export const useSceneStore = create<SceneStore>((set) => ({
  target: cached ?? fallback,
  hasRealTarget: !!cached,
  // Fixed on "low" (user's choice, 2026-10-26): looks the same to them and never re-sizes the
  // canvas mid-session. The debug panel can still switch tiers manually for comparison.
  quality: 'low',
  setTarget: (target) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(target)); } catch { /* storage blocked */ }
    set({ target, hasRealTarget: true });
  },
  setQuality: (quality) => set({ quality }),
}));
