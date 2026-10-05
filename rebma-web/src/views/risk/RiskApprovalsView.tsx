// rebma-web/src/views/risk/RiskApprovalsView.tsx
//
// Risk's approval queue — Customer Verification, Cargo Intake, Sales Order
// (cash + credit alike), and Proof of Delivery. Modeled directly on
// src/views/management/MgmtApprovalsView.tsx: the Cargo Intake and Sales
// Order approve/reject logic below is Management's original pipeline
// (stock upsert, stock-ledger entry, damage write-off, notification
// fan-out) copied over, not reinvented — only the source status filters and
// outcome values changed, per the "reuse, don't rebuild" principle behind
// the Risk department.
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { management } from '../../services/apiClient';
import { sendNotification } from '../../utils/sendNotification';
import {
  CheckCircle, XCircle, RotateCcw, Clock, Search,
  MoreVertical, ArrowLeft, Package, CreditCard, Camera,
  FileText, RefreshCw, Download, Eye, UserCheck, ExternalLink, History,
  ShieldCheck
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import InvoiceLineItems from '../../components/InvoiceLineItems';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import ApprovalHistoryPanel from '../../components/global/ApprovalHistoryPanel';
import RequestTimelinePanel from '../../components/global/RequestTimelinePanel';
import { useFullscreenToggle, FullscreenButton } from '../../components/global/FullscreenToggle';
import CountUp from '../../components/CountUp';

interface ApprovalItem {
  id: string;
  requestId: string;
  type: 'Customer Verification' | 'Cargo Intake' | 'Sales Order' | 'Risk Final Release' | 'Proof of Delivery';
  description: string;
  department: string;
  amount: number | null;
  date: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned' | 'Escalated';
  submittedBy: string;
  raw?: Record<string, unknown>;
}

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  'Customer Verification': 'bg-violet-100 text-violet-700',
  'Cargo Intake': 'bg-blue-100 text-blue-700',
  'Sales Order': 'bg-purple-100 text-purple-700',
  'Risk Final Release': 'bg-rose-100 text-rose-700',
  'Proof of Delivery': 'bg-cyan-100 text-cyan-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: 'text-red-500',
  Medium: 'text-yellow-500',
  Low: 'text-green-500',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Returned: 'bg-orange-100 text-orange-700',
  Escalated: 'bg-indigo-100 text-indigo-700',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  'Customer Verification': UserCheck,
  'Cargo Intake': Package,
  'Sales Order': CreditCard,
  'Risk Final Release': ShieldCheck,
  'Proof of Delivery': Camera,
};

const TABS = ['All', 'Cargo Intake', 'Sales Order', 'Risk Final Release', 'Proof of Delivery', 'Customer Verification'] as const;

export default function RiskApprovalsView({ addNotification, currentUser }: Props) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('All');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [todayApproved, setTodayApproved] = useState(0);
  const [todayRejected, setTodayRejected] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Every customer (not just PENDING-verification ones) + their live credit
  // orders, so the Sales Order lane's Customer Credit Position card can show
  // real exposure. Separate from mappedCustomers' PENDING-only fetch, which
  // stays untouched so the verification queue's own scope doesn't change.
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [creditOrders, setCreditOrders] = useState<any[]>([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const tableFullscreen = useFullscreenToggle();

  useEffect(() => {
    loadApprovals();
    loadHistory();
  }, []);

  // Parses "APPROVE: CARGO-xxxxxx — description | Note: reason" (the exact
  // format confirmAction below writes) back into a viewable row — same
  // convention Management's queue already uses for its own history.
  async function loadHistory() {
    try {
      const { data } = await supabase
        .from('global_audit_history')
        .select('*')
        .eq('department', 'RISK')
        .order('timestamp', { ascending: false })
        .limit(100);
      const parsed: ApprovalItem[] = (data || [])
        .map((row: any): ApprovalItem | null => {
          const m = String(row.action || '').match(/^(APPROVE|REJECT|RETURN|ESCALATE)[A-Z_]*:\s*([\w-]+)\s*(?:—|,)\s*(.+)$/i)  // older entries use a dash, newer ones a comma;
          if (!m) return null;
          const [, verb, requestId, rest] = m;
          const noteMatch = rest.match(/^(.*?)(?:\s*\|\s*Note:\s*(.*))?$/);
          const description = noteMatch?.[1]?.trim() || rest;
          const reason = noteMatch?.[2]?.trim();
          const inferredType: ApprovalItem['type'] =
            requestId.startsWith('CARGO') ? 'Cargo Intake'
            : requestId.startsWith('ORD') ? 'Sales Order'
            : requestId.startsWith('POD') ? 'Proof of Delivery'
            : requestId.startsWith('CUST') ? 'Customer Verification'
            : 'Cargo Intake';
          const status: ApprovalItem['status'] =
            /^approve/i.test(verb) ? 'Approved'
            : /^reject/i.test(verb) ? 'Rejected'
            : /^return/i.test(verb) ? 'Returned'
            : 'Escalated';
          return {
            id: row.id,
            requestId,
            type: inferredType,
            description: reason ? `${description}, Reason: ${reason}` : description,
            department: row.department || 'RISK',
            amount: null,
            date: row.timestamp ? row.timestamp.slice(0, 10) : '',
            priority: 'Medium' as const,
            status,
            submittedBy: row.performed_by || 'Risk',
            raw: { timestamp: row.timestamp },
          };
        })
        .filter((r): r is ApprovalItem => r !== null);
      setHistoryItems(parsed);
    } catch {
      setHistoryItems([]);
    }
  }

  async function loadApprovals() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from('global_audit_history')
      .select('action')
      .eq('department', 'RISK')
      .gte('timestamp', `${today}T00:00:00.000Z`)
      .lte('timestamp', `${today}T23:59:59.999Z`)
      .then(({ data }) => {
        const rows = data || [];
        setTodayApproved(rows.filter((r: any) => String(r.action).startsWith('APPROVE')).length);
        setTodayRejected(rows.filter((r: any) => String(r.action).startsWith('REJECT')).length);
      }, () => {});
    try {
      const [
        { data: customersData },
        { data: cargoData },
        { data: ordersData },
        { data: finalReleaseData },
        { data: podData },
        { data: allCustomersData },
        { data: creditOrdersData },
      ] = await Promise.all([
        supabase.from('customers').select('*').eq('status', 'PENDING').order('registered_at', { ascending: false }).limit(50).then(r => r, () => ({ data: [] })),
        supabase.from('cargo_intake').select('*').eq('status', 'PENDING_RISK_APPROVAL').order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('*').eq('status', 'PENDING_RISK').order('created_at', { ascending: false }).limit(50),
        // Risk Final Release Check — the new second gate, after Accounts.
        supabase.from('orders').select('*').eq('status', 'PENDING_RISK_RELEASE').order('created_at', { ascending: false }).limit(50),
        supabase.from('delivery_logs').select('*, orders:order_id(client_name, destination, total_amount), drivers:driver_id(user_id, name)').eq('status', 'PENDING_RISK_REVIEW').order('created_at', { ascending: false }).limit(50).then(r => r, () => ({ data: [] })),
        // Customer Credit Position card (Sales Order lane) needs every
        // customer's terms, not just the ones pending verification.
        supabase.from('customers').select('id, name, credit_limit, credit_status').then(r => r, () => ({ data: [] })),
        supabase.from('orders').select('id, customer_id, client_name, total_amount, amount_paid, payment_mode, status')
          .eq('payment_mode', 'CREDIT').not('status', 'in', '(REJECTED,CANCELLED,RETURNED_FOR_CORRECTION)')
          .then(r => r, () => ({ data: [] })),
      ]);
      setAllCustomers(allCustomersData || []);
      setCreditOrders(creditOrdersData || []);

      const mappedCustomers: ApprovalItem[] = (customersData || []).map((row: any) => ({
        id: row.id,
        requestId: `CUST-${String(row.id).slice(-6).toUpperCase()}`,
        type: 'Customer Verification' as const,
        description: `${row.name || 'Unnamed customer'}${row.company_name ? `, ${row.company_name}` : ''}`,
        department: 'MARKETING',
        amount: null,
        date: row.registered_at?.slice(0, 10) || '',
        priority: 'Medium' as const,
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.name || 'Marketing',
        raw: row,
      }));

      const mappedCargo: ApprovalItem[] = (cargoData || []).map((row: any) => {
        const baseDesc = `${row.product_name || 'Goods'}, ${row.qty_received || row.quantity || 0} ${row.goods_type || 'units'} from ${row.company || 'supplier'}`;
        const description = row.discrepancies && row.discrepancies.trim() !== ''
          ? `${baseDesc} (Discrepancy: ${row.discrepancies})`
          : baseDesc;
        return {
          id: row.id,
          requestId: `CARGO-${row.id.slice(-6).toUpperCase()}`,
          type: 'Cargo Intake' as const,
          description,
          department: 'OPERATIONS',
          amount: row.unit_price ? Number(row.unit_price) * (row.qty_received || row.quantity || 0) : null,
          date: row.created_at?.slice(0, 10) || '',
          priority: 'High' as const,
          status: 'Pending' as ApprovalItem['status'],
          submittedBy: row.company || 'Operations',
          raw: row,
        };
      });

      const mappedOrders: ApprovalItem[] = (ordersData || []).map((row: any) => ({
        id: row.id,
        requestId: `ORD-${row.id.slice(-6).toUpperCase()}`,
        type: 'Sales Order' as const,
        description: `${row.payment_mode === 'CREDIT' ? 'Credit order' : `${row.payment_mode || 'Cash'} order`} for ${row.client_name}, GHS ${Number(row.total_amount || 0).toLocaleString()}`,
        department: 'MARKETING',
        amount: Number(row.total_amount || 0),
        date: row.created_at?.slice(0, 10) || '',
        priority: 'High' as const,
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.client_name || 'Marketing',
        raw: row,
      }));

      const mappedPod: ApprovalItem[] = (podData || []).map((row: any) => ({
        id: row.id,
        requestId: `POD-${row.id.slice(-6).toUpperCase()}`,
        type: 'Proof of Delivery' as const,
        description: `Delivery for ${row.orders?.client_name || row.customer_name || 'Customer'}, ${row.orders?.destination || row.delivery_address || 'destination unknown'}`,
        department: 'DISPATCH',
        amount: row.orders?.total_amount ? Number(row.orders.total_amount) : null,
        date: row.created_at?.slice(0, 10) || '',
        priority: 'Medium' as const,
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.driver_name || 'Dispatch',
        raw: row,
      }));

      const mappedFinalRelease: ApprovalItem[] = (finalReleaseData || []).map((row: any) => ({
        id: row.id,
        requestId: `ORD-${row.id.slice(-6).toUpperCase()}`,
        type: 'Risk Final Release' as const,
        description: `${row.payment_mode === 'CREDIT' ? 'Credit order' : `${row.payment_mode || 'Cash'} order`} for ${row.client_name}, GHS ${Number(row.total_amount || 0).toLocaleString()} (cleared by Accounts, awaiting release)`,
        department: 'FINANCE',
        amount: Number(row.total_amount || 0),
        date: row.created_at?.slice(0, 10) || '',
        priority: 'High' as const,
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.client_name || 'Marketing',
        raw: row,
      }));

      setItems([...mappedCustomers, ...mappedCargo, ...mappedOrders, ...mappedFinalRelease, ...mappedPod]);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const allItems = [...items, ...historyItems];

  const filtered = allItems.filter(item => {
    const matchTab = activeTab === 'All' || item.type === activeTab;
    const matchStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchSearch = !search || item.description.toLowerCase().includes(search.toLowerCase()) || item.requestId.toLowerCase().includes(search.toLowerCase()) || item.department.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchStatus && matchSearch;
  });

  const counts = {
    total: allItems.length,
    pending: items.filter(i => i.status === 'Pending').length,
    approved: historyItems.filter(i => i.status === 'Approved').length,
    rejected: historyItems.filter(i => i.status === 'Rejected').length,
  };

  const selectedItem = allItems.find(i => i.id === selected);

  function handleAction(id: string, action: 'approve' | 'reject' | 'return') {
    setSelected(id);
    setShowModal(action);
    setModalNote('');
  }

  // Every Risk decision — approve, reject, or return — tells three
  // audiences: Management (always), the department that submitted the
  // item (when there is one distinct from Management), and the specific
  // person who submitted it (when the record has one on file). Confirmed
  // requirement, 2026-09-16 — replaces the old scattered, inconsistent
  // per-type notification lists.
  async function notifyDecision(opts: { title: string; message: string; department?: string; personId?: string | null }) {
    const depts = new Set<string>(['MANAGEMENT']);
    if (opts.department) depts.add(opts.department);
    await Promise.all([
      ...Array.from(depts).map(dept => sendNotification({ recipientDepartment: dept, title: opts.title, message: opts.message })),
      opts.personId ? sendNotification({ recipientId: opts.personId, title: opts.title, message: opts.message }) : Promise.resolve(),
    ]);
  }

  async function confirmAction() {
    if (!selectedItem || !showModal || submitting) return;
    if (!modalNote.trim()) return;
    setSubmitting(true);
    const action = showModal;
    // ACTION -> audit verb, shared across all three types below.
    const verb = action === 'approve' ? 'APPROVE' : action === 'reject' ? 'REJECT' : 'RETURN';

    try {
      if (selectedItem.type === 'Cargo Intake' && selectedItem.raw) {
        // Risk no longer edits anything here — no damage count, no cost
        // per unit, no selling price. Those are Management's job.
        // Approving adds the cargo exactly as submitted; nothing about the
        // record itself changes except its status. Confirmed 2026-09-16.
        const rawId = String(selectedItem.raw.id);
        const cargoRow = selectedItem.raw as Record<string, any>;

        // One database step (review_cargo_intake): checks the cargo is
        // still waiting, records the decision and adds the stock, all at
        // once. Two people approving together can no longer add it twice.
        const { error: cargoErr } = await supabase.rpc('review_cargo_intake', {
          p_cargo_id: rawId,
          p_stage: 'risk',
          p_action: action,
          p_note: modalNote,
          p_reference: selectedItem.requestId,
          p_description: selectedItem.description,
        });
        if (cargoErr) throw cargoErr;

        const verbLabel = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await notifyDecision({
          title: `Cargo Intake ${verbLabel}`,
          message: `Cargo intake ${verbLabel} by Risk: ${selectedItem.description}, ${modalNote}`,
          department: 'ADMIN_WAREHOUSE',
          personId: cargoRow.handled_by_id || cargoRow.logged_by_id || null,
        });
      }

      if (selectedItem.type === 'Sales Order' && selectedItem.raw) {
        // Risk Initial Review — approve now ALWAYS forwards to Management
        // (mandatory stage, not an optional escalation). The status write
        // itself goes through risk_initial_review(), which is the only
        // place PENDING_RISK -> PENDING_MANAGEMENT/REJECTED/
        // RETURNED_FOR_CORRECTION is legal, enforced by a database
        // trigger, not just this screen's own convention. Risk no longer
        // edits quantity/price here — passes the order through exactly as
        // Marketing submitted it. Confirmed 2026-09-16.
        const orderRow = selectedItem.raw as Record<string, any>;

        const { error: rpcError } = await supabase.rpc('risk_initial_review', {
          p_order_id: selectedItem.id,
          p_action: action,
          p_note: modalNote,
          p_metadata: null,
          p_total_amount: null,
        });
        if (rpcError) throw rpcError;

        const verbLabel = action === 'approve' ? 'APPROVED (forwarded to Management)' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await notifyDecision({
          title: `Sales Order ${verbLabel}`,
          message: `Order ${verbLabel} by Risk: ${selectedItem.description}, ${modalNote}`,
          department: 'MARKETING',
          personId: orderRow.handled_by_id || orderRow.created_by || null,
        });
      }

      if (selectedItem.type === 'Risk Final Release' && selectedItem.raw) {
        // The new second gate — Accounts has already cleared the payment
        // check (PENDING_FINANCE -> PENDING_RISK_RELEASE); this is Risk's
        // final control/release check before Admin & Warehouse may
        // physically load the goods. Approve/Reject/Return only — no
        // line-item editing at this stage, per the approved decision that
        // the order's content is already locked in by the time Accounts
        // verified the financial transaction against it.
        const { error: rpcError } = await supabase.rpc('risk_final_release', {
          p_order_id: selectedItem.id,
          p_action: action,
          p_note: modalNote,
        });
        if (rpcError) throw rpcError;

        if (action === 'approve') {
          // Operationally necessary on top of the standard notify list —
          // Admin & Warehouse has to know it's cleared to load, and they
          // aren't the order's submitter or its department.
          await sendNotification({ recipientDepartment: 'ADMIN_WAREHOUSE', title: 'Order Cleared for Warehouse', message: `Order cleared Risk's final release check, ready for warehouse: ${selectedItem.description}` });
        }
        const verbLabel = action === 'approve' ? 'RELEASED to warehouse' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await notifyDecision({
          title: `Order Final Release ${verbLabel}`,
          message: `Order ${verbLabel} by Risk at final release: ${selectedItem.description}, ${modalNote}`,
          department: 'MARKETING',
          personId: (selectedItem.raw as any).handled_by_id || (selectedItem.raw as any).created_by || null,
        });
      }

      if (selectedItem.type === 'Customer Verification' && selectedItem.raw) {
        const custStatus = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED_FOR_CORRECTION' : 'REJECTED';
        await management.setCustomerVerification(selectedItem.id, custStatus as 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION', {
          rejectionReason: modalNote,
        });
        const verbLabel = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await notifyDecision({
          title: `Customer Verification ${verbLabel}`,
          message: `Customer ${verbLabel} by Risk: ${selectedItem.description}, ${modalNote}`,
          department: 'MARKETING',
          personId: (selectedItem.raw as any).handled_by_id || (selectedItem.raw as any).registered_by_id || null,
        });
      }

      if (selectedItem.type === 'Proof of Delivery' && selectedItem.raw) {
        // DELIVERED is reachable ONLY through this RPC — a driver's or
        // staff account's own direct update can no longer set it, even on
        // an OUT_FOR_DELIVERY order (enforced by the transition-guard
        // trigger's transaction-local flag, not just this screen's logic).
        const { error: rpcError } = await supabase.rpc('risk_review_pod', {
          p_delivery_log_id: selectedItem.id,
          p_action: action === 'approve' ? 'approve' : 'reject',
          p_note: modalNote,
        });
        if (rpcError) throw rpcError;

        // No separate "submitting department" here — Dispatch's own
        // delivery-facing screens live under Risk since Phase 9, so the
        // only distinct audience beyond Management is the driver
        // themselves, not a department.
        const verbLabel = action === 'approve' ? 'APPROVED, delivery closed out' : 'REJECTED';
        const driverUserId = (selectedItem.raw as any).drivers?.user_id || null;
        await notifyDecision({
          title: `Proof of Delivery ${verbLabel}`,
          message: `Proof of delivery ${verbLabel} by Risk: ${selectedItem.description}, ${modalNote}`,
          personId: driverUserId,
        });
      }

      await supabase.from('global_audit_history').insert([{
        department: 'RISK',
        action: `${verb}: ${selectedItem.requestId}, ${selectedItem.description}${modalNote ? ` | Note: ${modalNote}` : ''}`,
        performed_by: currentUser?.fullName || 'Risk',
        reference_id: selectedItem.id,
        details: modalNote || null,
      }]);

      const verbPastTense = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Returned for correction';
      addNotification?.(`${selectedItem.requestId} ${verbPastTense}${modalNote ? ` ("${modalNote}")` : ''}`);
    } catch (e: any) {
      console.error(e);
      addNotification?.(`Not done: ${e?.message || 'the action failed.'}`);
    } finally {
      setSubmitting(false);
    }

    setShowModal(null);
    setSelected(null);
    loadApprovals();
    loadHistory();
  }

  const handleExport = () => {
    exportToCSV(
      filtered.map(i => ({ ID: i.requestId, Type: i.type, Description: i.description, Department: i.department, Amount: i.amount ?? '', Date: i.date, Priority: i.priority, Status: i.status, SubmittedBy: i.submittedBy })),
      ['ID', 'Type', 'Description', 'Department', 'Amount', 'Date', 'Priority', 'Status', 'SubmittedBy'],
      'risk_approvals_queue'
    );
  };

  if (selectedItem && !showModal) {
    const Icon = TYPE_ICONS[selectedItem.type] || FileText;
    return (
      <div className="p-4 md:p-6 space-y-5">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Approvals Queue
        </button>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                <Icon size={24} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedItem.requestId}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[selectedItem.type]}`}>{selectedItem.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedItem.status]}`}>{selectedItem.status}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{selectedItem.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setShowTimeline(true)} className="px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"><History size={14} className="inline mr-1" />View Timeline</button>
              {selectedItem.status === 'Pending' && (
                <>
                  <button onClick={() => handleAction(selectedItem.id, 'reject')} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"><XCircle size={14} className="inline mr-1" />Reject</button>
                  {selectedItem.type !== 'Proof of Delivery' && (
                    <button onClick={() => handleAction(selectedItem.id, 'return')} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"><RotateCcw size={14} className="inline mr-1" />Return for Correction</button>
                  )}
                  <button onClick={() => handleAction(selectedItem.id, 'approve')} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}><CheckCircle size={14} className="inline mr-1" />{selectedItem.type === 'Risk Final Release' ? 'Release to Warehouse' : 'Approve'}</button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Department', value: selectedItem.department },
              { label: 'Submitted By', value: selectedItem.submittedBy },
              { label: 'Date', value: selectedItem.date },
              { label: 'Priority', value: selectedItem.priority },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--bg-input)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className={`text-sm font-semibold ${label === 'Priority' ? PRIORITY_COLORS[value] : 'text-[var(--text-primary)]'}`}>{value}</p>
              </div>
            ))}
          </div>

          {selectedItem.amount !== null && (
            <div className="bg-[var(--bg-input)] rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Transaction Amount</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>GHS <CountUp value={Number(selectedItem.amount ?? 0)} /></p>
            </div>
          )}

          {(selectedItem.type === 'Sales Order' || selectedItem.type === 'Risk Final Release') && selectedItem.raw && String((selectedItem.raw as any).payment_mode).toUpperCase() === 'CREDIT' && (() => {
            const orderRow = selectedItem.raw as Record<string, any>;
            const custId = orderRow.customer_id;
            const custName = String(orderRow.client_name || '').trim().toLowerCase();
            const customer = allCustomers.find((c: any) =>
              custId ? c.id === custId : String(c.name || '').trim().toLowerCase() === custName
            );
            // Current outstanding excludes this pending order itself — it's
            // "currently outstanding" (everything else) vs. "this order".
            const outstanding = creditOrders
              .filter((o: any) => o.id !== selectedItem.id)
              .filter((o: any) => custId ? o.customer_id === custId : String(o.client_name || '').trim().toLowerCase() === custName)
              .reduce((s: number, o: any) => s + Math.max(Number(o.total_amount || 0) - Number(o.amount_paid || 0), 0), 0);
            const thisOrder = Number(orderRow.total_amount || 0);
            const wouldTotal = outstanding + thisOrder;
            const limit = customer?.credit_limit != null ? Number(customer.credit_limit) : null;
            const onHold = customer?.credit_status === 'ON_HOLD';
            const overLimit = limit !== null && wouldTotal > limit;
            return (
              <div className="bg-[var(--bg-input)] rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Customer Credit Position</p>
                {onHold && (
                  <div className="px-3 py-2 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold">
                    ⚠ CREDIT ON HOLD. This customer is currently blocked from new credit orders.
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)]">Credit Limit</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{limit !== null ? `GHS ${limit.toLocaleString()}` : 'No limit, global cap applies'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)]">Currently Outstanding</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">GHS {outstanding.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)]">This Order</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">GHS {thisOrder.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)]">Would Total</p>
                    <p className={`text-sm font-bold ${overLimit ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>GHS {wouldTotal.toLocaleString()}</p>
                    {overLimit && <p className="text-[10px] text-rose-500">Exceeds limit by GHS {(wouldTotal - (limit ?? 0)).toLocaleString()}</p>}
                  </div>
                </div>
              </div>
            );
          })()}

          {(selectedItem.type === 'Sales Order' || selectedItem.type === 'Risk Final Release') && selectedItem.raw && (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Order Items breakdown</p>
                <span className="text-[10px] text-[var(--text-muted)]">Read-only, as submitted</span>
              </div>
              <InvoiceLineItems order={selectedItem.raw as any} />
            </div>
          )}

          {selectedItem.type === 'Customer Verification' && selectedItem.raw && (() => {
            const c = selectedItem.raw as Record<string, any>;
            return (
              <div className="space-y-3">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Customer Details</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    ['Phone', c.phone],
                    ['Email', c.email],
                    ['Location', c.location],
                    ['House Address', c.house_address],
                    ['Company Address', c.company_address],
                    ['Ghana Card', c.ghana_card_id],
                    ['Second Ghana Card', c.ghana_card_id_2],
                    ['Partner / Second Customer', c.partner_name],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="bg-[var(--bg-input)] rounded-xl p-3">
                      <p className="text-xs text-[var(--text-muted)] mb-1">{k}</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{v}</p>
                    </div>
                  ))}
                  {c.gps_lat != null && c.gps_lng != null && (
                    <div className="bg-[var(--bg-input)] rounded-xl p-3">
                      <p className="text-xs text-[var(--text-muted)] mb-1">GPS Location</p>
                      <a href={`https://www.google.com/maps?q=${c.gps_lat},${c.gps_lng}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1">
                        View on map <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
                {c.business_certificate_url && (
                  <div className="flex items-center justify-between gap-3 bg-[var(--bg-input)] rounded-xl p-3">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]"><FileText size={14} className="text-[var(--accent)]" /> Business Certificate</span>
                    <a href={c.business_certificate_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1">
                      View <ExternalLink size={11} />
                    </a>
                  </div>
                )}
                {c.notes && (
                  <div className="bg-[var(--bg-input)] rounded-xl p-3">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Notes</p>
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{c.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <RequestTimelinePanel
          open={showTimeline}
          onClose={() => setShowTimeline(false)}
          referenceId={selectedItem.id}
          displayId={selectedItem.requestId}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Risk Approvals Queue</h1>
          <p className="text-sm text-[var(--text-secondary)]">Review and action pending cargo, orders and delivery proof</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadApprovals} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <Download size={14} /> Export
          </button>
          <FullscreenButton expanded={tableFullscreen.expanded} onClick={tableFullscreen.toggle} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Pending', value: counts.pending, icon: FileText, color: 'var(--accent)', filter: 'Pending', title: 'Everything currently awaiting your review, across all types' },
          { label: 'All Decisions', value: counts.total, icon: Clock, color: '#f59e0b', filter: 'All', title: 'Every item on record, pending, approved, rejected, returned, escalated' },
          { label: 'Approved Today', value: todayApproved, icon: CheckCircle, color: '#10b981', filter: 'Approved', title: 'Items you approved today' },
          { label: 'Rejected Today', value: todayRejected, icon: XCircle, color: '#ef4444', filter: 'Rejected', title: 'Items you rejected today' },
        ].map(({ label, value, icon: Icon, color, filter, title }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(filter)}
            title={title}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 text-left hover:border-[var(--accent)] transition-colors cursor-pointer w-full"
            style={statusFilter === filter ? { borderColor: color, boxShadow: `0 0 0 2px ${color}30` } : {}}
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

      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === tab ? 'text-white' : 'text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-input)]'}`}
            style={activeTab === tab ? { background: 'var(--accent)' } : {}}
          >
            {tab}
            {tab !== 'All' && (
              <span className="ml-1.5 text-xs opacity-70">({items.filter(i => i.type === tab).length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ID, description, department..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <SearchableDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={['All', 'Pending', 'Approved', 'Rejected', 'Returned', 'Escalated'].map(s => ({ value: s, label: s }))}
          className="w-40"
        />
      </div>

      <div className={`bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden shadow-[var(--box-shadow)] ${tableFullscreen.expanded ? `${tableFullscreen.fullscreenClass} p-4` : 'rounded-2xl'}`}>
        {tableFullscreen.expanded && (
          <div className="flex justify-end mb-3"><FullscreenButton expanded onClick={tableFullscreen.toggle} /></div>
        )}
        {loading ? (
          <div className="p-10 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-6 bg-[var(--bg-input)] rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 gap-2 text-[var(--text-muted)]">
            <CheckCircle size={32} className="opacity-30" />
            <p className="text-sm">No pending items, you're all caught up.</p>
          </div>
        ) : (
          <div className="p-3">
            <ResponsiveDataView<typeof filtered[number]>
              columns={[
                {
                  key: 'description', label: 'Description', primary: true, render: item => (
                    <p className="truncate font-medium">{item.description}</p>
                  )
                },
                { key: 'requestId', label: 'Request ID', render: item => <span className="font-mono text-xs">{item.requestId}</span> },
                {
                  key: 'type', label: 'Type', render: item => {
                    const Icon = TYPE_ICONS[item.type] || FileText;
                    return (
                      <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap w-fit ${TYPE_COLORS[item.type]}`}>
                        <Icon size={11} />{item.type}
                      </span>
                    );
                  }
                },
                { key: 'department', label: 'Department' },
                { key: 'amount', label: 'Amount', render: item => item.amount !== null ? `GHS ${(Number(item.amount ?? 0)).toLocaleString()}` : 'Not set' },
                { key: 'date', label: 'Date' },
                { key: 'priority', label: 'Priority', render: item => <span className={`font-semibold text-xs ${PRIORITY_COLORS[item.priority]}`}>● {item.priority}</span> },
                { key: 'status', label: 'Status', status: true, render: item => <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[item.status]}`}>{item.status}</span> },
              ]}
              data={filtered}
              rowKey={item => item.id}
              onRowClick={item => setSelected(item.id)}
              renderActions={item => (
                <>
                  <button onClick={() => setSelected(item.id)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)]" title="View"><Eye size={14} style={{ color: 'var(--accent)' }} /></button>
                  {item.status === 'Pending' && <>
                    <button onClick={() => handleAction(item.id, 'approve')} className="p-1.5 rounded-lg hover:bg-green-100" title="Approve"><CheckCircle size={14} className="text-green-500" /></button>
                    <button onClick={() => handleAction(item.id, 'reject')} className="p-1.5 rounded-lg hover:bg-red-100" title="Reject"><XCircle size={14} className="text-red-500" /></button>
                  </>}
                  <div className="relative">
                    <button onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                    {menuOpen === item.id && (
                      <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[160px]" onClick={() => setMenuOpen(null)}>
                        <button onClick={() => setSelected(item.id)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Details</button>
                        {item.status === 'Pending' && <>
                          <button onClick={() => handleAction(item.id, 'approve')} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-[var(--bg-input)]">Approve</button>
                          <button onClick={() => handleAction(item.id, 'reject')} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-[var(--bg-input)]">Reject</button>
                          {item.type !== 'Proof of Delivery' && (
                            <button onClick={() => handleAction(item.id, 'return')} className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-[var(--bg-input)]">Return for Correction</button>
                          )}
                        </>}
                      </div>
                    )}
                  </div>
                </>
              )}
            />
          </div>
        )}
      </div>

      <ApprovalHistoryPanel department="RISK" />

      <SidePanel
        open={!!(showModal && selectedItem)}
        onClose={() => setShowModal(null)}
        title={selectedItem ? `${showModal === 'approve' ? 'Approve' : showModal === 'reject' ? 'Reject' : 'Return for Correction'}: ${selectedItem.requestId}` : ''}
        badge={showModal === 'approve' ? <CheckCircle size={16} className="text-green-500" /> : showModal === 'reject' ? <XCircle size={16} className="text-red-500" /> : <RotateCcw size={16} className="text-orange-500" />}
        width="lg"
        footer={
          <>
            <button disabled={submitting} onClick={() => setShowModal(null)} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button
              disabled={submitting || !modalNote.trim()}
              onClick={confirmAction}
              className={`erp-btn text-white disabled:opacity-50 ${showModal === 'approve' ? 'bg-green-500 hover:bg-green-600' : showModal === 'reject' ? 'bg-red-500 hover:bg-red-600' : showModal === 'return' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}
            >
              {submitting ? 'Processing...' : showModal === 'approve' ? 'Confirm Approval' : showModal === 'reject' ? 'Confirm Rejection' : showModal === 'return' ? 'Confirm Return' : 'Confirm Escalation'}
            </button>
          </>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">{selectedItem.description}</p>

              {showModal === 'approve' && selectedItem.type === 'Cargo Intake' && (
                <div className="space-y-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <div className="bg-[var(--bg-input)] rounded-xl px-4 py-2.5 flex items-center gap-3">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Cargo In</span>
                      <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                        {Number((selectedItem.raw as any)?.quantity || (selectedItem.raw as any)?.qty_received || 0).toLocaleString()} units
                      </span>
                    </div>
                    {(selectedItem.raw as any)?.container_number && (
                      <div className="bg-[var(--bg-input)] rounded-xl px-4 py-2.5 flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Container Number</span>
                        <span className="text-sm font-bold text-[var(--text-primary)] font-mono">{(selectedItem.raw as any).container_number}</span>
                      </div>
                    )}
                  </div>

                  {(selectedItem.raw as any)?.discrepancies && String((selectedItem.raw as any).discrepancies).trim() && (
                    <div className="p-3 bg-amber-500/15 border border-amber-500/25 text-amber-700 rounded-xl text-xs flex items-center gap-2">
                      <span className="shrink-0">⚠️</span>
                      <span>Discrepancy reported: <strong>{String((selectedItem.raw as any).discrepancies)}</strong></span>
                    </div>
                  )}

                  <p className="text-[10px] text-[var(--text-muted)]">Approving adds the full quantity above to stock exactly as submitted. Quantity, price, and damage assessment are Management's, not reviewed here.</p>
                </div>
              )}

              {showModal === 'approve' && selectedItem.type === 'Sales Order' && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700">
                  Approving forwards this order to <strong>Management</strong> for the next mandatory review. It does not go straight to Account Department.
                </div>
              )}

              {showModal === 'approve' && selectedItem.type === 'Risk Final Release' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                  Approving clears this order for <strong>Admin &amp; Warehouse</strong> to begin preparing/loading the goods.
                </div>
              )}

              {showModal === 'approve' && selectedItem.type === 'Proof of Delivery' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                  Approving marks this delivery <strong>DELIVERED</strong> and closes out the linked order.
                </div>
              )}

              {showModal === 'approve' && selectedItem.type === 'Customer Verification' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                  Approving marks this customer <strong>Verified</strong>. Marketing will see the badge update on the customer's profile.
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                  {showModal === 'approve' ? 'Note for this approval *' : showModal === 'return' ? 'Reason for return *' : 'Reason for rejection *'}
                </label>
                <textarea
                  value={modalNote}
                  onChange={e => setModalNote(e.target.value)}
                  rows={3}
                  placeholder={showModal === 'approve' ? 'Explain why this is being approved...' : showModal === 'return' ? 'Explain what needs to be corrected...' : 'Explain why this is being rejected...'}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
                {!modalNote.trim() && <p className="text-[10px] text-rose-500 mt-1">A note is required to submit this decision.</p>}
              </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
