import { useEffect, useId, useRef, useState } from 'react';
import type { Place } from '../../data/types';
import { useApp, useT } from '../../state/appStore';
import { useGeocode, usePrefetch } from '../../app/hooks';
import { Icon } from '../../ui/Icon';

export function SearchBar({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const t = useT();
  const recents = useApp((s) => s.recents);
  const selectPlace = useApp((s) => s.selectPlace);
  const prefetch = usePrefetch();
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(value), 250);
    return () => clearTimeout(id);
  }, [value]);

  const geo = useGeocode(query);
  const showingRecents = value.trim().length === 0;
  const items: Place[] = showingRecents ? recents : query.trim().length >= 2 ? geo.data ?? [] : [];
  const searching = !showingRecents && (geo.isFetching || value !== query) && value.trim().length >= 2;

  useEffect(() => setActive(-1), [query, showingRecents]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const choose = (p: Place) => {
    selectPlace(p);
    setValue('');
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const move = (dir: 1 | -1) => {
    if (!items.length) return;
    const next = (active + dir + items.length) % items.length;
    setActive(next);
    void prefetch(items[next]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { const p = items[active] ?? items[0]; if (p) { e.preventDefault(); choose(p); } }
    else if (e.key === 'Escape') setOpen(false);
  };

  const noResults = !showingRecents && !searching && query.trim().length >= 2 && geo.isSuccess && items.length === 0;
  const visible = open && (items.length > 0 || noResults || searching);

  return (
    <div className="search" ref={boxRef}>
      <input
        ref={inputRef}
        className="glass"
        type="text"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label={t.searchLbl}
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={t.searchPh}
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      <span className="search-ico"><Icon name={searching ? 'loader' : 'search'} size={20} spin={searching} /></span>
      {visible && (
        <div className="suggest glass" id={listId} role="listbox" onPointerDown={(e) => e.preventDefault()}>
          {noResults ? (
            <p className="empty">{t.noRes(value.trim())}</p>
          ) : items.length === 0 ? (
            <p className="empty">{t.searching}</p>
          ) : (
            <>
              <p className="hd">{showingRecents ? t.recent : t.results}</p>
              {items.map((p, i) => (
                <div
                  key={p.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="opt"
                  onPointerEnter={() => void prefetch(p)}
                  onClick={() => choose(p)}
                >
                  <span className="flag">{p.countryCode || '··'}</span>
                  <span className="opt-txt">
                    <span className="nm">{p.name}</span>{' '}
                    <span className="ct">{[p.region, p.country].filter(Boolean).join('، ')}</span>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
