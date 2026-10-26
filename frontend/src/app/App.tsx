import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { useApp, useT } from '../state/appStore';
import { useBootPlace, useRefreshGeoHome, useSceneSync, useWeather } from './hooks';
import { Header } from '../features/header/Header';
import { Notices } from '../features/notices/Notices';
import { Hero, HumidityCard, WindCard } from '../features/current/Current';
import { DailyCard, HourlyCard } from '../features/forecast/Forecast';
import { ReviewPanel } from '../features/debug/ReviewPanel';

// The 3D bundle loads in parallel with the UI; the CSS sky gradient covers the gap.
const WeatherCanvas = lazy(() => import('../scene/WeatherCanvas').then((m) => ({ default: m.WeatherCanvas })));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function App() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const place = useApp((s) => s.place);
  const debug = useApp((s) => s.debug);
  const searchRef = useRef<HTMLInputElement>(null);
  const webgl = useMemo(hasWebGL, []);

  useBootPlace();
  useRefreshGeoHome();
  const q = useWeather(place);
  const data = q.data;
  useSceneSync(data);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'سحاب · طقس' : 'Sahab · Weather';
  }, [lang]);

  // Skeleton while the selected place's data is on its way (previous data stays underneath).
  const switching = !!place && (!data || (q.isFetching && q.isPlaceholderData));
  const loading = debug.ui === 'loading' || switching;
  const error = debug.ui === 'error' || (q.isError && !q.isFetching);

  return (
    <>
      {webgl ? (
        <Suspense fallback={null}><WeatherCanvas /></Suspense>
      ) : (
        <div className="sky-fallback" aria-hidden="true" />
      )}
      <div className="stage">
        <div className={`app ${loading ? 'is-loading' : ''} ${debug.phone ? 'phone' : ''}`}>
          <Header searchRef={searchRef} />
          <div className="notices">
            {!webgl && <p className="notice glass body">{t.noWebgl}</p>}
            <Notices
              error={error}
              onRetry={() => { useApp.getState().setDebug({ ui: 'normal' }); void q.refetch(); }}
              onPickCity={() => searchRef.current?.focus()}
            />
          </div>
          {data ? (
            <main className="main">
              <div className="col-a">
                <Hero data={data} />
                <div className="pair">
                  <WindCard data={data} />
                  <HumidityCard data={data} />
                </div>
                <HourlyCard data={data} />
              </div>
              <div className="col-b">
                <DailyCard data={data} />
              </div>
            </main>
          ) : (
            <main className="main is-loading" aria-busy="true">
              <div className="col-a"><section className="hero"><p className="temp" data-sk>--°</p><p className="cond" data-sk>…</p></section></div>
            </main>
          )}
        </div>
      </div>
      <ReviewPanel />
    </>
  );
}
