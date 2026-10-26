import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { provider, type Place, type WeatherData } from '../data';
import { FIXTURES, fixturePlace } from '../data/providers/mock';
import { cityNow, minutesOf, sunElevation } from '../data/time';
import { useApp } from '../state/appStore';
import { useSceneStore } from '../scene/state/sceneStore';
import { ELEVATION_OVERRIDE, skyLuminance, weatherToSceneTarget } from '../scene/state/sceneState';

const WEATHER_STALE = 10 * 60 * 1000;
export const weatherKey = (p: Place) => ['weather', provider.name, p.lat.toFixed(2), p.lon.toFixed(2)] as const;

// Last response per place, so a reload paints real numbers instantly and refreshes in the background.
const WX_CACHE = 'sahab.wx';
function readCached(place: Place | null): { at: number; data: WeatherData } | undefined {
  if (!place) return undefined;
  try {
    const v = JSON.parse(localStorage.getItem(WX_CACHE) ?? 'null') as { key: string; at: number; data: WeatherData } | null;
    return v && v.key === weatherKey(place).join('|') ? v : undefined;
  } catch {
    return undefined;
  }
}
async function fetchAndCache(place: Place) {
  const data = await provider.weather(place);
  try { localStorage.setItem(WX_CACHE, JSON.stringify({ key: weatherKey(place).join('|'), at: Date.now(), data })); } catch { /* storage full/blocked */ }
  return data;
}

export function useWeather(place: Place | null) {
  const placeKey = place ? weatherKey(place).join('|') : '';
  // Re-read storage only when the place changes, not on every render.
  const cached = useMemo(() => readCached(place), [placeKey]);
  return useQuery({
    queryKey: place ? weatherKey(place) : ['weather', 'none'],
    queryFn: () => fetchAndCache(place!),
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
    enabled: !!place,
    staleTime: WEATHER_STALE,
    refetchInterval: WEATHER_STALE,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function usePrefetch() {
  const qc = useQueryClient();
  return (p: Place) => qc.prefetchQuery({ queryKey: weatherKey(p), queryFn: () => fetchAndCache(p), staleTime: WEATHER_STALE });
}

export function useGeocode(query: string) {
  const lang = useApp((s) => s.lang);
  const q = query.trim();
  return useQuery({
    queryKey: ['geocode', provider.name, lang, q.toLowerCase()],
    queryFn: () => provider.geocode(q, lang),
    enabled: q.length >= 2,
    staleTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/** Re-renders every `ms` so live clocks and the sun position keep moving. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** First visit without a saved city: guess from the browser time zone, fall back to Amman. */
export function useBootPlace() {
  const place = useApp((s) => s.place);
  const lang = useApp((s) => s.lang);
  useEffect(() => {
    if (place) return;
    let cancelled = false;
    const fallback = provider.name === 'mock' ? fixturePlace(FIXTURES[0], lang) : { ...fixturePlace(FIXTURES[0], lang), id: 'om:250441' };
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? '';
    (async () => {
      let p: Place = fallback;
      if (city && city !== 'UTC') {
        try {
          const r = await provider.geocode(city, lang);
          if (r[0]) p = r[0];
        } catch { /* keep fallback */ }
      }
      if (!cancelled) useApp.getState().selectPlace(p, { remember: false });
    })();
    return () => { cancelled = true; };
  }, [place, lang]);
}

/** Pushes the weather (plus debug overrides) into the 3D scene and the glass/scrim tokens. */
export function useSceneSync(data: WeatherData | undefined) {
  const debug = useApp((s) => s.debug);
  const now = useNow(60_000);
  const setTarget = useSceneStore((s) => s.setTarget);
  useEffect(() => {
    if (!data) return;
    const local = cityNow(data.location.utcOffsetSeconds, now);
    const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
    const d0 = data.daily[0];
    const elevation = debug.time ? ELEVATION_OVERRIDE[debug.time] : sunElevation(nowMin, minutesOf(d0.sunrise), minutesOf(d0.sunset));
    const target = weatherToSceneTarget({
      condition: debug.scene ?? data.current.condition,
      elevation,
      temperature: data.current.temperature,
      windSpeed: data.current.windSpeed,
      windDirection: data.current.windDirection,
      cloudCover: debug.scene ? undefined : data.current.cloudCover,
    });
    setTarget(target);
    const lum = skyLuminance(target);
    const root = document.documentElement.style;
    root.setProperty('--glass-a', (0.2 + lum * 0.3).toFixed(3));
    root.setProperty('--scrim', (Math.max(0, lum - 0.3) * 0.75).toFixed(3));
    root.setProperty('--sky-top', `rgb(${target.top.map(Math.round).join(',')})`);
    root.setProperty('--sky-hor', `rgb(${target.hor.map(Math.round).join(',')})`);
  }, [data, debug.scene, debug.time, now, setTarget]);
}

/** "Use my location": geolocation → reverse geocode → select. */
export function useLocate() {
  return () => {
    const s = useApp.getState();
    s.finishOnboarding();
    if (s.debug.ui === 'denied') { s.setNotice('denied'); return; }
    if (!('geolocation' in navigator)) { s.setNotice('geoFail'); return; }
    s.setLocating(true);
    s.setNotice(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let p: Place;
        try {
          p = await provider.reverse(latitude, longitude, useApp.getState().lang);
        } catch {
          p = { id: `geo:${latitude.toFixed(3)},${longitude.toFixed(3)}`, name: '', country: '', countryCode: '', lat: latitude, lon: longitude };
        }
        if (!p.name) p = { ...p, name: STRINGS_FALLBACK[useApp.getState().lang] };
        useApp.getState().setLocating(false);
        useApp.getState().selectPlace(p, { geo: true });
      },
      (err) => {
        useApp.getState().setLocating(false);
        useApp.getState().setNotice(err.code === err.PERMISSION_DENIED ? 'denied' : 'geoFail');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  };
}
const STRINGS_FALLBACK = { ar: 'موقعك الحالي', en: 'Your location' } as const;

/** A saved "auto" home re-locates silently on each visit, only if permission is already granted. */
export function useRefreshGeoHome() {
  useEffect(() => {
    const { home } = useApp.getState();
    if (!home?.geo || !navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then((r) => {
      if (r.state !== 'granted') return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const p = await provider.reverse(pos.coords.latitude, pos.coords.longitude, useApp.getState().lang);
          if (p.name && Math.hypot(p.lat - home.lat, p.lon - home.lon) > 0.05) useApp.getState().selectPlace(p, { geo: true, remember: false });
        } catch { /* keep the saved home */ }
      }, () => {}, { timeout: 8000, maximumAge: 30 * 60 * 1000 });
    }).catch(() => {});
  }, []);
}
