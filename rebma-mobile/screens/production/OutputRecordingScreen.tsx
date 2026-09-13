// rebma-mobile/screens/production/OutputRecordingScreen.tsx
// Ports: rebma-web/src/views/production/OutputRecordingView.tsx (366
// lines, read in full) — full CRUD (D65) against production_logs,
// preserving both documented web-side fixes exactly: goods_unit is a
// NOT NULL column with no default (always set on insert/update), and the
// row id is left for Postgres's gen_random_uuid() default rather than
// fabricated client-side.
import { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Package, Edit, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';
import SectionHeader from '../../components/ui/SectionHeader';

const UNITS = ['kg', 'tons', 'liters', 'bags', 'units'];

interface OutputRecord {
  id: string;
  date: string;
  product: string;
  received: number;
  unit: string;
  boxes: number;
  sachets: number;
  quality: 'Pass' | 'Fail';
  notes: string;
}

const mapToUI = (db: any): OutputRecord => ({
  id: db.id,
  date: db.date || '',
  product: db.product_name || '',
  received: Number(db.goods_received || 0),
  unit: db.goods_unit || 'kg',
  boxes: Number(db.boxes_produced || 0),
  sachets: Number(db.total_sachets || 0),
  quality: db.quality_result === 'Fail' ? 'Fail' : 'Pass',
  notes: db.notes || '',
});

const mapToDB = (ui: Partial<OutputRecord>) => {
  const db: any = {};
  if (ui.date !== undefined) db.date = ui.date;
  if (ui.product !== undefined) db.product_name = ui.product;
  if (ui.received !== undefined) db.goods_received = ui.received;
  // goods_unit is NOT NULL with no default in the live schema — always set it.
  if (ui.unit !== undefined) db.goods_unit = ui.unit;
  if (ui.boxes !== undefined) db.boxes_produced = ui.boxes;
  if (ui.sachets !== undefined) {
    db.total_sachets = ui.sachets;
    if (ui.boxes && ui.boxes > 0) db.sachets_per_box = Math.round(ui.sachets / ui.boxes);
  }
  if (ui.quality !== undefined) db.quality_result = ui.quality;
  if (ui.notes !== undefined) db.notes = ui.notes;
  return db;
};

const emptyForm = { date: new Date().toISOString().split('T')[0], product: '', received: '', unit: 'kg', boxes: '', sachets: '', quality: 'Pass' as 'Pass' | 'Fail', notes: '' };

export default function OutputRecordingScreen() {
  const t = useTheme();
  const [records, setRecords] = useState<OutputRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<OutputRecord | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const load = async () => {
    const { data, error } = await supabase.from('production_logs').select('*').order('date', { ascending: false });
    setRecords(!error && data ? data.map(mapToUI) : []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.date === today);
  const todayBoxes = todayRecords.reduce((s, r) => s + r.boxes, 0);
  const todaySachets = todayRecords.reduce((s, r) => s + r.sachets, 0);
  const passRate = records.length ? Math.round((records.filter((r) => r.quality === 'Pass').length / records.length) * 100) : 0;
  const totalBoxes = records.reduce((s, r) => s + r.boxes, 0);
  const totalSachets = records.reduce((s, r) => s + r.sachets, 0);

  const handleSubmit = async () => {
    if (!form.product.trim()) { Alert.alert('Product name is required.'); return; }
    if (!form.boxes) { Alert.alert('Boxes Produced is required.'); return; }
    if (!form.sachets) { Alert.alert('Sachets Produced is required.'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const dbData = mapToDB({
        date: form.date, product: form.product, received: Number(form.received),
        unit: form.unit, boxes: Number(form.boxes), sachets: Number(form.sachets),
        quality: form.quality, notes: form.notes,
      });
      dbData.record_number = `REC-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from('production_logs').insert(dbData);
      if (error) throw error;
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not insert output record.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (r: OutputRecord) => {
    setEditTarget(r);
    setEditForm({ date: r.date, product: r.product, received: String(r.received), unit: r.unit, boxes: String(r.boxes), sachets: String(r.sachets), quality: r.quality, notes: r.notes });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const dbData = mapToDB({
        date: editForm.date, product: editForm.product, received: Number(editForm.received),
        unit: editForm.unit, boxes: Number(editForm.boxes), sachets: Number(editForm.sachets),
        quality: editForm.quality, notes: editForm.notes,
      });
      const { error } = await supabase.from('production_logs').update(dbData).eq('id', editTarget.id);
      if (error) throw error;
      setEditTarget(null);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not update record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (r: OutputRecord) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this production record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('production_logs').delete().eq('id', r.id);
          if (error) Alert.alert('Failed', error.message);
          else await load();
        },
      },
    ]);
  };

  const columns: DataColumn<OutputRecord>[] = [
    { key: 'product', label: 'Product', primary: true },
    { key: 'quality', label: 'Quality', status: true, render: (r) => <Badge tone={r.quality === 'Pass' ? 'success' : 'danger'} label={r.quality} size="xs" /> },
    { key: 'date', label: 'Date' },
    { key: 'received', label: 'Received', render: (r) => `${r.received} ${r.unit}` },
    { key: 'boxes', label: 'Boxes' },
    { key: 'sachets', label: 'Sachets', render: (r) => r.sachets.toLocaleString() },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Boxes Today" value={todayBoxes} tone="accent" emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Sachets Today" value={todaySachets.toLocaleString()} emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Quality Pass Rate" value={`${passRate}%`} tone={passRate >= 90 ? 'accent' : 'warning'} emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Records" value={records.length} emphasis="secondary" /></View>
        </View>

        <Card>
          <SectionHeader title="Record New Output" />
          <Field label="Date"><Input value={form.date} onChangeText={(v) => setForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" /></Field>
          <Field label="Product"><Input value={form.product} onChangeText={(v) => setForm((f) => ({ ...f, product: v }))} placeholder="Product name" /></Field>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}><Field label="Goods Received"><Input value={form.received} onChangeText={(v) => setForm((f) => ({ ...f, received: v }))} keyboardType="numeric" placeholder="From operations" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Unit"><SearchablePicker value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} options={UNITS.map((u) => ({ value: u, label: u }))} /></Field></View>
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}><Field label="Boxes Produced"><Input value={form.boxes} onChangeText={(v) => setForm((f) => ({ ...f, boxes: v }))} keyboardType="numeric" placeholder="0" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Sachets Produced"><Input value={form.sachets} onChangeText={(v) => setForm((f) => ({ ...f, sachets: v }))} keyboardType="numeric" placeholder="0" /></Field></View>
          </View>
          <Field label="Quality Check">
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {(['Pass', 'Fail'] as const).map((q) => (
                <View key={q} style={{ flex: 1 }}>
                  <Button label={q} variant={form.quality === q ? (q === 'Pass' ? 'primary' : 'danger') : 'ghost'} onPress={() => setForm((f) => ({ ...f, quality: q }))} />
                </View>
              ))}
            </View>
          </Field>
          <Field label="Notes"><Input value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={2} placeholder="Any observations..." style={{ minHeight: 56, textAlignVertical: 'top' }} /></Field>
          <Button label={submitting ? 'Submitting…' : 'Submit Record'} onPress={handleSubmit} loading={submitting} disabled={submitting} fullWidth />
        </Card>

        <View>
          <SectionHeader title="Output History" />
          <DataList
            columns={columns}
            data={records}
            rowKey={(r) => r.id}
            loading={loading}
            emptyIcon={<Package size={28} color={t.colors.textMuted} />}
            emptyTitle="No output records yet"
            emptyDescription="They will appear here once added"
            renderActions={(r) => (
              <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
                <Button label="Edit" size="sm" variant="ghost" icon={<Edit size={12} color={t.colors.textSecondary} />} onPress={() => openEdit(r)} />
                <Button label="Delete" size="sm" variant="danger" icon={<Trash2 size={12} color="#fff" />} onPress={() => handleDelete(r)} />
              </View>
            )}
          />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Boxes" value={totalBoxes.toLocaleString()} emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Sachets" value={totalSachets.toLocaleString()} emphasis="secondary" /></View>
        </View>
      </View>

      <Sheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Production Output"
        side="bottom"
        maxHeight={720}
        footer={<Button label={submitting ? 'Saving…' : 'Save Changes'} onPress={saveEdit} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Product"><Input value={editForm.product} onChangeText={(v) => setEditForm((f) => ({ ...f, product: v }))} /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Date"><Input value={editForm.date} onChangeText={(v) => setEditForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Goods Received"><Input value={editForm.received} onChangeText={(v) => setEditForm((f) => ({ ...f, received: v }))} keyboardType="numeric" /></Field></View>
        </View>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Unit"><SearchablePicker value={editForm.unit} onChange={(v) => setEditForm((f) => ({ ...f, unit: v }))} options={UNITS.map((u) => ({ value: u, label: u }))} /></Field></View>
          <View style={{ flex: 1 }}><Field label="Boxes Produced"><Input value={editForm.boxes} onChangeText={(v) => setEditForm((f) => ({ ...f, boxes: v }))} keyboardType="numeric" /></Field></View>
        </View>
        <Field label="Sachets Produced"><Input value={editForm.sachets} onChangeText={(v) => setEditForm((f) => ({ ...f, sachets: v }))} keyboardType="numeric" /></Field>
        <Field label="Quality Check">
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {(['Pass', 'Fail'] as const).map((q) => (
              <View key={q} style={{ flex: 1 }}>
                <Button label={q} variant={editForm.quality === q ? (q === 'Pass' ? 'primary' : 'danger') : 'ghost'} onPress={() => setEditForm((f) => ({ ...f, quality: q }))} />
              </View>
            ))}
          </View>
        </Field>
        <Field label="Notes"><Input value={editForm.notes} onChangeText={(v) => setEditForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} /></Field>
      </Sheet>
    </Screen>
  );
}
