// rebma-mobile/screens/reception/VisitorsScreen.tsx
// Ports: rebma-web/src/views/reception/VisitorsView.tsx — full CRUD
// (add/edit/checkout/delete) + search/status filter. Check-in reproduces
// web's exact write shape: a sequential `V-###` badge number generated
// client-side, and a cross-department `supplier_order_notifications`
// insert (`notified_department: 'ALL'`). `idType`/`idNumber`/
// `expectedTime` are on web's form but never actually written to the DB
// (verified by reading `handleAdd`'s insert payload) — matched exactly,
// not the form's superset.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

interface VisitorRow {
  id: string;
  full_name: string;
  company: string | null;
  purpose: string | null;
  host_name: string | null;
  check_in_time: string;
  check_out_time: string | null;
  badge_number: string | null;
  notes: string | null;
}

const emptyForm = { fullName: '', company: '', purpose: 'Business Meeting', hostName: '', notes: '' };

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function VisitorsScreen() {
  const t = useTheme();
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<VisitorRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('visitors')
      .select('id, full_name, company, purpose, host_name, check_in_time, check_out_time, badge_number, notes')
      .order('check_in_time', { ascending: false })
      .limit(300);
    if (!error && data) setVisitors(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visitors.filter((v) => {
      const matchesSearch = !q || v.full_name.toLowerCase().includes(q) || (v.company || '').toLowerCase().includes(q) || (v.host_name || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'IN' ? !v.check_out_time : !!v.check_out_time);
      return matchesSearch && matchesStatus;
    });
  }, [visitors, search, statusFilter]);

  const closeForm = () => {
    setShowAdd(false);
    setEditTarget(null);
    setForm(emptyForm);
  };

  const openEdit = (v: VisitorRow) => {
    setForm({ fullName: v.full_name, company: v.company || '', purpose: v.purpose || 'Business Meeting', hostName: v.host_name || '', notes: v.notes || '' });
    setEditTarget(v);
  };

  const checkIn = async () => {
    if (!form.fullName.trim()) {
      Alert.alert('Missing Info', 'Visitor name is required.');
      return;
    }
    setSubmitting(true);
    const badgeNumber = `V-${String(visitors.length + 1).padStart(3, '0')}`;
    const { error } = await supabase.from('visitors').insert([{
      full_name: form.fullName.trim(),
      company: form.company.trim(),
      purpose: form.purpose.trim(),
      host_name: form.hostName.trim(),
      check_in_time: new Date().toISOString(),
      badge_number: badgeNumber,
      notes: form.notes.trim(),
      status: 'inside',
    }]);
    setSubmitting(false);
    if (error) {
      Alert.alert('Check-In Failed', error.message);
      return;
    }
    try {
      await supabase.from('supplier_order_notifications').insert([{
        message: `Visitor ${form.fullName.trim()} (${form.purpose.trim()}) has arrived to see ${form.hostName.trim()}. Badge: ${badgeNumber}`,
        notified_department: 'ALL',
        read: false,
        created_at: new Date().toISOString(),
      }]);
    } catch {}
    closeForm();
    load();
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSubmitting(true);
    const { error } = await supabase.from('visitors').update({
      full_name: form.fullName.trim(),
      company: form.company.trim(),
      purpose: form.purpose.trim(),
      host_name: form.hostName.trim(),
      notes: form.notes.trim(),
    }).eq('id', editTarget.id);
    setSubmitting(false);
    if (error) {
      Alert.alert('Update Failed', error.message);
      return;
    }
    closeForm();
    load();
  };

  const checkOut = async (v: VisitorRow) => {
    const { error } = await supabase.from('visitors').update({ check_out_time: new Date().toISOString() }).eq('id', v.id);
    if (error) {
      Alert.alert('Check-Out Failed', error.message);
      return;
    }
    load();
  };

  const remove = (v: VisitorRow) => {
    Alert.alert('Delete Visitor Record', `Remove ${v.full_name}'s record?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('visitors').delete().eq('id', v.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<VisitorRow>[] = [
    { key: 'full_name', label: 'Visitor', primary: true },
    { key: 'status', label: 'Status', status: true, render: (v) => <Badge tone={v.check_out_time ? 'muted' : 'success'} label={v.check_out_time ? 'Checked Out' : 'On Site'} /> },
    { key: 'badge_number', label: 'Badge', render: (v) => v.badge_number || '—' },
    { key: 'host_name', label: 'Host', render: (v) => v.host_name || '—' },
    { key: 'check_in_time', label: 'Check-In', render: (v) => fmt(v.check_in_time) },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Check In Visitor" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.md }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search visitors…" />
        <SearchablePicker
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as 'ALL' | 'IN' | 'OUT')}
          options={[{ value: 'ALL', label: 'All' }, { value: 'IN', label: 'Currently In' }, { value: 'OUT', label: 'Checked Out' }]}
          label="Status"
        />
        <DataList
          columns={columns}
          data={filtered}
          rowKey={(v) => v.id}
          loading={loading}
          emptyTitle="No visitors found"
          onRowPress={openEdit}
          renderActions={(v) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {!v.check_out_time && <Button label="Check Out" size="sm" onPress={() => checkOut(v)} />}
              <Button label="Delete" size="sm" variant="danger" onPress={() => remove(v)} />
            </View>
          )}
        />
      </View>

      <Sheet
        open={showAdd || !!editTarget}
        onClose={closeForm}
        title={editTarget ? 'Edit Visitor' : 'Check In Visitor'}
        side="bottom"
        footer={<Button label={submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Check In'} onPress={editTarget ? saveEdit : checkIn} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Full Name *"><Input value={form.fullName} onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))} placeholder="Visitor name" /></Field>
        <Field label="Company" hint="Optional"><Input value={form.company} onChangeText={(v) => setForm((f) => ({ ...f, company: v }))} placeholder="Company name" /></Field>
        <Field label="Purpose"><Input value={form.purpose} onChangeText={(v) => setForm((f) => ({ ...f, purpose: v }))} placeholder="E.g., Business Meeting" /></Field>
        <Field label="Visiting"><Input value={form.hostName} onChangeText={(v) => setForm((f) => ({ ...f, hostName: v }))} placeholder="Host staff name" /></Field>
        <Field label="Notes" hint="Optional"><Input value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Additional notes" /></Field>
      </Sheet>
    </Screen>
  );
}
