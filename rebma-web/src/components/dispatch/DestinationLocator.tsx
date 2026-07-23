import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

const pinIcon = L.divIcon({
  className: 'destination-pin-marker',
  html: `<div style="background:#ef4444;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid #fff;"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

export interface Coords { lat: number; lng: number }

interface Props {
  value: string;
  onChange: (text: string) => void;
  onResolve: (coords: Coords | null) => void;
  placeholder?: string;
  className?: string;
}

const COORD_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

// Accepts either a free-text place name (geocoded via Nominatim, OSM's free
// search — matches the tile provider already used elsewhere) or raw
// "lat, lng" typed directly, and shows exactly where it resolved to so
// dispatch can catch a wrong address before assigning a driver to it.
export default function DestinationLocator({ value, onChange, onResolve, placeholder, className }: Props) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function locate() {
    setError('');
    const raw = value.trim();
    if (!raw) { setCoords(null); onResolve(null); return; }

    const coordMatch = raw.match(COORD_PATTERN);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      setCoords({ lat, lng });
      onResolve({ lat, lng });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gh&q=${encodeURIComponent(raw)}`
      );
      if (!res.ok) throw new Error('lookup failed');
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setCoords({ lat, lng });
        onResolve({ lat, lng });
      } else {
        setError('Location not found — try a more specific address, or enter coordinates as "lat, lng".');
        setCoords(null);
        onResolve(null);
      }
    } catch {
      setError('Could not reach the map lookup service — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setCoords(null); onResolve(null); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); locate(); } }}
          placeholder={placeholder || 'Address, place name, or "lat, lng"'}
          className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
        />
        <button
          type="button"
          onClick={locate}
          disabled={loading || !value.trim()}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          Locate
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}
      {coords && (
        <div className="mt-2 rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: 160 }}>
          <MapContainer center={[coords.lat, coords.lng]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} dragging={false}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[coords.lat, coords.lng]} icon={pinIcon} />
          </MapContainer>
        </div>
      )}
      {coords && (
        <p className="text-[10px] text-[var(--text-muted)] mt-1">Resolved to {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
      )}
    </div>
  );
}
