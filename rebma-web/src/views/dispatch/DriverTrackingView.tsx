import { useState, useEffect, useRef } from 'react';
import { LogOut, MapPin, Navigation, Package, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface DriverTrackingViewProps {
  driver: { id: string; driverId: string; fullName: string; vehicleId: string | null };
  onLogout: () => void;
}

interface ActiveDelivery {
  id: string;
  orderId: string | null;
  customerName: string;
  deliveryAddress: string;
  status: string;
}

export default function DriverTrackingView({ driver, onLogout }: DriverTrackingViewProps) {
  const [delivery, setDelivery] = useState<ActiveDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [lastLat, setLastLat] = useState<number | null>(null);
  const [lastLng, setLastLng] = useState<number | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const loadActiveDelivery = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('delivery_logs')
      .select('id, order_id, customer_name, delivery_address, status')
      .eq('driver_id', driver.id)
      .in('status', ['ASSIGNED', 'IN_TRANSIT'])
      .order('created_at', { ascending: false })
      .limit(1);
    const row = data?.[0];
    setDelivery(row ? {
      id: row.id,
      orderId: row.order_id,
      customerName: row.customer_name || 'Client',
      deliveryAddress: row.delivery_address || '',
      status: row.status,
    } : null);
    setLoading(false);
  };

  useEffect(() => { loadActiveDelivery(); }, [driver.id]);

  useEffect(() => {
    if (!gpsActive || !delivery) {
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
        setLastLat(latitude);
        setLastLng(longitude);
        setLocationError(null);
        const { error } = await supabase.from('driver_locations').insert({
          driver_id: driver.driverId,
          delivery_id: delivery.id,
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
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [gpsActive, delivery, driver.driverId]);

  const handleMarkDelivered = async () => {
    if (!delivery) return;
    setMarking(true);
    const { error } = await supabase
      .from('delivery_logs')
      .update({ status: 'DELIVERED', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', delivery.id);
    setMarking(false);
    if (error) {
      alert(`Failed to update delivery: ${error.message}`);
      return;
    }
    if (delivery.orderId) {
      await supabase.from('orders').update({ status: 'DELIVERED', updated_at: new Date().toISOString() }).eq('id', delivery.orderId);
    }
    setGpsActive(false);
    setDelivery(null);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-page)] flex flex-col items-center">
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
          <p className="text-xs font-extrabold text-text-primary mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Active Route Assignment
          </p>

          {loading ? (
            <p className="text-xs text-text-muted">Checking for assignments...</p>
          ) : !delivery ? (
            <div className="text-center py-6">
              <p className="text-xs text-text-muted mb-4">No route currently assigned. Dispatch will assign your next delivery.</p>
              <button
                type="button"
                onClick={loadActiveDelivery}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Check for Assignment
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-[var(--bg-page)] border border-[var(--border)]">
                <p className="text-xs font-bold text-text-primary">Order Ref: {delivery.orderId || delivery.id}</p>
                <p className="text-[11px] text-text-muted mt-1">Client: {delivery.customerName}</p>
                {delivery.deliveryAddress && (
                  <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" /> {delivery.deliveryAddress}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
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
              <p className="text-[10px] text-text-muted text-center -mt-2">Keep this page open while tracking is on — location only updates while the browser tab is active.</p>
              {locationError && <p className="text-[10px] text-rose-500 text-center">{locationError}</p>}

              <button
                type="button"
                onClick={handleMarkDelivered}
                disabled={marking}
                className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold disabled:opacity-50"
              >
                {marking ? 'Updating...' : 'Mark Order as Delivered'}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
