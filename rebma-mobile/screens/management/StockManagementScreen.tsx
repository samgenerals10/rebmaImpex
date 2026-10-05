// rebma-mobile/screens/management/StockManagementScreen.tsx
// Ports: rebma-web/src/views/management/MgmtStockManagementView.tsx (read
// in full) — two real capabilities (D42). Cargo correction (qty/weight/
// discrepancy edit, a REQUIRED reason, delta-adjusts stock + a
// stock_ledger CORRECTION row) and stock deletion with type-to-confirm
// friction (exact product name for one item, literal "DELETE" for a
// batch) plus a live open-orders warning fetched right before
// confirmation. Both gated by their own ceo_settings keys via the new
// lib/ceoSetting.ts. No realtime subscription (D34 precedent) — manual
// pull-to-refresh instead.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { AlertTriangle, Edit3, Trash2, History } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import ProductImage from '../../components/ui/ProductImage';
import Sheet from '../../components/ui/Sheet';
import SectionHeader from '../../components/ui/SectionHeader';
import SearchSortBar from '../../components/ui/SearchSortBar';
import IconActionButton from '../../components/ui/IconActionButton';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';

const OPEN_ORDER_STATUSES_EXCLUDED = ['DELIVERED', 'REJECTED', 'CANCELLED', 'COMPLETED'];

export default function StockManagementScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvedCargo, setApprovedCargo] = useState<any[]>([]);
  const [cargoSearch, setCargoSearch] = useState('');
  const [cargoSort, setCargoSort] = useState('recent');

  const [correctionTarget, setCorrectionTarget] = useState<any | null>(null);
  const [timelineTarget, setTimelineTarget] = useState<any | null>(null);
  const [correctionForm, setCorrectionForm] = useState({ quantity: '', weight: '', discrepancies: '', unitPrice: '', note: '' });
  const [savingCorrection, setSavingCorrection] = useState(false);

  const [deleteTargets, setDeleteTargets] = useState<any[] | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [openOrdersWarning, setOpenOrdersWarning] = useState<{ product: string; count: number }[]>([]);
  const [deletingStock, setDeletingStock] = useState(false);
  const [loadingDeleteContext, setLoadingDeleteContext] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: cargo } = await supabase.from('cargo_intake').select('*').eq('status', 'APPROVED');
    setApprovedCargo(cargo || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const CARGO_SORT_OPTIONS = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'name', label: 'Product Name' },
    { value: 'qty', label: 'Quantity' },
    { value: 'weight', label: 'Weight' },
  ];

  const filteredCargo = approvedCargo
    .filter((c) =>
      !cargoSearch || String(c.product_name || '').toLowerCase().includes(cargoSearch.toLowerCase()) || String(c.company || '').toLowerCase().includes(cargoSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (cargoSort === 'name') return String(a.product_name || '').localeCompare(String(b.product_name || ''));
      if (cargoSort === 'qty') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
      if (cargoSort === 'weight') return (Number(b.weight) || 0) - (Number(a.weight) || 0);
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    });

  const openCorrection = (c: any) => {
    setCorrectionTarget(c);
    setCorrectionForm({
      quantity: String(c.quantity ?? ''), weight: String(c.weight ?? ''),
      discrepancies: c.discrepancies && c.discrepancies !== 'None' ? c.discrepancies : '', unitPrice: String(c.unit_price ?? ''), note: '',
    });
  };

  const saveCorrection = async () => {
    if (!correctionTarget) return;
    if (!(await getCeoSetting('stock_adjustments_allowed', true))) { Alert.alert('Disabled', 'Stock adjustments are currently disabled by the CEO.'); return; }
    if (!correctionForm.note.trim()) { Alert.alert('Reason Required', 'A reason for the correction is required.'); return; }
    const oldQty = Number(correctionTarget.quantity) || 0;
    const newQty = Number(correctionForm.quantity) || 0;
    const delta = newQty - oldQty;
    const performedBy = profile?.fullName || 'Management';
    setSavingCorrection(true);
    try {
      // One database step (correct_cargo_intake): reads the quantity on
      // record at that moment, saves the correction and moves stock by
      // exactly the difference. Same as web.
      const { error: corrErr } = await supabase.rpc('correct_cargo_intake', {
        p_cargo_id: String(correctionTarget.id),
        p_new_quantity: newQty,
        p_fields: {
          weight: correctionForm.weight || '',
          discrepancies: correctionForm.discrepancies || '',
          unit_price: correctionForm.unitPrice || '',
        },
        p_reason: correctionForm.note.trim(),
        p_performed_by: performedBy,
      });
      if (corrErr) throw corrErr;

      await supabase.from('global_audit_history').insert({
        action: `CORRECT_CARGO: ${correctionTarget.goods_code || correctionTarget.id}, ${correctionTarget.product_name}`,
        department: 'MANAGEMENT', performed_by: performedBy,
        // Direct correction: this write had no reference_id — an edit
        // to a cargo entry disappeared from that entry's own timeline
        // ("even with rejections, editing... it should be tracked").
        reference_id: correctionTarget.id,
        details: `Corrected cargo entry. Qty ${oldQty} to ${newQty}${delta !== 0 ? ` (stock adjusted by ${delta > 0 ? '+' : ''}${delta})` : ''}. Reason: ${correctionForm.note.trim()}`,
        timestamp: new Date().toISOString(),
      });

      setCorrectionTarget(null);
      fetchData();
    } catch (e: any) {
      Alert.alert('Correction Failed', e.message || 'Could not save this correction.');
    } finally {
      setSavingCorrection(false);
    }
  };

  const deleteConfirmExpected = deleteTargets && deleteTargets.length === 1 ? deleteTargets[0].product_name : 'DELETE';

  // Direct correction: "Correct" and "Delete" are two actions on the SAME
  // row now, not two separate lists — Correct operates on the cargo_intake
  // batch (a specific approved entry), Delete operates on the live `stock`
  // row for that product, resolved by product_name right when it's tapped
  // (the two tables aren't the same row, but the user should never see
  // that as two lists — it's one product, two things you can do to it).
  const deleteFromCargoRow = async (c: any) => {
    if (!(await getCeoSetting('management_can_delete_stock', true))) { Alert.alert('Disabled', 'Stock deletion is currently disabled by the CEO.'); return; }
    const { data: matches } = await supabase.from('stock').select('*').eq('product_name', c.product_name);
    if (!matches?.length) {
      Alert.alert('No Stock Record', `No stock record found for "${c.product_name}" to delete.`);
      return;
    }
    openDeleteStock(matches);
  };

  const openDeleteStock = async (rows: any[]) => {
    setDeleteTargets(rows);
    setDeleteReason('');
    setDeleteConfirmText('');
    setOpenOrdersWarning([]);
    setLoadingDeleteContext(true);
    try {
      const ids = rows.map((r) => r.id);
      const { data: freshRows } = await supabase.from('stock').select('*').in('id', ids);
      if (freshRows?.length) setDeleteTargets((prev) => (prev || []).map((r) => freshRows.find((f: any) => f.id === r.id) || r));

      const productNames = Array.from(new Set(rows.map((r) => r.product_name).filter(Boolean)));
      if (productNames.length) {
        const { data: openOrders } = await supabase.from('orders').select('product_name, status').in('product_name', productNames).not('status', 'in', `(${OPEN_ORDER_STATUSES_EXCLUDED.join(',')})`);
        const counts: Record<string, number> = {};
        (openOrders || []).forEach((o: any) => { counts[o.product_name] = (counts[o.product_name] || 0) + 1; });
        setOpenOrdersWarning(Object.entries(counts).map(([product, count]) => ({ product, count })));
      }
    } finally {
      setLoadingDeleteContext(false);
    }
  };

  const confirmDeleteStock = async () => {
    if (!deleteTargets?.length) return;
    if (!deleteReason.trim()) { Alert.alert('Reason Required', 'A reason for deletion is required.'); return; }
    if (deleteConfirmText.trim() !== deleteConfirmExpected) { Alert.alert('Confirmation Mismatch', `Type "${deleteConfirmExpected}" to confirm.`); return; }
    const performedBy = profile?.fullName || 'Management';
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;

    setDeletingStock(true);
    try {
      for (const row of deleteTargets) {
        await supabase.from('stock_ledger').insert({
          product_name: row.product_name, movement_type: 'DELETION', quantity: -(Number(row.quantity) || 0), reference: row.id,
          notes: `Deleted by ${performedBy}. Reason: ${deleteReason.trim()}`, performed_by: performerId, created_at: new Date().toISOString(),
        });
        await supabase.from('stock').delete().eq('id', row.id);
      }
      await supabase.from('global_audit_history').insert({
        action: deleteTargets.length === 1 ? `DELETE_STOCK: ${deleteTargets[0].product_name}` : `DELETE_STOCK: ${deleteTargets.length} items`,
        department: 'MANAGEMENT', performed_by: performedBy,
        // Single-item delete anchors to that stock row's own id (so the
        // deletion itself is the last, traceable entry on what was that
        // record's timeline); a batch delete has no single record to
        // anchor to, so it's left unlinked rather than picking one
        // arbitrarily.
        reference_id: deleteTargets.length === 1 ? deleteTargets[0].id : null,
        details: `Deleted ${deleteTargets.map((r) => `${r.product_name} (${r.quantity} ${r.unit || 'units'})`).join(', ')}. Reason: ${deleteReason.trim()}.`,
        timestamp: new Date().toISOString(),
      });
      setDeleteTargets(null);
      setDeleteReason('');
      setDeleteConfirmText('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Deletion Failed', e.message || 'Could not delete this stock item.');
    } finally {
      setDeletingStock(false);
    }
  };

  // Same detail level as Admin & Warehouse's own Stock screen shows for
  // this exact table (cargo_intake, status='APPROVED') — direct
  // correction, this list was missing several fields the Admin &
  // Warehouse version of this same list already has. Confirmed against
  // source: PortIngestionScreen.tsx writes a new row at
  // 'PENDING_RISK_APPROVAL'; RiskApprovalsScreen.tsx's cargo lane is the
  // ONLY place that ever flips it to 'APPROVED' (approve/reject/return
  // are its only three outcomes for this table). So every row on this
  // screen is, structurally, cargo Admin & Warehouse logged that Risk
  // has since approved — that's the real flow, not a guess.
  const cargoColumns: DataColumn<any>[] = [
    { key: 'product_name', label: 'Product', primary: true },
    { key: 'company', label: 'Supplier', status: true, render: (c) => <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{c.company || '—'}</Text> },
    { key: 'quantity', label: 'Qty', render: (c) => String(c.quantity ?? 0) },
    { key: 'goods_code', label: 'Goods Code', render: (c) => c.goods_code || `CARGO-${String(c.id || '').slice(-6).toUpperCase()}` },
    { key: 'weight', label: 'Weight', render: (c) => `${Number(c.weight || 0).toFixed(1)}T` },
    { key: 'country', label: 'Country of Origin', render: (c) => c.country || '—' },
    { key: 'container_number', label: 'Container #', render: (c) => c.container_number || '—' },
    { key: 'unit_price', label: 'Unit Price', render: (c) => (c.unit_price != null ? `GHS ${c.unit_price}` : '—') },
    {
      key: 'discrepancies', label: 'Discrepancy',
      render: (c) => c.is_fault_or_damaged || (c.discrepancies && c.discrepancies !== 'None')
        ? <Badge tone="warning" label={c.discrepancies || 'Flagged'} size="xs" />
        : <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>None</Text>,
    },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View>
          <SectionHeader title="Stock" subtitle="Approved by Risk from Admin & Warehouse's cargo intake, correct an entry error, or delete a stock record" />
          <SearchSortBar
            value={cargoSearch}
            onChangeText={setCargoSearch}
            placeholder="Search stock..."
            sortOptions={CARGO_SORT_OPTIONS}
            sortValue={cargoSort}
            onSortChange={setCargoSort}
          />
        </View>
        <DataList
          columns={cargoColumns}
          data={filteredCargo}
          rowKey={(c) => c.id}
          loading={loading}
          emptyTitle="No approved cargo entries"
          collapsible
          rowThumbnail={(c) => <ProductImage uri={c.product_image} label={c.product_name} size={40} />}
          renderActions={(c) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
              {/* Direct instruction: tracking should be "horizontal on
                  every list", a visible icon right on the row, not
                  buried behind a menu. */}
              <IconActionButton icon={History} tone="info" accessibilityLabel="View Timeline" onPress={() => setTimelineTarget(c)} />
              <Button label="Correct" size="sm" variant="ghost" icon={<Edit3 size={12} color={t.colors.textSecondary} />} onPress={() => openCorrection(c)} />
              <Button label="Delete" size="sm" variant="danger" icon={<Trash2 size={12} color="#fff" />} onPress={() => deleteFromCargoRow(c)} />
            </View>
          )}
        />
      </View>

      <RequestTimelineSheet
        open={!!timelineTarget}
        onClose={() => setTimelineTarget(null)}
        referenceId={timelineTarget?.id || ''}
        displayId={timelineTarget?.goods_code || timelineTarget?.product_name}
      />

      <Sheet
        open={!!correctionTarget}
        onClose={() => setCorrectionTarget(null)}
        title="Correct Cargo Entry"
        subtitle={correctionTarget?.product_name}
        side="bottom"
        maxHeight={620}
        footer={<Button label={savingCorrection ? 'Saving…' : 'Save Correction'} onPress={saveCorrection} loading={savingCorrection} disabled={savingCorrection} fullWidth />}
      >
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Quantity"><Input value={correctionForm.quantity} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, quantity: v }))} keyboardType="numeric" placeholder="0" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Weight"><Input value={correctionForm.weight} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, weight: v }))} keyboardType="decimal-pad" placeholder="0.00" /></Field></View>
        </View>
        <Field label="Unit Price"><Input value={correctionForm.unitPrice} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, unitPrice: v }))} keyboardType="decimal-pad" placeholder="0.00" /></Field>
        <Field label="Discrepancies"><Input value={correctionForm.discrepancies} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, discrepancies: v }))} placeholder="e.g. 3 units water-damaged" /></Field>
        <Field label="Reason for Correction *"><Input value={correctionForm.note} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, note: v }))} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} placeholder="Why is this being corrected?" /></Field>
      </Sheet>

      <Sheet
        open={!!deleteTargets}
        onClose={() => setDeleteTargets(null)}
        title="Confirm Stock Deletion"
        subtitle={deleteTargets?.length === 1 ? deleteTargets[0].product_name : `${deleteTargets?.length || 0} items`}
        side="bottom"
        maxHeight={560}
        footer={<Button label={deletingStock ? 'Deleting…' : 'Delete'} variant="danger" onPress={confirmDeleteStock} loading={deletingStock} disabled={deletingStock || loadingDeleteContext} fullWidth />}
      >
        <View style={{ gap: t.spacing.md }}>
          {openOrdersWarning.length > 0 && (
            <Card tone="inset">
              <View style={{ flexDirection: 'row', gap: t.spacing.xs, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} color={t.colors.status.warning.text} />
                <Text style={{ flex: 1, fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.status.warning.text }}>
                  Open orders exist against: {openOrdersWarning.map((w) => `${w.product}: ${w.count} open`).join(', ')}. Deletion doesn't touch orders.
                </Text>
              </View>
            </Card>
          )}
          <Field label="Reason for Deletion *"><Input value={deleteReason} onChangeText={setDeleteReason} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} placeholder="Why is this stock being deleted?" /></Field>
          <Field label={`Type "${deleteConfirmExpected}" to confirm`}><Input value={deleteConfirmText} onChangeText={setDeleteConfirmText} autoCapitalize="characters" placeholder={deleteConfirmExpected} /></Field>
        </View>
      </Sheet>
    </Screen>
  );
}
