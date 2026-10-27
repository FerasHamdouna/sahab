import { useEffect, useRef, useState } from 'react';
import { useApp, useT } from '../../state/appStore';
import { useLocate } from '../../app/hooks';
import { Icon } from '../../ui/Icon';
import { SearchBar } from '../search/SearchBar';
import { isAudioUnlocked, setSoundEnabled, unlockAudio } from '../../scene/audio/ambient';

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE2A8" />
          <stop offset="1" stopColor="#FFB45E" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="12" r="7" fill="url(#bm)" />
      <path d="M9 26h14.5a5.5 5.5 0 0 0 0-11 7.5 7.5 0 0 0-14.3 2.1A4.5 4.5 0 0 0 9 26Z" fill="#F5F8FD" fillOpacity=".92" />
    </svg>
  );
}

function SoundButton() {
  const t = useT();
  const sound = useApp((s) => s.sound);
  const setSound = useApp((s) => s.setSound);
  const [unlocked, setUnlocked] = useState(isAudioUnlocked());
  const unlockedAt = useRef(-1e9);

  // Sound is on by default, but browsers only allow audio to start inside a "user activation"
  // gesture. On phones a touch pointerdown doesn't count; pointerup/touchend/click/keydown do.
  useEffect(() => {
    const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
    const onGesture = () => {
      if (!useApp.getState().sound || isAudioUnlocked()) return;
      unlockedAt.current = performance.now(); // this tap starts audio; it must not also toggle mute
      void unlockAudio().then((ok) => { if (ok) setUnlocked(true); });
    };
    // Phones suspend audio when the tab goes to the background; the next tap resumes it.
    const onVisibility = () => { if (!document.hidden) setUnlocked(isAudioUnlocked()); };
    events.forEach((e) => addEventListener(e, onGesture, true));
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      events.forEach((e) => removeEventListener(e, onGesture, true));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => { setSoundEnabled(sound); }, [sound]);

  const pending = sound && !unlocked;
  const label = pending ? t.soundPending : sound ? t.soundOn : t.soundOff;
  return (
    <button
      className="icon-btn glass"
      aria-label={label}
      title={label}
      aria-pressed={sound}
      onClick={() => {
        if (performance.now() - unlockedAt.current < 800) return; // that tap only unlocked audio
        const next = !sound;
        setSound(next);
        setSoundEnabled(next); // now, not after render: unlockAudio below runs inside this click
        if (next) void unlockAudio().then(setUnlocked);
      }}
    >
      <Icon name={sound ? 'vol' : 'volX'} size={20} />
      {pending && <span className="dot" />}
    </button>
  );
}

export function Header({ searchRef }: { searchRef: React.RefObject<HTMLInputElement | null> }) {
  const t = useT();
  const { lang, units, locating, setLang, setUnits } = useApp();
  const locate = useLocate();
  return (
    <header className="top">
      <div className="brand">
        <BrandMark />
        <span>{t.brand}</span>
      </div>
      <SearchBar inputRef={searchRef} />
      <div className="actions">
        <button className="icon-btn glass" aria-label={t.myLoc} title={t.myLoc} onClick={locate} disabled={locating}>
          <Icon name={locating ? 'loader' : 'locate'} size={20} spin={locating} />
        </button>
        <SoundButton />
        <button className="icon-btn glass lang-btn" aria-label={t.langLbl} title={t.langLbl} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
          {t.langBtn}
        </button>
        <div className="seg glass" role="group" aria-label={t.unitsLbl}>
          <button aria-pressed={units === 'metric'} onClick={() => setUnits('metric')}>°C</button>
          <button aria-pressed={units === 'imperial'} onClick={() => setUnits('imperial')}>°F</button>
        </div>
      </div>
    </header>
  );
}
