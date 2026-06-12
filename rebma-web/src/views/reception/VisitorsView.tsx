import React, { useState, useEffect } from 'react';
import { Plus, Search, X, LogOut, Eye, Users, UserCheck, UserMinus, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Visitor } from '../../types/erp';

const MOCK_VISITORS: (Visitor & { company?: string; badgeNumber: string; expectedTime?: string })[] = [
  { id: '1', fullName: 'Emmanuel Quaye', company: 'TechHub Ghana', purpose: 'Business Meeting', hostName: 'Kwame Mensah', checkInTime: '2026-06-12T08:30:00', badgeNumber: 'V-001' },
  { id: '2', fullName: 'Serwa Asiedu', company: 'AfriBank Ltd', purpose: 'Finance Review', hostName: 'Abena Owusu', checkInTime: '2026-06-12T09:10:00', checkOutTime: '2026-06-12T10:45:00', badgeNumber: 'V-002' },
  { id: '3', fullName: 'Bright Forson', company: 'Logistics Partners', purpose: 'Cargo Pickup', hostName: 'Kofi Asante', checkInTime: '2026-06-12T09:45:00', badgeNumber: 'V-003' },
  { id: '4', fullName: 'Patricia Mensah', company: 'Independent', purpose: 'Job Interview', hostName: 'Ama Boateng', checkInTime: '2026-06-12T10:00:00', checkOutTime: '2026-06-12T11:00:00', badgeNumber: 'V-004' },
  { id: '5', fullName: 'Daniel Appiah', company: 'Apex Supplies', purpose: 'Delivery', hostName: 'Nana Agyei', checkInTime: '2026-06-12T10:30:00', badgeNumber: 'V-005' },
  { id: '6', fullName: 'Grace Ntow', company: 'Gov Regulatory Office', purpose: 'Compliance Inspection', hostName: 'Maame Asare', checkInTime: '2026-06-12T11:00:00', badgeNumber: 'V-006' },
  { id: '7', fullName: 'Samuel Boadu', company: 'IT Solutions Ltd', purpose: 'System Maintenance', hostName: 'Kwesi Ofori', checkInTime: '2026-06-12T11:30:00', checkOutTime: '2026-06-12T13:00:00', badgeNumber: 'V-007' },
  { id: '8', fullName: 'Felicia Osei', company: 'Creative Agency', purpose: 'Marketing Consultation', hostName: 'Yaw Darko', checkInTime: '2026-06-12T13:15:00', badgeNumber: 'V-008' },
  { id: '9', fullName: 'Kofi Bonsu', company: 'Construction Co.', purpose: 'Site Assessment', hostName: 'Adwoa Sarpong', checkInTime: '2026-06-12T14:00:00', expectedTime: '2026-06-12T14:00:00', badgeNumber: 'V-009' },
  { id: '10', fullName: 'Akua Nkansah', company: 'Legal Associates', purpose: 'Contract Review', hostName: 'Maame Asare', checkInTime: '2026-06-12T14:30:00', badgeNumber: 'V-010' },
];

type VisitorRecord = (typeof MOCK_VISITORS)[0];

const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });

interface Props {
  addNotification: (msg: string) => void;
}

export default function VisitorsView({ addNotification }: Props) {
  const [visitors, setVisitors] = useState<VisitorRecord[]>(MOCK_VISITORS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('2026-06-12');
  const [showAdd, setShowAdd] = useState(false);
  const [detailVisitor, setDetailVisitor] = useState<VisitorRecord | null>(null);
  const [form, setForm] = useState({ fullName: '', company: '', purpose: '', hostName: '', expectedTime: '' });

  useEffect(() => {
    supabase.from('visitors').select('*').then(({ data, error }) => {
      if (!error && data && data.length > 0) setVisitors(data as VisitorRecord[]);
    });
  }, []);

  const todayVisitors = visitors.filter(v => v.checkInTime.startsWith(dateFilter));
  const currentlyIn = todayVisitors.filter(v => !v.checkOutTime).length;
  const checkedOut = todayVisitors.filter(v => !!v.checkOutTime).length;
  const expected = visitors.filter(v => v.expectedTime && v.expectedTime.startsWith(dateFilter) && !v.checkInTime).length;

  const filtered = todayVisitors.filter(v => {
    const matchSearch = v.fullName.toLowerCase().includes(search.toLowerCase()) || v.hostName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || (statusFilter === 'Checked In' && !v.checkOutTime) || (statusFilter === 'Checked Out' && !!v.checkOutTime);
    return matchSearch && matchStatus;
  });

  const handleCheckOut = async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from('visitors').update({ checkOutTime: now }).eq('id', id);
    setVisitors(prev => prev.map(v => v.id === id ? { ...v, checkOutTime: now } : v));
    addNotification('Visitor checked out');
  };

  const handleAdd = async () => {
    const newVisitor: VisitorRecord = {
      id: Date.now().toString(),
      fullName: form.fullName,
      company: form.company,
      purpose: form.purpose,
      hostName: form.hostName,
      checkInTime: new Date().toISOString(),
      expectedTime: form.expectedTime || undefined,
      badgeNumber: `V-${String(visitors.length + 1).padStart(3, '0')}`,
    };
    const { error } = await supabase.from('visitors').insert([newVisitor]);
    setVisitors(prev => [newVisitor, ...prev]);
    addNotification(`Visitor ${form.fullName} checked in`);
    setShowAdd(false);
    setForm({ fullName: '', company: '', purpose: '', hostName: '', expectedTime: '' });
    if (error) console.error(error);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: 22 }}>Visitor Registry</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Track and manage visitor access</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1.25rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <Plus size={16} /> Add Visitor
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: "Today's Visitors", value: todayVisitors.length, color: 'var(--accent)', icon: <Users size={18} /> },
          { label: 'Currently In', value: currentlyIn, color: '#10b981', icon: <UserCheck size={18} /> },
          { label: 'Checked Out', value: checkedOut, color: '#64748b', icon: <UserMinus size={18} /> },
          { label: 'Expected', value: expected, color: '#f59e0b', icon: <Clock size={18} /> },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${card.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{card.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or host..."
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13 }}>
          {['All', 'Checked In', 'Checked Out'].map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13 }} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Badge', 'Name', 'Company', 'Purpose', 'Host', 'Check-In', 'Check-Out', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const onSite = !v.checkOutTime;
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => setDetailVisitor(v)}>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{v.badgeNumber}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{v.fullName}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{v.company || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{v.purpose}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{v.hostName}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(v.checkInTime)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{v.checkOutTime ? fmt(v.checkOutTime) : '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: onSite ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                        color: onSite ? '#10b981' : '#64748b' }}>
                        {onSite ? 'On Site' : 'Left'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {onSite && (
                          <button onClick={() => handleCheckOut(v.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.3rem 0.7rem', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <LogOut size={12} /> Check Out
                          </button>
                        )}
                        <button onClick={() => setDetailVisitor(v)}
                          style={{ padding: '0.3rem 0.7rem', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                          <Eye size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No visitors found</div>
        )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 460, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Add Visitor</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                { key: 'fullName', label: 'Full Name' },
                { key: 'company', label: 'Company' },
                { key: 'purpose', label: 'Purpose' },
                { key: 'hostName', label: 'Host Name' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Expected Time</label>
                <input type="datetime-local" value={form.expectedTime} onChange={e => setForm(p => ({ ...p, expectedTime: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdd} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Check In</button>
            </div>
          </div>
        </div>
      )}

      {detailVisitor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 420, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Visitor Details</h3>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{detailVisitor.badgeNumber}</span>
              </div>
              <button onClick={() => setDetailVisitor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                { label: 'Full Name', value: detailVisitor.fullName },
                { label: 'Company', value: detailVisitor.company || '—' },
                { label: 'Purpose', value: detailVisitor.purpose },
                { label: 'Host', value: detailVisitor.hostName },
                { label: 'Check-In', value: fmt(detailVisitor.checkInTime) },
                { label: 'Check-Out', value: detailVisitor.checkOutTime ? fmt(detailVisitor.checkOutTime) : 'Still on site' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <span style={{ padding: '4px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: !detailVisitor.checkOutTime ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                color: !detailVisitor.checkOutTime ? '#10b981' : '#64748b' }}>
                {!detailVisitor.checkOutTime ? 'On Site' : 'Left'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
