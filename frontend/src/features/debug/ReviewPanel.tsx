import { useEffect, useRef, useState } from 'react';
import type { Condition } from '../../data/types';
import { provider } from '../../data';
import { FIXTURES, fixturePlace } from '../../data/providers/mock';
import { useApp, type DebugUi, type TimeOverride } from '../../state/appStore';
import { useSceneStore, type Quality } from '../../scene/state/sceneStore';
import { Icon, conditionIcon } from '../../ui/Icon';

// Dev/review tool, shown with ?debug. Not part of the product UI, so it stays in Arabic.
const SCENES: [Condition | null, string][] = [
  [null, 'من البيانات'], ['clear', 'صافٍ'], ['partly', 'غائم جزئياً'], ['overcast', 'غائم'], ['fog', 'ضباب'],
  ['drizzle', 'رذاذ'], ['rain', 'مطر'], ['snow', 'ثلج'], ['storm', 'عاصفة'],
];
const TIMES: [TimeOverride, string][] = [[null, 'من البيانات'], ['day', 'نهار'], ['golden', 'غروب'], ['night', 'ليل']];
const UIS: [DebugUi, string][] = [['normal', 'عادي'], ['loading', 'تحميل'], ['error', 'خطأ شبكة'], ['denied', 'رفض الموقع'], ['onboarding', 'أول زيارة']];
const QUALITIES: [Quality, string][] = [['high', 'عالية'], ['medium', 'متوسطة'], ['low', 'منخفضة']];

function Chips<T>({ items, value, onPick, withIcons }: { items: [T, string][]; value: T; onPick: (v: T) => void; withIcons?: boolean }) {
  return (
    <div className="chips">
      {items.map(([v, label]) => (
        <button key={String(v)} type="button" aria-pressed={v === value} onClick={() => onPick(v)}>
          {withIcons && v ? <Icon name={conditionIcon(v as Condition, true)} size={15} /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

function useFps() {
  const [fps, setFps] = useState(0);
  const acc = useRef({ n: 0, t: performance.now() });
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      acc.current.n++;
      if (now - acc.current.t > 500) { setFps(Math.round((acc.current.n * 1000) / (now - acc.current.t))); acc.current = { n: 0, t: now }; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

export function ReviewPanel() {
  const { debug, setDebug, setNotice, selectPlace, lang, place } = useApp();
  const quality = useSceneStore((s) => s.quality);
  const setQuality = useSceneStore((s) => s.setQuality);
  const fps = useFps();
  if (!debug.enabled) return null;
  return (
    <details className="review">
      <summary><Icon name="sliders" size={18} /><span>لوحة المراجعة</span><small>للتطوير فقط · ?debug</small></summary>
      <div className="rv-body">
        <div className="rv-row"><span>المشهد</span><Chips items={SCENES} value={debug.scene} onPick={(scene) => setDebug({ scene })} withIcons /></div>
        <div className="rv-row"><span>وقت اليوم</span><Chips items={TIMES} value={debug.time} onPick={(time) => setDebug({ time })} /></div>
        <div className="rv-row">
          <span>حالة الواجهة</span>
          <Chips items={UIS} value={debug.ui} onPick={(ui) => { setDebug({ ui }); setNotice(ui === 'denied' ? 'denied' : null); }} />
        </div>
        <div className="rv-row"><span>جودة الرسم (تتغير تلقائياً حسب الجهاز)</span><Chips items={QUALITIES} value={quality} onPick={setQuality} /></div>
        <div className="rv-row"><span>العرض</span><Chips items={[[false, 'ديسكتوب'], [true, 'موبايل']]} value={debug.phone} onPick={(phone) => setDebug({ phone })} /></div>
        <div className="rv-row">
          <span>مدن تجريبية {provider.name === 'mock' ? '(بيانات وهمية)' : '(طقس حقيقي)'}</span>
          <div className="chips">
            {FIXTURES.map((f) => {
              const p = fixturePlace(f, lang);
              const real = provider.name === 'mock' ? p : { ...p, id: `fx:${f.key}` };
              return <button key={f.key} type="button" aria-pressed={place?.id === real.id} onClick={() => selectPlace(real)}>{p.name}</button>;
            })}
          </div>
        </div>
        <div className="rv-foot"><span className="n">{fps} fps · {quality}</span><span>مصدر البيانات: {provider.name}</span></div>
      </div>
    </details>
  );
}
