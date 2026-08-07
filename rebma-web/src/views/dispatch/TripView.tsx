import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Package, Wifi, WifiOff, RefreshCw, ExternalLink, CheckCircle2, Phone, CreditCard, Camera } from 'lucide-react';
import { compressImageToDataUrl } from '../../utils/compressImage';

interface TripViewProps {
  token: string;
}

interface StopItem {
  productName: string;
  quantity: number | null;
}

interface Stop {
  id: string;
  orderId: string | null;
  customerName: string;
  deliveryAddress: string;
  sequence: number | null;
  status: string;
  hasProof?: boolean;
  phone?: string | null;
  paymentMode?: string | null;
  totalAmount?: number | null;
  items?: StopItem[];
}

function mapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

async function callTripApi(token: string, action: string, payload: Record<string, unknown> = {}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action, ...payload }),
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body.error };
}

export default function TripView({ token }: TripViewProps) {
  const [driverName, setDriverName] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [everHadStops, setEverHadStops] = useState(false);
  const [returned, setReturned] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingStage, setMarkingStage] = useState<'photo' | 'confirming' | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const captureStopRef = useRef<Stop | null>(null);
  const activeDeliveryId = stops[0]?.id || null;

  const loadStops = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trip?token=${encodeURIComponent(token)}`);
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      setDriverName(data.driverName || '');
      setVehicleId(data.vehicleId || null);
      setStops(data.stops || []);
      if ((data.stops || []).length > 0) setEverHadStops(true);
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  };

  useEffect(() => { loadStops(); }, [token]);

  // Mirrors DriverTrackingView: sharing live location is the driver's own
  // signal that they've actually started the trip, so this is where the
  // stop flips ASSIGNED -> IN_TRANSIT, not at dispatch-assignment time.
  useEffect(() => {
    if (!gpsActive || !activeDeliveryId) return;
    const stop = stops.find(s => s.id === activeDeliveryId);
    if (!stop || stop.status !== 'ASSIGNED') return;
    (async () => {
      await callTripApi(token, 'start', { deliveryId: activeDeliveryId });
      setStops(prev => prev.map(s => s.id === activeDeliveryId ? { ...s, status: 'IN_TRANSIT' } : s));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsActive, activeDeliveryId]);

  useEffect(() => {
    if (!gpsActive || !activeDeliveryId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by this browser.');
      setGpsActive(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocationError(null);
        const result = await callTripApi(token, 'ping', { deliveryId: activeDeliveryId, latitude, longitude, accuracy: accuracy ?? null });
        if (result.ok) setLastSyncedAt(new Date());
      },
      (err) => setLocationError(err.message || 'Unable to read location.'),
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 20000 }
    );
    watchIdRef.current = id;
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [gpsActive, activeDeliveryId, token]);

  const finishDelivery = async (stop: Stop) => {
    setMarkingStage('confirming');
    const result = await callTripApi(token, 'deliver', { deliveryId: stop.id });
    setMarkingId(null);
    setMarkingStage(null);
    if (!result.ok) { setProofError(result.error || 'Failed to update delivery. Please try again.'); return; }
    setStops(prev => prev.filter(s => s.id !== stop.id));
  };

  // "Arrived" opens the camera first — the ask is proof-of-delivery at the
  // point of arrival, not an after-the-fact upload from a desk. Cancelling
  // the camera (no file picked) falls straight through to a plain delivery
  // confirmation so a driver never gets stuck if a photo isn't practical;
  // the server still enforces proof_of_delivery_required either way.
  const handleArrived = (stop: Stop) => {
    setProofError(null);
    setMarkingId(stop.id);
    captureStopRef.current = stop;
    photoInputRef.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const stop = captureStopRef.current;
    if (!stop) return;
    if (!file) { await finishDelivery(stop); return; }
    setMarkingStage('photo');
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const result = await callTripApi(token, 'proof', { deliveryId: stop.id, photoDataUrl: dataUrl });
      if (!result.ok) { setMarkingId(null); setMarkingStage(null); setProofError(result.error || 'Photo upload failed.'); return; }
    } catch {
      setMarkingId(null); setMarkingStage(null); setProofError('Photo upload failed.'); return;
    }
    await finishDelivery(stop);
  };

  const skipPhoto = async (stop: Stop) => {
    setProofError(null);
    setMarkingId(stop.id);
    await finishDelivery(stop);
  };

  const handleReturn = async () => {
    setGpsActive(false);
    await callTripApi(token, 'return');
    setReturned(true);
  };

  if (notFound) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-page)] flex items-center justify-center p-6">
        <p className="text-sm text-text-muted text-center">This trip link is no longer active. Ask dispatch to resend it.</p>
      </div>
    );
  }

  if (returned) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-page)] flex items-center justify-center p-6">
        <div className="text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-text-primary">Welcome back — trip closed out.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg-page)] flex flex-col items-center">
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelected} style={{ display: 'none' }} />
      <div className="w-full max-w-xl flex flex-col min-h-screen sm:min-h-0 sm:my-8 sm:rounded-3xl sm:border sm:border-[var(--border)] sm:shadow-[var(--box-shadow)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <div>
            <p className="text-sm font-extrabold text-text-primary">{driverName || 'Your Trip'}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Dispatch Driver{vehicleId ? ` • ${vehicleId}` : ''}</p>
          </div>
        </div>

        <div className={`flex items-center justify-between px-5 py-2.5 text-xs font-bold ${gpsActive ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800/40 text-text-muted'}`}>
          <span className="flex items-center gap-2">
            {gpsActive ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {gpsActive ? 'Sharing live location' : 'Location sharing off'}
          </span>
          {lastSyncedAt && <span className="font-mono text-[10px] opacity-70">synced {lastSyncedAt.toLocaleTimeString()}</span>}
        </div>

        <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-[var(--bg-page)]">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-extrabold text-text-primary flex items-center gap-2">
                <Package className="w-4 h-4" /> Today's Stops {stops.length > 0 && `(${stops.length})`}
              </p>
              <button type="button" onClick={loadStops} className="text-text-muted hover:text-text-primary">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {proofError && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-500 text-[11px] font-semibold">{proofError}</div>
            )}

            {loading ? (
              <p className="text-xs text-text-muted">Loading your trip...</p>
            ) : stops.length === 0 ? (
              everHadStops ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-text-muted mb-4">All stops delivered. Heading back to the company?</p>
                  <button
                    type="button"
                    onClick={handleReturn}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    <Navigation className="w-3.5 h-3.5" /> I'm Back at the Company
                  </button>
                </div>
              ) : (
                <p className="text-xs text-text-muted text-center py-6">No active stops on this trip.</p>
              )
            ) : (
              <div className="space-y-3">
                {stops.map((stop, idx) => (
                  <div key={stop.id} className={`p-3 rounded-xl border ${idx === 0 ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900' : 'bg-[var(--bg-page)] border-[var(--border)]'}`}>
                    <p className="text-xs font-bold text-text-primary">Stop {stop.sequence ?? idx + 1}: {stop.customerName}</p>
                    {stop.deliveryAddress && (
                      <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" /> {stop.deliveryAddress}
                      </p>
                    )}
                    {stop.phone && (
                      <a href={`tel:${stop.phone}`} className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1 w-fit">
                        <Phone className="w-3 h-3 shrink-0" /> {stop.phone}
                      </a>
                    )}
                    {stop.items && stop.items.length > 0 && (
                      <div className="mt-1.5 text-[11px] text-text-secondary">
                        {stop.items.map((it, i) => (
                          <p key={i} className="leading-snug">{it.quantity != null ? `${it.quantity}x ` : ''}{it.productName}</p>
                        ))}
                      </div>
                    )}
                    {stop.paymentMode && (
                      <p className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 shrink-0" /> {stop.paymentMode}
                        {typeof stop.totalAmount === 'number' && ` — GHS ${stop.totalAmount.toLocaleString()}`}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2.5">
                      {stop.deliveryAddress && (
                        <a
                          href={mapsLink(stop.deliveryAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setGpsActive(true)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--accent)] text-white text-[11px] font-bold"
                        >
                          <ExternalLink className="w-3 h-3" /> Navigate
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleArrived(stop)}
                        disabled={markingId === stop.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                      >
                        {markingId === stop.id
                          ? (markingStage === 'photo' ? 'Uploading proof...' : 'Confirming...')
                          : <><Camera className="w-3 h-3" /> Arrived</>}
                      </button>
                    </div>
                    {markingId !== stop.id && (
                      <button type="button" onClick={() => skipPhoto(stop)} className="mt-1.5 text-[10px] text-text-muted underline w-full text-center">
                        Skip photo & mark delivered
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {stops.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
              <button
                type="button"
                onClick={() => setGpsActive(v => !v)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-colors ${gpsActive ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                <Navigation className="w-3.5 h-3.5" />
                {gpsActive ? 'Stop Sharing Location' : 'Share Live Location with Dispatch'}
              </button>
              <p className="text-[10px] text-text-muted text-center mt-2">Keep this page open while tracking is on — location only updates while the browser tab is active.</p>
              {locationError && <p className="text-[10px] text-rose-500 text-center mt-1">{locationError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
