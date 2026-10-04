// rebma-mobile/screens/risk/RiskApprovalsScreen.tsx
// Ports: rebma-web/src/views/risk/RiskApprovalsView.tsx — five lanes
// (Cargo Intake / Sales Order [Risk Initial Review] / Risk Final Release
// / Proof of Delivery / Customer Verification).
//
// Order/Risk workflow reconciliation: Risk Initial Review's Approve now
// ALWAYS forwards to Management (mandatory stage, not an optional
// escalation — the old "Escalate" action is removed) via the guarded
// risk_initial_review() RPC. The new Risk Final Release lane
// (PENDING_RISK_RELEASE -> APPROVED, no line-item editing per the
// approved decision — Accounts has already verified the transaction
// against the order) uses risk_final_release(). POD approval uses
// risk_review_pod(), the only path either delivery_logs.status or
// orders.status can ever reach DELIVERED — enforced by a database
// trigger, not just this screen's own convention.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { Alert } from '../../lib/appAlert';
import {
  CheckCircle, XCircle, RotateCcw, History, ShieldCheck,
  Package, CreditCard, Camera, UserCheck, FileText, ExternalLink,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { setCustomerVerification } from '../../lib/riskActions';
import { sendNotification } from '../../lib/sendNotification';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import ProductImage from '../../components/ui/ProductImage';
import Badge from '../../components/ui/Badge';
import type { StatusTone } from '../../theme/tokens';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import Tabs from '../../components/ui/Tabs';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';

type ItemType = 'Cargo Intake' | 'Sales Order' | 'Risk Final Release' | 'Proof of Delivery' | 'Customer Verification';
type Action = 'approve' | 'reject' | 'return';

interface ApprovalItem {
  id: string;
  requestId: string;
  type: ItemType;
  description: string;
  amount: number | null;
  date: string;
  raw: any;
}

const TABS: Array<'All' | ItemType> = ['All', 'Cargo Intake', 'Sales Order', 'Risk Final Release', 'Proof of Delivery', 'Customer Verification'];
const TYPE_ICON: Record<ItemType, typeof Package> = {
  'Cargo Intake': Package, 'Sales Order': CreditCard, 'Risk Final Release': ShieldCheck, 'Proof of Delivery': Camera, 'Customer Verification': UserCheck,
};
const TYPE_TONE: Record<ItemType, 'info' | 'purple' | 'muted' | 'danger'> = {
  'Cargo Intake': 'info', 'Sales Order': 'purple', 'Risk Final Release': 'danger', 'Proof of Delivery': 'info', 'Customer Verification': 'muted',
};

export default function RiskApprovalsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [creditOrders, setCreditOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | ItemType>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [showModal, setShowModal] = useState<Action | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const load = useCallback(async () => {
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
        supabase.from('customers').select('*').eq('status', 'PENDING').order('registered_at', { ascending: false }).limit(50).then((r) => r, () => ({ data: [] })),
        supabase.from('cargo_intake').select('*').eq('status', 'PENDING_RISK_APPROVAL').order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('*').eq('status', 'PENDING_RISK').order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('*').eq('status', 'PENDING_RISK_RELEASE').order('created_at', { ascending: false }).limit(50),
        supabase.from('delivery_logs').select('*, orders:order_id(client_name, destination, total_amount), drivers:driver_id(user_id, full_name)').eq('status', 'PENDING_RISK_REVIEW').order('created_at', { ascending: false }).limit(50).then((r) => r, () => ({ data: [] })),
        supabase.from('customers').select('id, name, credit_limit, credit_status').then((r) => r, () => ({ data: [] })),
        supabase.from('orders').select('id, customer_id, client_name, total_amount, amount_paid, payment_mode, status')
          .eq('payment_mode', 'CREDIT').not('status', 'in', '(REJECTED,CANCELLED,RETURNED_FOR_CORRECTION)')
          .then((r) => r, () => ({ data: [] })),
      ]);

      setAllCustomers(allCustomersData || []);
      setCreditOrders(creditOrdersData || []);

      const mappedCustomers: ApprovalItem[] = (customersData || []).map((row: any) => ({
        id: row.id, requestId: `CUST-${String(row.id).slice(-6).toUpperCase()}`, type: 'Customer Verification',
        description: `${row.name || 'Unnamed customer'}${row.company_name ? ` — ${row.company_name}` : ''}`,
        amount: null, date: row.registered_at?.slice(0, 10) || '', raw: row,
      }));
      const mappedCargo: ApprovalItem[] = (cargoData || []).map((row: any) => {
        const baseDesc = `${row.product_name || 'Goods'} — ${row.qty_received || row.quantity || 0} ${row.goods_type || 'units'} from ${row.company || 'supplier'}`;
        return {
          id: row.id, requestId: `CARGO-${row.id.slice(-6).toUpperCase()}`, type: 'Cargo Intake',
          description: row.discrepancies?.trim() ? `${baseDesc} (Discrepancy: ${row.discrepancies})` : baseDesc,
          amount: row.unit_price ? Number(row.unit_price) * (row.qty_received || row.quantity || 0) : null,
          date: row.created_at?.slice(0, 10) || '', raw: row,
        };
      });
      const mappedOrders: ApprovalItem[] = (ordersData || []).map((row: any) => ({
        id: row.id, requestId: `ORD-${row.id.slice(-6).toUpperCase()}`, type: 'Sales Order',
        description: `${row.payment_mode === 'CREDIT' ? 'Credit order' : `${row.payment_mode || 'Cash'} order`} for ${row.client_name} — GHS ${Number(row.total_amount || 0).toLocaleString()}`,
        amount: Number(row.total_amount || 0), date: row.created_at?.slice(0, 10) || '', raw: row,
      }));
      const mappedPod: ApprovalItem[] = (podData || []).map((row: any) => ({
        id: row.id, requestId: `POD-${row.id.slice(-6).toUpperCase()}`, type: 'Proof of Delivery',
        description: `Delivery for ${row.orders?.client_name || row.customer_name || 'Customer'} — ${row.orders?.destination || row.delivery_address || 'destination unknown'}`,
        amount: row.orders?.total_amount ? Number(row.orders.total_amount) : null, date: row.created_at?.slice(0, 10) || '', raw: row,
      }));
      const mappedFinalRelease: ApprovalItem[] = (finalReleaseData || []).map((row: any) => ({
        id: row.id, requestId: `ORD-${row.id.slice(-6).toUpperCase()}`, type: 'Risk Final Release',
        description: `${row.payment_mode === 'CREDIT' ? 'Credit order' : `${row.payment_mode || 'Cash'} order`} for ${row.client_name} — GHS ${Number(row.total_amount || 0).toLocaleString()}, cleared by Accounts`,
        amount: Number(row.total_amount || 0), date: row.created_at?.slice(0, 10) || '', raw: row,
      }));

      setItems([...mappedCargo, ...mappedOrders, ...mappedFinalRelease, ...mappedPod, ...mappedCustomers]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((i) => {
    const matchTab = activeTab === 'All' || i.type === activeTab;
    const q = search.toLowerCase();
    const matchSearch = !q || i.description.toLowerCase().includes(q) || i.requestId.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const openAction = (item: ApprovalItem, action: Action) => {
    setSelected(item);
    setModalNote('');
    setShowModal(action);
  };

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
      ...Array.from(depts).map((dept) => sendNotification({ recipientDepartment: dept, title: opts.title, message: opts.message })),
      opts.personId ? sendNotification({ recipientId: opts.personId, title: opts.title, message: opts.message }) : Promise.resolve(),
    ]);
  }

  async function confirmAction() {
    if (!selected || !showModal || submitting || !modalNote.trim()) return;
    const action = showModal;
    const verb = action === 'approve' ? 'APPROVE' : action === 'reject' ? 'REJECT' : 'RETURN';
    setSubmitting(true);
    try {
      if (selected.type === 'Cargo Intake') {
        // Risk no longer edits anything here — no damage count, no cost
        // per unit, no selling price. Those are Management's job.
        // Approving adds the cargo exactly as submitted; nothing about the
        // record itself changes except its status. Confirmed 2026-09-16.
        const rawId = String(selected.raw.id);
        const cargoRow = selected.raw;

        // One database step (review_cargo_intake): checks the cargo is
        // still waiting, records the decision and adds the stock at once.
        // Two people approving together can no longer add it twice.
        const { error: cargoErr } = await supabase.rpc('review_cargo_intake', {
          p_cargo_id: rawId, p_stage: 'risk', p_action: action, p_note: modalNote,
          p_reference: selected.requestId, p_description: selected.description,
        });
        if (cargoErr) throw cargoErr;

        const verbLabel = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await notifyDecision({
          title: `Cargo Intake ${verbLabel}`,
          message: `Cargo intake ${verbLabel} by Risk: ${selected.description} — ${modalNote}`,
          department: 'ADMIN_WAREHOUSE',
          personId: cargoRow.handled_by_id || cargoRow.logged_by_id || null,
        });
      }

      if (selected.type === 'Sales Order') {
        // Risk Initial Review — approve ALWAYS forwards to Management now
        // (mandatory stage, not an optional escalation). Status write goes
        // through risk_initial_review(), the only legal path
        // PENDING_RISK -> PENDING_MANAGEMENT/REJECTED/RETURNED_FOR_CORRECTION,
        // enforced by a database trigger.
        // Risk no longer edits quantity/price here — passes the order
        // through exactly as Marketing submitted it. Confirmed 2026-09-16.
        const orderRow = selected.raw;
        const { error: rpcErr } = await supabase.rpc('risk_initial_review', {
          p_order_id: selected.id, p_action: action, p_note: modalNote, p_metadata: null, p_total_amount: null,
        });
        if (rpcErr) throw rpcErr;

        const verbLabel = action === 'approve' ? 'APPROVED (forwarded to Management)' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await notifyDecision({
          title: `Sales Order ${verbLabel}`,
          message: `Order ${verbLabel} by Risk: ${selected.description} — ${modalNote}`,
          department: 'MARKETING',
          personId: orderRow.handled_by_id || orderRow.created_by || null,
        });
      }

      if (selected.type === 'Risk Final Release') {
        // The new second gate — Accounts already cleared the payment check
        // (PENDING_FINANCE -> PENDING_RISK_RELEASE); this is Risk's final
        // control/release check before Admin & Warehouse may physically
        // load the goods. Approve/Reject/Return only — no line-item
        // editing at this stage, per the approved decision.
        const { error: rpcErr } = await supabase.rpc('risk_final_release', {
          p_order_id: selected.id, p_action: action, p_note: modalNote,
        });
        if (rpcErr) throw rpcErr;

        if (action === 'approve') {
          // Operationally necessary on top of the standard notify list —
          // Admin & Warehouse has to know it's cleared to load.
          await sendNotification({ recipientDepartment: 'ADMIN_WAREHOUSE', title: 'Order Cleared for Warehouse', message: `Order cleared Risk's final release check, ready for warehouse: ${selected.description}` });
        }
        const verbLabel = action === 'approve' ? 'RELEASED to warehouse' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await notifyDecision({
          title: `Order Final Release ${verbLabel}`,
          message: `Order ${verbLabel} by Risk at final release: ${selected.description} — ${modalNote}`,
          department: 'MARKETING',
          personId: selected.raw.handled_by_id || selected.raw.created_by || null,
        });
      }

      if (selected.type === 'Customer Verification') {
        const custStatus = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED_FOR_CORRECTION' : 'REJECTED';
        await setCustomerVerification(selected.id, custStatus, { rejectionReason: modalNote });
        const verbLabel = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await notifyDecision({
          title: `Customer Verification ${verbLabel}`,
          message: `Customer ${verbLabel} by Risk: ${selected.description} — ${modalNote}`,
          department: 'MARKETING',
          personId: selected.raw.handled_by_id || selected.raw.registered_by_id || null,
        });
      }

      if (selected.type === 'Proof of Delivery') {
        // DELIVERED is reachable ONLY through this RPC — a driver's or
        // staff account's own direct update can no longer set it.
        const { error: rpcErr } = await supabase.rpc('risk_review_pod', {
          p_delivery_log_id: selected.id, p_action: action === 'approve' ? 'approve' : 'reject', p_note: modalNote,
        });
        if (rpcErr) throw rpcErr;

        // No separate "submitting department" here — Dispatch's own
        // delivery-facing screens live under Risk since Phase 9, so the
        // only distinct audience beyond Management is the driver
        // themselves, not a department.
        const verbLabel = action === 'approve' ? 'APPROVED, delivery closed out' : 'REJECTED';
        await notifyDecision({
          title: `Proof of Delivery ${verbLabel}`,
          message: `Proof of delivery ${verbLabel} by Risk: ${selected.description} — ${modalNote}`,
          personId: selected.raw.drivers?.user_id || null,
        });
      }

      // Direct correction: for Proof of Delivery specifically, `selected.id`
      // is the delivery_logs row's own id, not the order's — anchoring
      // the final "delivered" event to it would put THE END of the
      // workflow on a timeline nothing else in the order's own history
      // ever reads. This is the literal "workflow should end at the
      // customer's destination" moment, so it has to land on the same
      // reference_id as everything before it (order creation, Risk's own
      // earlier order approval, Finance's payment) — the order's id,
      // already selected via the `orders:order_id(...)` join.
      const referenceId = selected.type === 'Proof of Delivery' ? (selected.raw.order_id || selected.id) : selected.id;

      await supabase.from('global_audit_history').insert([{
        department: 'RISK',
        action: `${verb}: ${selected.requestId} — ${selected.description}${modalNote ? ` | Note: ${modalNote}` : ''}`,
        performed_by: profile?.fullName || 'Risk',
        reference_id: referenceId,
        details: modalNote || null,
        timestamp: new Date().toISOString(),
      }]);
    } catch (e: any) {
      Alert.alert('Action Failed', e.message || 'Could not complete this action.');
    } finally {
      setSubmitting(false);
    }
    setShowModal(null);
    setSelected(null);
    load();
  }

  const columns: DataColumn<ApprovalItem>[] = [
    { key: 'description', label: 'Item', primary: true },
    {
      key: 'type', label: 'Type', status: true,
      render: (i) => <Badge tone={TYPE_TONE[i.type] as StatusTone} label={i.type} size="xs" />,
    },
    { key: 'amount', label: 'Amount', render: (i) => (i.amount != null ? `GHS ${i.amount.toLocaleString()}` : '—') },
    { key: 'date', label: 'Date' },
    { key: 'requestId', label: 'ID' },
  ];

  // Customer Credit Position — only for a pending CREDIT sales order, matching web exactly.
  const creditPosition = (() => {
    if (!selected || (selected.type !== 'Sales Order' && selected.type !== 'Risk Final Release') || String(selected.raw.payment_mode).toUpperCase() !== 'CREDIT') return null;
    const orderRow = selected.raw;
    const custId = orderRow.customer_id;
    const custName = String(orderRow.client_name || '').trim().toLowerCase();
    const customer = allCustomers.find((c) => (custId ? c.id === custId : String(c.name || '').trim().toLowerCase() === custName));
    const outstanding = creditOrders
      .filter((o) => o.id !== selected.id)
      .filter((o) => (custId ? o.customer_id === custId : String(o.client_name || '').trim().toLowerCase() === custName))
      .reduce((s, o) => s + Math.max(Number(o.total_amount || 0) - Number(o.amount_paid || 0), 0), 0);
    const thisOrder = Number(orderRow.total_amount || 0);
    const wouldTotal = outstanding + thisOrder;
    const limit = customer?.credit_limit != null ? Number(customer.credit_limit) : null;
    const onHold = customer?.credit_status === 'ON_HOLD';
    const overLimit = limit !== null && wouldTotal > limit;
    return { outstanding, thisOrder, wouldTotal, limit, onHold, overLimit };
  })();

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search by ID or description..." />

        <Tabs
          variant="chips"
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'All' | ItemType)}
          options={TABS.map((tab) => ({
            value: tab,
            label: `${tab}${tab !== 'All' ? ` (${items.filter((i) => i.type === tab).length})` : ''}`,
          }))}
        />

        <DataList
          columns={columns}
          data={filtered}
          rowKey={(i) => i.id}
          loading={loading}
          emptyTitle="No pending items. You're all caught up."
          onRowPress={(i) => setSelected(i)}
        />
      </View>

      <Sheet
        open={!!selected && !showModal}
        onClose={() => setSelected(null)}
        title={selected?.requestId}
        subtitle={selected?.type}
        badge={<Badge tone="warning" label="Pending" size="xs" />}
        side="bottom"
        maxHeight={680}
      >
        {selected && (
          <View style={{ gap: t.spacing.lg }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{selected.description}</Text>

            {selected.amount !== null && (
              <Card tone="inset">
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Transaction Amount</Text>
                <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: t.colors.accent }}>GHS {selected.amount.toLocaleString()}</Text>
              </Card>
            )}

            {selected.type === 'Cargo Intake' && selected.raw?.product_image && (
              <SheetSection label="Product Photo">
                <ProductImage uri={selected.raw.product_image} label={selected.raw.product_name || 'Cargo photo'} size={72} />
              </SheetSection>
            )}

            {creditPosition && (
              <SheetSection label="Customer Credit Position">
                <View style={{ gap: t.spacing.sm }}>
                  {creditPosition.onHold && (
                    <View style={{ padding: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: t.colors.status.warning.bg }}>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.status.warning.text }}>⚠ CREDIT ON HOLD: new credit orders are blocked for this customer.</Text>
                    </View>
                  )}
                  <View style={{ gap: t.spacing.sm }}>
                    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                      <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Credit Limit</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{creditPosition.limit !== null ? `GHS ${creditPosition.limit.toLocaleString()}` : 'No limit, global cap applies'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Currently Outstanding</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {creditPosition.outstanding.toLocaleString()}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                      <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>This Order</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {creditPosition.thisOrder.toLocaleString()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Would Total</Text>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: creditPosition.overLimit ? t.colors.status.danger.text : t.colors.textPrimary }}>GHS {creditPosition.wouldTotal.toLocaleString()}</Text>
                      {creditPosition.overLimit && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.status.danger.text }}>Exceeds limit by GHS {(creditPosition.wouldTotal - (creditPosition.limit ?? 0)).toLocaleString()}</Text>}
                      </View>
                    </View>
                  </View>
                </View>
              </SheetSection>
            )}

            {(selected.type === 'Sales Order' || selected.type === 'Risk Final Release') && Array.isArray(selected.raw?.metadata?.items) && selected.raw.metadata.items.length > 0 && (
              <SheetSection label="Order Items (read-only, as submitted)">
                <View style={{ gap: t.spacing.sm }}>
                  {selected.raw.metadata.items.map((it: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                      <ProductImage uri={it.productImage} label={it.productName} size={32} />
                      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{it.productName}</Text>
                        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{it.quantity} × GHS {Number(it.unitPrice || 0).toLocaleString()}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </SheetSection>
            )}

            {selected.type === 'Customer Verification' && (
              <SheetSection label="Customer Details">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
                  {[
                    ['Phone', selected.raw.phone], ['Email', selected.raw.email], ['Location', selected.raw.location],
                    ['House Address', selected.raw.house_address], ['Company Address', selected.raw.company_address],
                    ['Ghana Card', selected.raw.ghana_card_id], ['Second Ghana Card', selected.raw.ghana_card_id_2],
                    ['Partner / Second Customer', selected.raw.partner_name],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <View key={k as string} style={{ width: '47%' }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{k}</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{v as string}</Text>
                    </View>
                  ))}
                  {selected.raw.gps_lat != null && selected.raw.gps_lng != null && (
                    <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps?q=${selected.raw.gps_lat},${selected.raw.gps_lng}`)} style={{ width: '47%' }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>GPS Location</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.accent }}>View on map</Text>
                    </Pressable>
                  )}
                </View>
                {selected.raw.business_certificate_url && (
                  <Pressable onPress={() => Linking.openURL(selected.raw.business_certificate_url)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.md, padding: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: t.colors.bgInput }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                      <FileText size={14} color={t.colors.accent} />
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Business Certificate</Text>
                    </View>
                    <ExternalLink size={12} color={t.colors.accent} />
                  </Pressable>
                )}
                {selected.raw.notes && (
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginTop: t.spacing.md }}>{selected.raw.notes}</Text>
                )}
              </SheetSection>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              <Button label="Timeline" size="sm" variant="ghost" icon={<History size={13} color={t.colors.textSecondary} />} onPress={() => setShowTimeline(true)} />
              <Button label="Reject" size="sm" variant="danger" icon={<XCircle size={13} color="#fff" />} onPress={() => openAction(selected, 'reject')} />
              {selected.type !== 'Proof of Delivery' && (
                <Button label="Return" size="sm" variant="ghost" icon={<RotateCcw size={13} color={t.colors.textSecondary} />} onPress={() => openAction(selected, 'return')} />
              )}
              <Button label={selected.type === 'Risk Final Release' ? 'Release to Warehouse' : 'Approve'} size="sm" icon={<CheckCircle size={13} color="#fff" />} onPress={() => openAction(selected, 'approve')} />
            </View>
          </View>
        )}
      </Sheet>

      <Sheet
        open={!!showModal}
        onClose={() => setShowModal(null)}
        title={showModal ? `${showModal[0].toUpperCase()}${showModal.slice(1)} ${selected?.type}` : undefined}
        subtitle={selected?.requestId}
        side="bottom"
        maxHeight={620}
        footer={<Button label={submitting ? 'Submitting…' : 'Confirm'} onPress={confirmAction} loading={submitting} disabled={submitting || !modalNote.trim()} fullWidth />}
      >
        <View style={{ gap: t.spacing.md }}>
          {selected?.type === 'Cargo Intake' && showModal === 'approve' && (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
              Approving adds the full quantity to stock exactly as submitted. Quantity, price, and damage assessment are Management's, not reviewed here.
            </Text>
          )}
          <Field label={showModal === 'approve' ? 'Note for this approval *' : showModal === 'return' ? 'Reason for return *' : 'Reason for rejection *'}>
            <Input value={modalNote} onChangeText={setModalNote} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} placeholder={showModal === 'approve' ? 'Why is this being approved?' : showModal === 'return' ? 'What needs to be corrected?' : 'Why is this being rejected?'} />
          </Field>
          {!modalNote.trim() && (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.status.danger.text }}>A note is required to submit this decision.</Text>
          )}
        </View>
      </Sheet>

      <RequestTimelineSheet
        open={showTimeline}
        onClose={() => setShowTimeline(false)}
        referenceId={(selected?.type === 'Proof of Delivery' ? selected?.raw?.order_id : null) || selected?.id || ''}
        displayId={selected?.requestId}
      />
    </Screen>
  );
}
