import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Copy, X, ChevronRight, Package } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { ProductionRequest } from '../../types/erp';


const STATUS_COLORS: Record<string, string> = {
  PENDING_MANAGEMENT: 'amber',
  APPROVED: 'blue',
  TICKETS_ISSUED: 'indigo',
  COMPLETED: 'emerald',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_MANAGEMENT: 'Pending',
  APPROVED: 'Approved',
  TICKETS_ISSUED: 'Issued',
  COMPLETED: 'Completed',
};

const STEPS = ['PENDING_MANAGEMENT', 'APPROVED', 'TICKETS_ISSUED', 'COMPLETED'];

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'gray';
  const colorMap: Record<string, string> = {
    amber: 'background:rgba(251,191,36,0.15);color:#d97706',
    blue: 'background:rgba(59,130,246,0.15);color:#2563eb',
    indigo: 'background:rgba(99,102,241,0.15);color:#4338ca',
    emerald: 'background:rgba(16,185,129,0.15);color:#059669',
    gray: 'background:rgba(107,114,128,0.15);color:#6b7280',
  };
  return (
    <span style={{ ...Object.fromEntries(colorMap[color].split(';').map(s => s.split(':'))), padding: '2px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ProgressSteps({ status }: { status: string }) {
  const current = STEPS.indexOf(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i <= current ? 'var(--accent)' : 'var(--border)',
            flexShrink: 0,
          }} />
          {i < STEPS.length - 1 && <div style={{ width: 12, height: 2, background: i < current ? 'var(--accent)' : 'var(--border)' }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

interface Props {
  productionRequests: ProductionRequest[];
  addNotification: (msg: string) => void;
}

export default function InternalOrdersView({ productionRequests, addNotification }: Props) {
  const [orders, setOrders] = useState<ProductionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<ProductionRequest | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newMaterials, setNewMaterials] = useState([{ materialName: '', quantity: 0 }]);
  const [detailNotes, setDetailNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('production_requests').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          items: row.items || [{ materialName: row.product_name || 'Materials', quantity: Number(row.quantity || 0) }],
          status: row.status,
          createdAt: row.created_at || row.createdAt,
          producedGoods: row.product_name
        }));
        setOrders(mapped);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [productionRequests]);

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchSearch = o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.items.some(i => i.materialName.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const counts = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDING_MANAGEMENT').length,
    approved: orders.filter(o => o.status === 'APPROVED').length,
    completed: orders.filter(o => o.status === 'COMPLETED').length,
  };

  const handleDuplicate = async (order: ProductionRequest) => {
    const firstMaterial = order.items[0] || { materialName: 'Duplicate Request', quantity: 1 };
    try {
      const { data, error } = await supabase.from('production_requests').insert([{
        product_name: firstMaterial.materialName,
        quantity: Number(firstMaterial.quantity),
        unit: 'kg',
        status: 'PENDING_MANAGEMENT',
        notes: `Duplicated from order ${order.id}`
      }]).select();
      if (!error && data) {
        addNotification(`Duplicated order ${order.id}`);
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitNew = async () => {
    const validMaterials = newMaterials.filter(m => m.materialName.trim());
    if (!validMaterials.length) return;
    const firstMaterial = validMaterials[0];
    
    try {
      const { data, error } = await supabase.from('production_requests').insert([{
        product_name: firstMaterial.materialName,
        quantity: Number(firstMaterial.quantity),
        unit: 'kg',
        status: 'PENDING_MANAGEMENT',
        notes: detailNotes || null
      }]).select();
      if (!error && data) {
        addNotification('New production request submitted');
        loadData();
      } else {
        alert(error?.message || 'Failed to submit production request.');
      }
    } catch (e: any) {
      alert(e.message || 'Failed to submit production request.');
    }
    setShowNewModal(false);
    setNewMaterials([{ materialName: '', quantity: 0 }]);
    setDetailNotes('');
  };

  const summaryCards = [
    { label: 'Total Orders', value: counts.total, color: 'var(--accent)' },
    { label: 'Pending', value: counts.pending, color: '#d97706' },
    { label: 'Approved', value: counts.approved, color: '#2563eb' },
    { label: 'Completed', value: counts.completed, color: '#059669' },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Internal Production Orders</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Manage and track all production requests</p>
        </div>
        <button onClick={() => setShowNewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <Plus size={16} /> New Request
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {summaryCards.map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: 28, fontWeight: 700, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', borderRadius: 12, padding: '8px 14px', border: '1px solid var(--border)', flex: 1, minWidth: 200 }}>
          <Search size={16} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders or materials..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' }}>
          <option value="All">All Statuses</option>
          <option value="PENDING_MANAGEMENT">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="TICKETS_ISSUED">Tickets Issued</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
        {!loading && filtered.map(order => (
          <div key={order.id} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '18px 20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setSelectedOrder(order)}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: { PENDING_MANAGEMENT: '#d97706', APPROVED: '#2563eb', TICKETS_ISSUED: '#4338ca', COMPLETED: '#059669' }[order.status] || '#888', flexShrink: 0 }} />
            <div style={{ minWidth: 90 }}>
              <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: 14 }}>{order.id}</p>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 12 }}>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}</p>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>
                {order.items.map(i => `${i.materialName} (${i.quantity})`).join(', ')}
              </p>
            </div>
            <ProgressSteps status={order.status} />
            <StatusBadge status={order.status} />
            <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedOrder(order)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <Eye size={14} /> View
              </button>
              <button onClick={() => handleDuplicate(order)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <Copy size={14} />
              </button>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-sm">No orders yet</p>
            <p className="text-xs mt-1">They will appear here once added</p>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Order {selectedOrder.id}</h2>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={selectedOrder.status} />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Created: {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : '—'}</span>
            </div>
            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 10 }}>Materials</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>Material</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14 }}>{item.materialName}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 14, textAlign: 'right' }}>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedOrder.producedGoods !== undefined && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>Produced Goods: <strong>{selectedOrder.producedGoods}</strong></p>
            )}
            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 8 }}>Progress</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              {STEPS.map((step, i) => {
                const current = STEPS.indexOf(selectedOrder.status);
                return (
                  <React.Fragment key={step}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: i <= current ? 'var(--accent)' : 'var(--border)' }} />
                      <span style={{ fontSize: 10, color: i <= current ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{STATUS_LABELS[step]}</span>
                    </div>
                    {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < current ? 'var(--accent)' : 'var(--border)', marginBottom: 14 }} />}
                  </React.Fragment>
                );
              })}
            </div>
            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 8 }}>Notes</h3>
            <textarea value={detailNotes} onChange={e => setDetailNotes(e.target.value)} placeholder="Add notes..." rows={3} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            <button onClick={() => setSelectedOrder(null)} style={{ marginTop: 16, width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>Close</button>
          </div>
        </div>
      )}

      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>New Production Request</h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 12 }}>Materials</h3>
            {newMaterials.map((mat, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <input value={mat.materialName} onChange={e => {
                  const updated = [...newMaterials]; updated[idx].materialName = e.target.value; setNewMaterials(updated);
                }} placeholder="Material name" style={{ flex: 2, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14 }} />
                <input type="number" value={mat.quantity || ''} onChange={e => {
                  const updated = [...newMaterials]; updated[idx].quantity = Number(e.target.value); setNewMaterials(updated);
                }} placeholder="Qty" style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14 }} />
                {newMaterials.length > 1 && (
                  <button onClick={() => setNewMaterials(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '0 10px', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
                )}
              </div>
            ))}
            <button onClick={() => setNewMaterials(prev => [...prev, { materialName: '', quantity: 0 }])} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
              <Plus size={14} /> Add Material
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNewModal(false)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSubmitNew} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
