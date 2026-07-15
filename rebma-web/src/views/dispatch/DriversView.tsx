import { useState, useEffect } from 'react';
import { Search, Plus, ArrowLeft, X, Edit2, UserMinus, Truck, Trash2, Edit, Smartphone, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Driver, DeliveryRecord } from '../../types/erp';

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

const mapToUI = (db: any): Driver => ({
  id: db.id,
  driverId: db.driver_id || db.id || '',
  fullName: db.full_name || db.fullName || '',
  phone: db.phone || '',
  ghanaCard: db.ghana_card_id || db.ghanaCard || '',
  licenseNumber: db.license_number || db.licenseNumber || '',
  truckId: db.vehicle_id || db.truckId || '',
  status: db.status || 'OFFLINE',
  totalDeliveries: Number(db.total_deliveries || 0),
  joinedAt: db.created_at || db.joinedAt || '',
  userId: db.user_id || undefined,
});

const mapToDB = (ui: Partial<Driver>) => {
  const db: any = {};
  if (ui.id !== undefined) db.id = ui.id;
  if (ui.driverId !== undefined) db.driver_id = ui.driverId;
  if (ui.fullName !== undefined) db.full_name = ui.fullName;
  if (ui.phone !== undefined) db.phone = ui.phone;
  if (ui.ghanaCard !== undefined) db.ghana_card_id = ui.ghanaCard;
  if (ui.licenseNumber !== undefined) db.license_number = ui.licenseNumber;
  if (ui.truckId !== undefined) db.vehicle_id = ui.truckId;
  if (ui.status !== undefined) db.status = ui.status;
  return db;
};

interface DriverFormModalProps {
  title: string;
  form: Record<string, string>;
  submitting?: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (key: string, val: string) => void;
}
function DriverFormModal({ title, form, submitting, onClose, onSave, onChange }: DriverFormModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} disabled={submitting} style={{ background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
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
            <input
              value={form[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              disabled={submitting}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={onClose} disabled={submitting} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, opacity: submitting ? 0.6 : 1 }}>Cancel</button>
          <button onClick={onSave} disabled={submitting} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

interface InviteDriverModalProps {
  driver: Driver;
  onClose: () => void;
  onInvited: (userId: string) => void;
}
function InviteDriverModal({ driver, onClose, onInvited }: InviteDriverModalProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim()) { setError('Email is required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/register-driver-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverRowId: driver.id, email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create mobile account.');
      setResult({ email: json.email, password: json.password });
      onInvited(json.userId);
    } catch (e: any) {
      setError(e.message || 'Failed to create mobile account.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCreds = () => {
    navigator.clipboard.writeText(`Email: ${result?.email}\nPassword: ${result?.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} /> Invite to Mobile App
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {!result ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Creates a login for <strong>{driver.fullName}</strong> so they can sign in on the Rebma driver app and share live GPS during deliveries.
            </p>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Driver's Email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="driver@rebmaimpex.com"
              disabled={submitting}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
            />
            {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={onClose} disabled={submitting} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={submit} disabled={submitting} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Creating...' : 'Create Login'}</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>Account created. Share these credentials with the driver now — the password won't be shown again.</p>
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, fontFamily: 'monospace', fontSize: 13 }}>
              <p style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>Email: {result.email}</p>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>Password: {result.password}</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={copyCreds} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={onClose} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: 14 }}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DriversView({ addNotification }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Driver['status']>('ALL');
  const [profileDriver, setProfileDriver] = useState<Driver | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [inviteTarget, setInviteTarget] = useState<Driver | null>(null);
  const [history, setHistory] = useState<DeliveryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('drivers').select('*').order('full_name');
      if (!error && data) {
        setDrivers(data.map(mapToUI));
      } else {
        setDrivers([]);
      }
    } catch { setDrivers([]); }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!profileDriver) { setHistory([]); return; }
    let active = true;
    setHistoryLoading(true);
    supabase
      .from('delivery_logs')
      .select('*')
      .or(`driver_id.eq.${profileDriver.driverId},driver_name.eq.${profileDriver.fullName}`)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!active) return;
        setHistory((data ?? []).map((row: any): DeliveryRecord => ({
          id: row.id,
          orderId: row.order_id || '',
          clientName: row.customer_name || '',
          destination: row.delivery_address || '',
          driverName: row.driver_name || '',
          driverId: row.driver_id || '',
          dispatchedAt: row.created_at || '',
          deliveredAt: row.delivered_at || undefined,
          status: row.status || 'PENDING_ASSIGNMENT',
          vehicleId: row.vehicle_id || undefined,
        })));
        setHistoryLoading(false);
      }, () => { if (active) { setHistory([]); setHistoryLoading(false); } });
    return () => { active = false; };
  }, [profileDriver]);

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

  const openEdit = (d: Driver) => {
    setEditDriver(d);
    setForm({
      fullName: d.fullName,
      phone: d.phone,
      ghanaCard: d.ghanaCard,
      licenseNumber: d.licenseNumber,
      truckId: d.truckId
    });
  };

  const saveDriver = async () => {
    if (!form.fullName || !form.phone) {
      alert('Full Name and Phone are required.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editDriver) {
        const updatedDbRow = mapToDB(form);
        const { error } = await supabase.from('drivers').update(updatedDbRow).eq('id', editDriver.id);
        if (!error) {
          addNotification(`Driver ${form.fullName} updated.`);
          await loadData();
          setEditDriver(null);
          // If viewing profile of this driver, reload profile state too
          if (profileDriver?.id === editDriver.id) {
            setProfileDriver({ ...profileDriver, ...form });
          }
          setForm(emptyForm);
        } else {
          alert(error.message);
        }
      } else {
        const generatedId = `DRV-${String(drivers.length + 1).padStart(3, '0')}`;
        const newDbRow = mapToDB({
          driverId: generatedId,
          fullName: form.fullName,
          phone: form.phone,
          ghanaCard: form.ghanaCard,
          licenseNumber: form.licenseNumber,
          truckId: form.truckId,
          status: 'ACTIVE'
        });
        const { error } = await supabase.from('drivers').insert([newDbRow]);
        if (!error) {
          addNotification(`Driver ${form.fullName} added.`);
          await loadData();
          setShowAdd(false);
          setForm(emptyForm);
        } else {
          alert(error.message);
        }
      }
    } catch (e: any) {
      alert(e.message || 'Failed to save driver.');
    } finally {
      setSubmitting(false);
    }
  };

  const deactivate = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('drivers').update({ status: 'OFFLINE' }).eq('id', id);
      if (!error) {
        addNotification(`Driver deactivated.`);
        await loadData();
        if (profileDriver?.id === id) {
          setProfileDriver(p => p ? { ...p, status: 'OFFLINE' } : p);
        }
      } else {
        alert(error.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to deactivate driver.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (d: Driver) => {
    if (submitting) return;
    if (!await window.confirm(`Are you sure you want to delete driver ${d.fullName}?`)) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('drivers').delete().eq('id', d.id);
      if (!error) {
        addNotification(`Deleted driver ${d.fullName}`);
        await loadData();
        if (profileDriver?.id === d.id) {
          setProfileDriver(null);
        }
      } else {
        alert(error.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete driver.');
    } finally {
      setSubmitting(false);
    }
  };



  if (profileDriver) {
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
            {profileDriver.userId ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#d1fae5', color: '#065f46', borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                <Smartphone size={13} /> Mobile App Linked
              </span>
            ) : (
              <button onClick={() => setInviteTarget(profileDriver)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                <Smartphone size={14} /> Invite to Mobile App
              </button>
            )}
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
          {historyLoading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading delivery history...</p>
          ) : history.length === 0 ? (
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
        {inviteTarget && (
          <InviteDriverModal
            driver={inviteTarget}
            onClose={() => setInviteTarget(null)}
            onInvited={(userId) => {
              setProfileDriver(p => p ? { ...p, userId } : p);
              addNotification(`Mobile app login created for ${inviteTarget.fullName}.`);
              loadData();
            }}
          />
        )}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <Truck size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 15 }}>No drivers found</p>
        </div>
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
                  { label: 'Truck ID', value: d.truckId },
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
                {d.status !== 'OFFLINE' ? (
                  <button onClick={() => deactivate(d.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#ffe4e6', border: 'none', borderRadius: 10, padding: '8px', fontWeight: 600, fontSize: 13, color: '#9f1239', cursor: 'pointer' }}>
                    <UserMinus size={13} /> Deactivate
                  </button>
                ) : (
                  <button onClick={() => handleDelete(d)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '8px', fontWeight: 600, fontSize: 13, color: '#dc2626', cursor: 'pointer' }}>
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editDriver) && (
        <DriverFormModal
          title={editDriver ? 'Edit Driver' : 'Add Driver'}
          form={form as Record<string, string>}
          submitting={submitting}
          onClose={() => { setShowAdd(false); setEditDriver(null); setForm(emptyForm); }}
          onSave={saveDriver}
          onChange={(key, val) => setForm(p => ({ ...p, [key]: val }))}
        />
      )}
    </div>
  );
}
