import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Copy, X, ChevronRight, Package } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { ProductionRequest } from '../../types/erp';

const MOCK_ORDERS: ProductionRequest[] = [
  { id: 'PRO-001', items: [{ materialName: 'Shea Butter', quantity: 200 }, { materialName: 'Palm Oil', quantity: 50 }], status: 'PENDING_MANAGEMENT', createdAt: '2026-06-01T08:00:00Z' },
  { id: 'PRO-002', items: [{ materialName: 'Coconut Oil', quantity: 100 }], status: 'APPROVED', producedGoods: 0, createdAt: '2026-06-02T09:30:00Z' },
  { id: 'PRO-003', items: [{ materialName: 'Raw Cocoa', quantity: 300 }, { materialName: 'Sugar', quantity: 80 }], status: 'TICKETS_ISSUED', createdAt: '2026-06-03T10:00:00Z' },
  { id: 'PRO-004', items: [{ materialName: 'Groundnut Oil', quantity: 150 }], status: 'COMPLETED', producedGoods: 148, createdAt: '2026-06-04T07:45:00Z' },
  { id: 'PRO-005', items: [{ materialName: 'Shea Butter', quantity: 400 }, { materialName: 'Beeswax', quantity: 20 }], status: 'APPROVED', createdAt: '2026-06-05T11:00:00Z' },
  { id: 'PRO-006', items: [{ materialName: 'Palm Kernel Oil', quantity: 250 }], status: 'PENDING_MANAGEMENT', createdAt: '2026-06-06T08:30:00Z' },
  { id: 'PRO-007', items: [{ materialName: 'Cocoa Butter', quantity: 180 }, { materialName: 'Vanilla', quantity: 10 }], status: 'COMPLETED', producedGoods: 175, createdAt: '2026-06-07T09:00:00Z' },
  { id: 'PRO-008', items: [{ materialName: 'Sesame Oil', quantity: 90 }], status: 'TICKETS_ISSUED', createdAt: '2026-06-08T10:15:00Z' },
];

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<ProductionRequest | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newMaterials, setNewMaterials] = useState([{ materialName: '', quantity: 0 }]);
  const [detailNotes, setDetailNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from('production_requests').select('*').order('createdAt', { ascending: false });
        if (error || !data || data.length === 0) setOrders(productionRequests.length ? productionRequests : MOCK_ORDERS);
        else setOrders(data);
      } catch {
        setOrders(productionRequests.length ? productionRequests : MOCK_ORDERS);
      }
    };
    load();
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

  const handleDuplicate = (order: ProductionRequest) => {
    const dup: ProductionRequest = { ...order, id: `PRO-${String(orders.length + 1).padStart(3, '0')}`, status: 'PENDING_MANAGEMENT', createdAt: new Date().toISOString() };
    setOrders(prev => [dup, ...prev]);
    addNotification(`Duplicated order ${order.id}`);
  };

  const handleSubmitNew = async () => {
    const validMaterials = newMaterials.filter(m => m.materialName.trim());
    if (!validMaterials.length) return;
    const newOrder: ProductionRequest = {
      id: `PRO-${String(orders.length + 1).padStart(3, '0')}`,
      items: validMaterials,
      status: 'PENDING_MANAGEMENT',
      createdAt: new Date().toISOString(),
    };
    try {
      await supabase.from('production_requests').insert([newOrder]);
    } catch {}
    setOrders(prev => [newOrder, ...prev]);
    addNotification('New production request submitted');
    setShowNewModal(false);
    setNewMaterials([{ materialName: '', quantity: 0 }]);
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
        {filtered.map(order => (
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
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <Package size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <p>No orders found</p>
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
