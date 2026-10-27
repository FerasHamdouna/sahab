import { create } from 'zustand';
import type { Condition, Lang, Place, Units } from '../data/types';
import { STRINGS } from '../i18n/strings';

const storage = {
  get<T>(k: string, d: T): T {
    try { const v = localStorage.getItem('sahab.' + k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; }
  },
  set(k: string, v: unknown) {
    try { localStorage.setItem('sahab.' + k, JSON.stringify(v)); } catch { /* storage blocked: keep in memory */ }
  },
};

export type HomePlace = Place & { geo?: boolean };
export type Notice = 'denied' | 'geoFail' | null;
export type DebugUi = 'normal' | 'loading' | 'error' | 'denied' | 'onboarding';
export type TimeOverride = 'day' | 'golden' | 'night' | null;

interface AppState {
  lang: Lang;
  units: Units;
  sound: boolean;
  home: HomePlace | null;
  recents: Place[];
  place: Place | null;
  fromGeo: boolean;
  onboarded: boolean;
  locating: boolean;
  notice: Notice;
  debug: { enabled: boolean; scene: Condition | null; time: TimeOverride; ui: DebugUi; phone: boolean };

  setLang: (l: Lang) => void;
  setUnits: (u: Units) => void;
  setSound: (on: boolean) => void;
  selectPlace: (p: Place, opts?: { geo?: boolean; remember?: boolean }) => void;
  /** Same place, new names (language switch): updates it everywhere it's stored. */
  renamePlace: (p: Place) => void;
  toggleHome: () => void;
  finishOnboarding: () => void;
  setLocating: (b: boolean) => void;
  setNotice: (n: Notice) => void;
  setDebug: (d: Partial<AppState['debug']>) => void;
}

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const home = storage.get<HomePlace | null>('home', null);
// "My city" wins; otherwise reopen the last city viewed (no time-zone guess or network wait on reload).
const lastPlace = storage.get<Place | null>('last', null);

export const useApp = create<AppState>((set, get) => ({
  lang: storage.get<Lang>('lang', 'ar'),
  units: storage.get<Units>('units', 'metric'),
  sound: storage.get('sound', true),
  home,
  recents: storage.get<Place[]>('recents', []),
  place: home ?? lastPlace,
  fromGeo: home ? !!home.geo : false,
  onboarded: storage.get('onboarded', !!home),
  locating: false,
  notice: null,
  debug: { enabled: params.has('debug'), scene: null, time: null, ui: 'normal', phone: false },

  setLang: (lang) => { storage.set('lang', lang); set({ lang }); },
  setUnits: (units) => { storage.set('units', units); set({ units }); },
  setSound: (sound) => { storage.set('sound', sound); set({ sound }); },
  selectPlace: (p, opts = {}) => {
    const s = get();
    const recents = opts.remember === false ? s.recents : [p, ...s.recents.filter((r) => r.id !== p.id)].slice(0, 5);
    storage.set('recents', recents);
    storage.set('last', p);
    // A geolocated home follows the user: refresh it silently.
    let homeNext = s.home;
    if (opts.geo && s.home?.geo) { homeNext = { ...p, geo: true }; storage.set('home', homeNext); }
    set({ place: p, recents, fromGeo: !!opts.geo, notice: null, home: homeNext });
  },
  renamePlace: (p) => {
    const s = get();
    const place = s.place?.id === p.id ? p : s.place;
    const home = s.home?.id === p.id ? { ...p, geo: s.home.geo } : s.home;
    const recents = s.recents.map((r) => (r.id === p.id ? p : r));
    if (place?.id === p.id) storage.set('last', place);
    if (home !== s.home) storage.set('home', home);
    storage.set('recents', recents);
    set({ place, home, recents });
  },
  toggleHome: () => {
    const { place, home: h, fromGeo } = get();
    if (!place) return;
    const next = h?.id === place.id ? null : { ...place, geo: fromGeo };
    storage.set('home', next);
    set({ home: next });
  },
  finishOnboarding: () => { storage.set('onboarded', true); set({ onboarded: true }); },
  setLocating: (locating) => set({ locating }),
  setNotice: (notice) => set({ notice }),
  setDebug: (d) => set({ debug: { ...get().debug, ...d } }),
}));

export const useT = () => STRINGS[useApp((s) => s.lang)];
