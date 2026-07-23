// rebma-web/src/views/management/MaterialRequisitionsPanel.tsx
// Raw-material requisition front-half of the production pipeline: Production
// requests materials -> Management approves here (-> PENDING_FINANCE, Finance
// notified) or rejects -> Finance records the internal credit and forwards it
// -> Operations releases the materials. Kept as its own panel rather than
// threading a new type through MgmtApprovalsView's generic ApprovalItem union.
import { useEffect, useState, useCallback } from 'react';
import { Boxes, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function MaterialRequisitionsPanel({ addNotification, currentUser }: Props) {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  // Management can adjust a requested quantity before approving — keyed by
  // `${requisitionId}:${itemIndex}` so edits don't clash across rows. Falls
  // back to the originally-requested quantity for any item left untouched.
  const [itemEdits, setItemEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('material_requisitions')
        .select('*')
        .eq('status', 'PENDING_MANAGEMENT')
        .order('created_at', { ascending: false });
      setRequisitions(data || []);
    } catch {
      setRequisitions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('mgmt-material-requisitions-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_requisitions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleDecision = async (req: any, approve: boolean) => {
    if (submittingId) return;
    setSubmittingId(req.id);
    try {
      const originalItems = Array.isArray(req.items) ? req.items : [];
      // Substitute Management's edited quantity per line item, if any —
      // whatever's approved here is what Finance/Operations act on downstream.
      const items = approve
        ? originalItems.map((i: any, idx: number) => {
            const draft = itemEdits[`${req.id}:${idx}`];
            const qty = draft !== undefined ? Math.max(0, Number(draft) || 0) : i.quantity;
            return { ...i, quantity: qty };
          })
        : originalItems;
      const summary = items.map((i: any) => `${i.materialName} (${i.quantity}${i.unit ? ' ' + i.unit : ''})`).join(', ') || 'Materials';

      await supabase
        .from('material_requisitions')
        .update({ status: approve ? 'PENDING_FINANCE' : 'REJECTED', items, updated_at: new Date().toISOString() })
        .eq('id', req.id);

      if (approve) {
        await supabase.from('supplier_order_notifications').insert([{
          message: `Raw material requisition approved by Management — awaiting Finance recording: ${summary} (requested by ${req.requested_by || 'Production'})`,
          notified_department: 'FINANCE', read: false,
        }]);
      } else {
        await supabase.from('supplier_order_notifications').insert([{
          message: `Raw material requisition REJECTED by Management: ${summary}`,
          notified_department: 'PRODUCTION', read: false,
        }]);
      }

      await supabase.from('global_audit_history').insert([{
        department: 'MANAGEMENT',
        action: `${approve ? 'APPROVE' : 'REJECT'}_MATERIAL_REQUISITION: ${summary}`,
        performed_by: currentUser?.fullName || 'Management',
      }]);

      addNotification?.(`Material requisition ${approve ? 'approved — sent to Finance' : 'rejected'}.`);
      setItemEdits(prev => {
        const next = { ...prev };
        originalItems.forEach((_: any, idx: number) => { delete next[`${req.id}:${idx}`]; });
        return next;
      });
      await load();
    } catch (e: any) {
      addNotification?.(e.message || 'Failed to process requisition.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (!loading && requisitions.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Boxes size={16} color="var(--accent)" />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Raw Material Requisitions</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>Production is requesting these materials before processing can begin. Approving sends it to Finance to record; rejecting sends it back.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>}
        {!loading && requisitions.map(req => {
          const items = Array.isArray(req.items) ? req.items : [];
          return (
            <div key={req.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  Requested by {req.requested_by || 'Production'} · {req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}{req.notes ? ` · ${req.notes}` : ''}
                </p>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    disabled={submittingId === req.id}
                    onClick={() => handleDecision(req, true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: submittingId === req.id ? 0.5 : 1 }}
                  >
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button
                    disabled={submittingId === req.id}
                    onClick={() => handleDecision(req, false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: submittingId === req.id ? 0.5 : 1 }}
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((item: any, idx: number) => {
                  const key = `${req.id}:${idx}`;
                  const draft = itemEdits[key];
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>{item.materialName}</span>
                      <input
                        type="number"
                        min={0}
                        value={draft !== undefined ? draft : String(item.quantity ?? '')}
                        onChange={e => setItemEdits(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{ width: 72, fontSize: 12, fontFamily: 'monospace', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 32 }}>{item.unit || 'units'}</span>
                      {draft !== undefined && Number(draft) !== item.quantity && (
                        <span style={{ fontSize: 10, color: '#b45309' }}>was {item.quantity}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
