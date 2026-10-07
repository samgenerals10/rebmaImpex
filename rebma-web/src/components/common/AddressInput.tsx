// An address box with a map pin inside it. Typing works as normal; the pin
// opens a map where you can search for a place or tap the exact spot, and
// the address text is filled in from the map. Used by every address field
// (staff, guarantor, customer, delivery). The map picker itself is the same
// DestinationLocator the delivery screens already use.
import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import DestinationLocator, { type Coords } from '../dispatch/DestinationLocator';

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Optional: receives the exact point when one is picked on the map. */
  onCoords?: (coords: Coords | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function AddressInput({ value, onChange, onCoords, placeholder, disabled, className, style }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div style={{ position: 'relative' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          style={{ ...style, paddingRight: 40 }}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          title="Find on the map"
          aria-label="Find on the map"
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <MapPin size={16} />
        </button>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} color="var(--accent)" />
              <p style={{ margin: 0, flex: 1, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Find the address on the map</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Search for a place, or tap the exact spot on the map. The address box fills in for you.</p>
            <DestinationLocator
              value={value}
              onChange={onChange}
              onResolve={c => onCoords?.(c)}
              placeholder={placeholder || 'Search a place or area'}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ alignSelf: 'flex-end', padding: '0.55rem 1.4rem', borderRadius: 999, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Use this address
            </button>
          </div>
        </div>
      )}
    </>
  );
}
