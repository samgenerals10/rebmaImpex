import { useState, useEffect } from 'react';
import { Truck, CheckCircle, XCircle, Plus, Search, Eye, X, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { DeliveryRecord, Driver } from '../../types/erp';

const MOCK_DRIVERS: Driver[] = [
  { id: 'DRV-001', fullName: 'Kwesi Asante', phone: '0244123456', ghanaCard: 'GHA-00001-1', licenseNumber: 'LIC-001', truckId: 'GR-1234-22', status: 'ACTIVE' },
  { id: 'DRV-002', fullName: 'Kofi Mensah', phone: '0277654321', ghanaCard: 'GHA-00002-2', licenseNumber: 'LIC-002', truckId: 'GR-5678-22', status: 'ON_DELIVERY' },
  { id: 'DRV-003', fullName: 'Ama Serwaa', phone: '0200987654', ghanaCard: 'GHA-00003-3', licenseNumber: 'LIC-003', truckId: 'GR-9012-23', status: 'ACTIVE' },
  { id: 'DRV-004', fullName: 'Kojo Boateng', phone: '0541234567', ghanaCard: 'GHA-00004-4', licenseNumber: 'LIC-004', truckId: 'AS-3456-21', status: 'ON_DELIVERY' },
];

const MOCK_DELIVERIES: DeliveryRecord[] = [
  { id: 'DEL-001', orderId: 'ORD-1001', clientName: 'Accra Traders Ltd', destination: '123 High Street, Accra', driverName: 'Kwesi Asante', driverId: 'DRV-001', dispatchedAt: new Date(Date.now() - 3600000 * 2).toISOString(), status: 'IN_TRANSIT' },
  { id: 'DEL-002', orderId: 'ORD-1002', clientName: 'Gulf Imports Co.', destination: '45 Liberation Rd, Accra', driverName: 'Kofi Mensah', driverId: 'DRV-002', dispatchedAt: new Date(Date.now() - 3600000 * 5).toISOString(), deliveredAt: new Date(Date.now() - 3600000 * 2).toISOString(), status: 'DELIVERED' },
  { id: 'DEL-003', orderId: 'ORD-1003', clientName: 'Kama Industries', destination: 'Plot 7, Spintex Road', driverName: 'Ama Serwaa', driverId: 'DRV-003', dispatchedAt: new Date(Date.now() - 3600000 * 4).toISOString(), status: 'IN_TRANSIT' },
  { id: 'DEL-004', orderId: 'ORD-1004', clientName: 'Prime Suppliers', destination: 'Ring Road East, Accra', driverName: 'Kojo Boateng', driverId: 'DRV-004', dispatchedAt: new Date(Date.now() - 3600000 * 7).toISOString(), status: 'FAILED' },
  { id: 'DEL-005', orderId: 'ORD-1005', clientName: 'Delta Logistics', destination: 'Tema Community 1', driverName: 'Kwesi Asante', driverId: 'DRV-001', dispatchedAt: new Date(Date.now() - 3600000 * 1).toISOString(), status: 'IN_TRANSIT' },
  { id: 'DEL-006', orderId: 'ORD-1006', clientName: 'Sunrise Exports', destination: 'Adabraka, Accra', driverName: 'Kofi Mensah', driverId: 'DRV-002', dispatchedAt: new Date(Date.now() - 86400000).toISOString(), deliveredAt: new Date(Date.now() - 82800000).toISOString(), status: 'DELIVERED' },
  { id: 'DEL-007', orderId: 'ORD-1007', clientName: 'Horizon Trading', destination: 'Lashibi, Tema', driverName: 'Ama Serwaa', driverId: 'DRV-003', dispatchedAt: new Date(Date.now() - 3600000 * 6).toISOString(), deliveredAt: new Date(Date.now() - 3600000 * 3).toISOString(), status: 'DELIVERED' },
  { id: 'DEL-008', orderId: 'ORD-1008', clientName: 'Gold Coast Merchants', destination: 'OSU, Accra', driverName: 'Kojo Boateng', driverId: 'DRV-004', dispatchedAt: new Date(Date.now() - 3600000 * 9).toISOString(), status: 'FAILED' },
  { id: 'DEL-009', orderId: 'ORD-1009', clientName: 'Atlantic Ventures', destination: 'Haatso, Accra', driverName: 'Kwesi Asante', driverId: 'DRV-001', dispatchedAt: new Date(Date.now() - 1800000).toISOString(), status: 'IN_TRANSIT' },
  { id: 'DEL-010', orderId: 'ORD-1010', clientName: 'Pacific Imports', destination: 'East Legon, Accra', driverName: 'Ama Serwaa', driverId: 'DRV-003', dispatchedAt: new Date(Date.now() - 3600000 * 3).toISOString(), deliveredAt: new Date(Date.now() - 3600000).toISOString(), status: 'DELIVERED' },
];

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

interface Props { addNotification: (msg: string) => void }

export default function DeliveriesView({ addNotification }: Props) {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED'>('ALL');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [detailRecord, setDetailRecord] = useState<DeliveryRecord | null>(null);
  const [form, setForm] = useState({ clientName: '', orderId: '', destination: '', driverId: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('deliveries').select('*').order('dispatchedAt', { ascending: false }).limit(100);
        setDeliveries(data && data.length > 0 ? data : MOCK_DELIVERIES);
      } catch { setDeliveries(MOCK_DELIVERIES); }
      try {
        const { data } = await supabase.from('drivers').select('*');
        if (data && data.length > 0) setDrivers(data);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const todayStr = new Date().toDateString();
  const total = deliveries.length;
  const inTransit = deliveries.filter(d => d.status === 'IN_TRANSIT').length;
  const deliveredToday = deliveries.filter(d => d.status === 'DELIVERED' && d.deliveredAt && new Date(d.deliveredAt).toDateString() === todayStr).length;
  const failed = deliveries.filter(d => d.status === 'FAILED').length;

  const filtered = deliveries.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !search || d.clientName.toLowerCase().includes(q) || d.orderId.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const matchDriver = !driverFilter || d.driverId === driverFilter;
    const matchDate = !dateFilter || d.dispatchedAt.startsWith(dateFilter);
    return matchSearch && matchStatus && matchDriver && matchDate;
  });

  const markDelivered = async (id: string) => {
    const now = new Date().toISOString();
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 'DELIVERED', deliveredAt: now } : d));
    try { await supabase.from('deliveries').update({ status: 'DELIVERED', deliveredAt: now }).eq('id', id); } catch {}
    addNotification(`Delivery ${id} marked as delivered.`);
    if (detailRecord?.id === id) setDetailRecord(prev => prev ? { ...prev, status: 'DELIVERED', deliveredAt: now } : prev);
  };

  const createDelivery = () => {
    if (!form.clientName || !form.orderId || !form.destination || !form.driverId) return;
    const driver = drivers.find(d => d.id === form.driverId);
    const rec: DeliveryRecord = {
      id: `DEL-${String(deliveries.length + 1).padStart(3, '0')}`,
      orderId: form.orderId,
      clientName: form.clientName,
      destination: form.destination,
      driverName: driver?.fullName ?? '',
      driverId: form.driverId,
      dispatchedAt: new Date().toISOString(),
      status: 'IN_TRANSIT',
    };
    setDeliveries(prev => [rec, ...prev]);
    supabase.from('deliveries').insert(rec).then(() => {}, () => {});
    addNotification(`New delivery ${rec.id} dispatched.`);
    setShowNew(false);
    setForm({ clientName: '', orderId: '', destination: '', driverId: '' });
  };

  const StatusIcon = ({ status }: { status: DeliveryRecord['status'] }) => {
    if (status === 'IN_TRANSIT') return <Truck size={22} style={{ color: '#3b82f6' }} />;
    if (status === 'DELIVERED') return <CheckCircle size={22} style={{ color: '#10b981' }} />;
    return <XCircle size={22} style={{ color: '#f43f5e' }} />;
  };

  const StatusBadge = ({ status }: { status: DeliveryRecord['status'] }) => {
    const map = { IN_TRANSIT: { bg: '#dbeafe', color: '#1d4ed8', label: 'In Transit' }, DELIVERED: { bg: '#d1fae5', color: '#065f46', label: 'Delivered' }, FAILED: { bg: '#ffe4e6', color: '#9f1239', label: 'Failed' } };
    const s = map[status];
    return <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
  };

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Delivery Job Board</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Track and manage all delivery jobs</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <Plus size={16} /> New Delivery
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Deliveries', value: total, color: 'var(--accent)' },
          { label: 'In Transit', value: inTransit, color: '#3b82f6' },
          { label: 'Delivered Today', value: deliveredToday, color: '#10b981' },
          { label: 'Failed', value: failed, color: '#f43f5e' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client or order ID..." style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' }}>
          <option value="ALL">All Status</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="DELIVERED">Delivered</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} style={{ flex: '0 0 160px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' }}>
          <option value="">All Drivers</option>
          {drivers.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ flex: '0 0 160px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading deliveries...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No deliveries found.</div>}
          {filtered.map(d => (
            <div key={d.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', boxShadow: 'var(--box-shadow)' }}>
              <div style={{ flexShrink: 0 }}>
                <StatusIcon status={d.status} />
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{d.clientName}</p>
                <p style={{ margin: '2px 0', color: 'var(--text-secondary)', fontSize: 13 }}>{d.orderId} · {d.destination}</p>
                <p style={{ margin: '2px 0', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {d.driverName} · Dispatched {fmt(d.dispatchedAt)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <StatusBadge status={d.status} />
                {d.status === 'IN_TRANSIT' && (
                  <button onClick={() => markDelivered(d.id)} style={{ background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Mark Delivered</button>
                )}
                <button onClick={() => setDetailRecord(d)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                  <Eye size={14} /> Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>New Delivery</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            {[
              { label: 'Client Name', key: 'clientName', placeholder: 'e.g. Accra Traders Ltd' },
              { label: 'Order ID', key: 'orderId', placeholder: 'e.g. ORD-1011' },
              { label: 'Destination', key: 'destination', placeholder: 'Full delivery address' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{f.label}</label>
                <input value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Driver</label>
              <select value={form.driverId} onChange={e => setForm(p => ({ ...p, driverId: e.target.value }))} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14 }}>
                <option value="">Select a driver...</option>
                {drivers.filter(d => d.status !== 'OFFLINE').map(d => <option key={d.id} value={d.id}>{d.fullName} ({d.truckId})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={createDelivery} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: 14 }}>Dispatch</button>
            </div>
          </div>
        </div>
      )}

      {detailRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{detailRecord.orderId}</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Delivery Details</p>
              </div>
              <button onClick={() => setDetailRecord(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Client', value: detailRecord.clientName },
                { label: 'Destination', value: detailRecord.destination },
                { label: 'Driver', value: detailRecord.driverName },
                { label: 'Driver ID', value: detailRecord.driverId },
                { label: 'Status', value: detailRecord.status.replace('_', ' ') },
                { label: 'Delivery ID', value: detailRecord.id },
              ].map(f => (
                <div key={f.label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</p>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{f.value}</p>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Delivery Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Dispatched</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{fmt(detailRecord.dispatchedAt)}</p>
                  </div>
                </div>
                {detailRecord.deliveredAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Delivered</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{fmt(detailRecord.deliveredAt)}</p>
                    </div>
                  </div>
                )}
                {detailRecord.status === 'FAILED' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f43f5e', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f43f5e' }}>Delivery Failed</p>
                    </div>
                  </div>
                )}
                {detailRecord.status === 'IN_TRANSIT' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, animation: 'pulse 2s infinite' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>In Transit...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {detailRecord.status === 'IN_TRANSIT' && (
                <button onClick={() => markDelivered(detailRecord.id)} style={{ flex: 1, background: '#10b981', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: 14 }}>Mark Delivered</button>
              )}
              <button onClick={() => setDetailRecord(null)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
