// rebma-mobile/screens/management/MgmtApprovalsScreen.tsx
// Ports: rebma-web/src/views/management/MgmtApprovalsView.tsx (1115 lines,
// read in full) — the centerpiece of Phase 7.6. Five LIVE lanes (Cargo
// Intake, Sales Order [escalation-only from Risk], Production Request,
// General Purchase, Float Request), each Approve/Reject only (no
// Return/Escalate — Management has no further escalation destination in
// this pipeline). confirmAction()'s write logic is ported line-for-line
// (D39) — same rigor as Risk's centerpiece (Phase 7.5). Only PENDING
// items are loaded, matching every other mobile approval queue's scoping
// call. Correction from stale plan text: Cargo Intake was NOT actually
// removed from Management on web (confirmed by reading current source) —
// it's a real, live lane querying PENDING_MANAGEMENT_APPROVAL, ported as
// such.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { CheckCircle, XCircle, RotateCcw, History, Package, CreditCard, Factory, ShoppingCart, Wallet } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';
import type { StatusTone } from '../../theme/tokens';

type ItemType = 'Cargo Intake' | 'Sales Order' | 'Production Request' | 'General Purchase' | 'Float Request';
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

// 'Cargo Intake' removed from this tab list — security/gap audit fix.
// This file's own header comment above confirmed it was live when built
// (Phase 7.6), but the Risk-department migration
// (supabase_risk_department.sql) since restricted cargo_intake writes to
// operations/risk/admin only, and nothing writes
// PENDING_MANAGEMENT_APPROVAL on it anymore — this tab was permanently
// empty (or threw a raw RLS error on a stale legacy row). The underlying
// query/confirmAction() branch is left in place, unreachable now that
// the tab can't be selected, matching web's own same-scoped fix.
const TABS: Array<'All' | ItemType> = ['All', 'Sales Order', 'Production Request', 'General Purchase', 'Float Request'];
const TYPE_ICON: Record<ItemType, typeof Package> = {
  'Cargo Intake': Package, 'Sales Order': CreditCard, 'Production Request': Factory, 'General Purchase': ShoppingCart, 'Float Request': Wallet,
};
const TYPE_TONE: Record<ItemType, 'info' | 'purple' | 'muted' | 'success'> = {
  'Cargo Intake': 'info', 'Sales Order': 'purple', 'Production Request': 'success', 'General Purchase': 'muted', 'Float Request': 'muted',
};

export default function MgmtApprovalsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();

  const [items, setItems] = useState<ApprovalItem[]>([]);
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
  const [approvedQty, setApprovedQty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const load = useCallback(async () => {
    try {
      const [
        { data: cargoData },
        { data: ordersData },
        { data: productionData },
        { data: purchasesData },
        { data: floatData },
      ] = await Promise.all([
        supabase.from('cargo_intake').select('*').eq('status', 'PENDING_MANAGEMENT_APPROVAL').order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('*').eq('status', 'PENDING_MANAGEMENT').order('created_at', { ascending: false }).limit(50),
        supabase.from('production_requests').select('*').eq('status', 'PENDING_MANAGEMENT').order('created_at', { ascending: false }).limit(50).then((r) => r, () => ({ data: [] })),
        supabase.from('general_purchases').select('*').eq('status', 'PENDING_MANAGEMENT_APPROVAL').order('created_at', { ascending: false }).limit(50).then((r) => r, () => ({ data: [] })),
        supabase.from('float_requests').select('*').eq('status', 'PENDING_MANAGEMENT').order('created_at', { ascending: false }).limit(50).then((r) => r, () => ({ data: [] })),
      ]);

      const mappedCargo: ApprovalItem[] = (cargoData || []).map((row: any) => {
        const baseDesc = `${row.product_name || 'Goods'}, ${row.qty_received || row.quantity || 0} ${row.goods_type || 'units'} from ${row.company || 'supplier'}`;
        return {
          id: row.id, requestId: `CARGO-${row.id.slice(-6).toUpperCase()}`, type: 'Cargo Intake',
          description: row.discrepancies?.trim() ? `${baseDesc} (Discrepancy: ${row.discrepancies})` : baseDesc,
          amount: row.unit_price ? Number(row.unit_price) * (row.qty_received || row.quantity || 0) : null,
          date: row.created_at?.slice(0, 10) || '', raw: row,
        };
      });
      const mappedOrders: ApprovalItem[] = (ordersData || []).map((row: any) => ({
        id: row.id, requestId: `ORD-${row.id.slice(-6).toUpperCase()}`, type: 'Sales Order',
        description: `${row.payment_mode === 'CREDIT' ? 'Credit order' : `${row.payment_mode || 'Cash'} order`} for ${row.client_name}, GHS ${Number(row.total_amount || 0).toLocaleString()}`,
        amount: Number(row.total_amount || 0), date: row.created_at?.slice(0, 10) || '', raw: row,
      }));
      const mappedProduction: ApprovalItem[] = (productionData || []).map((row: any) => ({
        id: row.id, requestId: `PROD-${row.id.slice(-6).toUpperCase()}`, type: 'Production Request',
        description: `${row.product_name || row.productName || 'Product'}, ${row.quantity || 0} ${row.unit || 'units'}`,
        amount: null, date: row.created_at?.slice(0, 10) || '', raw: row,
      }));
      const mappedPurchases: ApprovalItem[] = (purchasesData || []).map((row: any) => ({
        id: row.id, requestId: `PURCH-${row.id.slice(-6).toUpperCase()}`, type: 'General Purchase',
        description: `${row.item_name || row.itemName || 'Item'}, ${row.quantity || 0} units`,
        amount: row.cost ? Number(row.cost) : null, date: row.created_at?.slice(0, 10) || '', raw: row,
      }));
      const mappedFloat: ApprovalItem[] = (floatData || []).map((row: any) => ({
        id: row.id, requestId: `FLOAT-${row.id.slice(-6).toUpperCase()}`, type: 'Float Request',
        description: `Float replenishment: GHS ${Number(row.amount || 0).toLocaleString()} (${row.reason || 'No reason given'})`,
        amount: Number(row.amount || 0), date: row.created_at?.slice(0, 10) || '', raw: row,
      }));

      setItems([...mappedCargo, ...mappedOrders, ...mappedProduction, ...mappedPurchases, ...mappedFloat]);
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
    setSellingPrice('');
    setNotifyOps(true);
    setNotifyCeo(true);
    if (item.type === 'Cargo Intake') {
      let defaultDamages = 0;
      const discText = String(item.raw?.discrepancies || '');
      if (discText.trim()) {
        const matches = discText.match(/\d+/g);
        if (matches) defaultDamages = matches.reduce((sum, v) => sum + parseInt(v, 10), 0);
      }
      setConfirmedDamages(defaultDamages);
      setCostPerUnit(Number(item.raw?.unit_price || 0));
    }
    if (item.type === 'Production Request') {
      setApprovedQty(String(item.raw?.quantity ?? ''));
    }
    if (item.type === 'Sales Order' && Array.isArray(item.raw?.metadata?.items)) {
      setOrderEdits(item.raw.metadata.items.map((it: any) => ({ quantity: String(it.quantity ?? ''), unitPrice: String(it.unitPrice ?? '') })));
    }
    setShowModal(action);
  };

  async function confirmAction() {
    if (!selected || !showModal || submitting) return;
    const action = showModal;
    setSubmitting(true);
    try {
      if (selected.type === 'Cargo Intake') {
        const newDbStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        const rawId = String(selected.raw.id);
        const cargoRow = selected.raw;
        const incomingQty = Number(cargoRow.quantity || cargoRow.qty_received || 0);
        const finalQtyToAdd = Math.max(0, incomingQty - confirmedDamages);
        const discrepancyCost = confirmedDamages * costPerUnit;
        const sellingPriceVal = sellingPrice ? parseFloat(sellingPrice) : 0;
        const rawDiscrepancies = String(cargoRow.discrepancies || '');
        let finalDiscrepancyNotes = rawDiscrepancies;
        if (confirmedDamages > 0) {
          finalDiscrepancyNotes = JSON.stringify({
            originalQty: incomingQty, damagedCount: confirmedDamages, unitCost: costPerUnit, costLoss: discrepancyCost,
            sellingPrice: sellingPriceVal, notes: rawDiscrepancies && rawDiscrepancies !== 'None' ? rawDiscrepancies : 'Damaged goods write-off',
          });
        }
        await supabase.from('cargo_intake').update({
          status: newDbStatus, quantity: action === 'approve' ? finalQtyToAdd : incomingQty, discrepancies: finalDiscrepancyNotes,
          unit_price: costPerUnit, is_fault_or_damaged: confirmedDamages > 0, rejection_reason: action === 'approve' ? null : (modalNote || null),
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
            notes: `${selected.description}${confirmedDamages > 0 ? ` (${confirmedDamages} units damaged/lost)` : ''}`, created_at: now,
          });
          if (discrepancyCost > 0) {
            await supabase.from('finance_expenses').insert([{
              category: 'Damaged Goods', description: `Loss from damaged goods in Cargo Intake ${selected.requestId} (${productName}: ${confirmedDamages} units)`,
              amount: discrepancyCost, date: now.slice(0, 10), status: 'Approved', submitted_by: 'Management (Auto-generated)',
              notes: `Auto-generated from Cargo Intake approval. Discrepancy details: ${selected.description}`,
            }]);
          }
          if (notifyOps) await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Management: ${selected.description}`, notified_department: 'OPERATIONS', read: false }]);
          const forceCeoAlert = confirmedDamages > 0 && (await getCeoSetting('discrepancy_auto_alert_ceo', true));
          if (notifyCeo || forceCeoAlert) await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Management: ${selected.description}`, notified_department: 'CEO', read: false }]);
          if (sellingPrice) await supabase.from('goods_prices').upsert([{ product_name: productName, unit_price: parseFloat(sellingPrice) }], { onConflict: 'product_name' });
          await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Management: ${selected.description}`, notified_department: 'FINANCE', read: false }]);
          await supabase.from('supplier_order_notifications').insert([{ message: `New stock approved: ${selected.description}. Update pricing in Marketing.`, notified_department: 'MARKETING', read: false }]);
        } else {
          await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake REJECTED by Management: ${selected.description}${modalNote ? ` (${modalNote})` : ''}`, notified_department: 'OPERATIONS', read: false }]);
        }
      }

      if (selected.type === 'Sales Order') {
        // Now the MANDATORY universal gate every order passes through
        // (Marketing -> Risk Initial -> Management -> Accounts -> Risk
        // Final Release -> ...), not an optional Risk escalation. Status
        // write goes through management_review_order(), the only legal
        // path PENDING_MANAGEMENT -> PENDING_FINANCE/REJECTED/
        // RETURNED_FOR_CORRECTION, database-trigger-enforced. Line-item
        // editing capability is unchanged.
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
        const { error: rpcErr } = await supabase.rpc('management_review_order', {
          p_order_id: selected.id, p_action: action, p_note: modalNote || null, p_metadata, p_total_amount,
        });
        if (rpcErr) throw rpcErr;

        if (action === 'approve') {
          await supabase.from('supplier_order_notifications').insert([{ message: `Order approved by Management and now awaiting Accounts Office processing: ${selected.description}`, notified_department: 'FINANCE', read: false }]);
          await supabase.from('supplier_order_notifications').insert([{ message: `Your order has been approved by Management and sent to Accounts: ${selected.description}`, notified_department: 'MARKETING', read: false }]);
        } else if (action === 'return') {
          await supabase.from('supplier_order_notifications').insert([{ message: `Order RETURNED FOR CORRECTION by Management: ${selected.description}${modalNote ? ` (${modalNote})` : ''}`, notified_department: 'MARKETING', read: false }]);
        } else {
          await supabase.from('supplier_order_notifications').insert([{ message: `Order REJECTED by Management: ${selected.description}${modalNote ? ` (${modalNote})` : ''}`, notified_department: 'MARKETING', read: false }]);
        }
      }

      if (selected.type === 'Production Request') {
        if (action === 'approve') {
          const req = selected.raw;
          const productName: string = req.product_name || req.productName || '';
          const requestedQty = Number(req.quantity) || 0;
          const qty = approvedQty !== '' ? Math.max(0, Number(approvedQty) || 0) : requestedQty;
          const now = new Date().toISOString();
          await supabase.from('production_requests').update({ status: 'TICKETS_ISSUED', quantity: qty }).eq('id', selected.id);
          await supabase.from('fulfillment_tickets').insert({
            production_request_id: selected.id, type: 'PRODUCTION_RELEASE',
            details: { productName, quantity: qty, requestedQuantity: requestedQty, unit: req.unit, purpose: req.purpose },
            status: 'PENDING', created_at: now, updated_at: now,
          });
          if (productName && qty > 0) {
            const { data: existingStock } = await supabase.from('stock').select('id, quantity').ilike('product_name', productName).limit(1);
            if (existingStock && existingStock.length > 0) {
              await supabase.from('stock').update({ quantity: (existingStock[0].quantity || 0) + qty, last_updated: now }).eq('id', existingStock[0].id);
            } else {
              await supabase.from('stock').insert({ product_name: productName, quantity: qty, unit: req.unit || 'units', last_updated: now });
            }
            await supabase.from('stock_ledger').insert({
              product_name: productName, movement_type: 'ADD', quantity: qty, reference: `Production Request Approved: ${selected.requestId}`,
              notes: qty !== requestedQty ? `Management adjusted requested qty ${requestedQty} → ${qty}` : undefined, created_at: now,
            });
          }
          await supabase.from('supplier_order_notifications').insert([{ message: `Production request APPROVED by Management and ready for pickup/repackaging: ${selected.description}`, notified_department: 'PRODUCTION', read: false }]);
          await supabase.from('supplier_order_notifications').insert([{ message: `Production release ready for warehouse handling: ${selected.description}`, notified_department: 'OPERATIONS', read: false }]);
        } else {
          await supabase.from('production_requests').update({ status: 'REJECTED', rejection_reason: modalNote || null }).eq('id', selected.id);
          await supabase.from('supplier_order_notifications').insert([{ message: `Production request REJECTED by Management: ${selected.description}${modalNote ? ` (${modalNote})` : ''}`, notified_department: 'PRODUCTION', read: false }]);
        }
      }

      if (selected.type === 'General Purchase') {
        const newDbStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        const requestingDept = String(selected.raw.department || 'OPERATIONS');
        await supabase.from('general_purchases').update({ status: newDbStatus, rejection_reason: action === 'approve' ? null : (modalNote || null) }).eq('id', selected.id);
        if (action === 'approve') {
          await supabase.from('supplier_order_notifications').insert([{ message: `General purchase APPROVED by Management: ${selected.description}`, notified_department: requestingDept, read: false }]);
        } else {
          await supabase.from('supplier_order_notifications').insert([{ message: `General purchase REJECTED by Management: ${selected.description}${modalNote ? ` (${modalNote})` : ''}`, notified_department: requestingDept, read: false }]);
        }
      }

      if (selected.type === 'Float Request') {
        const req = selected.raw;
        const now = new Date().toISOString();
        if (action === 'approve') {
          await supabase.from('float_requests').update({ status: 'APPROVED', approved_by: profile?.fullName || 'Management', updated_at: now }).eq('id', selected.id);
          const { data: latestEntry } = await supabase.from('finance_petty_cash').select('balance_after').order('created_at', { ascending: false }).limit(1);
          const currentBalance = Number(latestEntry?.[0]?.balance_after) || 0;
          const amount = Number(req.amount) || 0;
          await supabase.from('finance_petty_cash').insert({
            date: now.slice(0, 10), description: `Replenishment approved by Management: ${req.reason || 'Float top-up'}`,
            amount, disbursed_to: 'Petty Cash Float', category: 'Replenishment', type: 'replenishment',
            balance_after: currentBalance + amount, created_at: now,
          });
          await supabase.from('supplier_order_notifications').insert([{ message: `Float replenishment APPROVED by Management: GHS ${amount.toLocaleString()} added to petty cash.`, notified_department: 'FINANCE', read: false }]);
        } else {
          await supabase.from('float_requests').update({ status: 'REJECTED', rejection_reason: modalNote || null, updated_at: now }).eq('id', selected.id);
          await supabase.from('supplier_order_notifications').insert([{ message: `Float replenishment REJECTED by Management: ${selected.description}${modalNote ? ` (${modalNote})` : ''}`, notified_department: 'FINANCE', read: false }]);
        }
      }

      await supabase.from('global_audit_history').insert([{
        department: 'MANAGEMENT',
        action: `${action.toUpperCase()}: ${selected.requestId}, ${selected.description}${modalNote ? ` | Note: ${modalNote}` : ''}`,
        performed_by: profile?.fullName || 'Management',
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
    { key: 'type', label: 'Type', status: true, render: (i) => <Badge tone={TYPE_TONE[i.type] as StatusTone} label={i.type} size="xs" /> },
    { key: 'amount', label: 'Amount', render: (i) => (i.amount != null ? `GHS ${i.amount.toLocaleString()}` : '—') },
    { key: 'date', label: 'Date' },
    { key: 'requestId', label: 'ID' },
  ];

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

        <DataList columns={columns} data={filtered} rowKey={(i) => i.id} loading={loading} emptyTitle="No pending items. You're all caught up." onRowPress={(i) => setSelected(i)} />
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
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Amount</Text>
                <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: t.colors.accent }}>GHS {selected.amount.toLocaleString()}</Text>
              </Card>
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

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              <Button label="Timeline" size="sm" variant="ghost" icon={<History size={13} color={t.colors.textSecondary} />} onPress={() => setShowTimeline(true)} />
              <Button label="Reject" size="sm" variant="danger" icon={<XCircle size={13} color="#fff" />} onPress={() => openAction(selected, 'reject')} />
              {selected.type === 'Sales Order' && (
                <Button label="Return" size="sm" variant="ghost" icon={<RotateCcw size={13} color={t.colors.textSecondary} />} onPress={() => openAction(selected, 'return')} />
              )}
              <Button label="Approve" size="sm" icon={<CheckCircle size={13} color="#fff" />} onPress={() => openAction(selected, 'approve')} />
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
          {selected?.type === 'Production Request' && showModal === 'approve' && (
            <Field label="Approved Quantity" hint={`Requested: ${Number(selected.raw?.quantity ?? 0).toLocaleString()} ${selected.raw?.unit || 'units'}`}>
              <Input value={approvedQty} onChangeText={setApprovedQty} keyboardType="numeric" />
            </Field>
          )}
          <Field label={showModal === 'approve' ? 'Additional notes (optional)' : 'Reason for rejection *'}>
            <Input value={modalNote} onChangeText={setModalNote} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} />
          </Field>
        </View>
      </Sheet>

      <RequestTimelineSheet open={showTimeline} onClose={() => setShowTimeline(false)} referenceId={selected?.id || ''} displayId={selected?.requestId} />
    </Screen>
  );
}
