import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Copy, X, ChevronRight, Package, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const STATUS_COLORS: Record<string, string> = {
  PENDING_MANAGEMENT: 'amber',
  APPROVED: 'blue',
  TICKETS_ISSUED: 'indigo',
  COMPLETED: 'emerald',
  REJECTED: 'red',
  'Raw Materials': 'gray',
  'Processing': 'blue',
  'Quality Check': 'amber',
  'Packaging': 'orange',
  'Awaiting Dispatch': 'emerald',
  'Completed': 'purple',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_MANAGEMENT: 'Pending',
  APPROVED: 'Approved',
  TICKETS_ISSUED: 'Issued',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
};

const STEPS = ['PENDING_MANAGEMENT', 'APPROVED', 'TICKETS_ISSUED', 'COMPLETED'];

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'gray';
  const colorMap: Record<string, string> = {
    amber: 'background:rgba(251,191,36,0.15);color:#d97706',
    blue: 'background:rgba(59,130,246,0.15);color:#2563eb',
    indigo: 'background:rgba(99,102,241,0.15);color:#4338ca',
    emerald: 'background:rgba(16,185,129,0.15);color:#059669',
    red: 'background:rgba(239,68,68,0.15);color:#dc2626',
    gray: 'background:rgba(107,114,128,0.15);color:#6b7280',
    orange: 'background:rgba(249,115,22,0.15);color:#ea580c',
    purple: 'background:rgba(168,85,247,0.15);color:#9333ea',
  };
  return (
    <span style={{ ...Object.fromEntries(colorMap[color].split(';').map(s => s.split(':'))), padding: '2px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ProgressSteps({ status }: { status: string }) {
  const current = STEPS.indexOf(status);
  if (status === 'REJECTED') {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Rejected</span>;
  }
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

const getDisplayStatus = (order: any, wipList: any[]) => {
  if (order.status === 'COMPLETED' || order.status === 'REJECTED') {
    return { text: STATUS_LABELS[order.status] || order.status, statusVal: order.status };
  }
  const match = wipList.find(w => w.productName.toLowerCase().trim() === order.productName.toLowerCase().trim());
  if (match) {
    return { text: match.stage, statusVal: match.stage };
  }
  return { text: STATUS_LABELS[order.status] || order.status, statusVal: order.status };
};

const getProgressStatus = (status: string) => {
  const map: Record<string, string> = {
    'Raw Materials': 'APPROVED',
    'Processing': 'APPROVED',
    'Quality Check': 'APPROVED',
    'Packaging': 'APPROVED',
    'Awaiting Dispatch': 'TICKETS_ISSUED',
    'Completed': 'COMPLETED',
  };
  return map[status] || status;
};

interface Props {
  productionRequests: any[];
  addNotification: (msg: string) => void;
}

export default function InternalOrdersView({ productionRequests, addNotification }: Props) {
  const [orders, setOrders] = useState<any[]>([]);
  const [wipItems, setWipItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  const selectedOrderDisp = selectedOrder ? getDisplayStatus(selectedOrder, wipItems) : null;

  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    productName: '',
    quantity: 0,
    unit: 'kg',
    requiredByDate: '',
    purpose: '',
    priority: 'Medium',
    notes: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load WIP items first
      const { data: wipData } = await supabase.from('wip_stock').select('*');
      if (wipData) {
        setWipItems(wipData.map((row: any) => ({
          id: row.id,
          productName: row.product_name,
          stage: row.stage,
          qty: Number(row.qty || 0),
          updatedAt: row.updated_at
        })));
      } else {
        setWipItems([]);
      }

      const { data, error } = await supabase.from('production_requests').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          requestNumber: row.request_number,
          productName: row.product_name,
          quantity: row.quantity,
          unit: row.unit,
          requiredByDate: row.required_by_date,
          purpose: row.purpose,
          priority: row.priority,
          status: row.status,
          notes: row.notes,
          rejectionReason: row.rejection_reason,
          createdAt: row.created_at || row.createdAt,
          items: [{ materialName: row.product_name || 'Materials', quantity: Number(row.quantity || 0) }]
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
    const matchSearch = 
      (o.id && o.id.toLowerCase().includes(search.toLowerCase())) ||
      (o.productName && o.productName.toLowerCase().includes(search.toLowerCase())) ||
      (o.requestNumber && String(o.requestNumber).toLowerCase().includes(search.toLowerCase())) ||
      (o.purpose && o.purpose.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const counts = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDING_MANAGEMENT').length,
    approved: orders.filter(o => o.status === 'APPROVED').length,
    completed: orders.filter(o => o.status === 'COMPLETED').length,
  };

  const handleDuplicate = async (order: any) => {
    try {
      const { data, error } = await supabase.from('production_requests').insert([{
        product_name: order.productName,
        quantity: Number(order.quantity),
        unit: order.unit,
        required_by_date: order.requiredByDate || null,
        purpose: order.purpose || null,
        priority: order.priority || 'Medium',
        status: 'PENDING_MANAGEMENT',
        notes: `Duplicated from request ${order.requestNumber || order.id}`
      }]).select();
      if (!error && data) {
        addNotification(`Duplicated request ${order.requestNumber || order.id}`);
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitNew = async () => {
    if (!newForm.productName.trim()) {
      alert('Product Name is required.');
      return;
    }
    
    try {
      const { data, error } = await supabase.from('production_requests').insert([{
        product_name: newForm.productName,
        quantity: Number(newForm.quantity),
        unit: newForm.unit,
        required_by_date: newForm.requiredByDate || null,
        purpose: newForm.purpose || null,
        priority: newForm.priority,
        status: 'PENDING_MANAGEMENT',
        notes: newForm.notes || null
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
    setNewForm({
      productName: '',
      quantity: 0,
      unit: 'kg',
      requiredByDate: '',
      purpose: '',
      priority: 'Medium',
      notes: ''
    });
  };

  const handleEditSave = async () => {
    if (!editForm || !editForm.productName.trim()) {
      alert('Product Name is required.');
      return;
    }

    try {
      const { error } = await supabase.from('production_requests')
        .update({
          product_name: editForm.productName,
          quantity: Number(editForm.quantity),
          unit: editForm.unit,
          required_by_date: editForm.requiredByDate || null,
          purpose: editForm.purpose || null,
          priority: editForm.priority,
          status: editForm.status,
          notes: editForm.notes || null,
          rejection_reason: editForm.status === 'REJECTED' ? editForm.rejectionReason : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editForm.id);

      if (!error) {
        addNotification(`Updated request ${editForm.requestNumber || editForm.id}`);
        loadData();
        setShowEditModal(false);
        setEditForm(null);
      } else {
        alert(error.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update request.');
    }
  };

  const handleDelete = async (order: any) => {
    if (!window.confirm(`Are you sure you want to delete production request ${order.requestNumber || order.id}?`)) return;
    try {
      const { error } = await supabase.from('production_requests').delete().eq('id', order.id);
      if (!error) {
        addNotification(`Deleted request ${order.requestNumber || order.id}`);
        loadData();
      } else {
        alert(error.message);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete request.');
    }
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
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
        {!loading && filtered.map(order => {
          const disp = getDisplayStatus(order, wipItems);
          return (
            <div key={order.id} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '18px 20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setSelectedOrder(order)}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: ({
                  PENDING_MANAGEMENT: '#d97706',
                  APPROVED: '#2563eb',
                  TICKETS_ISSUED: '#4338ca',
                  COMPLETED: '#059669',
                  REJECTED: '#dc2626',
                  'Raw Materials': '#6b7280',
                  'Processing': '#2563eb',
                  'Quality Check': '#f59e0b',
                  'Packaging': '#ea580c',
                  'Awaiting Dispatch': '#10b981',
                  'Completed': '#9333ea'
                } as Record<string, string>)[disp.statusVal] || '#888',
                flexShrink: 0
              }} />
              <div style={{ minWidth: 90 }}>
                <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: 14 }}>Req #{order.requestNumber || order.id.slice(0, 8)}</p>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 12 }}>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}</p>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: 14, fontWeight: 600 }}>{order.productName}</p>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 12 }}>Qty: {order.quantity} {order.unit} | Priority: {order.priority}</p>
              </div>
              <ProgressSteps status={getProgressStatus(disp.statusVal)} />
              <StatusBadge status={disp.statusVal} />
              <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedOrder(order)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <Eye size={14} /> View
              </button>
              <button onClick={() => { setEditForm({ ...order }); setShowEditModal(true); }} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <Edit size={14} /> Edit
              </button>
              <button onClick={() => handleDuplicate(order)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }} title="Duplicate">
                <Copy size={14} />
              </button>
              <button onClick={() => handleDelete(order)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 12px', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }} title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Request Details</h2>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={selectedOrderDisp ? selectedOrderDisp.statusVal : selectedOrder.status} />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Created: {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : '—'}</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>Product Name</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedOrder.productName}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>Quantity</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedOrder.quantity} {selectedOrder.unit}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>Required By Date</p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{selectedOrder.requiredByDate ? new Date(selectedOrder.requiredByDate).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>Priority</p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{selectedOrder.priority}</p>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>Purpose</p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{selectedOrder.purpose || '—'}</p>
              </div>
            </div>

            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 8 }}>Progress</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              {STEPS.map((step, i) => {
                const current = STEPS.indexOf(getProgressStatus(selectedOrderDisp ? selectedOrderDisp.statusVal : selectedOrder.status));
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

            {selectedOrder.rejectionReason && (
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Rejection Reason</p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{selectedOrder.rejectionReason}</p>
              </div>
            )}

            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 8 }}>Notes</h3>
            <p style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', color: 'var(--text-primary)', fontSize: 14, margin: 0, whiteSpace: 'pre-wrap' }}>
              {selectedOrder.notes || 'No notes added.'}
            </p>

            <button onClick={() => setSelectedOrder(null)} style={{ marginTop: 20, width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>Close</button>
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
            
            <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Product Name</label>
                <input value={newForm.productName} onChange={e => setNewForm(prev => ({ ...prev, productName: e.target.value }))} placeholder="e.g. Bread Flour" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Quantity</label>
                  <input type="number" value={newForm.quantity || ''} onChange={e => setNewForm(prev => ({ ...prev, quantity: Number(e.target.value) }))} placeholder="Qty" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Unit</label>
                  <input value={newForm.unit} onChange={e => setNewForm(prev => ({ ...prev, unit: e.target.value }))} placeholder="e.g. kg" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Required By Date</label>
                  <input type="date" value={newForm.requiredByDate} onChange={e => setNewForm(prev => ({ ...prev, requiredByDate: e.target.value }))} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Priority</label>
                  <select value={newForm.priority} onChange={e => setNewForm(prev => ({ ...prev, priority: e.target.value }))} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', boxSizing: 'border-box' }}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Purpose</label>
                <input value={newForm.purpose} onChange={e => setNewForm(prev => ({ ...prev, purpose: e.target.value }))} placeholder="e.g. Order Fulfillment" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Notes</label>
                <textarea value={newForm.notes} onChange={e => setNewForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Additional requirements..." rows={3} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowNewModal(false)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSubmitNew} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Edit Production Request</h2>
              <button onClick={() => { setShowEditModal(false); setEditForm(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Product Name</label>
                <input value={editForm.productName} onChange={e => setEditForm({ ...editForm, productName: e.target.value })} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Quantity</label>
                  <input type="number" value={editForm.quantity || ''} onChange={e => setEditForm({ ...editForm, quantity: Number(e.target.value) })} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Unit</label>
                  <input value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Required By Date</label>
                  <input type="date" value={editForm.requiredByDate || ''} onChange={e => setEditForm({ ...editForm, requiredByDate: e.target.value })} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Priority</label>
                  <select value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', boxSizing: 'border-box' }}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Purpose</label>
                <input value={editForm.purpose || ''} onChange={e => setEditForm({ ...editForm, purpose: e.target.value })} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', boxSizing: 'border-box' }}>
                  <option value="PENDING_MANAGEMENT">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="TICKETS_ISSUED">Tickets Issued</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              {editForm.status === 'REJECTED' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Rejection Reason</label>
                  <textarea value={editForm.rejectionReason || ''} onChange={e => setEditForm({ ...editForm, rejectionReason: e.target.value })} rows={2} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Notes</label>
                <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setShowEditModal(false); setEditForm(null); }} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleEditSave} style={{ flex: 2, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
