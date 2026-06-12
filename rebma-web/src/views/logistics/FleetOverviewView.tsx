import React, { useState, useEffect } from 'react';
import { Truck, Wrench, Settings, Package, Plus, X, Edit, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Vehicle {
  id: string;
  vehicleId: string;
  type: 'Pickup' | 'Container' | 'Tanker';
  driver: string;
  status: 'Operational' | 'In Maintenance' | 'Retired';
  lastMaintenance: string;
  totalDeliveries: number;
}

const MOCK_VEHICLES: Vehicle[] = [
  { id: '1', vehicleId: 'GR-1234-22', type: 'Pickup', driver: 'Kwame Asante', status: 'Operational', lastMaintenance: '2026-05-10', totalDeliveries: 142 },
  { id: '2', vehicleId: 'GR-5678-21', type: 'Container', driver: 'Ama Boateng', status: 'Operational', lastMaintenance: '2026-05-22', totalDeliveries: 98 },
  { id: '3', vehicleId: 'GR-9012-20', type: 'Tanker', driver: 'Unassigned', status: 'In Maintenance', lastMaintenance: '2026-06-01', totalDeliveries: 75 },
  { id: '4', vehicleId: 'GR-3456-22', type: 'Pickup', driver: 'Kojo Mensah', status: 'Operational', lastMaintenance: '2026-04-30', totalDeliveries: 201 },
  { id: '5', vehicleId: 'GR-7890-19', type: 'Container', driver: 'Efua Darko', status: 'In Maintenance', lastMaintenance: '2026-06-05', totalDeliveries: 56 },
  { id: '6', vehicleId: 'GR-2345-23', type: 'Pickup', driver: 'Yaw Osei', status: 'Operational', lastMaintenance: '2026-05-15', totalDeliveries: 88 },
  { id: '7', vehicleId: 'GR-6789-18', type: 'Tanker', driver: 'Unassigned', status: 'Retired', lastMaintenance: '2025-11-20', totalDeliveries: 310 },
  { id: '8', vehicleId: 'GR-0123-24', type: 'Pickup', driver: 'Akosua Frimpong', status: 'Operational', lastMaintenance: '2026-06-08', totalDeliveries: 34 },
];

const MOCK_DELIVERIES = [
  { date: '2026-06-10', destination: 'Tema Port', status: 'Delivered', amount: 'GHS 450' },
  { date: '2026-06-08', destination: 'Kumasi Depot', status: 'Delivered', amount: 'GHS 620' },
  { date: '2026-06-05', destination: 'Takoradi Warehouse', status: 'Delivered', amount: 'GHS 380' },
  { date: '2026-06-03', destination: 'Accra Central', status: 'Delivered', amount: 'GHS 290' },
  { date: '2026-05-30', destination: 'Tema Port', status: 'Delivered', amount: 'GHS 510' },
  { date: '2026-05-28', destination: 'Ho Distribution', status: 'Delivered', amount: 'GHS 440' },
  { date: '2026-05-25', destination: 'Tamale Hub', status: 'Delivered', amount: 'GHS 680' },
  { date: '2026-05-20', destination: 'Cape Coast', status: 'Delivered', amount: 'GHS 350' },
];

const STATUS_COLORS = { Operational: '#059669', 'In Maintenance': '#d97706', Retired: '#6b7280' };

const emptyVehicle: Omit<Vehicle, 'id' | 'totalDeliveries'> = { vehicleId: '', type: 'Pickup', driver: '', status: 'Operational', lastMaintenance: '' };

interface Props {
  addNotification: (msg: string) => void;
}

export default function FleetOverviewView({ addNotification }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<Omit<Vehicle, 'id' | 'totalDeliveries'>>(emptyVehicle);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('fleet_vehicles').select('*');
        if (error || !data || data.length === 0) setVehicles(MOCK_VEHICLES);
        else setVehicles(data);
      } catch {
        setVehicles(MOCK_VEHICLES);
      }
    };
    load();
  }, []);

  const counts = {
    total: vehicles.length,
    operational: vehicles.filter(v => v.status === 'Operational').length,
    maintenance: vehicles.filter(v => v.status === 'In Maintenance').length,
    deliveries: vehicles.reduce((s, v) => s + v.totalDeliveries, 0),
  };

  const handleSaveAdd = async () => {
    if (!formData.vehicleId) return;
    const newV: Vehicle = { ...formData, id: String(Date.now()), totalDeliveries: 0 };
    try { await supabase.from('fleet_vehicles').insert([newV]); } catch {}
    setVehicles(prev => [newV, ...prev]);
    addNotification(`Vehicle ${newV.vehicleId} added`);
    setShowAddModal(false);
    setFormData(emptyVehicle);
  };

  const handleSaveEdit = async () => {
    if (!editVehicle) return;
    const updated = { ...editVehicle, ...formData };
    try { await supabase.from('fleet_vehicles').update(formData).eq('id', editVehicle.id); } catch {}
    setVehicles(prev => prev.map(v => v.id === editVehicle.id ? updated : v));
    addNotification(`Vehicle ${editVehicle.vehicleId} updated`);
    setEditVehicle(null);
  };

  const handleDeactivate = (vehicle: Vehicle) => {
    setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...v, status: 'Retired' } : v));
    addNotification(`Vehicle ${vehicle.vehicleId} deactivated`);
  };

  const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, width: '100%', boxSizing: 'border-box' };

  const VehicleForm = ({ onSave, onClose }: { onSave: () => void; onClose: () => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Vehicle ID</label>
        <input value={formData.vehicleId} onChange={e => setFormData(f => ({ ...f, vehicleId: e.target.value }))} placeholder="e.g. GR-1234-22" style={inputStyle} />
      </div>
      <div>
        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Type</label>
        <select value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value as Vehicle['type'] }))} style={inputStyle}>
          <option value="Pickup">Pickup</option>
          <option value="Container">Container</option>
          <option value="Tanker">Tanker</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Driver Assigned</label>
        <input value={formData.driver} onChange={e => setFormData(f => ({ ...f, driver: e.target.value }))} placeholder="Driver name or leave blank" style={inputStyle} />
      </div>
      <div>
        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Status</label>
        <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value as Vehicle['status'] }))} style={inputStyle}>
          <option value="Operational">Operational</option>
          <option value="In Maintenance">In Maintenance</option>
          <option value="Retired">Retired</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Last Maintenance Date</label>
        <input type="date" value={formData.lastMaintenance} onChange={e => setFormData(f => ({ ...f, lastMaintenance: e.target.value }))} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={onClose} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
        <button onClick={onSave} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Save</button>
      </div>
    </div>
  );

  if (selectedVehicle) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <button onClick={() => setSelectedVehicle(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, padding: 0, fontSize: 14 }}>
          <ChevronLeft size={16} /> Back to Fleet
        </button>
        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${STATUS_COLORS[selectedVehicle.status]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={26} color={STATUS_COLORS[selectedVehicle.status]} />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{selectedVehicle.vehicleId}</h2>
              <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: `${STATUS_COLORS[selectedVehicle.status]}22`, color: STATUS_COLORS[selectedVehicle.status] }}>{selectedVehicle.status}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
            {[
              { label: 'Type', value: selectedVehicle.type },
              { label: 'Driver', value: selectedVehicle.driver || 'Unassigned' },
              { label: 'Last Maintenance', value: selectedVehicle.lastMaintenance },
              { label: 'Total Deliveries', value: String(selectedVehicle.totalDeliveries) },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 12, padding: 16 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 4px', fontWeight: 600 }}>{item.label}</p>
                <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, marginBottom: 16 }}>Recent Delivery History</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Destination', 'Status', 'Amount'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_DELIVERIES.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13 }}>{d.date}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>{d.destination}</td>
                    <td style={{ padding: '12px' }}><span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: 'rgba(16,185,129,0.15)', color: '#059669' }}>{d.status}</span></td>
                    <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{d.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Fleet Overview</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Manage vehicles and track deliveries</p>
        </div>
        <button onClick={() => { setFormData(emptyVehicle); setShowAddModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {[
          { label: 'Total Vehicles', value: counts.total, color: 'var(--accent)', icon: <Truck size={18} /> },
          { label: 'Operational', value: counts.operational, color: '#059669', icon: <Package size={18} /> },
          { label: 'In Maintenance', value: counts.maintenance, color: '#d97706', icon: <Wrench size={18} /> },
          { label: 'Total Deliveries', value: counts.deliveries, color: '#7c3aed', icon: <Settings size={18} /> },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>{c.label}</p>
              <span style={{ color: c.color }}>{c.icon}</span>
            </div>
            <p style={{ color: c.color, fontSize: 28, fontWeight: 700, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {vehicles.map(v => (
          <div key={v.id} style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)', cursor: 'pointer' }} onClick={() => setSelectedVehicle(v)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${STATUS_COLORS[v.status]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Truck size={22} color={STATUS_COLORS[v.status]} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: 15 }}>{v.vehicleId}</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>{v.type}</p>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: `${STATUS_COLORS[v.status]}22`, color: STATUS_COLORS[v.status], flexShrink: 0 }}>{v.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, margin: '0 0 2px' }}>DRIVER</p>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, margin: 0, fontWeight: 500 }}>{v.driver || 'Unassigned'}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, margin: '0 0 2px' }}>DELIVERIES</p>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, margin: 0, fontWeight: 500 }}>{v.totalDeliveries}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, margin: '0 0 2px' }}>LAST MAINTENANCE</p>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, margin: 0 }}>{v.lastMaintenance}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setFormData({ vehicleId: v.vehicleId, type: v.type, driver: v.driver, status: v.status, lastMaintenance: v.lastMaintenance }); setEditVehicle(v); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
                <Edit size={13} /> Edit
              </button>
              {v.status !== 'Retired' && (
                <button onClick={() => handleDeactivate(v)} style={{ flex: 1, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '8px', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}>Deactivate</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(showAddModal || editVehicle) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{editVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => { setShowAddModal(false); setEditVehicle(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <VehicleForm onSave={editVehicle ? handleSaveEdit : handleSaveAdd} onClose={() => { setShowAddModal(false); setEditVehicle(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}
