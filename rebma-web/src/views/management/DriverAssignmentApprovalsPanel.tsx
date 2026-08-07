// Self-contained "pending driver assignments" list — only renders anything
// when dispatch_needs_management is on and there's something to review.
// Mirrors MaterialRequisitionsPanel's drop-in pattern in MgmtApprovalsView.
import { useState, useEffect } from 'react';
import { Truck, MapPin, Check, X } from 'lucide-react';
import { dispatch as dispatchApi } from '../../services/apiClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';

interface Props {
  addNotification?: (msg: string) => void;
}

export default function DriverAssignmentApprovalsPanel({ addNotification }: Props) {
  const { getSetting } = useCeoSettings();
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof dispatchApi.getPendingDriverAssignments>>>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const enabled = getSetting('dispatch_needs_management', false);

  const load = async () => {
    try { setRequests(await dispatchApi.getPendingDriverAssignments()); } catch { /* table may not exist yet */ }
  };

  useEffect(() => { if (enabled) load(); }, [enabled]);

  if (!enabled || requests.length === 0) return null;

  const decide = async (id: string, approve: boolean) => {
    setDecidingId(id);
    try {
      await dispatchApi.decideDriverAssignment(id, approve);
      addNotification?.(approve ? 'Driver assignment approved — trip link sent.' : 'Driver assignment rejected.');
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      addNotification?.(`Failed to record decision: ${e.message}`);
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Truck size={16} className="text-[var(--accent)]" />
        <h3 className="font-semibold text-[var(--text-primary)]">Pending Driver Assignments ({requests.length})</h3>
      </div>
      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{r.driverName}{r.vehicleId ? ` (${r.vehicleId})` : ''} → {r.customerName}</p>
              {r.deliveryAddress && (
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5"><MapPin size={11} className="shrink-0" /> {r.deliveryAddress}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => decide(r.id, true)}
                disabled={decidingId === r.id}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold disabled:opacity-60"
              >
                <Check size={13} /> Approve
              </button>
              <button
                onClick={() => decide(r.id, false)}
                disabled={decidingId === r.id}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--bg-input)] hover:bg-rose-100 text-rose-500 rounded-lg text-xs font-semibold disabled:opacity-60"
              >
                <X size={13} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
