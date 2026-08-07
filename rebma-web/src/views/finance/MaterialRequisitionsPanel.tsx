// rebma-web/src/views/finance/MaterialRequisitionsPanel.tsx
// Finance's step in the raw-material requisition pipeline: Management has
// approved (status PENDING_FINANCE) — Finance records the internal credit
// entry (this is company stock moving to Production, not a cash sale, but it
// still needs a traceable ledger entry) and forwards it to Operations to
// release the materials.
import { useEffect, useState, useCallback } from 'react';
import { Boxes, ArrowRightCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function FinanceMaterialRequisitionsPanel({ addNotification, currentUser }: Props) {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('material_requisitions')
        .select('*')
        .eq('status', 'PENDING_FINANCE')
        .order('created_at', { ascending: false });
      setRequisitions(data || []);
    } catch {
      setRequisitions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useRealtimeChannel('finance-material-requisitions', ['material_requisitions'], () => load());

  const handleRecord = async (req: any) => {
    if (submittingId) return;
    setSubmittingId(req.id);
    try {
      const items = Array.isArray(req.items) ? req.items : [];
      const summary = items.map((i: any) => `${i.materialName} (${i.quantity}${i.unit ? ' ' + i.unit : ''})`).join(', ') || 'Materials';
      const now = new Date().toISOString();

      await supabase.from('material_requisitions').update({ status: 'APPROVED', updated_at: now }).eq('id', req.id);

      // Traceable internal credit entry — this requisition draws from company
      // stock for Production's own use, not a customer sale, but Finance still
      // needs a recorded data entry before Operations physically releases it.
      await supabase.from('global_audit_history').insert([{
        department: 'FINANCE',
        action: `RECORD_MATERIAL_REQUISITION_CREDIT: ${summary} — requested by ${req.requested_by || 'Production'}`,
        performed_by: currentUser?.fullName || 'Finance',
      }]);

      await supabase.from('fulfillment_tickets').insert({
        type: 'RAW_MATERIAL_RELEASE',
        details: { items, requisitionId: req.id, notes: req.notes },
        status: 'PENDING',
        created_at: now,
        updated_at: now,
      });

      await supabase.from('supplier_order_notifications').insert([{
        message: `Raw material requisition recorded by Finance — ready for release: ${summary}`,
        notified_department: 'OPERATIONS', read: false,
      }]);
      await supabase.from('supplier_order_notifications').insert([{
        message: `Your material request has been recorded by Finance and sent to Operations for release: ${summary}`,
        notified_department: 'PRODUCTION', read: false,
      }]);

      addNotification?.('Requisition recorded and forwarded to Operations.');
      await load();
    } catch (e: any) {
      addNotification?.(e.message || 'Failed to record requisition.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (!loading && requisitions.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Boxes size={16} color="var(--accent)" />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Production Material Requisitions</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>Approved by Management. Record the credit entry and forward to Operations for release.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>}
        {!loading && requisitions.map(req => {
          const items = Array.isArray(req.items) ? req.items : [];
          const summary = items.map((i: any) => `${i.materialName} (${i.quantity}${i.unit ? ' ' + i.unit : ''})`).join(', ') || 'Materials';
          return (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{summary}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  Requested by {req.requested_by || 'Production'} · {req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}{req.notes ? ` · ${req.notes}` : ''}
                </p>
              </div>
              <button
                disabled={submittingId === req.id}
                onClick={() => handleRecord(req)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: submittingId === req.id ? 0.5 : 1, flexShrink: 0 }}
              >
                <ArrowRightCircle size={13} /> {submittingId === req.id ? 'Recording…' : 'Record & Send to Operations'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
