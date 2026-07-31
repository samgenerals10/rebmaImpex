import { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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
// Ghana-wide default view for the map picker before anything's been located yet.
const GHANA_CENTER: [number, number] = [7.9465, -1.0232];

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// Accepts either a free-text place name (geocoded via Nominatim, OSM's free
// search — matches the tile provider already used elsewhere) or raw
// "lat, lng" typed directly, resolving to an exact point. The map itself is
// a real picker, not just a preview: click or drag the pin to fine-tune the
// spot, which reverse-geocodes back into the text field so the destination
// stays human-readable even when it was set by hand rather than typed.
export default function DestinationLocator({ value, onChange, onResolve, placeholder, className }: Props) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMap, setShowMap] = useState(false);

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (!res.ok) throw new Error('reverse lookup failed');
      const data = await res.json();
      onChange(data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }

  function pickPoint(lat: number, lng: number) {
    setError('');
    setCoords({ lat, lng });
    onResolve({ lat, lng });
    reverseGeocode(lat, lng);
  }

  async function locate() {
    setError('');
    const raw = value.trim();
    if (!raw) { setShowMap(true); return; }

    const coordMatch = raw.match(COORD_PATTERN);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      setCoords({ lat, lng });
      onResolve({ lat, lng });
      setShowMap(true);
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
        setShowMap(true);
      } else {
        setError('Location not found — try a more specific address, enter coordinates as "lat, lng", or pick it on the map.');
        setCoords(null);
        onResolve(null);
        setShowMap(true);
      }
    } catch {
      setError('Could not reach the map lookup service — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // Live preview: re-locate a short pause after the user stops typing, so
  // the map shows where the destination resolves to without needing an
  // explicit click — the pin icon/Enter remain there for an immediate,
  // on-demand check too.
  useEffect(() => {
    if (!value.trim()) return;
    const t = setTimeout(() => { locate(); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const mapCenter: [number, number] = coords ? [coords.lat, coords.lng] : GHANA_CENTER;

  return (
    <div className={className}>
      <div className="relative">
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setCoords(null); onResolve(null); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); locate(); } }}
          placeholder={placeholder || 'Enter destination name, or coordinates as "lat, lng"'}
          className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
        />
        <button
          type="button"
          onClick={locate}
          disabled={loading}
          title="Locate, or pick on map"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-[var(--accent-light)] text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}
      {showMap && (
        <div className="mt-2 rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: 220 }}>
          <MapContainer center={mapCenter} zoom={coords ? 15 : 7} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickToPick onPick={pickPoint} />
            {coords && (
              <Marker
                position={[coords.lat, coords.lng]}
                icon={pinIcon}
                draggable
                eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); pickPoint(p.lat, p.lng); } }}
              />
            )}
          </MapContainer>
        </div>
      )}
      {showMap && (
        <p className="text-[10px] text-[var(--text-muted)] mt-1">
          {coords ? `Resolved to ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — click or drag the pin to adjust` : 'Click anywhere on the map to set the exact destination'}
        </p>
      )}
    </div>
  );
}
