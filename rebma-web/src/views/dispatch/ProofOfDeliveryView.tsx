// src/views/dispatch/ProofOfDeliveryView.tsx
import { useState, useEffect } from 'react';
import { Camera, CheckCircle, Clock, Upload, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface Delivery {
  id: string;
  order_id: string;
  customer: string;
  address: string;
  driver: string;
  proof_url?: string;
  status: 'pending_proof' | 'confirmed' | 'disputed';
  delivered_at?: string;
}

const MOCK: Delivery[] = Array.from({ length: 8 }, (_, i) => ({
  id: `DEL-${String(i+1).padStart(3,'0')}`,
  order_id: `ORD-${String(i+100).padStart(4,'0')}`,
  customer: ['Accra Traders','Gulf Imports','Kama Industries','Prime Suppliers','Delta Logistics'][i % 5],
  address: ['123 High Street, Accra','45 Liberation Rd','Plot 7, Spintex','Ring Rd East','Tema Community 1'][i % 5],
  driver: ['Kwesi Asante','Kofi Mensah','Ama Serwaa','Kojo Boateng'][i % 4],
  proof_url: i < 3 ? '/logo.png' : undefined,
  status: i < 3 ? 'confirmed' : i < 6 ? 'pending_proof' : 'disputed',
  delivered_at: i < 3 ? new Date(Date.now() - i * 86400000).toISOString() : undefined,
}));

const STATUS_STYLES = {
  pending_proof: 'bg-amber-100 text-amber-700',
  confirmed:     'bg-emerald-100 text-emerald-700',
  disputed:      'bg-rose-100 text-rose-700',
};

interface Props { currentUser: CurrentUser | null; addNotification: (msg: string) => void }

export default function ProofOfDeliveryView({ currentUser, addNotification }: Props) {
  const [rows, setRows]       = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProof, setViewProof] = useState<Delivery | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('deliveries').select('*').in('status', ['pending_proof','confirmed','disputed']).order('id', { ascending: false }).limit(50);
        setRows(data && data.length > 0 ? data : MOCK);
      } catch { setRows(MOCK); }
      setLoading(false);
    };
    load();
  }, []);

  const markConfirmed = async (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed', delivered_at: new Date().toISOString() } : r));
    try { await supabase.from('deliveries').update({ status: 'confirmed', delivered_at: new Date().toISOString() }).eq('id', id); } catch {}
    addNotification(`Delivery ${id} confirmed.`);
  };

  const handleUpload = (id: string) => {
    // In a real app this would open a file picker and upload to Supabase Storage
    addNotification('Photo upload feature requires Supabase Storage configuration.');
  };

  const pending   = rows.filter(r => r.status === 'pending_proof');
  const confirmed = rows.filter(r => r.status === 'confirmed');
  const disputed  = rows.filter(r => r.status === 'disputed');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Proof of Delivery</h2>
        <p className="text-xs text-[var(--text-muted)]">Upload and confirm delivery documentation</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Proof', count: pending.length,   cls: 'text-amber-600',   bg: 'bg-amber-50' },
          { label: 'Confirmed',     count: confirmed.length, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Disputed',      count: disputed.length,  cls: 'text-rose-600',    bg: 'bg-rose-50' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} border border-[var(--border)] rounded-2xl p-4`}>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-extrabold ${s.cls} mt-1`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${row.status === 'confirmed' ? 'bg-emerald-100' : row.status === 'disputed' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                  {row.status === 'confirmed' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : row.status === 'disputed' ? <Camera className="w-5 h-5 text-rose-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{row.customer}</p>
                    <span className="text-[9px] font-bold text-[var(--text-muted)]">{row.order_id}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[row.status]}`}>{row.status.replace('_',' ')}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{row.address} · Driver: {row.driver}</p>
                  {row.delivered_at && <p className="text-[9px] text-emerald-600 font-semibold">{new Date(row.delivered_at).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.proof_url && (
                    <button onClick={() => setViewProof(row)} className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-lg cursor-pointer hover:opacity-90">
                      <Eye className="w-3.5 h-3.5" /> View Proof
                    </button>
                  )}
                  {row.status === 'pending_proof' && (
                    <>
                      <button onClick={() => handleUpload(row.id)} className="flex items-center gap-1 px-2.5 py-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-lg cursor-pointer hover:bg-[var(--accent-light)]">
                        <Upload className="w-3.5 h-3.5" /> Upload
                      </button>
                      <button onClick={() => markConfirmed(row.id)} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-emerald-600">
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proof viewer modal */}
      {viewProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setViewProof(null)}>
          <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Proof of Delivery — {viewProof.order_id}</h3>
              <button onClick={() => setViewProof(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer font-bold text-xs">Close</button>
            </div>
            <img src={viewProof.proof_url} alt="Proof of delivery" className="w-full object-cover max-h-80" />
            <div className="p-4">
              <p className="text-xs text-[var(--text-secondary)]"><strong>Customer:</strong> {viewProof.customer}</p>
              <p className="text-xs text-[var(--text-secondary)]"><strong>Driver:</strong> {viewProof.driver}</p>
              {viewProof.delivered_at && <p className="text-xs text-emerald-600 font-semibold mt-1">{new Date(viewProof.delivered_at).toLocaleString('en-GB')}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
