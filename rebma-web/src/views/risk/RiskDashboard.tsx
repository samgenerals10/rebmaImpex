// rebma-web/src/views/risk/RiskDashboard.tsx
//
// Risk's landing screen. Kept deliberately light — Risk's real work happens
// in RiskApprovalsView.tsx (the actual queues) — this is just an at-a-glance
// summary plus the shared cross-department widgets every other department's
// Overview already embeds (PendingApprovalsAlert, ApprovalHistoryPanel).
import { useEffect, useState } from 'react';
import { RefreshCw, Package, CreditCard, Camera, UserCheck, ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import PendingApprovalsAlert from '../../components/global/PendingApprovalsAlert';
import ApprovalHistoryPanel from '../../components/global/ApprovalHistoryPanel';
import CountUp from '../../components/CountUp';

interface Props {
  addNotification?: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function RiskDashboard({ addNotification, setActiveSubTab, currentUser }: Props) {
  const [loading, setLoading] = useState(true);
  const [cargoCount, setCargoCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [finalReleaseCount, setFinalReleaseCount] = useState(0);
  const [podCount, setPodCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);
  const [creditWatchCount, setCreditWatchCount] = useState(0);
  const [approvedToday, setApprovedToday] = useState(0);
  const [rejectedToday, setRejectedToday] = useState(0);
  // CEO Control Center — Risk Controls: "Customer Verification Required".
  // Verification itself stays non-blocking (a pending customer can still
  // be ordered for) — this only changes whether the tile below reads as
  // urgent or advisory.
  const [verificationRequired, setVerificationRequired] = useState(true);

  const firstName = currentUser?.fullName?.split(' ')[0] || 'Reviewer';

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [cargo, orders, finalRelease, pod, customersPending, todayLogs, onHoldCustomers, limitedCustomers, creditOrders] = await Promise.all([
        supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_APPROVAL'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_RELEASE'),
        supabase.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_REVIEW'),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('status', 'PENDING').then(r => r, () => ({ count: 0 })),
        supabase.from('global_audit_history').select('action').eq('department', 'RISK')
          .gte('timestamp', `${today}T00:00:00.000Z`).lte('timestamp', `${today}T23:59:59.999Z`),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('credit_status', 'ON_HOLD').then(r => r, () => ({ count: 0 })),
        supabase.from('customers').select('id, credit_limit').not('credit_limit', 'is', null).then(r => r, () => ({ data: [] as any[] })),
        supabase.from('orders').select('customer_id, client_name, total_amount, amount_paid').eq('payment_mode', 'CREDIT')
          .not('status', 'in', '(REJECTED,CANCELLED,RETURNED_FOR_CORRECTION)').then(r => r, () => ({ data: [] as any[] })),
      ]);
      setCargoCount(cargo.count ?? 0);
      setOrdersCount(orders.count ?? 0);
      setFinalReleaseCount(finalRelease.count ?? 0);
      setPodCount(pod.count ?? 0);
      setCustomersCount(customersPending.count ?? 0);
      const rows = todayLogs.data || [];
      setApprovedToday(rows.filter((r: any) => String(r.action).startsWith('APPROVE')).length);
      setRejectedToday(rows.filter((r: any) => String(r.action).startsWith('REJECT')).length);

      // Credit Watch: on-hold customers + customers whose outstanding credit
      // exposure has reached or exceeded their individual limit.
      const creditRows = creditOrders.data || [];
      let overLimit = 0;
      for (const c of (limitedCustomers.data || [])) {
        const outstanding = creditRows
          .filter((o: any) => o.customer_id === c.id)
          .reduce((s: number, o: any) => s + Math.max((Number(o.total_amount) || 0) - (Number(o.amount_paid) || 0), 0), 0);
        if (outstanding >= Number(c.credit_limit)) overLimit++;
      }
      setCreditWatchCount((onHoldCustomers.count ?? 0) + overLimit);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'risk_customer_verification_required').maybeSingle()
      .then(({ data }) => setVerificationRequired(data?.setting_value !== false));
  }, []);

  const goToApprovals = () => setActiveSubTab?.('RiskApprovals');
  const goToCredit = () => setActiveSubTab?.('CustomerCredit');

  const tiles = [
    { label: verificationRequired ? 'Customers Awaiting Verification (Required)' : 'Customers Awaiting Verification', value: customersCount, icon: UserCheck, color: verificationRequired && customersCount > 0 ? '#ef4444' : '#8b5cf6', onClick: goToApprovals },
    { label: 'Cargo Awaiting Review', value: cargoCount, icon: Package, color: '#0ea5e9', onClick: goToApprovals },
    { label: 'Orders Awaiting Review', value: ordersCount, icon: CreditCard, color: '#6366f1', onClick: goToApprovals },
    { label: 'Awaiting Final Release', value: finalReleaseCount, icon: ShieldCheck, color: '#e11d48', onClick: goToApprovals },
    { label: 'Proof of Delivery to Review', value: podCount, icon: Camera, color: '#f59e0b', onClick: goToApprovals },
    { label: 'Credit Watch', value: creditWatchCount, icon: ShieldAlert, color: '#ef4444', onClick: goToCredit },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{timeGreeting()}, {firstName}</h1>
          <p className="text-sm text-[var(--text-secondary)]">Risk & Compliance — customer, credit, cargo and delivery review</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <PendingApprovalsAlert department="RISK" onNavigate={setActiveSubTab} addNotification={addNotification} />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {tiles.map(({ label, value, icon: Icon, color, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 text-left hover:border-[var(--accent)] transition-colors cursor-pointer w-full"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]"><CountUp value={value} /></p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-xs text-[var(--text-muted)]">Approved Today</p>
          <p className="text-xl font-bold text-emerald-500"><CountUp value={approvedToday} /></p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-xs text-[var(--text-muted)]">Rejected Today</p>
          <p className="text-xl font-bold text-rose-500"><CountUp value={rejectedToday} /></p>
        </div>
      </div>

      <button
        onClick={goToApprovals}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white text-sm font-semibold hover:opacity-90"
        style={{ background: 'var(--accent)' }}
      >
        Go to Approvals Queue <ArrowRight size={16} />
      </button>

      <ApprovalHistoryPanel department="RISK" title="Recent Risk Decisions" />
    </div>
  );
}
