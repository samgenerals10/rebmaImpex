import { MapPin, Wifi, WifiOff, Truck, Clock, Info } from 'lucide-react';

interface VehicleRecord {
  id: string;
  driverName: string;
  truckId: string;
  status: 'IN_TRANSIT' | 'ACTIVE' | 'OFFLINE';
  lastKnownLocation: string;
  lastUpdated: string;
}

const MOCK_VEHICLES: VehicleRecord[] = [
  { id: 'V-001', driverName: 'Kwesi Asante', truckId: 'GR-1234-22', status: 'IN_TRANSIT', lastKnownLocation: 'Accra-Tema Motorway, near Tetteh Quarshie', lastUpdated: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 'V-002', driverName: 'Kofi Mensah', truckId: 'GR-5678-22', status: 'IN_TRANSIT', lastKnownLocation: 'Liberation Road, near Kwame Nkrumah Circle', lastUpdated: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: 'V-003', driverName: 'Ama Serwaa', truckId: 'GR-9012-23', status: 'ACTIVE', lastKnownLocation: 'REBMA Impex Warehouse, Spintex Road', lastUpdated: new Date(Date.now() - 2 * 60000).toISOString() },
  { id: 'V-004', driverName: 'Efua Turkson', truckId: 'GR-2345-20', status: 'OFFLINE', lastKnownLocation: 'Depot, Tema Community 2', lastUpdated: new Date(Date.now() - 3600000 * 4).toISOString() },
];

const fmtAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
};

const statusConfig = { IN_TRANSIT: { color: '#3b82f6', bg: '#dbeafe', label: 'In Transit', pulse: true }, ACTIVE: { color: '#10b981', bg: '#d1fae5', label: 'Active', pulse: false }, OFFLINE: { color: '#94a3b8', bg: '#f1f5f9', label: 'Offline', pulse: false } };

interface Props { addNotification: (msg: string) => void }

export default function TrackingView({ addNotification: _addNotification }: Props) {
  const active = MOCK_VEHICLES.filter(v => v.status !== 'OFFLINE').length;
  const inTransit = MOCK_VEHICLES.filter(v => v.status === 'IN_TRANSIT').length;
  const lastUpdate = MOCK_VEHICLES.filter(v => v.status !== 'OFFLINE').sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];

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

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 0, marginBottom: 24, overflow: 'hidden', boxShadow: 'var(--box-shadow)' }}>
        <div style={{ height: 320, background: 'linear-gradient(135deg, var(--accent-light) 0%, var(--bg) 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'repeating-linear-gradient(0deg, currentColor 0, currentColor 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, currentColor 0, currentColor 1px, transparent 1px, transparent 40px)', color: 'var(--text-primary)' }} />
          <div style={{ background: 'var(--bg-card)', borderRadius: '50%', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <MapPin size={36} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>GPS Map View</h3>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>Connect GPS module to enable live tracking</p>
          <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
            {[0.15, 0.3, 0.5].map((op, i) => (
              <div key={i} style={{ position: 'absolute', width: 60 + i * 30, height: 60 + i * 30, borderRadius: '50%', border: '2px solid var(--accent)', opacity: op, bottom: -20 - i * 15, right: -20 - i * 15 }} />
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <WifiOff size={16} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>GPS Module Status: Configuration Required</span>
          <span style={{ marginLeft: 'auto', background: '#fef3c7', color: '#92400e', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>PENDING SETUP</span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>Active Vehicles</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MOCK_VEHICLES.map(v => {
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
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', boxShadow: 'var(--box-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Info size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>GPS Hardware Integration</p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
              To enable live GPS tracking, install a compatible OBD-II GPS tracker (e.g. Concox GT06E or Teltonika FMB920) on each vehicle.
              Configure the device to push coordinates to the REBMA Impex tracking API endpoint. Once connected, real-time map view, geofencing alerts, and route history will be available here.
              Contact your system administrator to complete the hardware setup and API key provisioning.
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
