import { useEffect, useRef } from 'react';
import type { WeatherData } from '../../data/types';
import { hhmm } from '../../data/time';
import { useApp, useT } from '../../state/appStore';
import { isolate, tempColor, tempNum, toUnit } from '../../app/format';
import { Icon, conditionIcon } from '../../ui/Icon';

const CW = 60, SH = 84, TOP = 26, BOT = 10, W = CW * 24;

export function HourlyCard({ data }: { data: WeatherData }) {
  const t = useT();
  const { units, lang } = useApp();
  const scroller = useRef<HTMLDivElement>(null);
  const rtl = lang === 'ar';
  const hrs = data.hourly;
  const vals = hrs.map((h) => toUnit(h.temperature, units));
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const pts = vals.map((v, i) => [rtl ? W - (i + 0.5) * CW : (i + 0.5) * CW, TOP + (1 - (v - mn) / (mx - mn || 1)) * (SH - TOP - BOT)] as const);

  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${pts[23][0]},${SH} L${pts[0][0]},${SH} Z`;

  const srH = [data.daily[0].sunrise, data.daily[1].sunrise].map((s) => s.slice(0, 13));
  const ssH = [data.daily[0].sunset, data.daily[1].sunset].map((s) => s.slice(0, 13));

  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = 0; }, [data.location.id, rtl]);

  return (
    <section className="card glass">
      <h2><Icon name="clock" size={16} />{t.hourly}</h2>
      <div className="hours" data-sk ref={scroller}>
        <div className="track">
          {hrs.map((h, i) => {
            const key = h.time.slice(0, 13);
            const ev = i > 0 && srH.includes(key) ? t.sunrise : i > 0 && ssH.includes(key) ? t.sunset : null;
            return (
              <div key={h.time} style={{ display: 'contents' }}>
                <div className={`tm ${i === 0 ? 'now' : ''}`} style={{ gridColumn: i + 1 }}>
                  <span className="n">{i === 0 ? t.now : hhmm(h.time)}</span>
                  {ev && <span className="ev">{ev}</span>}
                </div>
                <div className="ic" style={{ gridColumn: i + 1 }}><Icon name={conditionIcon(h.condition, h.isDay)} size={22} /></div>
                <div className="pp" style={{ gridColumn: i + 1 }}>
                  {h.precipitationProbability >= 10 && <span className="n">{Math.round(h.precipitationProbability)}%</span>}
                </div>
              </div>
            );
          })}
          <svg className="curve" viewBox={`0 0 ${W} ${SH}`} aria-hidden="true">
            <defs>
              <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity=".16" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#hg)" />
            <path d={d} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={i === 0 ? 4.5 : 2.6} fill={i === 0 ? '#FFC873' : '#F5F8FD'}
                  {...(i === 0 ? { stroke: 'rgba(255,200,115,.35)', strokeWidth: 6 } : {})} />
                <text x={x} y={y - 10} textAnchor="middle">{isolate(`${tempNum(hrs[i].temperature, units)}°`)}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

export function DailyCard({ data }: { data: WeatherData }) {
  const t = useT();
  const { units, lang } = useApp();
  const rtl = lang === 'ar';
  const days = data.daily;
  const lo = Math.min(...days.map((d) => d.tempMin)), hi = Math.max(...days.map((d) => d.tempMax)), span = hi - lo || 1;
  const fmt = new Intl.DateTimeFormat(t.locale, { weekday: 'long', timeZone: 'UTC' });
  const cur = data.current.temperature;
  return (
    <section className="card glass">
      <h2><Icon name="calendar" size={16} />{t.daily}</h2>
      <ul className="days" data-sk>
        {days.map((d, i) => {
          const name = i === 0 ? t.today : i === 1 ? t.tomorrow : fmt.format(new Date(`${d.date}T12:00:00Z`));
          const s = ((d.tempMin - lo) / span) * 100, w = ((d.tempMax - d.tempMin) / span) * 100;
          return (
            <li className="day" key={d.date}>
              <span className="dn">{name}</span>
              <span className="di">
                <Icon name={conditionIcon(d.condition, true)} size={24} />
                {d.precipitationProbability >= 20 && <small className="n">{Math.round(d.precipitationProbability)}%</small>}
              </span>
              <span className="lo"><span className="n">{tempNum(d.tempMin, units)}°</span></span>
              <span className="bar">
                <span className="fill" style={{
                  insetInlineStart: `${s}%`, width: `${Math.max(w, 4)}%`,
                  background: `linear-gradient(${rtl ? 'to left' : 'to right'}, ${tempColor(d.tempMin)}, ${tempColor(d.tempMax)})`,
                }} />
                {i === 0 && <span className="now" style={{ insetInlineStart: `${Math.min(100, Math.max(0, ((cur - lo) / span) * 100))}%` }} />}
              </span>
              <span className="hi"><span className="n">{tempNum(d.tempMax, units)}°</span></span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
