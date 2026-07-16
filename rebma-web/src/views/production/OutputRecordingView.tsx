import React, { useState, useEffect } from 'react';
import { Download, Trash2, Package, Edit, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';

interface OutputRecord {
  id: string;
  date: string;
  product: string;
  received: number;
  unit: string;
  boxes: number;
  sachets: number;
  quality: 'Pass' | 'Fail';
  notes: string;
}

interface Props {
  addNotification: (msg: string) => void;
}

const mapToUI = (db: any): OutputRecord => ({
  id: db.id,
  date: db.date || '',
  product: db.product_name || '',
  received: Number(db.goods_received || 0),
  unit: db.goods_unit || 'kg',
  boxes: Number(db.boxes_produced || 0),
  sachets: Number(db.total_sachets || 0),
  quality: (db.quality_result === 'Fail' ? 'Fail' : 'Pass') as 'Pass' | 'Fail',
  notes: db.notes || '',
});

const mapToDB = (ui: Partial<OutputRecord>) => {
  const db: any = {};
  if (ui.id !== undefined) db.id = ui.id;
  if (ui.date !== undefined) db.date = ui.date;
  if (ui.product !== undefined) db.product_name = ui.product;
  if (ui.received !== undefined) db.goods_received = ui.received;
  // goods_unit is NOT NULL in the live schema with no default — was never
  // set anywhere, so every insert failed with a not-null violation.
  if (ui.unit !== undefined) db.goods_unit = ui.unit;
  if (ui.boxes !== undefined) db.boxes_produced = ui.boxes;
  if (ui.sachets !== undefined) {
    db.total_sachets = ui.sachets;
    if (ui.boxes && ui.boxes > 0) {
      db.sachets_per_box = Math.round(ui.sachets / ui.boxes);
    }
  }
  if (ui.quality !== undefined) db.quality_result = ui.quality;
  if (ui.notes !== undefined) db.notes = ui.notes;
  return db;
};

export default function OutputRecordingView({ addNotification }: Props) {
  const [records, setRecords] = useState<OutputRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], product: '', received: '', unit: 'kg', boxes: '', sachets: '', quality: 'Pass' as 'Pass' | 'Fail', notes: '' });
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<OutputRecord | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('production_logs').select('*').order('date', { ascending: false });
        if (!error && data) setRecords(data.map(mapToUI));
        else setRecords([]);
      } catch {
        setRecords([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter(r => r.date === today);
  const todayBoxes = todayRecords.reduce((s, r) => s + r.boxes, 0);
  const todaySachets = todayRecords.reduce((s, r) => s + r.sachets, 0);
  const totalPass = records.filter(r => r.quality === 'Pass').length;
  const passRate = records.length ? Math.round((totalPass / records.length) * 100) : 0;
  const totalBoxes = records.reduce((s, r) => s + r.boxes, 0);
  const totalSachets = records.reduce((s, r) => s + r.sachets, 0);

  const handleSubmit = async () => {
    // Previously a silent no-op — clicking Submit with any of these blank
    // did nothing and gave no feedback, which looks exactly like a broken
    // button.
    if (!form.product.trim()) { alert('Product name is required.'); return; }
    if (!form.boxes) { alert('Boxes Produced is required.'); return; }
    if (!form.sachets) { alert('Sachets Produced is required.'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      // id is a UUID column with a gen_random_uuid() default — let the DB
      // generate it instead of fabricating a Date.now() numeric string,
      // which Postgres rejects outright ("invalid input syntax for type uuid").
      const newRecordInput: Partial<OutputRecord> = {
        date: form.date,
        product: form.product,
        received: Number(form.received),
        unit: form.unit,
        boxes: Number(form.boxes),
        sachets: Number(form.sachets),
        quality: form.quality,
        notes: form.notes,
      };

      const dbData = mapToDB(newRecordInput);
      dbData.record_number = `REC-${Date.now().toString().slice(-6)}`;

      const { data, error } = await supabase.from('production_logs').insert([dbData]).select();
      if (!error) {
        const inserted = data?.[0] ? mapToUI(data[0]) : { ...newRecordInput, id: dbData.record_number } as OutputRecord;
        setRecords(prev => [inserted, ...prev]);
        addNotification(`Output recorded for ${form.product}`);
        setForm({ date: new Date().toISOString().split('T')[0], product: '', received: '', unit: 'kg', boxes: '', sachets: '', quality: 'Pass', notes: '' });
      } else {
        alert(error.message || 'Failed to insert output record');
      }
    } catch (e: any) {
      alert(e.message || 'Error inserting record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (r: OutputRecord) => {
    setEditForm(r);
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    if (!editForm) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const dbData = mapToDB(editForm);
      const { error } = await supabase.from('production_logs').update(dbData).eq('id', editForm.id);
      if (!error) {
        setRecords(prev => prev.map(r => r.id === editForm.id ? editForm : r));
        addNotification(`Output record updated for ${editForm.product}`);
        setShowEdit(false);
        setEditForm(null);
      } else {
        alert(error.message || 'Failed to update record');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (submitting) return;
    if (!await confirm('Are you sure you want to delete this production record?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('production_logs').delete().eq('id', id);
      if (!error) {
        setRecords(prev => prev.filter(r => r.id !== id));
        addNotification('Record deleted');
      } else {
        alert(error.message || 'Failed to delete record');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    exportToCSV(records, ['date','product','received','unit','boxes','sachets','quality','notes'], 'production_output');
  };

  const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Production Output Recording</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Log and track daily production output</p>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 4px' }}>Today</p>
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: 0 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 4px' }}>Boxes Today</p>
          <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 22, margin: 0 }}>{todayBoxes}</p>
        </div>
        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 4px' }}>Sachets Today</p>
          <p style={{ fontWeight: 700, color: '#7c3aed', fontSize: 22, margin: 0 }}>{todaySachets.toLocaleString()}</p>
        </div>
        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 4px' }}>Quality Pass Rate</p>
          <p style={{ fontWeight: 700, color: '#059669', fontSize: 22, margin: 0 }}>{passRate}%</p>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>Record New Output</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Product</label>
            <input value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} placeholder="Product name" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Goods Received</label>
            <input type="number" value={form.received} onChange={e => setForm(f => ({ ...f, received: e.target.value }))} placeholder="From operations" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Unit</label>
            <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle}>
              {['kg', 'tons', 'liters', 'bags', 'units'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Boxes Produced</label>
            <input type="number" value={form.boxes} onChange={e => setForm(f => ({ ...f, boxes: e.target.value }))} placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Sachets Produced</label>
            <input type="number" value={form.sachets} onChange={e => setForm(f => ({ ...f, sachets: e.target.value }))} placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Quality Check</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Pass', 'Fail'] as const).map(q => (
                <button key={q} onClick={() => setForm(f => ({ ...f, quality: q }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: form.quality === q ? (q === 'Pass' ? '#059669' : '#dc2626') : 'var(--bg-input)', color: form.quality === q ? '#fff' : 'var(--text-secondary)' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any observations..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <button onClick={handleSubmit} disabled={submitting} style={{ marginTop: 16, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 15, opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Submitting...' : 'Submit Record'}</button>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Output History</h2>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
        {loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
        {!loading && <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Product', 'Received', 'Boxes', 'Sachets', 'Quality', 'Notes', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13, whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td style={{ padding: '12px', color: 'var(--text-primary)', fontSize: 13 }}>{r.product}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>{r.received} {r.unit}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>{r.boxes}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center' }}>{r.sachets.toLocaleString()}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: r.quality === 'Pass' ? 'rgba(16,185,129,0.15)' : 'rgba(220,38,38,0.15)', color: r.quality === 'Pass' ? '#059669' : '#dc2626' }}>{r.quality}</span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 12, maxWidth: 160 }}>{r.notes || '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleEditClick(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }} title="Edit"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-sm">No output records yet</p>
              <p className="text-xs mt-1">They will appear here once added</p>
            </div>
          )}
        </div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {[
          { label: 'Total Boxes', value: totalBoxes.toLocaleString(), color: 'var(--accent)' },
          { label: 'Total Sachets', value: totalSachets.toLocaleString(), color: '#7c3aed' },
          { label: 'Quality Pass Rate', value: `${passRate}%`, color: '#059669' },
          { label: 'Total Records', value: records.length, color: '#d97706' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: 26, fontWeight: 700, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {showEdit && editForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '24px', width: '100%', maxWidth: 480, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>Edit Production Output</h3>
              <button onClick={() => { setShowEdit(false); setEditForm(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Product</label>
                <input value={editForm.product} onChange={e => setEditForm({ ...editForm, product: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Date</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Goods Received</label>
                <input type="number" value={editForm.received} onChange={e => setEditForm({ ...editForm, received: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Unit</label>
                <select value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} style={inputStyle}>
                  {['kg', 'tons', 'liters', 'bags', 'units'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Boxes Produced</label>
                <input type="number" value={editForm.boxes} onChange={e => setEditForm({ ...editForm, boxes: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Sachets Produced</label>
                <input type="number" value={editForm.sachets} onChange={e => setEditForm({ ...editForm, sachets: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Quality Check</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['Pass', 'Fail'] as const).map(q => (
                    <button key={q} onClick={() => setEditForm({ ...editForm, quality: q })} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: editForm.quality === q ? (q === 'Pass' ? '#059669' : '#dc2626') : 'var(--bg-input)', color: editForm.quality === q ? '#fff' : 'var(--text-secondary)' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Notes (optional)</label>
                <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Any observations..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowEdit(false); setEditForm(null); }} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={handleEditSave} disabled={submitting} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14, opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
