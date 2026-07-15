import { useState, useEffect } from 'react';
import { MapPin, Truck, Clock, Info } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import DispatchMap, { type DispatchMapDelivery } from '../../components/dispatch/DispatchMap';

interface VehicleRecord {
  id: string;
  driverId: string;
  driverName: string;
  truckId: string;
  status: 'IN_TRANSIT' | 'ACTIVE' | 'OFFLINE';
  lastKnownLocation: string;
  lastUpdated: string;
}

const fmtAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
};

const statusConfig = { IN_TRANSIT: { color: '#3b82f6', bg: '#dbeafe', label: 'In Transit', pulse: true }, ACTIVE: { color: '#10b981', bg: '#d1fae5', label: 'Active', pulse: false }, OFFLINE: { color: '#94a3b8', bg: '#f1f5f9', label: 'Offline', pulse: false } };

interface Props { addNotification: (msg: string) => void }

export default function TrackingView({ addNotification: _addNotification }: Props) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('drivers')
          .select('id, driver_id, full_name, vehicle_id, status')
          .neq('status', 'OFFLINE');
        if (data && data.length > 0) {
          const driverIds = data.map((d: any) => d.driver_id).filter(Boolean);
          const { data: pings } = await supabase
            .from('driver_locations')
            .select('driver_id, recorded_at')
            .in('driver_id', driverIds)
            .order('recorded_at', { ascending: false })
            .limit(200);
          const lastPingByDriver: Record<string, string> = {};
          for (const p of (pings || []) as any[]) {
            if (!lastPingByDriver[p.driver_id]) lastPingByDriver[p.driver_id] = p.recorded_at;
          }
          setVehicles(data.map((d: any) => {
            const lastPing = lastPingByDriver[d.driver_id];
            return {
              id: d.id,
              driverId: d.driver_id,
              driverName: d.full_name,
              truckId: d.vehicle_id || '—',
              status: d.status === 'ON_DELIVERY' ? 'IN_TRANSIT' : (d.status as VehicleRecord['status']),
              lastKnownLocation: lastPing ? `Live GPS · updated ${fmtAgo(lastPing)}` : 'No GPS ping yet — driver hasn’t opened the mobile app during a delivery',
              lastUpdated: lastPing || new Date().toISOString(),
            };
          }));
        } else {
          setVehicles([]);
        }
      } catch {
        setVehicles([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const mapDeliveries: DispatchMapDelivery[] = vehicles.map(v => ({
    id: v.id,
    driverId: v.driverId,
    driverName: v.driverName,
    vehicleId: v.truckId,
    status: v.status === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'ASSIGNED',
  }));

  const active = vehicles.filter(v => v.status !== 'OFFLINE').length;
  const inTransit = vehicles.filter(v => v.status === 'IN_TRANSIT').length;
  const lastUpdate = vehicles.filter(v => v.status !== 'OFFLINE').sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Live GPS Tracking</h1>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Real-time vehicle and driver location monitoring</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Active Vehicles', value: active, color: '#10b981', icon: <Truck size={18} /> },
          { label: 'In Transit', value: inTransit, color: '#3b82f6', icon: <MapPin size={18} /> },
          { label: 'Last Update', value: lastUpdate ? fmtAgo(lastUpdate.lastUpdated) : 'N/A', color: 'var(--accent)', icon: <Clock size={18} /> },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', boxShadow: 'var(--box-shadow)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>
              {c.icon}
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 12, marginBottom: 24, boxShadow: 'var(--box-shadow)' }}>
        <DispatchMap deliveries={mapDeliveries} height={360} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>Active Vehicles</h2>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
          </div>
        ) : vehicles.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <Truck size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 14 }}>No active vehicles found</p>
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {vehicles.map(v => {
            const cfg = statusConfig[v.status];
            return (
              <div key={v.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', boxShadow: 'var(--box-shadow)' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: cfg.color }}>
                    {cfg.pulse && (
                      <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `2px solid ${cfg.color}`, opacity: 0.4, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                    )}
                  </div>
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{v.driverName}</p>
                    <span style={{ background: '#f1f5f9', color: 'var(--text-secondary)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{v.truckId}</span>
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{cfg.label}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {v.lastKnownLocation}
                  </p>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={12} /> {fmtAgo(v.lastUpdated)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', boxShadow: 'var(--box-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Info size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>How live tracking works</p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
              Drivers with a mobile app login share their phone's real GPS position while a delivery is active and the app is open.
              Invite a driver from the Drivers screen to give them access. Positions update on this map as soon as they come in — no hardware tracker required.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}
