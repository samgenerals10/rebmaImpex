import React, { useState } from 'react';
import { Plus, Fuel, Edit, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

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

const mapToUI = (db: any): FuelLog => ({
  id: db.id,
  date: db.date || '',
  vehicleId: db.vehicle_id || db.vehicleId || '',
  driver: db.driver || '',
  liters: Number(db.liters || 0),
  cost: Number(db.cost || 0),
  station: db.station || '',
  odometer: Number(db.odometer || 0),
});

const mapToDB = (ui: Partial<FuelLog>) => {
  const db: any = {};
  if (ui.id !== undefined) db.id = ui.id;
  if (ui.date !== undefined) db.date = ui.date;
  if (ui.vehicleId !== undefined) db.vehicle_id = ui.vehicleId;
  if (ui.driver !== undefined) db.driver = ui.driver;
  if (ui.liters !== undefined) db.liters = Number(ui.liters);
  if (ui.cost !== undefined) db.cost = Number(ui.cost);
  if (ui.station !== undefined) db.station = ui.station;
  if (ui.odometer !== undefined) db.odometer = Number(ui.odometer);
  return db;
};

export default function FuelManagementView({ addNotification }: Props) {
  const { rows: logs, setRows: setLogs, loading, hasMore, total, loadMore, reload } = usePaginatedQuery<FuelLog>({
    table: 'fuel_logs',
    pageSize: 100,
    orderColumn: 'date',
    map: mapToUI,
  });
  const loadData = reload;
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<FuelLog | null>(null);
  const [filterVehicle, setFilterVehicle] = useState('All');
  const [filterDriver, setFilterDriver] = useState('');
  const [form, setForm] = useState({ vehicleId: 'GR-1234-22', driver: '', liters: '', cost: '', station: '', odometer: '', date: new Date().toISOString().split('T')[0] });

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
    if (!form.vehicleId || !form.liters || !form.cost) {
      alert('Vehicle ID, Liters, and Cost are required.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const newDbRow = mapToDB({
      date: form.date,
      vehicleId: form.vehicleId,
      driver: form.driver,
      liters: Number(form.liters),
      cost: Number(form.cost),
      station: form.station,
      odometer: Number(form.odometer || 0)
    });

    try {
      const { data, error } = await supabase.from('fuel_logs').insert([newDbRow]).select();
      if (!error && data) {
        addNotification(`Fuel entry logged for ${form.vehicleId}`);
        await loadData();
        setShowModal(false);
        setForm({ vehicleId: 'GR-1234-22', driver: '', liters: '', cost: '', station: '', odometer: '', date: new Date().toISOString().split('T')[0] });
      } else {
        alert(error?.message || 'Failed to log fuel entry.');
      }
    } catch (e: any) {
      alert(e.message || 'Failed to log fuel entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editForm || !editForm.vehicleId || !editForm.liters || !editForm.cost) {
      alert('Vehicle ID, Liters, and Cost are required.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const updatedDbRow = mapToDB(editForm);
    delete updatedDbRow.id; // Avoid overriding primary key in update

    try {
      const { error } = await supabase.from('fuel_logs')
        .update({
          ...updatedDbRow,
          updated_at: new Date().toISOString()
        })
        .eq('id', editForm.id);

      if (!error) {
        addNotification(`Fuel log updated for ${editForm.vehicleId}`);
        await loadData();
        setShowEditModal(false);
        setEditForm(null);
      } else {
        alert(error.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update fuel log.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (log: FuelLog) => {
    if (submitting) return;
    if (!await window.confirm(`Are you sure you want to delete the fuel log for ${log.vehicleId} on ${log.date}?`)) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('fuel_logs').delete().eq('id', log.id);
      if (!error) {
        addNotification(`Deleted fuel log for ${log.vehicleId}`);
        await loadData();
      } else {
        alert(error.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete fuel log.');
    } finally {
      setSubmitting(false);
    }
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
        <SearchableDropdown
          value={filterVehicle}
          onChange={setFilterVehicle}
          className="min-w-[180px]"
          options={[{ value: 'All', label: 'All Vehicles' }, ...VEHICLES.map(v => ({ value: v, label: v }))]}
        />
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
        {loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
        {!loading && <div>
          <ResponsiveDataView<FuelLog>
            columns={[
              { key: 'vehicleId', label: 'Vehicle ID', primary: true },
              { key: 'date', label: 'Date' },
              { key: 'driver', label: 'Driver', render: l => l.driver || '—' },
              { key: 'liters', label: 'Liters', render: l => `${l.liters} L` },
              { key: 'cost', label: 'Cost (GHS)', status: true, render: l => <span style={{ color: 'var(--accent)', fontWeight: 600 }}>GHS {l.cost.toLocaleString()}</span> },
              { key: 'station', label: 'Fuel Station' },
              { key: 'odometer', label: 'Odometer (km)', render: l => l.odometer.toLocaleString() },
            ]}
            data={filtered}
            rowKey={l => l.id}
            emptyIcon={<Fuel className="w-10 h-10" />}
            emptyTitle="No fuel logs yet"
            emptyDescription="They will appear here once added"
            renderActions={l => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setEditForm({ ...l }); setShowEditModal(true); }} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }} title="Edit">
                  <Edit size={12} />
                </button>
                <button onClick={() => handleDelete(l)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '4px 8px', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }} title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          />
          {!loading && logs.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              <span>Showing {logs.length}{typeof total === 'number' ? ` of ${total.toLocaleString()}` : ''}</span>
              {hasMore && (
                <button onClick={loadMore} className="px-3 py-1.5 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] hover:opacity-90 font-medium">Load more</button>
              )}
            </div>
          )}
        </div>}
      </div>

      <SidePanel
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Log Fuel Entry"
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowModal(false)} disabled={submitting} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, color: 'var(--text-secondary)', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 15, opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Logging...' : 'Log Entry'}</button>
          </div>
        }
      >
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
            <SearchableDropdown value={form.vehicleId} onChange={v => setForm(f => ({ ...f, vehicleId: v }))} options={VEHICLES.map(v => ({ value: v, label: v }))} />
          </div>
        </div>
      </SidePanel>

      <SidePanel
        open={showEditModal && !!editForm}
        onClose={() => { setShowEditModal(false); setEditForm(null); }}
        title="Edit Fuel Entry"
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setShowEditModal(false); setEditForm(null); }} disabled={submitting} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, color: 'var(--text-secondary)', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>Cancel</button>
            <button onClick={handleEditSave} disabled={submitting} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 15, opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Saving...' : 'Save Changes'}</button>
          </div>
        }
      >
        {editForm && (
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
                <input type={field.type} value={editForm[field.key]} onChange={e => setEditForm(f => f ? ({ ...f, [field.key]: e.target.value }) : null)} placeholder={field.placeholder} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Vehicle ID</label>
              <SearchableDropdown value={editForm.vehicleId} onChange={v => setEditForm(f => f ? ({ ...f, vehicleId: v }) : null)} options={VEHICLES.map(v => ({ value: v, label: v }))} />
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
