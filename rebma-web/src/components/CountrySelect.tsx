import { useState, useEffect, useRef, useMemo } from 'react';

interface Country {
  name: string;
  flag: string;
}

const CACHE_KEY = 'rebma_countries_cache_v2';

let countriesCache: Country[] | null = null;
let countriesPromise: Promise<Country[]> | null = null;

const API_BASE = 'https://api.restcountries.com/countries/v5';
const PAGE_SIZE = 100; // free-plan cap — the full ~254-country list needs 3 requests

async function fetchAllCountries(): Promise<Country[]> {
  const apiKey = import.meta.env.VITE_RESTCOUNTRIES_API_KEY;
  if (!apiKey) throw new Error('VITE_RESTCOUNTRIES_API_KEY is not set');

  const list: Country[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${API_BASE}?response_fields=names.common,flag.emoji&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) throw new Error(`Failed to load countries (${res.status})`);
    const body = await res.json();
    for (const c of body.data?.objects || []) {
      const name = c.names?.common as string | undefined;
      if (name) list.push({ name, flag: c.flag?.emoji || '' });
    }
    if (!body.data?.meta?.more) break;
    offset += PAGE_SIZE;
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

// This API's free tier is capped at 500 requests/month, so results are cached in
// localStorage indefinitely (country lists barely change) — every browser only
// ever pays the 3-request cost of paging through the full list once.
function loadCountries(): Promise<Country[]> {
  if (countriesCache) return Promise.resolve(countriesCache);
  if (!countriesPromise) {
    countriesPromise = (async () => {
      try {
        const stored = localStorage.getItem(CACHE_KEY);
        if (stored) {
          const list = JSON.parse(stored) as Country[];
          countriesCache = list;
          return list;
        }
      } catch { /* storage unavailable — fall through to network */ }

      const list = await fetchAllCountries();
      countriesCache = list;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* storage full — cache stays in-memory only */ }
      return list;
    })().catch(err => { countriesPromise = null; throw err; });
  }
  return countriesPromise;
}

interface CountrySelectProps {
  value: string;
  onChange: (name: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

const DEFAULT_INPUT_CLASS = 'w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none';

export default function CountrySelect({
  value, onChange, name, required, placeholder = 'Search for a country…', className, id,
}: CountrySelectProps) {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadCountries()
      .then(list => { if (!cancelled) setCountries(list); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value || '');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [value]);

  const filtered = useMemo(() => {
    if (!countries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(c => c.name.toLowerCase().includes(q));
  }, [countries, query]);

  const inputClasses = className || DEFAULT_INPUT_CLASS;

  function selectCountry(n: string) {
    onChange(n);
    setQuery(n);
    setOpen(false);
  }

  // Typing an exact country name and tabbing/submitting straight away (without
  // clicking the dropdown row) should still count as a real selection.
  function commitOnBlur() {
    const match = countries?.find(c => c.name.toLowerCase() === query.trim().toLowerCase());
    if (match) selectCountry(match.name);
    else { setQuery(value || ''); setOpen(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[highlight]; if (c) selectCountry(c.name); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(value || ''); }
  }

  if (failed) {
    // Country list couldn't be fetched — fall back to a plain text field so the form still works.
    return (
      <input
        type="text" id={id} name={name} required={required} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={inputClasses}
      />
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        id={id}
        autoComplete="off"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={commitOnBlur}
        placeholder={countries ? placeholder : 'Loading countries…'}
        disabled={!countries}
        required={required}
        className={inputClasses}
      />
      {name && <input type="hidden" name={name} value={value} />}
      {open && countries && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">No matching country.</p>
          ) : filtered.map((c, i) => (
            <button
              key={c.name}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectCountry(c.name)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${i === highlight ? 'bg-[var(--accent-light)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[var(--accent-light)]'}`}
            >
              <span>{c.flag}</span><span>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
