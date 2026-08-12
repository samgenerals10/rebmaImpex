// src/views/dispatch/ProofOfDeliveryView.tsx
import { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, Clock, Upload, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SidePanel from '../../components/ui/SidePanel';
import { uploadFile } from '../../utils/uploadFile';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
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

const STATUS_STYLES = {
  pending_proof: 'bg-amber-100 text-amber-700',
  confirmed:     'bg-emerald-100 text-emerald-700',
  disputed:      'bg-rose-100 text-rose-700',
};

interface Props { currentUser: CurrentUser | null; addNotification: (msg: string) => void }

export default function ProofOfDeliveryView({ addNotification }: Props) {
  const { getSetting } = useCeoSettings();
  const [rows, setRows]       = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProof, setViewProof] = useState<Delivery | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_logs')
        .select('*, orders:order_id(client_name, destination)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching delivery logs:', error);
      }

      const mapped: Delivery[] = (data || []).map((row: any) => {
        // Map database status to UI states
        let uiStatus: Delivery['status'] = 'pending_proof';
        if (row.status === 'DELIVERED') {
          uiStatus = 'confirmed';
        } else if (row.status === 'FAILED') {
          uiStatus = 'disputed';
        }

        return {
          id: row.id,
          order_id: row.order_id || 'N/A',
          customer: row.orders?.client_name || 'Generic Client',
          address: row.orders?.destination || 'N/A',
          driver: row.driver_name || 'Unassigned Driver',
          proof_url: row.proof_photo || undefined,
          status: uiStatus,
          delivered_at: row.delivered_at || undefined,
        };
      });

      setRows(mapped);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markConfirmed = async (id: string) => {
    const target = rows.find(r => r.id === id);
    if (getSetting('proof_of_delivery_required', false) && !target?.proof_url) {
      addNotification('A proof-of-delivery photo is required by the CEO before this can be confirmed.');
      return;
    }
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed', delivered_at: new Date().toISOString() } : r));
    try {
      await supabase
        .from('delivery_logs')
        .update({
          status: 'DELIVERED',
          delivered_at: new Date().toISOString()
        })
        .eq('id', id);
      addNotification(`Delivery ${id} confirmed.`);
      load();
    } catch (e) {
      console.error(e);
      addNotification(`Failed to confirm delivery ${id}.`);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = (id: string) => {
    setUploadTargetId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetId;
    e.target.value = '';
    if (!file || !targetId) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, 'delivery-proofs', targetId);
      if (!url) throw new Error('Upload failed.');
      const { error } = await supabase.from('delivery_logs').update({ proof_photo: url }).eq('id', targetId);
      if (error) throw error;
      addNotification('Proof of delivery uploaded.');
      await load();
    } catch (err: any) {
      addNotification(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadTargetId(null);
    }
  };

  const pending   = rows.filter(r => r.status === 'pending_proof');
  const confirmed = rows.filter(r => r.status === 'confirmed');
  const disputed  = rows.filter(r => r.status === 'disputed');

  return (
    <div className="space-y-5">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
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
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl text-[var(--text-muted)] gap-2">
          <CheckCircle size={32} className="opacity-30" />
          <p className="text-sm">No delivery logs found. Create cargo orders to see items here.</p>
        </div>
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
                    <span className="text-[9px] font-bold text-[var(--text-muted)]">{row.id} ({row.order_id})</span>
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
                      <button
                        onClick={() => handleUpload(row.id)}
                        disabled={uploading && uploadTargetId === row.id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-lg cursor-pointer hover:bg-[var(--accent-light)] disabled:opacity-60"
                      >
                        <Upload className="w-3.5 h-3.5" /> {uploading && uploadTargetId === row.id ? 'Uploading...' : 'Upload'}
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
      <SidePanel
        open={!!viewProof}
        onClose={() => setViewProof(null)}
        title="Proof of Delivery"
        subtitle={viewProof?.order_id}
      >
        {viewProof && (
          <div className="flex flex-col gap-4 -mx-5 -mt-4">
            <img src={viewProof.proof_url} alt="Proof of delivery" className="w-full object-cover max-h-80" />
            <div className="px-5">
              <p className="text-xs text-[var(--text-secondary)]"><strong>Customer:</strong> {viewProof.customer}</p>
              <p className="text-xs text-[var(--text-secondary)]"><strong>Driver:</strong> {viewProof.driver}</p>
              {viewProof.delivered_at && <p className="text-xs text-emerald-600 font-semibold mt-1">{new Date(viewProof.delivered_at).toLocaleString('en-GB')}</p>}
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
