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
import { View, Text, Alert } from 'react-native';
import { AlertTriangle, Edit3, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';
import SectionHeader from '../../components/ui/SectionHeader';

const OPEN_ORDER_STATUSES_EXCLUDED = ['DELIVERED', 'REJECTED', 'CANCELLED', 'COMPLETED'];

export default function StockManagementScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvedCargo, setApprovedCargo] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);
  const [cargoSearch, setCargoSearch] = useState('');
  const [stockSearch, setStockSearch] = useState('');

  const [correctionTarget, setCorrectionTarget] = useState<any | null>(null);
  const [correctionForm, setCorrectionForm] = useState({ quantity: '', weight: '', discrepancies: '', unitPrice: '', note: '' });
  const [savingCorrection, setSavingCorrection] = useState(false);

  const [deleteTargets, setDeleteTargets] = useState<any[] | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [openOrdersWarning, setOpenOrdersWarning] = useState<{ product: string; count: number }[]>([]);
  const [deletingStock, setDeletingStock] = useState(false);
  const [loadingDeleteContext, setLoadingDeleteContext] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: cargo }, { data: stocks }] = await Promise.all([
      supabase.from('cargo_intake').select('*').eq('status', 'APPROVED'),
      supabase.from('stock').select('*'),
    ]);
    setApprovedCargo(cargo || []);
    setStockList(stocks || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredCargo = approvedCargo.filter((c) =>
    !cargoSearch || String(c.product_name || '').toLowerCase().includes(cargoSearch.toLowerCase()) || String(c.company || '').toLowerCase().includes(cargoSearch.toLowerCase())
  );
  const filteredStock = stockList.filter((s) =>
    !stockSearch || String(s.product_name || '').toLowerCase().includes(stockSearch.toLowerCase()) || String(s.category || '').toLowerCase().includes(stockSearch.toLowerCase())
  );

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
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;

    setSavingCorrection(true);
    try {
      await supabase.from('cargo_intake').update({
        quantity: newQty, weight: Number(correctionForm.weight) || 0, discrepancies: correctionForm.discrepancies || 'None',
        unit_price: correctionForm.unitPrice ? Number(correctionForm.unitPrice) : null,
      }).eq('id', correctionTarget.id);

      if (delta !== 0) {
        const productName = correctionTarget.product_name;
        const { data: stockRow } = await supabase.from('stock').select('id, quantity').eq('product_name', productName).maybeSingle();
        if (stockRow) {
          await supabase.from('stock').update({ quantity: Math.max(0, Number(stockRow.quantity || 0) + delta), last_updated: new Date().toISOString(), updated_by: performerId }).eq('id', stockRow.id);
        }
        await supabase.from('stock_ledger').insert({
          product_name: productName, movement_type: 'CORRECTION', quantity: delta, reference: correctionTarget.goods_code || correctionTarget.id,
          notes: `Correction by ${performedBy}: qty ${oldQty} → ${newQty}. Reason: ${correctionForm.note.trim()}`, performed_by: performerId, created_at: new Date().toISOString(),
        });
      }

      await supabase.from('global_audit_history').insert({
        action: `CORRECT_CARGO: ${correctionTarget.goods_code || correctionTarget.id} — ${correctionTarget.product_name}`,
        department: 'MANAGEMENT', performed_by: performedBy,
        details: `Corrected cargo entry. Qty ${oldQty} → ${newQty}${delta !== 0 ? ` (stock adjusted by ${delta > 0 ? '+' : ''}${delta})` : ''}. Reason: ${correctionForm.note.trim()}`,
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

  const openDeleteStock = async (rows: any[]) => {
    if (!(await getCeoSetting('management_can_delete_stock', true))) { Alert.alert('Disabled', 'Stock deletion is currently disabled by the CEO.'); return; }
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

  const cargoColumns: DataColumn<any>[] = [
    { key: 'product_name', label: 'Product', primary: true },
    { key: 'company', label: 'Supplier', status: true, render: (c) => <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{c.company || '—'}</Text> },
    { key: 'quantity', label: 'Qty', render: (c) => String(c.quantity ?? 0) },
    { key: 'unit_price', label: 'Unit Price', render: (c) => (c.unit_price != null ? `GHS ${c.unit_price}` : '—') },
  ];
  const stockColumns: DataColumn<any>[] = [
    { key: 'product_name', label: 'Product', primary: true },
    { key: 'category', label: 'Category', status: true, render: (s) => <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{s.category || '—'}</Text> },
    { key: 'quantity', label: 'Qty', render: (s) => `${s.quantity ?? 0} ${s.unit || ''}` },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View>
          <SectionHeader title="Approved Cargo — Corrections" subtitle="Fix a quantity, weight, or discrepancy entry error after approval" />
          <Input value={cargoSearch} onChangeText={setCargoSearch} placeholder="Search cargo..." />
        </View>
        <DataList
          columns={cargoColumns}
          data={filteredCargo}
          rowKey={(c) => c.id}
          loading={loading}
          emptyTitle="No approved cargo entries"
          renderActions={(c) => <Button label="Correct" size="sm" variant="ghost" icon={<Edit3 size={12} color={t.colors.textSecondary} />} onPress={() => openCorrection(c)} />}
        />

        <View>
          <SectionHeader title="Stock — Deletion" subtitle="Type-to-confirm required; open orders against a product are flagged first" />
          <Input value={stockSearch} onChangeText={setStockSearch} placeholder="Search stock..." />
        </View>
        <DataList
          columns={stockColumns}
          data={filteredStock}
          rowKey={(s) => s.id}
          loading={loading}
          emptyTitle="No stock records"
          renderActions={(s) => <Button label="Delete" size="sm" variant="danger" icon={<Trash2 size={12} color="#fff" />} onPress={() => openDeleteStock([s])} />}
        />
      </View>

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
          <View style={{ flex: 1 }}><Field label="Quantity"><Input value={correctionForm.quantity} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, quantity: v }))} keyboardType="numeric" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Weight"><Input value={correctionForm.weight} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, weight: v }))} keyboardType="decimal-pad" /></Field></View>
        </View>
        <Field label="Unit Price"><Input value={correctionForm.unitPrice} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, unitPrice: v }))} keyboardType="decimal-pad" /></Field>
        <Field label="Discrepancies"><Input value={correctionForm.discrepancies} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, discrepancies: v }))} /></Field>
        <Field label="Reason for Correction *"><Input value={correctionForm.note} onChangeText={(v) => setCorrectionForm((f) => ({ ...f, note: v }))} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} /></Field>
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
                  Open orders exist against: {openOrdersWarning.map((w) => `${w.product} (${w.count})`).join(', ')}. Deletion doesn't touch orders.
                </Text>
              </View>
            </Card>
          )}
          <Field label="Reason for Deletion *"><Input value={deleteReason} onChangeText={setDeleteReason} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} /></Field>
          <Field label={`Type "${deleteConfirmExpected}" to confirm`}><Input value={deleteConfirmText} onChangeText={setDeleteConfirmText} autoCapitalize="characters" /></Field>
        </View>
      </Sheet>
    </Screen>
  );
}
