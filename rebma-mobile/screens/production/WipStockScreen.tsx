// rebma-mobile/screens/production/WipStockScreen.tsx
// Ports: rebma-web/src/views/production/WipStockView.tsx (456 lines, read
// in full) — full CRUD (D64), matching wipApi's exact field shapes
// (product_name, stage, qty, unit, batch_ref, notes) and the 6-stage
// pipeline verbatim. Print omitted (D11 precedent).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Plus, Layers, Edit2, Copy, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import type { StatusTone } from '../../theme/tokens';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';

const UNITS = ['kg', 'L', 'pcs', 'boxes', 'sachets', 'blocks', 'bags'];
const STAGES = ['Raw Materials', 'Processing', 'Quality Check', 'Packaging', 'Awaiting Dispatch', 'Completed'];

function stageTone(stage: string): StatusTone {
  const map: Record<string, StatusTone> = {
    'Raw Materials': 'muted',
    Processing: 'info',
    'Quality Check': 'warning',
    Packaging: 'warning',
    'Awaiting Dispatch': 'success',
    Completed: 'purple',
  };
  return map[stage] || 'muted';
}

const emptyForm = { productName: '', stage: 'Raw Materials', qty: '', unit: 'kg', batchRef: '', notes: '' };

export default function WipStockScreen() {
  const t = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');

  const [detail, setDetail] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('wip_stock').select('*').order('updated_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    const matchStage = stageFilter === 'All' || i.stage === stageFilter;
    const s = search.toLowerCase();
    const matchSearch = !s || (i.product_name || '').toLowerCase().includes(s) || (i.batch_ref || '').toLowerCase().includes(s);
    return matchStage && matchSearch;
  });

  const totalQty = items.reduce((sum, i) => sum + Number(i.qty || 0), 0);
  const inProcessing = items.filter((i) => i.stage === 'Processing').length;
  const readyToDispatch = items.filter((i) => i.stage === 'Awaiting Dispatch').length;

  const openEdit = (item: any) => {
    setEditTarget(item);
    setEditForm({
      productName: item.product_name || '',
      stage: item.stage || 'Raw Materials',
      qty: String(item.qty ?? ''),
      unit: item.unit || 'kg',
      batchRef: item.batch_ref || '',
      notes: item.notes || '',
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('wip_stock')
        .update({
          product_name: editForm.productName,
          stage: editForm.stage,
          qty: Number(editForm.qty) || 0,
          unit: editForm.unit,
          batch_ref: editForm.batchRef || null,
          notes: editForm.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editTarget.id);
      if (error) throw error;
      setEditTarget(null);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not update WIP item.');
    } finally {
      setSubmitting(false);
    }
  };

  const addItem = async () => {
    if (!addForm.productName.trim() || !addForm.qty) {
      Alert.alert('Product name and quantity are required.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('wip_stock').insert({
        product_name: addForm.productName,
        stage: addForm.stage,
        qty: Number(addForm.qty) || 0,
        unit: addForm.unit,
        batch_ref: addForm.batchRef || `B-${Date.now()}`,
        notes: addForm.notes || null,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      setAddOpen(false);
      setAddForm(emptyForm);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not add WIP item.');
    } finally {
      setSubmitting(false);
    }
  };

  const duplicateItem = async (item: any) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('wip_stock').insert({
        product_name: item.product_name,
        stage: 'Raw Materials',
        qty: item.qty,
        unit: item.unit,
        batch_ref: item.batch_ref ? `${item.batch_ref}-Copy` : `B-${Date.now()}`,
        notes: item.notes || null,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not duplicate WIP item.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteItem = (item: any) => {
    Alert.alert('Remove WIP Item', `Remove "${item.product_name}" from WIP stock?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('wip_stock').delete().eq('id', item.id);
          if (error) Alert.alert('Failed', error.message);
          else await load();
        },
      },
    ]);
  };

  const columns: DataColumn<any>[] = [
    { key: 'product_name', label: 'Product', primary: true },
    { key: 'stage', label: 'Stage', status: true, render: (i) => <Badge tone={stageTone(i.stage)} label={i.stage} size="xs" /> },
    { key: 'qty', label: 'Qty', render: (i) => `${Number(i.qty || 0).toLocaleString()} ${i.unit || ''}` },
    { key: 'batch_ref', label: 'Batch', render: (i) => i.batch_ref || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <Button label="Add WIP Item" icon={<Plus size={14} color="#fff" />} onPress={() => setAddOpen(true)} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Items" value={items.length} emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Qty" value={totalQty.toLocaleString()} emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="In Processing" value={inProcessing} tone="warning" emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Ready to Dispatch" value={readyToDispatch} tone="accent" emphasis="secondary" /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Production Pipeline</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
            {STAGES.map((stage) => {
              const count = items.filter((i) => i.stage === stage).length;
              const active = stageFilter === stage;
              return (
                <Button
                  key={stage}
                  label={`${stage} (${count})`}
                  size="sm"
                  variant={active ? 'primary' : 'ghost'}
                  onPress={() => setStageFilter(active ? 'All' : stage)}
                />
              );
            })}
          </View>
        </Card>

        <Input value={search} onChangeText={setSearch} placeholder="Search product or batch ref..." />
        <SearchablePicker
          value={stageFilter}
          onChange={setStageFilter}
          options={[{ value: 'All', label: 'All Stages' }, ...STAGES.map((s) => ({ value: s, label: s }))]}
        />

        <DataList
          columns={columns}
          data={filtered}
          rowKey={(i) => i.id}
          loading={loading}
          onRowPress={(i) => setDetail(i)}
          emptyIcon={<Layers size={28} color={t.colors.textMuted} />}
          emptyTitle="No WIP items found"
          renderActions={(i) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
              <Button label="Edit" size="sm" variant="ghost" icon={<Edit2 size={12} color={t.colors.textSecondary} />} onPress={() => openEdit(i)} />
              <Button label="Copy" size="sm" variant="ghost" icon={<Copy size={12} color={t.colors.textSecondary} />} onPress={() => duplicateItem(i)} />
              <Button label="Delete" size="sm" variant="danger" icon={<Trash2 size={12} color="#fff" />} onPress={() => deleteItem(i)} />
            </View>
          )}
        />
      </View>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.product_name || 'WIP Item'} side="bottom" maxHeight={560}
        footer={detail && <Button label="Edit WIP Item" icon={<Edit2 size={14} color="#fff" />} onPress={() => { openEdit(detail); setDetail(null); }} fullWidth />}
      >
        {detail && (
          <View style={{ gap: t.spacing.sm }}>
            <Badge tone={stageTone(detail.stage)} label={detail.stage} />
            {[
              { label: 'Batch Reference', value: detail.batch_ref || '—' },
              { label: 'Quantity', value: `${Number(detail.qty || 0).toLocaleString()} ${detail.unit || ''}` },
              { label: 'Last Updated', value: detail.updated_at ? new Date(detail.updated_at).toLocaleString() : '—' },
              { label: 'Notes', value: detail.notes || '—' },
            ].map((r) => (
              <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: t.spacing.xs, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{r.label}</Text>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{r.value}</Text>
              </View>
            ))}
          </View>
        )}
      </Sheet>

      <Sheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit WIP Item"
        side="bottom"
        maxHeight={680}
        footer={<Button label={submitting ? 'Saving…' : 'Save Changes'} onPress={saveEdit} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Product Name *"><Input value={editForm.productName} onChangeText={(v) => setEditForm((f) => ({ ...f, productName: v }))} /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Quantity *"><Input value={editForm.qty} onChangeText={(v) => setEditForm((f) => ({ ...f, qty: v }))} keyboardType="numeric" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Unit"><SearchablePicker value={editForm.unit} onChange={(v) => setEditForm((f) => ({ ...f, unit: v }))} options={UNITS.map((u) => ({ value: u, label: u }))} /></Field></View>
        </View>
        <Field label="Batch Reference"><Input value={editForm.batchRef} onChangeText={(v) => setEditForm((f) => ({ ...f, batchRef: v }))} /></Field>
        <Field label="Stage"><SearchablePicker value={editForm.stage} onChange={(v) => setEditForm((f) => ({ ...f, stage: v }))} options={STAGES.map((s) => ({ value: s, label: s }))} /></Field>
        <Field label="Notes"><Input value={editForm.notes} onChangeText={(v) => setEditForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} /></Field>
      </Sheet>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add WIP Item"
        side="bottom"
        maxHeight={680}
        footer={<Button label={submitting ? 'Adding…' : 'Add Item'} onPress={addItem} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Product Name *"><Input value={addForm.productName} onChangeText={(v) => setAddForm((f) => ({ ...f, productName: v }))} placeholder="e.g. Shea Butter Cream 200ml" /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Quantity *"><Input value={addForm.qty} onChangeText={(v) => setAddForm((f) => ({ ...f, qty: v }))} keyboardType="numeric" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Unit"><SearchablePicker value={addForm.unit} onChange={(v) => setAddForm((f) => ({ ...f, unit: v }))} options={UNITS.map((u) => ({ value: u, label: u }))} /></Field></View>
        </View>
        <Field label="Batch Reference"><Input value={addForm.batchRef} onChangeText={(v) => setAddForm((f) => ({ ...f, batchRef: v }))} placeholder="e.g. B-2026-0507" /></Field>
        <Field label="Stage"><SearchablePicker value={addForm.stage} onChange={(v) => setAddForm((f) => ({ ...f, stage: v }))} options={STAGES.map((s) => ({ value: s, label: s }))} /></Field>
        <Field label="Notes"><Input value={addForm.notes} onChangeText={(v) => setAddForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} /></Field>
      </Sheet>
    </Screen>
  );
}
