// rebma-mobile/screens/hr/PayrollScreen.tsx
// Ports: rebma-web/src/views/PayrollPanel.tsx's `canManage` branch (D54)
// — NOT rebma-web/src/views/hr/PayrollView.tsx, which is dead code
// (App.tsx routes activeSubTab==='Payroll' to PayrollPanel before HR's
// own department-scoped block ever runs; confirmed by reading the
// routing order directly). This is a new, fuller-capability build, not a
// re-export of Finance/Management's read-only screen (finance/PayrollScreen.tsx),
// since only HR gets canManage=true.
//
// Ported bug-for-bug, per direct instruction — NOT fixed:
//   - saveItem()'s total_amount/item_count are recomputed client-side from
//     the locally-held `items` array before being written back, the same
//     read-modify-write race documented as MEDIUM in the Phase 7.7
//     pre-flight audit. Two people adding staff to the same batch at once
//     can produce a stale rollup total. Line items themselves are never
//     wrong, only the batch's rollup.
//   - The "only the CEO can mark PAID once ceo_must_approve_payroll is on"
//     enforcement is documented (HIGH) as non-functional on web today —
//     the RLS check compares against uppercase 'PAID' while this screen
//     (matching web) writes lowercase 'paid'. Ported as-is; not a place to
//     silently "improve" the gate.
// "My Payslips" self-service (Gap-Closure Backlog, Item 4, D112) is now
// built (screens/PayslipsScreen.tsx) — it sidesteps the employee_id/
// staff_id ambiguity entirely by relying on RLS alone for its read (no
// client-side .eq() filter). That still leaves the WRITE side of the
// ambiguity: this screen's own "Add Staff to Batch" always wrote
// employee_id: null, so no payroll item was ever actually linked to a
// real employee. Closed below with a real staff picker (optional — the
// old free-text-only path still works for anyone not in the picker, e.g.
// contractors) and a fallback-retry insert: try employee_id first, and
// only on a genuine "column does not exist" error retry with staff_id —
// the same schema-uncertainty pattern apiClient.ts's registerCustomer()
// already established for is_special_customer. Whichever column is real,
// this makes future payslips actually linkable.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Plus, Banknote } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';
import SearchablePicker from '../../components/ui/SearchablePicker';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import type { StatusTone } from '../../theme/tokens';

interface PayrollBatch {
  id: string; name: string; period_start: string; period_end: string;
  status: 'draft' | 'approved' | 'paid'; total_amount: number; item_count: number; created_by: string;
}
interface PayrollItem {
  id: string; batch_id: string; employee_id: string | null; employee_name: string; department: string;
  gross_amount: number; deductions: number; net_amount: number; notes: string;
}
const STATUS_TONE: Record<string, StatusTone> = { draft: 'warning', approved: 'info', paid: 'success' };

const blankBatch = { name: '', period_start: '', period_end: '' };
const blankItem = { batch_id: '', employee_name: '', department: '', gross_amount: '', deductions: '', staffId: '' };

interface StaffOption { id: string; full_name: string; department: string }

export default function PayrollScreen() {
  const t = useTheme();
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<PayrollBatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchForm, setBatchForm] = useState(blankBatch);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState(blankItem);

  const load = useCallback(async () => {
    try {
      const { data: batchData } = await supabase.from('payroll_batches').select('*').order('created_at', { ascending: false });
      if (batchData) setBatches(batchData as any);
      const { data: itemData } = await supabase.from('payroll_items').select('*').order('employee_name');
      if (itemData) setItems(itemData as any);
      const { data: staffData } = await supabase.from('profiles').select('id, full_name, department').eq('status', 'ACTIVE').order('full_name').limit(300);
      if (staffData) setStaffOptions(staffData as any);
    } catch {
      // tables may not exist
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveBatch = async () => {
    if (!batchForm.name.trim() || !batchForm.period_start || !batchForm.period_end) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await supabase.from('payroll_batches').insert({
        name: batchForm.name, period_start: batchForm.period_start, period_end: batchForm.period_end,
        status: 'draft', total_amount: 0, item_count: 0, created_by: sessionData.session?.user?.id || null,
      });
      setShowBatchForm(false);
      setBatchForm(blankBatch);
      load();
    } catch (e: any) {
      Alert.alert('Could Not Create Batch', 'Ensure payroll_batches exists with RLS.');
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async () => {
    if (!itemForm.employee_name.trim() || !itemForm.gross_amount) return;
    setSaving(true);
    try {
      const gross = parseFloat(itemForm.gross_amount) || 0;
      const deductions = parseFloat(itemForm.deductions) || 0;
      const base = {
        batch_id: itemForm.batch_id, employee_name: itemForm.employee_name,
        department: itemForm.department, gross_amount: gross, deductions, net_amount: gross - deductions,
      };
      // D112 fallback-retry: only populate the link when a real staff
      // member was picked (contractors/free-text entries stay unlinked,
      // exactly as before). Try employee_id first; on a genuine
      // "column does not exist" error, retry with staff_id instead —
      // this repo's live payroll_items schema isn't committed anywhere,
      // so which column is real can't be confirmed offline.
      let insertError: any = null;
      if (itemForm.staffId) {
        const first = await supabase.from('payroll_items').insert({ ...base, employee_id: itemForm.staffId });
        if (first.error && /column .* does not exist/i.test(first.error.message || '')) {
          const retry = await supabase.from('payroll_items').insert({ ...base, staff_id: itemForm.staffId } as any);
          insertError = retry.error;
        } else {
          insertError = first.error;
        }
      } else {
        const { error } = await supabase.from('payroll_items').insert({ ...base, employee_id: null });
        insertError = error;
      }
      if (insertError) throw insertError;

      // Client-recomputed rollup — ported as-is, race documented not fixed (see header).
      const batchItems = items.filter((i) => i.batch_id === itemForm.batch_id);
      const newTotal = batchItems.reduce((s, i) => s + i.net_amount, 0) + (gross - deductions);
      await supabase.from('payroll_batches').update({ total_amount: newTotal, item_count: batchItems.length + 1 }).eq('id', itemForm.batch_id);
      setShowItemForm(false);
      setItemForm(blankItem);
      load();
    } catch {
      Alert.alert('Error', 'Could not add payroll item.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (batch: PayrollBatch, status: 'approved' | 'paid') => {
    await supabase.from('payroll_batches').update({ status }).eq('id', batch.id);
    load();
  };

  const batchColumns: DataColumn<PayrollBatch>[] = [
    { key: 'name', label: 'Batch', primary: true },
    { key: 'status', label: 'Status', status: true, render: (b) => <Badge tone={STATUS_TONE[b.status] || 'muted'} label={b.status.toUpperCase()} size="xs" /> },
    { key: 'period', label: 'Period', render: (b) => `${b.period_start} — ${b.period_end}` },
    { key: 'total_amount', label: 'Total', render: (b) => `GHS ${Number(b.total_amount ?? 0).toLocaleString()}` },
    { key: 'item_count', label: 'Staff', render: (b) => `${b.item_count} staff` },
  ];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="New Batch" icon={<Plus size={14} color="#fff" />} onPress={() => { setBatchForm(blankBatch); setShowBatchForm(true); }} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <View>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Payroll Management</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 2 }}>Create batches, add staff, approve and pay</Text>
        </View>

        {loading ? (
          <SkeletonList rows={3} />
        ) : batches.length === 0 ? (
          <EmptyState icon={<Banknote size={20} color={t.colors.textMuted} />} title="No payroll batches yet" description="Create a new batch to get started." />
        ) : (
          <DataList
            columns={batchColumns}
            data={batches}
            rowKey={(b) => b.id}
            onRowPress={(b) => setExpanded(b)}
          />
        )}
      </View>

      <Sheet
        open={!!expanded}
        onClose={() => setExpanded(null)}
        title={expanded?.name}
        subtitle={expanded ? `${expanded.period_start} — ${expanded.period_end}` : undefined}
        badge={expanded ? <Badge tone={STATUS_TONE[expanded.status] || 'muted'} label={expanded.status.toUpperCase()} size="xs" /> : undefined}
        side="bottom"
        maxHeight={640}
      >
        {expanded && (
          <View style={{ gap: t.spacing.lg }}>
            <Card tone="inset">
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Total Net</Text>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: t.colors.accent }}>GHS {Number(expanded.total_amount ?? 0).toLocaleString()}</Text>
            </Card>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {expanded.status === 'draft' && <Button label="Approve" size="sm" onPress={() => { updateStatus(expanded, 'approved'); setExpanded({ ...expanded, status: 'approved' }); }} />}
              {expanded.status === 'approved' && <Button label="Mark Paid" size="sm" onPress={() => { updateStatus(expanded, 'paid'); setExpanded({ ...expanded, status: 'paid' }); }} />}
              <Button label="Add Staff" size="sm" variant="ghost" icon={<Plus size={12} color={t.colors.textSecondary} />} onPress={() => { setItemForm({ ...blankItem, batch_id: expanded.id }); setShowItemForm(true); }} />
            </View>

            <DataList
              columns={[
                { key: 'employee_name', label: 'Name', primary: true },
                { key: 'department', label: 'Dept', status: true, render: (i: PayrollItem) => <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{i.department}</Text> },
                { key: 'gross_amount', label: 'Gross', render: (i: PayrollItem) => `GHS ${Number(i.gross_amount ?? 0).toLocaleString()}` },
                { key: 'net_amount', label: 'Net', render: (i: PayrollItem) => `GHS ${Number(i.net_amount ?? 0).toLocaleString()}` },
              ]}
              data={items.filter((i) => i.batch_id === expanded.id)}
              rowKey={(i) => i.id}
              emptyTitle="No staff added yet"
            />
          </View>
        )}
      </Sheet>

      <Sheet open={showBatchForm} onClose={() => setShowBatchForm(false)} title="New Payroll Batch" side="bottom" maxHeight={420}
        footer={<Button label={saving ? 'Creating…' : 'Create'} onPress={saveBatch} loading={saving} disabled={saving || !batchForm.name.trim()} fullWidth />}>
        <Field label="Batch Name"><Input value={batchForm.name} onChangeText={(v) => setBatchForm((f) => ({ ...f, name: v }))} placeholder="e.g. June 2026 Payroll" /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Period Start"><Input value={batchForm.period_start} onChangeText={(v) => setBatchForm((f) => ({ ...f, period_start: v }))} placeholder="YYYY-MM-DD" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Period End"><Input value={batchForm.period_end} onChangeText={(v) => setBatchForm((f) => ({ ...f, period_end: v }))} placeholder="YYYY-MM-DD" /></Field></View>
        </View>
      </Sheet>

      <Sheet open={showItemForm} onClose={() => setShowItemForm(false)} title="Add Staff to Batch" side="bottom" maxHeight={520}
        footer={<Button label={saving ? 'Adding…' : 'Add'} onPress={saveItem} loading={saving} disabled={saving || !itemForm.employee_name.trim() || !itemForm.gross_amount} fullWidth />}>
        <Field label="Link to Staff Account" hint="Optional — leave blank for contractors or anyone not yet registered. Linking is what lets them see this in My Payslips.">
          <SearchablePicker
            value={itemForm.staffId}
            onChange={(v) => {
              const staff = staffOptions.find((s) => s.id === v);
              setItemForm((f) => ({ ...f, staffId: v, employee_name: staff?.full_name || f.employee_name, department: staff?.department || f.department }));
            }}
            options={staffOptions.map((s) => ({ value: s.id, label: s.full_name, sublabel: s.department }))}
            placeholder="Search staff…"
          />
        </Field>
        <Field label="Employee Name"><Input value={itemForm.employee_name} onChangeText={(v) => setItemForm((f) => ({ ...f, employee_name: v }))} /></Field>
        <Field label="Department"><Input value={itemForm.department} onChangeText={(v) => setItemForm((f) => ({ ...f, department: v }))} /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Gross (GHS)"><Input value={itemForm.gross_amount} onChangeText={(v) => setItemForm((f) => ({ ...f, gross_amount: v }))} keyboardType="decimal-pad" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Deductions (GHS)"><Input value={itemForm.deductions} onChangeText={(v) => setItemForm((f) => ({ ...f, deductions: v }))} keyboardType="decimal-pad" /></Field></View>
        </View>
      </Sheet>
    </Screen>
  );
}
