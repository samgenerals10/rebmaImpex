import { useState, useEffect } from 'react';
import { Search, Plus, ArrowLeft, X, Edit2, UserMinus, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Driver, DeliveryRecord } from '../../types/erp';

const MOCK_DRIVERS: Driver[] = [
  { id: 'DRV-001', fullName: 'Kwesi Asante', phone: '0244123456', ghanaCard: 'GHA-00001-1', licenseNumber: 'LIC-GH-001', truckId: 'GR-1234-22', status: 'ACTIVE', totalDeliveries: 142, joinedAt: '2022-03-15' },
  { id: 'DRV-002', fullName: 'Kofi Mensah', phone: '0277654321', ghanaCard: 'GHA-00002-2', licenseNumber: 'LIC-GH-002', truckId: 'GR-5678-22', status: 'ON_DELIVERY', totalDeliveries: 98, joinedAt: '2022-07-20' },
  { id: 'DRV-003', fullName: 'Ama Serwaa', phone: '0200987654', ghanaCard: 'GHA-00003-3', licenseNumber: 'LIC-GH-003', truckId: 'GR-9012-23', status: 'ACTIVE', totalDeliveries: 205, joinedAt: '2021-11-10' },
  { id: 'DRV-004', fullName: 'Kojo Boateng', phone: '0541234567', ghanaCard: 'GHA-00004-4', licenseNumber: 'LIC-GH-004', truckId: 'AS-3456-21', status: 'ON_DELIVERY', totalDeliveries: 77, joinedAt: '2023-01-05' },
  { id: 'DRV-005', fullName: 'Efua Turkson', phone: '0302456789', ghanaCard: 'GHA-00005-5', licenseNumber: 'LIC-GH-005', truckId: 'GR-2345-20', status: 'OFFLINE', totalDeliveries: 310, joinedAt: '2020-06-01' },
  { id: 'DRV-006', fullName: 'Yaw Darko', phone: '0501876543', ghanaCard: 'GHA-00006-6', licenseNumber: 'LIC-GH-006', truckId: 'BA-7890-22', status: 'ACTIVE', totalDeliveries: 61, joinedAt: '2023-08-18' },
];

const MOCK_HISTORY: Record<string, DeliveryRecord[]> = {
  'DRV-001': [
    { id: 'DEL-001', orderId: 'ORD-1001', clientName: 'Accra Traders Ltd', destination: '123 High St, Accra', driverName: 'Kwesi Asante', driverId: 'DRV-001', dispatchedAt: new Date(Date.now() - 3600000 * 2).toISOString(), status: 'IN_TRANSIT' },
    { id: 'DEL-009', orderId: 'ORD-1009', clientName: 'Atlantic Ventures', destination: 'Haatso, Accra', driverName: 'Kwesi Asante', driverId: 'DRV-001', dispatchedAt: new Date(Date.now() - 3600000 * 26).toISOString(), deliveredAt: new Date(Date.now() - 3600000 * 23).toISOString(), status: 'DELIVERED' },
    { id: 'DEL-015', orderId: 'ORD-1015', clientName: 'Nova Imports', destination: 'Tema Port', driverName: 'Kwesi Asante', driverId: 'DRV-001', dispatchedAt: new Date(Date.now() - 3600000 * 50).toISOString(), deliveredAt: new Date(Date.now() - 3600000 * 47).toISOString(), status: 'DELIVERED' },
  ],
};

const statusColors: Record<Driver['status'], { bg: string; color: string; label: string }> = {
  ACTIVE:      { bg: '#d1fae5', color: '#065f46', label: 'Active' },
  ON_DELIVERY: { bg: '#dbeafe', color: '#1d4ed8', label: 'On Delivery' },
  OFFLINE:     { bg: '#f1f5f9', color: '#475569', label: 'Offline' },
};

const avatarColors: Record<Driver['status'], string> = {
  ACTIVE: '#10b981', ON_DELIVERY: '#3b82f6', OFFLINE: '#94a3b8',
};

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

interface Props { addNotification: (msg: string) => void }

const emptyForm = { fullName: '', phone: '', ghanaCard: '', licenseNumber: '', truckId: '' };

export default function DriversView({ addNotification }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Driver['status']>('ALL');
  const [profileDriver, setProfileDriver] = useState<Driver | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('drivers').select('*').order('fullName');
        setDrivers(data && data.length > 0 ? data : MOCK_DRIVERS);
      } catch { setDrivers(MOCK_DRIVERS); }
      setLoading(false);
    };
    load();
  }, []);

  const total = drivers.length;
  const active = drivers.filter(d => d.status === 'ACTIVE').length;
  const onDelivery = drivers.filter(d => d.status === 'ON_DELIVERY').length;
  const offline = drivers.filter(d => d.status === 'OFFLINE').length;

  const filtered = drivers.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !search || d.fullName.toLowerCase().includes(q) || d.id.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openEdit = (d: Driver) => { setEditDriver(d); setForm({ fullName: d.fullName, phone: d.phone, ghanaCard: d.ghanaCard, licenseNumber: d.licenseNumber, truckId: d.truckId }); };

  const saveDriver = async () => {
    if (!form.fullName || !form.phone) return;
    if (editDriver) {
      const updated = { ...editDriver, ...form };
      setDrivers(prev => prev.map(d => d.id === editDriver.id ? updated : d));
      if (profileDriver?.id === editDriver.id) setProfileDriver(updated);
      try { await supabase.from('drivers').update(form).eq('id', editDriver.id); } catch {}
      addNotification(`Driver ${form.fullName} updated.`);
      setEditDriver(null);
    } else {
      const nd: Driver = { id: `DRV-${String(drivers.length + 1).padStart(3, '0')}`, ...form, status: 'ACTIVE', totalDeliveries: 0, joinedAt: new Date().toISOString().split('T')[0] };
      setDrivers(prev => [nd, ...prev]);
      try { await supabase.from('drivers').insert(nd); } catch {}
      addNotification(`Driver ${form.fullName} added.`);
      setShowAdd(false);
    }
    setForm(emptyForm);
  };

  const deactivate = async (id: string) => {
    setDrivers(prev => prev.map(d => d.id === id ? { ...d, status: 'OFFLINE' } : d));
    if (profileDriver?.id === id) setProfileDriver(p => p ? { ...p, status: 'OFFLINE' } : p);
    try { await supabase.from('drivers').update({ status: 'OFFLINE' }).eq('id', id); } catch {}
    addNotification(`Driver ${id} deactivated.`);
  };

  const DriverFormModal = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        {[
          { label: 'Full Name', key: 'fullName', placeholder: 'e.g. Kwesi Asante' },
          { label: 'Phone', key: 'phone', placeholder: '0244123456' },
          { label: 'Ghana Card #', key: 'ghanaCard', placeholder: 'GHA-00001-1' },
          { label: 'License Number', key: 'licenseNumber', placeholder: 'LIC-GH-001' },
          { label: 'Truck ID', key: 'truckId', placeholder: 'GR-1234-22' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>{f.label}</label>
            <input value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={saveDriver} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: 14 }}>Save</button>
        </div>
      </div>
    </div>
  );

  if (profileDriver) {
    const history = MOCK_HISTORY[profileDriver.id] ?? [];
    const onTime = history.length > 0 ? Math.round((history.filter(h => h.status === 'DELIVERED').length / history.length) * 100) : 0;
    return (
      <div style={{ padding: '24px 16px', maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => setProfileDriver(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={16} /> Back to Drivers
        </button>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, marginBottom: 24, boxShadow: 'var(--box-shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: avatarColors[profileDriver.status], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initials(profileDriver.fullName)}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{profileDriver.fullName}</h2>
              <p style={{ margin: '4px 0 8px', color: 'var(--text-muted)', fontSize: 13 }}>{profileDriver.id}</p>
              <span style={{ background: statusColors[profileDriver.status].bg, color: statusColors[profileDriver.status].color, borderRadius: 99, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>{statusColors[profileDriver.status].label}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {[
              { label: 'Phone', value: profileDriver.phone },
              { label: 'Ghana Card', value: profileDriver.ghanaCard },
              { label: 'License #', value: profileDriver.licenseNumber },
              { label: 'Truck ID', value: profileDriver.truckId },
              { label: 'Total Deliveries', value: String(profileDriver.totalDeliveries ?? 0) },
              { label: 'Joined', value: profileDriver.joinedAt ? fmt(profileDriver.joinedAt) : 'N/A' },
            ].map(f => (
              <div key={f.label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{f.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Deliveries', value: profileDriver.totalDeliveries ?? 0, color: 'var(--accent)' },
            { label: 'On-Time Rate', value: `${onTime}%`, color: '#10b981' },
            { label: 'Recent Jobs', value: history.length, color: '#3b82f6' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', boxShadow: 'var(--box-shadow)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{c.label}</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Delivery History</h3>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No delivery history available.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Order ID', 'Client', 'Destination', 'Dispatched', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{r.orderId}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.clientName}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.destination}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 13 }}>{fmt(r.dispatchedAt)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: r.status === 'DELIVERED' ? '#d1fae5' : r.status === 'IN_TRANSIT' ? '#dbeafe' : '#ffe4e6', color: r.status === 'DELIVERED' ? '#065f46' : r.status === 'IN_TRANSIT' ? '#1d4ed8' : '#9f1239', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{r.status.replace('_', ' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Driver Database</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Manage all registered drivers</p>
        </div>
        <button onClick={() => { setShowAdd(true); setForm(emptyForm); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <Plus size={16} /> Add Driver
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Drivers', value: total, color: 'var(--accent)' },
          { label: 'Active', value: active, color: '#10b981' },
          { label: 'On Delivery', value: onDelivery, color: '#3b82f6' },
          { label: 'Offline', value: offline, color: '#94a3b8' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', boxShadow: 'var(--box-shadow)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, boxShadow: 'var(--box-shadow)' }}>
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID..." style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={{ flex: '0 0 160px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_DELIVERY">On Delivery</option>
          <option value="OFFLINE">Offline</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading drivers...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(d => (
            <div key={d.id} onClick={() => setProfileDriver(d)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px', cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: 'var(--box-shadow)' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--box-shadow)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColors[d.status], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {initials(d.fullName)}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{d.fullName}</p>
                  <p style={{ margin: '2px 0 6px', color: 'var(--text-muted)', fontSize: 12 }}>{d.id}</p>
                  <span style={{ background: statusColors[d.status].bg, color: statusColors[d.status].color, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{statusColors[d.status].label}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Truck', value: d.truckId },
                  { label: 'Phone', value: d.phone },
                  { label: 'License', value: d.licenseNumber },
                  { label: 'Deliveries', value: String(d.totalDeliveries ?? 0) },
                ].map(f => (
                  <div key={f.label}>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{f.value}</p>
                  </div>
                ))}
              </div>
              {d.joinedAt && <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>Joined {fmt(d.joinedAt)}</p>}
              <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => openEdit(d)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Edit2 size={13} /> Edit
                </button>
                {d.status !== 'OFFLINE' && (
                  <button onClick={() => deactivate(d.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#ffe4e6', border: 'none', borderRadius: 10, padding: '8px', fontWeight: 600, fontSize: 13, color: '#9f1239', cursor: 'pointer' }}>
                    <UserMinus size={13} /> Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editDriver) && (
        <DriverFormModal title={editDriver ? 'Edit Driver' : 'Add Driver'} onClose={() => { setShowAdd(false); setEditDriver(null); setForm(emptyForm); }} />
      )}
    </div>
  );
}
