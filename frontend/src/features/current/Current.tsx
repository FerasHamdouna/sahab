import { useEffect, useRef, useState } from 'react';
import type { WeatherData } from '../../data/types';
import { cityClock } from '../../data/time';
import { provider } from '../../data';
import { useApp, useT } from '../../state/appStore';
import { useNow } from '../../app/hooks';
import { dewPoint, tempNum, windNum } from '../../app/format';
import { DROP_PATH, Icon, conditionIcon } from '../../ui/Icon';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts from the previous temperature to the new one. */
function useTween(to: number) {
  const [v, setV] = useState(to);
  const from = useRef(to);
  useEffect(() => {
    if (reduceMotion || from.current === to) { from.current = to; setV(to); return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 650), e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (to - a) * e));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = to; };
  }, [to]);
  return v;
}

const T = ({ c }: { c: number }) => {
  const units = useApp((s) => s.units);
  return <span className="n">{tempNum(c, units)}°</span>;
};

export function Hero({ data }: { data: WeatherData }) {
  const t = useT();
  const { units, home, fromGeo, place, toggleHome } = useApp();
  useNow(30_000);
  const c = data.current, d0 = data.daily[0];
  const isHome = !!home && !!place && home.id === place.id;
  // Names come from the selected place (renamed on language switch), not the cached weather payload.
  const shown = place && place.id === data.location.id ? place : data.location;
  const temp = useTween(tempNum(c.temperature, units));
  return (
    <section className="hero" aria-live="polite">
      <div className="place">
        <h1 data-sk>{shown.name}</h1>
        {fromGeo && <span className="chip"><Icon name="locate" size={13} />{t.yourLoc}</span>}
        <button className="home-btn" aria-pressed={isHome} onClick={toggleHome}>
          <Icon name="star" size={15} />
          <span>{isHome ? t.isHome : t.makeHome}</span>
        </button>
      </div>
      <p className="meta" data-sk>
        {shown.country && <><span>{shown.country}</span><span aria-hidden="true">·</span></>}
        <span>{t.localTime} <span className="n">{cityClock(data.location.utcOffsetSeconds)}</span></span>
        {provider.name === 'mock' && <span className="demo">{t.demo}</span>}
      </p>
      <p className="temp" data-sk><span className="n">{temp}°</span></p>
      <p className="cond" data-sk>
        <Icon name={conditionIcon(c.condition, c.isDay)} size={30} />
        <span>{t.cond[c.condition]}</span>
      </p>
      <p className="sub" data-sk>
        <span>{t.feels} <b><T c={c.feelsLike} /></b></span>
        <span>{t.hi} <b><T c={d0.tempMax} /></b></span>
        <span>{t.lo} <b><T c={d0.tempMin} /></b></span>
      </p>
    </section>
  );
}

export function WindCard({ data }: { data: WeatherData }) {
  const t = useT();
  const units = useApp((s) => s.units);
  const c = data.current;
  const dirIdx = Math.round(c.windDirection / 45) % 8;
  return (
    <section className="card glass">
      <h2><Icon name="wind" size={16} />{t.wind}</h2>
      <div className="metric" data-sk>
        <svg className="dial" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,.04)" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * 15 * Math.PI) / 180, major = i % 6 === 0, r1 = major ? 39 : 42;
            return <line key={i} x1={50 + Math.sin(a) * r1} y1={50 - Math.cos(a) * r1} x2={50 + Math.sin(a) * 46} y2={50 - Math.cos(a) * 46}
              stroke={`rgba(255,255,255,${major ? 0.55 : 0.2})`} strokeWidth={major ? 1.6 : 1} />;
          })}
          {t.compass.map((l, i) => {
            const a = (i * 90 * Math.PI) / 180;
            return <text key={l} x={50 + Math.sin(a) * 30} y={50 - Math.cos(a) * 30 + 4} textAnchor="middle" fontSize="10"
              fill={i === 0 ? '#FFC873' : 'rgba(255,255,255,.6)'}>{l}</text>;
          })}
          <g className="arrow" style={{ transform: `rotate(${c.windDirection + 180}deg)` }}>
            <path d="M50 26 L56 38 L51.5 36 L51.5 72 L48.5 72 L48.5 36 L44 38 Z" fill="#F5F8FD" />
            <circle cx="50" cy="50" r="3.2" fill="#0E1626" stroke="#F5F8FD" strokeWidth="1.5" />
          </g>
        </svg>
        <div>
          <p className="big"><span className="n">{windNum(c.windSpeed, units)}</span><small>{units === 'metric' ? t.kmh : t.mph}</small></p>
          <p className="lbl">{t.from} {t.dirs[dirIdx]}</p>
          <p className="lbl2">{t.gusts} <span className="n">{windNum(c.windGusts, units)}</span></p>
        </div>
      </div>
    </section>
  );
}

export function HumidityCard({ data }: { data: WeatherData }) {
  const t = useT();
  const units = useApp((s) => s.units);
  const h = Math.round(data.current.humidity);
  const comfort = t.comfort[h < 30 ? 0 : h < 60 ? 1 : h < 80 ? 2 : 3];
  const C = 2 * Math.PI * 40;
  return (
    <section className="card glass">
      <h2><Icon name="drop" size={16} />{t.humidity}</h2>
      <div className="metric" data-sk>
        <svg className="dial" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
          <circle className="ring" cx="50" cy="50" r="40" fill="none" stroke="#8FD3FF" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - h / 100)} transform="rotate(-90 50 50)" />
          <g transform="translate(38 38)" stroke="#8FD3FF" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: DROP_PATH }} />
        </svg>
        <div>
          <p className="big"><span className="n">{h}%</span></p>
          <p className="lbl">{comfort}</p>
          <p className="lbl2">{t.dew} <span className="n">{tempNum(dewPoint(data.current.temperature, h), units)}°</span></p>
        </div>
      </div>
    </section>
  );
}
