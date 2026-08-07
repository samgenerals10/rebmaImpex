import { useState, useEffect } from 'react';
import { MapPin, Truck, Clock, Info, X, Phone, CreditCard, Package, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import DispatchMap, { type DispatchMapDelivery } from '../../components/dispatch/DispatchMap';

type DriverState = 'ON_THE_WAY' | 'AT_COMPANY' | 'RETURNING' | 'ASSIGNED';

interface VehicleRecord {
  id: string;
  driverId: string;
  driverName: string;
  truckId: string;
  status: 'IN_TRANSIT' | 'ACTIVE' | 'OFFLINE';
  driverState: DriverState;
  phone: string;
  ghanaCard: string;
  licenseNumber: string;
  photo?: string;
  lastKnownLocation: string;
  lastUpdated: string;
  lastDelivery?: { id: string; destination: string; status: string } | null;
}

const fmtAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
};

const stateConfig: Record<DriverState, { color: string; bg: string; label: string; pulse: boolean }> = {
  ASSIGNED: { color: '#8b5cf6', bg: '#ede9fe', label: 'Assigned — awaiting start', pulse: false },
  ON_THE_WAY: { color: '#3b82f6', bg: '#dbeafe', label: 'On the way', pulse: true },
  RETURNING: { color: '#f59e0b', bg: '#fef3c7', label: 'Returning to company', pulse: true },
  AT_COMPANY: { color: '#10b981', bg: '#d1fae5', label: 'At the company', pulse: false },
};

interface Props { addNotification: (msg: string) => void }

export default function TrackingView({ addNotification: _addNotification }: Props) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VehicleRecord | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('drivers')
          .select('id, driver_id, full_name, vehicle_id, status, phone, ghana_card_id, license_number, photo, returned_at')
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

          // Most recent delivery per driver decides "on the way" / "returning" /
          // "at the company" — there's no dedicated driver-location-state field,
          // so this infers it from what actually happened on their last job.
          const driverRowIds = data.map((d: any) => d.id).filter(Boolean);
          const { data: recentDeliveries } = await supabase
            .from('delivery_logs')
            .select('id, driver_id, delivery_address, status, created_at, delivered_at')
            .in('driver_id', driverRowIds)
            .order('created_at', { ascending: false })
            .limit(200);
          const lastDeliveryByDriverRow: Record<string, any> = {};
          for (const row of (recentDeliveries || []) as any[]) {
            if (!lastDeliveryByDriverRow[row.driver_id]) lastDeliveryByDriverRow[row.driver_id] = row;
          }

          setVehicles(data.map((d: any) => {
            const lastPing = lastPingByDriver[d.driver_id];
            const lastDelivery = lastDeliveryByDriverRow[d.id];
            let driverState: DriverState = 'AT_COMPANY';
            if (lastDelivery) {
              if (['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(lastDelivery.status)) driverState = 'ON_THE_WAY';
              else if (lastDelivery.status === 'ASSIGNED') driverState = 'ASSIGNED';
              else if (lastDelivery.status === 'DELIVERED') {
                const returnedAt = d.returned_at ? new Date(d.returned_at).getTime() : 0;
                const deliveredAt = lastDelivery.delivered_at ? new Date(lastDelivery.delivered_at).getTime() : 0;
                driverState = returnedAt > deliveredAt ? 'AT_COMPANY' : 'RETURNING';
              }
            }
            return {
              id: d.id,
              driverId: d.driver_id,
              driverName: d.full_name,
              truckId: d.vehicle_id || '—',
              status: d.status === 'ON_DELIVERY' ? 'IN_TRANSIT' : (d.status as VehicleRecord['status']),
              driverState,
              phone: d.phone || '—',
              ghanaCard: d.ghana_card_id || '—',
              licenseNumber: d.license_number || '—',
              photo: d.photo || undefined,
              lastKnownLocation: lastPing ? `Live GPS · updated ${fmtAgo(lastPing)}` : 'No GPS ping yet — driver hasn’t opened the mobile app during a delivery',
              lastUpdated: lastPing || new Date().toISOString(),
              lastDelivery: lastDelivery ? { id: lastDelivery.id, destination: lastDelivery.delivery_address || '—', status: lastDelivery.status } : null,
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
    driverState: v.driverState,
  }));

  const onTheWay = vehicles.filter(v => v.driverState === 'ON_THE_WAY').length;
  const assignedWaiting = vehicles.filter(v => v.driverState === 'ASSIGNED').length;
  const returning = vehicles.filter(v => v.driverState === 'RETURNING').length;
  const atCompany = vehicles.filter(v => v.driverState === 'AT_COMPANY').length;
  const lastUpdate = vehicles.filter(v => v.status !== 'OFFLINE').sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Live GPS Tracking</h1>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Real-time vehicle and driver location monitoring</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'On the Way', value: onTheWay, color: stateConfig.ON_THE_WAY.color, icon: <Truck size={18} /> },
          { label: 'Assigned — Awaiting Start', value: assignedWaiting, color: stateConfig.ASSIGNED.color, icon: <Clock size={18} /> },
          { label: 'Returning', value: returning, color: stateConfig.RETURNING.color, icon: <Navigation size={18} /> },
          { label: 'At the Company', value: atCompany, color: stateConfig.AT_COMPANY.color, icon: <MapPin size={18} /> },
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

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 12, marginBottom: 16, boxShadow: 'var(--box-shadow)' }}>
        <DispatchMap
          deliveries={mapDeliveries}
          height={640}
          showTrails
          onMarkerClick={(d) => { const v = vehicles.find(v => v.id === d.id); if (v) setSelected(v); }}
        />
      </div>

      {/* Legend for driver-state colors */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 24, padding: '0 4px' }}>
        {(Object.keys(stateConfig) as DriverState[]).map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: stateConfig[k].color }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stateConfig[k].label}</span>
          </div>
        ))}
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
            const cfg = stateConfig[v.driverState];
            return (
              <div key={v.id} onClick={() => setSelected(v)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', boxShadow: 'var(--box-shadow)', cursor: 'pointer' }}>
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
              A driver's color is inferred from their most recent delivery: violet once assigned but before they've started sharing location, blue once they actually start the trip, amber once it's marked delivered (heading back), green once they're idle with nothing pending.
            </p>
          </div>
        </div>
      </div>

      {/* Driver detail sheet — slides in from the right on marker/row click */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelected(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'relative', width: 'min(420px, 100%)', height: '100%', background: 'var(--bg-card)', boxShadow: '-8px 0 30px rgba(0,0,0,0.2)', overflowY: 'auto', animation: 'slideIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Driver Details</h3>
              <button onClick={() => setSelected(null)} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'var(--bg-input)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {selected.photo ? (
                  <img src={selected.photo} alt={selected.driverName} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }}>
                    {selected.driverName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>{selected.driverName}</p>
                  <span style={{ display: 'inline-block', marginTop: 4, background: stateConfig[selected.driverState].bg, color: stateConfig[selected.driverState].color, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                    {stateConfig[selected.driverState].label}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: <Truck size={14} />, label: 'Vehicle', value: selected.truckId },
                  { icon: <Phone size={14} />, label: 'Phone', value: selected.phone },
                  { icon: <CreditCard size={14} />, label: 'Ghana Card', value: selected.ghanaCard },
                  { icon: <CreditCard size={14} />, label: 'License Number', value: selected.licenseNumber },
                  { icon: <MapPin size={14} />, label: 'Location', value: selected.lastKnownLocation },
                  { icon: <Clock size={14} />, label: 'Last Update', value: fmtAgo(selected.lastUpdated) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{row.icon}</div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{row.label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selected.lastDelivery && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Most Recent Delivery</p>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Package size={14} style={{ color: 'var(--text-muted)', marginTop: 2 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{selected.lastDelivery.destination}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{selected.lastDelivery.status.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
