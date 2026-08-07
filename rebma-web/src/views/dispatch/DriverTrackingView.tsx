import { useState, useEffect, useRef } from 'react';
import { LogOut, MapPin, Navigation, Package, Wifi, WifiOff, RefreshCw, ExternalLink, Phone, CreditCard, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { uploadFile } from '../../utils/uploadFile';

interface DriverTrackingViewProps {
  driver: { id: string; driverId: string; fullName: string; vehicleId: string | null };
  onLogout: () => void;
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
  phone?: string | null;
  paymentMode?: string | null;
  totalAmount?: number | null;
  items?: StopItem[];
}

function mapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export default function DriverTrackingView({ driver, onLogout }: DriverTrackingViewProps) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [lastLat, setLastLat] = useState<number | null>(null);
  const [lastLng, setLastLng] = useState<number | null>(null);
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
    const { data } = await supabase
      .from('delivery_logs')
      .select('id, order_id, customer_name, delivery_address, dispatch_sequence, status')
      .eq('driver_id', driver.id)
      .in('status', ['ASSIGNED', 'IN_TRANSIT'])
      .order('dispatch_sequence', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    const rows = data || [];

    const orderIds = [...new Set(rows.map((r: any) => r.order_id).filter(Boolean))];
    const ordersById = new Map<string, any>();
    if (orderIds.length > 0) {
      const { data: orderRows } = await supabase
        .from('orders')
        .select('id, phone, total_amount, payment_mode, product_name, quantity, metadata')
        .in('id', orderIds);
      for (const o of orderRows || []) ordersById.set(o.id, o);
    }

    setStops(rows.map((row: any) => {
      const order = row.order_id ? ordersById.get(row.order_id) : null;
      const items = order?.metadata?.items;
      return {
        id: row.id,
        orderId: row.order_id,
        customerName: row.customer_name || 'Client',
        deliveryAddress: row.delivery_address || '',
        sequence: row.dispatch_sequence,
        status: row.status,
        phone: order?.phone || null,
        paymentMode: order?.payment_mode || null,
        totalAmount: typeof order?.total_amount === 'number' ? order.total_amount : null,
        items: Array.isArray(items) && items.length > 0
          ? items.map((i: any) => ({ productName: i.productName || '', quantity: i.quantity ?? null }))
          : (order?.product_name ? [{ productName: order.product_name, quantity: order.quantity ?? null }] : []),
      };
    }));
    setLoading(false);
  };

  useEffect(() => { loadStops(); }, [driver.id]);

  // The real "out for delivery" moment — not when a driver gets assigned,
  // but when they actually start the trip. Sharing live location is the
  // driver's own explicit signal that they're moving, so this is where
  // delivery_logs/orders flip from ASSIGNED to IN_TRANSIT/OUT_FOR_DELIVERY,
  // not at dispatch-assignment time.
  useEffect(() => {
    if (!gpsActive || !activeDeliveryId) return;
    const stop = stops.find(s => s.id === activeDeliveryId);
    if (!stop || stop.status !== 'ASSIGNED') return;
    const now = new Date().toISOString();
    (async () => {
      await supabase.from('delivery_logs').update({ status: 'IN_TRANSIT', updated_at: now }).eq('id', activeDeliveryId);
      if (stop.orderId) {
        await supabase.from('orders').update({ status: 'OUT_FOR_DELIVERY', updated_at: now }).eq('id', stop.orderId);
      }
      setStops(prev => prev.map(s => s.id === activeDeliveryId ? { ...s, status: 'IN_TRANSIT' } : s));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsActive, activeDeliveryId]);

  // Streams position while any stop is active — tags pings with the first
  // (current) stop so dispatch's map ties the trail to the right delivery.
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
    let cancelled = false;
    let lastPingAt = 0;
    (async () => {
      // This view renders outside CeoSettingsProvider (drivers aren't
      // logged into the main app shell), so the settings are read directly
      // rather than via useCeoSettings().
      const { data: rows } = await supabase.from('ceo_settings').select('setting_key, setting_value').in('setting_key', ['gps_tracking_enabled', 'gps_ping_interval']);
      const trackingEnabled = rows?.find(r => r.setting_key === 'gps_tracking_enabled')?.setting_value;
      const intervalMinutes = rows?.find(r => r.setting_key === 'gps_ping_interval')?.setting_value;
      if (cancelled) return;
      if (trackingEnabled === false) {
        setLocationError('GPS tracking is currently disabled by the CEO.');
        setGpsActive(false);
        return;
      }
      const throttleMs = typeof intervalMinutes === 'number' && intervalMinutes > 0 ? intervalMinutes * 60000 : 0;

      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          setLastLat(latitude);
          setLastLng(longitude);
          setLocationError(null);
          if (throttleMs > 0 && Date.now() - lastPingAt < throttleMs) return;
          lastPingAt = Date.now();
          const { error } = await supabase.from('driver_locations').insert({
            driver_id: driver.driverId,
            delivery_id: activeDeliveryId,
            latitude,
            longitude,
            accuracy: accuracy ?? null,
          });
          if (!error) setLastSyncedAt(new Date());
        },
        (err) => setLocationError(err.message || 'Unable to read location.'),
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 20000 }
      );
      watchIdRef.current = id;
    })();
    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [gpsActive, activeDeliveryId, driver.driverId]);

  const finishDelivery = async (stop: Stop) => {
    setMarkingStage('confirming');
    // Rendered outside CeoSettingsProvider (see the GPS effect above for
    // why) — read the flag directly, and check this specific row's own
    // proof_photo rather than trusting local state, since the photo may
    // have just been uploaded in this same action.
    const { data: gate } = await supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'proof_of_delivery_required').maybeSingle();
    if (gate?.setting_value === true) {
      const { data: row } = await supabase.from('delivery_logs').select('proof_photo').eq('id', stop.id).maybeSingle();
      if (!row?.proof_photo) {
        setMarkingId(null);
        setMarkingStage(null);
        setProofError('A proof-of-delivery photo is required by the CEO before this can be marked delivered.');
        return;
      }
    }
    const { error } = await supabase
      .from('delivery_logs')
      .update({ status: 'DELIVERED', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', stop.id);
    setMarkingId(null);
    setMarkingStage(null);
    if (error) {
      setProofError(`Failed to update delivery: ${error.message}`);
      return;
    }
    if (stop.orderId) {
      await supabase.from('orders').update({ status: 'DELIVERED', updated_at: new Date().toISOString() }).eq('id', stop.orderId);
    }
    setStops(prev => prev.filter(s => s.id !== stop.id));
  };

  // "Arrived" opens the camera first — proof-of-delivery at the point of
  // arrival, not an after-the-fact upload from a desk. Cancelling the
  // camera (no file picked) falls through to a plain delivery confirmation
  // so the driver never gets stuck; the setting above still enforces the
  // photo requirement server-side either way.
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
    const url = await uploadFile(file, 'delivery-proofs', stop.id);
    if (!url) { setMarkingId(null); setMarkingStage(null); setProofError('Photo upload failed.'); return; }
    const { error } = await supabase.from('delivery_logs').update({ proof_photo: url }).eq('id', stop.id);
    if (error) { setMarkingId(null); setMarkingStage(null); setProofError('Photo upload failed.'); return; }
    await finishDelivery(stop);
  };

  const skipPhoto = async (stop: Stop) => {
    setProofError(null);
    setMarkingId(stop.id);
    await finishDelivery(stop);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-page)] flex flex-col items-center">
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelected} style={{ display: 'none' }} />
      <div className="w-full max-w-xl flex flex-col min-h-screen sm:min-h-0 sm:my-8 sm:rounded-3xl sm:border sm:border-[var(--border)] sm:shadow-[var(--box-shadow)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <div>
            <p className="text-sm font-extrabold text-text-primary">{driver.fullName}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Dispatch Driver{driver.vehicleId ? ` • ${driver.vehicleId}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-500"
          >
            <LogOut className="w-4 h-4" />
          </button>
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
              <p className="text-xs text-text-muted">Checking for assignments...</p>
            ) : stops.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-text-muted mb-4">No route currently assigned. Dispatch will assign your next delivery.</p>
                <button
                  type="button"
                  onClick={loadStops}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Check for Assignment
                </button>
              </div>
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
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-3 rounded-xl bg-[var(--bg-page)] border border-[var(--border)]">
                  <p className="text-[9px] font-bold uppercase text-text-muted">Latitude</p>
                  <p className="text-sm font-bold text-text-primary mt-1 font-mono">{lastLat !== null ? lastLat.toFixed(5) : '—'}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-page)] border border-[var(--border)]">
                  <p className="text-[9px] font-bold uppercase text-text-muted">Longitude</p>
                  <p className="text-sm font-bold text-text-primary mt-1 font-mono">{lastLng !== null ? lastLng.toFixed(5) : '—'}</p>
                </div>
              </div>

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
