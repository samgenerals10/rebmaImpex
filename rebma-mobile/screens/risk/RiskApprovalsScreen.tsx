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
import { View, Text, Pressable, ScrollView, Alert, Linking } from 'react-native';
import {
  CheckCircle, XCircle, RotateCcw, History, ShieldCheck,
  Package, CreditCard, Camera, UserCheck, FileText, ExternalLink,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { setCustomerVerification } from '../../lib/riskActions';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import type { StatusTone } from '../../theme/tokens';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
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
  const [orderEdits, setOrderEdits] = useState<{ quantity: string; unitPrice: string }[]>([]);
  const [showModal, setShowModal] = useState<Action | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [confirmedDamages, setConfirmedDamages] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [sellingPrice, setSellingPrice] = useState('');
  const [notifyOps, setNotifyOps] = useState(true);
  const [notifyCeo, setNotifyCeo] = useState(true);
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
        supabase.from('delivery_logs').select('*, orders:order_id(client_name, destination, total_amount)').eq('status', 'PENDING_RISK_REVIEW').order('created_at', { ascending: false }).limit(50).then((r) => r, () => ({ data: [] })),
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
    setConfirmedDamages(0);
    setCostPerUnit(0);
    setSellingPrice('');
    setNotifyOps(true);
    setNotifyCeo(true);
    if (item.type === 'Sales Order' && Array.isArray(item.raw?.metadata?.items)) {
      setOrderEdits(item.raw.metadata.items.map((it: any) => ({ quantity: String(it.quantity ?? ''), unitPrice: String(it.unitPrice ?? '') })));
    }
    setShowModal(action);
  };

  async function confirmAction() {
    if (!selected || !showModal || submitting) return;
    const action = showModal;
    const verb = action === 'approve' ? 'APPROVE' : action === 'reject' ? 'REJECT' : 'RETURN';
    setSubmitting(true);
    try {
      if (selected.type === 'Cargo Intake') {
        const newDbStatus = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED_FOR_CORRECTION' : 'REJECTED';
        const rawId = String(selected.raw.id);
        const cargoRow = selected.raw;
        const incomingQty = Number(cargoRow.quantity || cargoRow.qty_received || 0);
        // Clamped so a reviewer can't report more damaged units than the
        // shipment actually received — security/gap audit fix, matching
        // web's own fix.
        const clampedDamages = Math.max(0, Math.min(confirmedDamages, incomingQty));
        const finalQtyToAdd = Math.max(0, incomingQty - clampedDamages);
        const discrepancyCost = clampedDamages * costPerUnit;
        const sellingPriceVal = sellingPrice ? parseFloat(sellingPrice) : 0;
        const rawDiscrepancies = String(cargoRow.discrepancies || '');
        let finalDiscrepancyNotes = rawDiscrepancies;
        if (action === 'approve' && clampedDamages > 0) {
          finalDiscrepancyNotes = JSON.stringify({
            originalQty: incomingQty, damagedCount: clampedDamages, unitCost: costPerUnit, costLoss: discrepancyCost,
            sellingPrice: sellingPriceVal, notes: rawDiscrepancies && rawDiscrepancies !== 'None' ? rawDiscrepancies : 'Damaged goods write-off',
          });
        }
        await supabase.from('cargo_intake').update({
          status: newDbStatus, quantity: action === 'approve' ? finalQtyToAdd : incomingQty, discrepancies: finalDiscrepancyNotes,
          unit_price: costPerUnit, is_fault_or_damaged: action === 'approve' ? clampedDamages > 0 : cargoRow.is_fault_or_damaged,
          rejection_reason: action === 'approve' ? null : (modalNote || null),
        }).eq('id', rawId);

        if (action === 'approve') {
          const productName = String(cargoRow.product_name || 'Unknown Product');
          const productCode = String(cargoRow.goods_code || rawId.slice(0, 8).toUpperCase());
          const unit = String(cargoRow.goods_type || cargoRow.unit || 'units');
          const now = new Date().toISOString();
          const { data: existingStock } = await supabase.from('stock').select('id, quantity').eq('product_name', productName).maybeSingle().then((r) => r, () => ({ data: null }));
          if (existingStock) {
            await supabase.from('stock').update({ quantity: (Number(existingStock.quantity) || 0) + finalQtyToAdd, last_updated: now }).eq('id', existingStock.id);
          } else {
            await supabase.from('stock').upsert([{ product_name: productName, product_code: productCode, category: 'INCOMING_GOODS', quantity: finalQtyToAdd, maximum_level: finalQtyToAdd * 2 || 1000, minimum_level: Math.round(finalQtyToAdd * 0.1) || 50, unit, last_updated: now }], { onConflict: 'product_name' });
          }
          await supabase.from('stock_ledger').insert({
            product_name: productName, movement_type: 'ADD', quantity: finalQtyToAdd, reference: `Cargo approved: ${selected.requestId}`,
            notes: `${selected.description}${clampedDamages > 0 ? ` (${clampedDamages} units damaged/lost)` : ''}`, created_at: now,
          });
          if (discrepancyCost > 0) {
            // Posted as Pending, not auto-Approved — a single Risk
            // reviewer should not be able to single-handedly book an
            // arbitrary-size approved expense with no Finance sign-off.
            // Security/gap audit fix, matching web.
            await supabase.from('finance_expenses').insert([{
              category: 'Damaged Goods', description: `Loss from damaged goods in Cargo Intake ${selected.requestId} (${productName}: ${clampedDamages} units)`,
              amount: discrepancyCost, date: now.slice(0, 10), status: 'Pending', submitted_by: 'Risk (Auto-generated)',
              notes: `Auto-generated from Cargo Intake approval. Discrepancy details: ${selected.description}`,
            }]);
          }
          if (notifyOps) await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Risk: ${selected.description}`, notified_department: 'OPERATIONS', read: false }]);
          if (notifyCeo) await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Risk: ${selected.description}`, notified_department: 'CEO', read: false }]);
          if (sellingPrice) await supabase.from('goods_prices').upsert([{ product_name: productName, unit_price: parseFloat(sellingPrice) }], { onConflict: 'product_name' });
          await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Risk: ${selected.description}`, notified_department: 'FINANCE', read: false }]);
          await supabase.from('supplier_order_notifications').insert([{ message: `New stock approved: ${selected.description}. Update pricing in Marketing.`, notified_department: 'MARKETING', read: false }]);
        } else if (action === 'return') {
          await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake RETURNED FOR CORRECTION by Risk: ${selected.description}${modalNote ? ` — ${modalNote}` : ''}`, notified_department: 'OPERATIONS', read: false }]);
        } else {
          await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake REJECTED by Risk: ${selected.description}${modalNote ? ` — ${modalNote}` : ''}`, notified_department: 'OPERATIONS', read: false }]);
        }
      }

      if (selected.type === 'Sales Order') {
        // Risk Initial Review — approve ALWAYS forwards to Management now
        // (mandatory stage, not an optional escalation). Status write goes
        // through risk_initial_review(), the only legal path
        // PENDING_RISK -> PENDING_MANAGEMENT/REJECTED/RETURNED_FOR_CORRECTION,
        // enforced by a database trigger.
        const orderRow = selected.raw;
        const originalItems: any[] = Array.isArray(orderRow?.metadata?.items) ? orderRow.metadata.items : [];
        let p_metadata: any = null;
        let p_total_amount: number | null = null;
        if (action === 'approve' && originalItems.length > 0) {
          const adjustedItems = originalItems.map((it: any, idx: number) => {
            const draft = orderEdits[idx];
            const qty = draft?.quantity !== undefined && draft.quantity !== '' ? Math.max(0, Number(draft.quantity) || 0) : Number(it.quantity) || 0;
            const unitPrice = draft?.unitPrice !== undefined && draft.unitPrice !== '' ? Math.max(0, Number(draft.unitPrice) || 0) : Number(it.unitPrice) || 0;
            return { ...it, quantity: qty, unitPrice, lineTotal: unitPrice * qty };
          });
          p_total_amount = adjustedItems.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
          p_metadata = { ...(orderRow.metadata || {}), items: adjustedItems };
        }
        const { error: rpcErr } = await supabase.rpc('risk_initial_review', {
          p_order_id: selected.id, p_action: action, p_note: modalNote || null, p_metadata, p_total_amount,
        });
        if (rpcErr) throw rpcErr;

        if (action === 'approve') {
          await supabase.from('supplier_order_notifications').insert([{ message: `Order cleared Risk's initial review and is awaiting your approval: ${selected.description}`, notified_department: 'MANAGEMENT', read: false }]);
          await supabase.from('supplier_order_notifications').insert([{ message: `Your order passed Risk's initial review and is now with Management: ${selected.description}`, notified_department: 'MARKETING', read: false }]);
        } else {
          const verbLabel = action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
          await supabase.from('supplier_order_notifications').insert([{ message: `Order ${verbLabel} by Risk: ${selected.description}${modalNote ? ` — ${modalNote}` : ''}`, notified_department: 'MARKETING', read: false }]);
        }
      }

      if (selected.type === 'Risk Final Release') {
        // The new second gate — Accounts already cleared the payment check
        // (PENDING_FINANCE -> PENDING_RISK_RELEASE); this is Risk's final
        // control/release check before Admin & Warehouse may physically
        // load the goods. Approve/Reject/Return only — no line-item
        // editing at this stage, per the approved decision.
        const { error: rpcErr } = await supabase.rpc('risk_final_release', {
          p_order_id: selected.id, p_action: action, p_note: modalNote || null,
        });
        if (rpcErr) throw rpcErr;

        if (action === 'approve') {
          await supabase.from('supplier_order_notifications').insert([{ message: `Order cleared Risk's final release check and is ready for warehouse: ${selected.description}`, notified_department: 'ADMIN_WAREHOUSE', read: false }]);
          await supabase.from('supplier_order_notifications').insert([{ message: `Your order has been fully cleared by Risk and is being prepared for dispatch: ${selected.description}`, notified_department: 'MARKETING', read: false }]);
        } else {
          const verbLabel = action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
          await supabase.from('supplier_order_notifications').insert([{ message: `Order ${verbLabel} by Risk at final release: ${selected.description}${modalNote ? ` — ${modalNote}` : ''}`, notified_department: 'MARKETING', read: false }]);
        }
      }

      if (selected.type === 'Customer Verification') {
        const custStatus = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED_FOR_CORRECTION' : 'REJECTED';
        await setCustomerVerification(selected.id, custStatus, { rejectionReason: modalNote || undefined });
        const verbLabel = action === 'approve' ? 'APPROVED' : action === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
        await supabase.from('supplier_order_notifications').insert([{ message: `Customer ${verbLabel} by Risk: ${selected.description}${modalNote ? ` — ${modalNote}` : ''}`, notified_department: 'MARKETING', read: false }]);
      }

      if (selected.type === 'Proof of Delivery') {
        // DELIVERED is reachable ONLY through this RPC — a driver's or
        // staff account's own direct update can no longer set it.
        const { error: rpcErr } = await supabase.rpc('risk_review_pod', {
          p_delivery_log_id: selected.id, p_action: action === 'approve' ? 'approve' : 'reject', p_note: modalNote || null,
        });
        if (rpcErr) throw rpcErr;

        if (action === 'approve') {
          await supabase.from('supplier_order_notifications').insert([{ message: `Proof of delivery APPROVED by Risk, delivery closed out: ${selected.description}`, notified_department: 'DISPATCH', read: false }]);
        } else {
          await supabase.from('supplier_order_notifications').insert([{ message: `Proof of delivery REJECTED by Risk: ${selected.description}${modalNote ? ` — ${modalNote}` : ''}`, notified_department: 'DISPATCH', read: false }]);
        }
      }

      await supabase.from('global_audit_history').insert([{
        department: 'RISK',
        action: `${verb}: ${selected.requestId} — ${selected.description}${modalNote ? ` | Note: ${modalNote}` : ''}`,
        performed_by: profile?.fullName || 'Risk',
        reference_id: selected.id,
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
            {TABS.map((tab) => {
              const count = tab === 'All' ? items.length : items.filter((i) => i.type === tab).length;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    paddingVertical: 6, paddingHorizontal: 12, borderRadius: t.radius.pill,
                    backgroundColor: activeTab === tab ? t.colors.accent : t.colors.bgCard,
                    borderWidth: 1, borderColor: activeTab === tab ? t.colors.accent : t.colors.border,
                  }}
                >
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: activeTab === tab ? t.colors.onAccent : t.colors.textSecondary }}>
                    {tab}{tab !== 'All' ? ` (${count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

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

            {creditPosition && (
              <SheetSection label="Customer Credit Position">
                <View style={{ gap: t.spacing.sm }}>
                  {creditPosition.onHold && (
                    <View style={{ padding: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: t.colors.status.warning.bg }}>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.status.warning.text }}>⚠ CREDIT ON HOLD: new credit orders are blocked for this customer.</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
                    <View style={{ width: '47%' }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Credit Limit</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{creditPosition.limit !== null ? `GHS ${creditPosition.limit.toLocaleString()}` : 'No limit, global cap applies'}</Text>
                    </View>
                    <View style={{ width: '47%' }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Currently Outstanding</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {creditPosition.outstanding.toLocaleString()}</Text>
                    </View>
                    <View style={{ width: '47%' }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>This Order</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {creditPosition.thisOrder.toLocaleString()}</Text>
                    </View>
                    <View style={{ width: '47%' }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Would Total</Text>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: creditPosition.overLimit ? t.colors.status.danger.text : t.colors.textPrimary }}>GHS {creditPosition.wouldTotal.toLocaleString()}</Text>
                      {creditPosition.overLimit && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.status.danger.text }}>Exceeds limit by GHS {(creditPosition.wouldTotal - (creditPosition.limit ?? 0)).toLocaleString()}</Text>}
                    </View>
                  </View>
                </View>
              </SheetSection>
            )}

            {selected.type === 'Sales Order' && Array.isArray(selected.raw?.metadata?.items) && selected.raw.metadata.items.length > 0 && (
              <SheetSection label="Order Items (editable before approving)">
                <View style={{ gap: t.spacing.sm }}>
                  {selected.raw.metadata.items.map((it: any, idx: number) => {
                    const draft = orderEdits[idx] || { quantity: String(it.quantity ?? ''), unitPrice: String(it.unitPrice ?? '') };
                    return (
                      <View key={idx} style={{ gap: 4 }}>
                        <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{it.productName}</Text>
                        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                          <View style={{ flex: 1 }}>
                            <Input value={draft.quantity} onChangeText={(v) => setOrderEdits((prev) => { const next = [...prev]; next[idx] = { ...draft, quantity: v }; return next; })} keyboardType="numeric" placeholder="Qty" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Input value={draft.unitPrice} onChangeText={(v) => setOrderEdits((prev) => { const next = [...prev]; next[idx] = { ...draft, unitPrice: v }; return next; })} keyboardType="decimal-pad" placeholder="Unit Price" />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </SheetSection>
            )}

            {selected.type === 'Risk Final Release' && Array.isArray(selected.raw?.metadata?.items) && selected.raw.metadata.items.length > 0 && (
              <SheetSection label="Order Items (read-only, already verified by Accounts)">
                <View style={{ gap: t.spacing.sm }}>
                  {selected.raw.metadata.items.map((it: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{it.productName}</Text>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{it.quantity} × GHS {Number(it.unitPrice || 0).toLocaleString()}</Text>
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
        footer={<Button label={submitting ? 'Submitting…' : 'Confirm'} onPress={confirmAction} loading={submitting} disabled={submitting} fullWidth />}
      >
        <View style={{ gap: t.spacing.md }}>
          {selected?.type === 'Cargo Intake' && showModal === 'approve' && (
            <>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Field label="Confirmed Damages"><Input value={String(confirmedDamages)} onChangeText={(v) => setConfirmedDamages(Math.max(0, Number(v) || 0))} keyboardType="numeric" /></Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Cost Per Unit (GHS)"><Input value={String(costPerUnit)} onChangeText={(v) => setCostPerUnit(Math.max(0, Number(v) || 0))} keyboardType="decimal-pad" /></Field>
                </View>
              </View>
              {confirmedDamages > 0 && (
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.status.danger.text }}>
                  {confirmedDamages} damaged units will be recorded as a system loss of GHS {(confirmedDamages * costPerUnit).toLocaleString()}.
                </Text>
              )}
              <Field label="Selling Price (GHS, optional)"><Input value={sellingPrice} onChangeText={setSellingPrice} keyboardType="decimal-pad" /></Field>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <Pressable onPress={() => setNotifyOps((v) => !v)} style={{ flex: 1, padding: t.spacing.sm, borderRadius: t.radius.sm, borderWidth: 1, borderColor: notifyOps ? t.colors.accent : t.colors.border, backgroundColor: notifyOps ? t.colors.accentSoft : t.colors.bgCard }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: notifyOps ? t.colors.accent : t.colors.textSecondary, textAlign: 'center' }}>Notify Operations</Text>
                </Pressable>
                <Pressable onPress={() => setNotifyCeo((v) => !v)} style={{ flex: 1, padding: t.spacing.sm, borderRadius: t.radius.sm, borderWidth: 1, borderColor: notifyCeo ? t.colors.accent : t.colors.border, backgroundColor: notifyCeo ? t.colors.accentSoft : t.colors.bgCard }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: notifyCeo ? t.colors.accent : t.colors.textSecondary, textAlign: 'center' }}>Notify CEO</Text>
                </Pressable>
              </View>
            </>
          )}
          <Field label={showModal === 'approve' ? 'Note (optional)' : 'Reason'}>
            <Input value={modalNote} onChangeText={setModalNote} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} />
          </Field>
        </View>
      </Sheet>

      <RequestTimelineSheet open={showTimeline} onClose={() => setShowTimeline(false)} referenceId={selected?.id || ''} displayId={selected?.requestId} />
    </Screen>
  );
}
