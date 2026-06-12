import React, { useState, useEffect } from 'react';
import { Plus, X, Fuel } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../../lib/supabaseClient';

interface FuelLog {
  id: string;
  date: string;
  vehicleId: string;
  driver: string;
  liters: number;
  cost: number;
  station: string;
  odometer: number;
}

const MOCK_FUEL: FuelLog[] = [
  { id: '1', date: '2026-06-10', vehicleId: 'GR-1234-22', driver: 'Kwame Asante', liters: 45, cost: 405, station: 'Shell Tema', odometer: 54320 },
  { id: '2', date: '2026-06-09', vehicleId: 'GR-5678-21', driver: 'Ama Boateng', liters: 80, cost: 720, station: 'Total Accra', odometer: 78100 },
  { id: '3', date: '2026-06-08', vehicleId: 'GR-3456-22', driver: 'Kojo Mensah', liters: 40, cost: 360, station: 'Goil Kumasi', odometer: 32800 },
  { id: '4', date: '2026-06-07', vehicleId: 'GR-2345-23', driver: 'Yaw Osei', liters: 35, cost: 315, station: 'Total Takoradi', odometer: 18200 },
  { id: '5', date: '2026-06-06', vehicleId: 'GR-0123-24', driver: 'Akosua Frimpong', liters: 42, cost: 378, station: 'Shell Spintex', odometer: 9100 },
  { id: '6', date: '2026-06-05', vehicleId: 'GR-1234-22', driver: 'Kwame Asante', liters: 50, cost: 450, station: 'Goil Tema', odometer: 53890 },
  { id: '7', date: '2026-06-04', vehicleId: 'GR-5678-21', driver: 'Ama Boateng', liters: 75, cost: 675, station: 'Total Accra', odometer: 77620 },
  { id: '8', date: '2026-06-03', vehicleId: 'GR-3456-22', driver: 'Kojo Mensah', liters: 38, cost: 342, station: 'Shell Kumasi', odometer: 32400 },
  { id: '9', date: '2026-06-02', vehicleId: 'GR-6789-18', driver: 'Unassigned', liters: 120, cost: 1080, station: 'Total Tema', odometer: 91200 },
  { id: '10', date: '2026-06-01', vehicleId: 'GR-9012-20', driver: 'Unassigned', liters: 95, cost: 855, station: 'Goil Accra', odometer: 62300 },
  { id: '11', date: '2026-05-30', vehicleId: 'GR-2345-23', driver: 'Yaw Osei', liters: 33, cost: 297, station: 'Total Ho', odometer: 17800 },
  { id: '12', date: '2026-05-28', vehicleId: 'GR-0123-24', driver: 'Akosua Frimpong', liters: 40, cost: 360, station: 'Shell Accra', odometer: 8700 },
];

const CHART_DATA = [
  { vehicle: 'GR-1234', Jan: 720, Feb: 810, Mar: 680, Apr: 750, May: 855, Jun: 855 },
  { vehicle: 'GR-5678', Jan: 1200, Feb: 1350, Mar: 1100, Apr: 1280, May: 1395, Jun: 1395 },
  { vehicle: 'GR-3456', Jan: 540, Feb: 630, Mar: 580, Apr: 610, May: 702, Jun: 702 },
  { vehicle: 'GR-2345', Jan: 450, Feb: 520, Mar: 490, Apr: 530, May: 612, Jun: 612 },
  { vehicle: 'GR-0123', Jan: 360, Feb: 420, Mar: 380, Apr: 410, May: 738, Jun: 738 },
  { vehicle: 'GR-9012', Jan: 1440, Feb: 1620, Mar: 1380, Apr: 1500, May: 855, Jun: 855 },
];

const VEHICLES = ['GR-1234-22', 'GR-5678-21', 'GR-9012-20', 'GR-3456-22', 'GR-7890-19', 'GR-2345-23', 'GR-6789-18', 'GR-0123-24'];

interface Props {
  addNotification: (msg: string) => void;
}

export default function FuelManagementView({ addNotification }: Props) {
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filterVehicle, setFilterVehicle] = useState('All');
  const [filterDriver, setFilterDriver] = useState('');
  const [form, setForm] = useState({ vehicleId: 'GR-1234-22', driver: '', liters: '', cost: '', station: '', odometer: '', date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('fuel_logs').select('*').order('date', { ascending: false });
        if (error || !data || data.length === 0) setLogs(MOCK_FUEL);
        else setLogs(data);
      } catch {
        setLogs(MOCK_FUEL);
      }
    };
    load();
  }, []);

  const filtered = logs.filter(l => {
    const matchV = filterVehicle === 'All' || l.vehicleId === filterVehicle;
    const matchD = !filterDriver || l.driver.toLowerCase().includes(filterDriver.toLowerCase());
    return matchV && matchD;
  });

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthLogs = logs.filter(l => l.date.startsWith(thisMonth));

  const totalCost = logs.reduce((s, l) => s + l.cost, 0);
  const monthCost = thisMonthLogs.reduce((s, l) => s + l.cost, 0);
  const totalLiters = logs.reduce((s, l) => s + l.liters, 0);
  const avgCost = VEHICLES.length ? Math.round(totalCost / VEHICLES.length) : 0;

  const handleSubmit = async () => {
    if (!form.vehicleId || !form.liters || !form.cost) return;
    const newLog: FuelLog = { id: String(Date.now()), date: form.date, vehicleId: form.vehicleId, driver: form.driver, liters: Number(form.liters), cost: Number(form.cost), station: form.station, odometer: Number(form.odometer) };
    try { await supabase.from('fuel_logs').insert([newLog]); } catch {}
    setLogs(prev => [newLog, ...prev]);
    addNotification(`Fuel entry logged for ${form.vehicleId}`);
    setShowModal(false);
    setForm({ vehicleId: 'GR-1234-22', driver: '', liters: '', cost: '', station: '', odometer: '', date: new Date().toISOString().split('T')[0] });
  };

  const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Fuel Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Track fuel usage and costs across the fleet</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <Plus size={16} /> Log Fuel Entry
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {[
          { label: 'Total Fuel Cost', value: `GHS ${totalCost.toLocaleString()}`, color: 'var(--accent)' },
          { label: 'This Month', value: `GHS ${monthCost.toLocaleString()}`, color: '#d97706' },
          { label: 'Avg per Vehicle', value: `GHS ${avgCost.toLocaleString()}`, color: '#2563eb' },
          { label: 'Total Liters', value: `${totalLiters.toLocaleString()} L`, color: '#059669' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: 22, fontWeight: 700, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 14 }}>
          <option value="All">All Vehicles</option>
          {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <input value={filterDriver} onChange={e => setFilterDriver(e.target.value)} placeholder="Filter by driver..." style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 14 }} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16, marginBottom: 16 }}>Monthly Fuel Cost by Vehicle</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={CHART_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="vehicle" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => (
              <Bar key={month} dataKey={month} fill={['#6366f1', '#8b5cf6', '#a78bfa', '#3b82f6', '#06b6d4', '#10b981'][i]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16, marginBottom: 16 }}>Fuel Logs</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Vehicle ID', 'Driver', 'Liters', 'Cost (GHS)', 'Fuel Station', 'Odometer (km)'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13 }}>{l.date}</td>
                  <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{l.vehicleId}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>{l.driver || '—'}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>{l.liters} L</td>
                  <td style={{ padding: '12px', color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>GHS {l.cost.toLocaleString()}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>{l.station}</td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 13 }}>{l.odometer.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Log Fuel Entry</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([
                { label: 'Date', key: 'date', type: 'date' },
                { label: 'Driver', key: 'driver', type: 'text', placeholder: 'Driver name' },
                { label: 'Liters', key: 'liters', type: 'number', placeholder: '0' },
                { label: 'Cost (GHS)', key: 'cost', type: 'number', placeholder: '0' },
                { label: 'Fuel Station', key: 'station', type: 'text', placeholder: 'Station name' },
                { label: 'Odometer Reading (km)', key: 'odometer', type: 'number', placeholder: '0' },
              ] as Array<{ label: string; key: keyof typeof form; type: string; placeholder?: string }>).map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{field.label}</label>
                  <input type={field.type} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Vehicle ID</label>
                <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} style={inputStyle}>
                  {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSubmit} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Log Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
