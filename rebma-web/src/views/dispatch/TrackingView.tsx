import { useState } from 'react';
import { MapPin, Truck, Clock, Info, Phone, CreditCard, Package, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import DispatchMap, { type DispatchMapDelivery } from '../../components/dispatch/DispatchMap';
import { useFleetVehicles, vehiclesToMapDeliveries, type DriverState, type VehicleRecord } from '../../components/dispatch/useFleetVehicles';
import { FLEET_STATE_STYLE } from '../../utils/fleetState';
import SidePanel from '../../components/ui/SidePanel';

const fmtAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
};

// Colours and words from the one shared rule (utils/fleetState.ts), so this
// page, the CEO map and the phone map all agree.
const stateConfig: Record<DriverState, { color: string; bg: string; label: string }> = Object.fromEntries(
  (Object.keys(FLEET_STATE_STYLE) as DriverState[]).map(k => [k, { color: FLEET_STATE_STYLE[k].color, bg: `${FLEET_STATE_STYLE[k].color}1f`, label: FLEET_STATE_STYLE[k].label }])
) as Record<DriverState, { color: string; bg: string; label: string }>;

interface Props { addNotification: (msg: string) => void }

export default function TrackingView({ addNotification: _addNotification }: Props) {
  const { vehicles, loading } = useFleetVehicles();
  const [selected, setSelected] = useState<VehicleRecord | null>(null);

  const locationText = (v: VehicleRecord) => v.lastPingAt
    ? `Live GPS · updated ${fmtAgo(v.lastPingAt)}`
    : 'No GPS ping yet, driver hasn’t opened the mobile app during a delivery';

  const mapDeliveries: DispatchMapDelivery[] = vehiclesToMapDeliveries(vehicles);

  const countOf = (k: DriverState) => vehicles.filter(v => v.driverState === k).length;
  const lastUpdate = vehicles.filter(v => v.status !== 'OFFLINE').sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Track Fleet Live. <span style={{ color: 'var(--accent)' }}>Deliver With Confidence.</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '6px 0 0', fontSize: 14 }}>Real-time vehicle and driver location monitoring with live waypoint intelligence</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: FLEET_STATE_STYLE.AT_COMPANY.count, value: countOf('AT_COMPANY'), color: stateConfig.AT_COMPANY.color, icon: <MapPin size={18} /> },
          { label: FLEET_STATE_STYLE.ASSIGNED.count, value: countOf('ASSIGNED'), color: stateConfig.ASSIGNED.color, icon: <Clock size={18} /> },
          { label: FLEET_STATE_STYLE.ON_TRIP.count, value: countOf('ON_TRIP'), color: stateConfig.ON_TRIP.color, icon: <Truck size={18} /> },
          { label: FLEET_STATE_STYLE.NEXT_TRIP.count, value: countOf('NEXT_TRIP'), color: stateConfig.NEXT_TRIP.color, icon: <Package size={18} /> },
          { label: FLEET_STATE_STYLE.RETURNING.count, value: countOf('RETURNING'), color: stateConfig.RETURNING.color, icon: <Navigation size={18} /> },
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
                    {['ON_TRIP', 'NEXT_TRIP', 'RETURNING'].includes(v.driverState) && (
                      <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `2px solid ${cfg.color}`, opacity: 0.4, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                    )}
                  </div>
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{v.driverName}</p>
                    <span style={{ background: '#f1f5f9', color: 'var(--text-secondary)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{v.truckId}</span>
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{cfg.label}</span>
                    {v.stopsTotal > 1 && v.driverState !== 'AT_COMPANY' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                        {v.driverState === 'RETURNING' ? `${v.stopsDone} of ${v.stopsTotal} stops done` : `Stop ${Math.min(v.stopsDone + 1, v.stopsTotal)} of ${v.stopsTotal}`}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {locationText(v)}
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
              Invite a driver from the Drivers screen to give them access. Positions update on this map as soon as they come in, no hardware tracker required.
              A driver's color is inferred from their most recent delivery: violet once assigned but before they've started sharing location, blue once they actually start the trip, amber once it's marked delivered (heading back), green once they're idle with nothing pending.
            </p>
          </div>
        </div>
      </div>

      {/* Driver detail sheet — slides in from the right on marker/row click */}
      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Driver Details"
      >
        {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                  { icon: <MapPin size={14} />, label: 'Location', value: locationText(selected) },
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
        )}
      </SidePanel>

      <style>{`
        @keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}
