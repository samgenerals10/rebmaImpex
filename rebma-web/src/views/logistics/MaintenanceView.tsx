import React, { useState, useEffect } from 'react';
import { Plus, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabaseClient';

interface MaintenanceRecord {
  id: string;
  date: string;
  vehicleId: string;
  type: 'Service' | 'Repair' | 'Inspection';
  description: string;
  cost: number;
  status: 'Scheduled' | 'In Progress' | 'Completed';
  mechanic: string;
}

const MOCK_RECORDS: MaintenanceRecord[] = [
  { id: '1', date: '2026-06-15', vehicleId: 'GR-1234-22', type: 'Service', description: 'Oil change and filter replacement', cost: 350, status: 'Scheduled', mechanic: 'Joe Mechanics' },
  { id: '2', date: '2026-06-14', vehicleId: 'GR-5678-21', type: 'Repair', description: 'Brake pad replacement — front axle', cost: 820, status: 'In Progress', mechanic: 'Kwadwo Auto' },
  { id: '3', date: '2026-06-13', vehicleId: 'GR-9012-20', type: 'Inspection', description: 'Annual roadworthiness inspection', cost: 200, status: 'Scheduled', mechanic: 'DVLA Accra' },
  { id: '4', date: '2026-06-10', vehicleId: 'GR-3456-22', type: 'Service', description: 'Full service — 50,000 km milestone', cost: 1200, status: 'Completed', mechanic: 'Joe Mechanics' },
  { id: '5', date: '2026-06-08', vehicleId: 'GR-7890-19', type: 'Repair', description: 'Transmission fluid leak fix', cost: 950, status: 'Completed', mechanic: 'Ato Gearbox Specialist' },
  { id: '6', date: '2026-06-06', vehicleId: 'GR-2345-23', type: 'Inspection', description: 'Pre-trip safety inspection', cost: 150, status: 'Completed', mechanic: 'Kwadwo Auto' },
  { id: '7', date: '2026-06-18', vehicleId: 'GR-0123-24', type: 'Service', description: 'Tyre rotation and alignment', cost: 280, status: 'Scheduled', mechanic: 'Akoto Tyres' },
  { id: '8', date: '2026-05-28', vehicleId: 'GR-6789-18', type: 'Repair', description: 'Engine mount replacement', cost: 1500, status: 'Completed', mechanic: 'Joe Mechanics' },
  { id: '9', date: '2026-06-05', vehicleId: 'GR-1234-22', type: 'Inspection', description: 'Lights and electrical check', cost: 180, status: 'Completed', mechanic: 'Kwadwo Auto' },
  { id: '10', date: '2026-06-16', vehicleId: 'GR-5678-21', type: 'Service', description: 'Air filter and spark plug service', cost: 420, status: 'Scheduled', mechanic: 'Joe Mechanics' },
];

const COST_TREND = [
  { month: 'Jan', cost: 3200 }, { month: 'Feb', cost: 2800 }, { month: 'Mar', cost: 4100 },
  { month: 'Apr', cost: 3600 }, { month: 'May', cost: 5200 }, { month: 'Jun', cost: 4380 },
];

const VEHICLES = ['GR-1234-22', 'GR-5678-21', 'GR-9012-20', 'GR-3456-22', 'GR-7890-19', 'GR-2345-23', 'GR-6789-18', 'GR-0123-24'];
const STATUS_COLORS = { Scheduled: '#d97706', 'In Progress': '#2563eb', Completed: '#059669' };

interface Props {
  addNotification: (msg: string) => void;
}

export default function MaintenanceView({ addNotification }: Props) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<MaintenanceRecord | null>(null);
  const [filterVehicle, setFilterVehicle] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [form, setForm] = useState({ vehicleId: 'GR-1234-22', type: 'Service' as MaintenanceRecord['type'], date: '', description: '', mechanic: '', cost: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('maintenance_schedule').select('*').order('date', { ascending: false });
        if (error || !data || data.length === 0) setRecords(MOCK_RECORDS);
        else setRecords(data);
      } catch {
        setRecords(MOCK_RECORDS);
      }
    };
    load();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const upcoming = records.filter(r => r.status === 'Scheduled' && r.date >= today && r.date <= sevenDays);

  const filtered = records.filter(r => {
    const matchV = filterVehicle === 'All' || r.vehicleId === filterVehicle;
    const matchS = filterStatus === 'All' || r.status === filterStatus;
    const matchT = filterType === 'All' || r.type === filterType;
    return matchV && matchS && matchT;
  });

  const counts = {
    scheduled: records.filter(r => r.status === 'Scheduled').length,
    inProgress: records.filter(r => r.status === 'In Progress').length,
    completed: records.filter(r => r.status === 'Completed').length,
    totalCost: records.reduce((s, r) => s + r.cost, 0),
  };

  const handleMarkComplete = async (id: string) => {
    try { await supabase.from('maintenance_schedule').update({ status: 'Completed' }).eq('id', id); } catch {}
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'Completed' } : r));
    addNotification('Maintenance marked as completed');
  };

  const handleSubmit = async () => {
    if (!form.vehicleId || !form.date || !form.description) return;
    const newRec: MaintenanceRecord = { id: String(Date.now()), vehicleId: form.vehicleId, type: form.type, date: form.date, description: form.description, mechanic: form.mechanic, cost: Number(form.cost), status: 'Scheduled' };
    try { await supabase.from('maintenance_schedule').insert([newRec]); } catch {}
    setRecords(prev => [newRec, ...prev]);
    addNotification(`Maintenance scheduled for ${form.vehicleId}`);
    setShowModal(false);
    setForm({ vehicleId: 'GR-1234-22', type: 'Service', date: '', description: '', mechanic: '', cost: '' });
  };

  const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Maintenance Schedule</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Track and manage fleet maintenance</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <Plus size={16} /> Add Maintenance
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {[
          { label: 'Scheduled', value: counts.scheduled, color: '#d97706' },
          { label: 'In Progress', value: counts.inProgress, color: '#2563eb' },
          { label: 'Completed', value: counts.completed, color: '#059669' },
          { label: 'Total Cost (GHS)', value: `${counts.totalCost.toLocaleString()}`, color: 'var(--accent)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: 26, fontWeight: 700, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {upcoming.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#d97706" /> Upcoming in Next 7 Days
          </h2>
          {upcoming.map(r => (
            <div key={r.id} style={{ background: 'rgba(251,191,36,0.08)', borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(251,191,36,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: 14 }}>{r.vehicleId} — {r.type}</p>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>{r.description}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#d97706', fontWeight: 700, margin: '0 0 2px', fontSize: 13 }}>{r.date}</p>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 12 }}>{r.mechanic}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 14 }}>
          <option value="All">All Vehicles</option>
          {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 14 }}>
          <option value="All">All Statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 14 }}>
          <option value="All">All Types</option>
          <option value="Service">Service</option>
          <option value="Repair">Repair</option>
          <option value="Inspection">Inspection</option>
        </select>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Vehicle', 'Type', 'Description', 'Cost (GHS)', 'Status', 'Mechanic', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13, whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{r.vehicleId}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>{r.type}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13, maxWidth: 200 }}>{r.description}</td>
                  <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>GHS {r.cost.toLocaleString()}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: `${STATUS_COLORS[r.status]}22`, color: STATUS_COLORS[r.status] }}>{r.status}</span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 12 }}>{r.mechanic}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.status !== 'Completed' && (
                        <button onClick={() => handleMarkComplete(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '4px 10px', color: '#059669', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <CheckCircle size={12} /> Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16, marginBottom: 16 }}>Maintenance Cost Trend (Last 6 Months)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={COST_TREND} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)' }} />
            <Line type="monotone" dataKey="cost" stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: 'var(--accent)', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Add Maintenance</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Vehicle</label>
                <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} style={inputStyle}>
                  {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as MaintenanceRecord['type'] }))} style={inputStyle}>
                  <option value="Service">Service</option>
                  <option value="Repair">Repair</option>
                  <option value="Inspection">Inspection</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the maintenance work" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Mechanic</label>
                <input value={form.mechanic} onChange={e => setForm(f => ({ ...f, mechanic: e.target.value }))} placeholder="Mechanic or workshop name" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Estimated Cost (GHS)</label>
                <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSubmit} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
