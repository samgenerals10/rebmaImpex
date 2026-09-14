// rebma-mobile/screens/adminWarehouse/MaintenanceScreen.tsx
// Ports: rebma-web/src/views/logistics/MaintenanceView.tsx — CRUD on
// `maintenance_schedule` (add/edit/delete) + a "Complete" status action.
// Web's COST_TREND/VEHICLES constants are hardcoded chart-seed demo data,
// not read from the DB — not ported.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { AlertTriangle, Wrench, Clock, CheckCircle2, Banknote } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

interface MaintenanceRow {
  id: string;
  date: string | null;
  vehicle_id: string;
  type: string;
  description: string | null;
  cost: number;
  status: string;
  mechanic: string | null;
}

const emptyForm = { date: new Date().toISOString().slice(0, 10), vehicleId: '', type: 'Service', description: '', cost: '', mechanic: '' };
const STATUS_TONE: Record<string, 'warning' | 'info' | 'success'> = { Scheduled: 'warning', 'In Progress': 'info', Completed: 'success' };

export default function MaintenanceScreen() {
  const t = useTheme();
  const [records, setRecords] = useState<MaintenanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<MaintenanceRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('maintenance_schedule').select('id, date, vehicle_id, type, description, cost, status, mechanic').order('date', { ascending: false }).limit(200);
    if (!error && data) setRecords(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const upcoming = records.filter((r) => r.status === 'Scheduled' && (r.date || '') >= today && (r.date || '') <= sevenDays);

  const counts = {
    scheduled: records.filter((r) => r.status === 'Scheduled').length,
    inProgress: records.filter((r) => r.status === 'In Progress').length,
    completed: records.filter((r) => r.status === 'Completed').length,
    totalCost: records.reduce((s, r) => s + (r.cost || 0), 0),
  };

  // Real unique vehicles from the actual records — web's own filter
  // dropdown here is built from a hardcoded demo VEHICLES array instead.
  const uniqueVehicles = useMemo(() => Array.from(new Set(records.map((r) => r.vehicle_id).filter(Boolean))).sort(), [records]);
  const filteredRecords = useMemo(() => records.filter((r) => {
    const matchV = vehicleFilter === 'All' || r.vehicle_id === vehicleFilter;
    const matchS = statusFilter === 'All' || r.status === statusFilter;
    const matchT = typeFilter === 'All' || r.type === typeFilter;
    return matchV && matchS && matchT;
  }), [records, vehicleFilter, statusFilter, typeFilter]);

  const closeForm = () => {
    setShowAdd(false);
    setEditTarget(null);
    setForm(emptyForm);
  };

  const openEdit = (r: MaintenanceRow) => {
    setForm({ date: r.date || emptyForm.date, vehicleId: r.vehicle_id, type: r.type, description: r.description || '', cost: String(r.cost), mechanic: r.mechanic || '' });
    setEditTarget(r);
  };

  const save = async () => {
    if (!form.vehicleId.trim() || !form.description.trim()) {
      Alert.alert('Missing Info', 'Vehicle and description are required.');
      return;
    }
    setSubmitting(true);
    const payload = {
      date: form.date, vehicle_id: form.vehicleId.trim(), type: form.type, description: form.description.trim(),
      cost: Number(form.cost) || 0, mechanic: form.mechanic.trim() || null,
      status: editTarget?.status || 'Scheduled',
    };
    const { error } = editTarget
      ? await supabase.from('maintenance_schedule').update(payload).eq('id', editTarget.id)
      : await supabase.from('maintenance_schedule').insert([payload]);
    setSubmitting(false);
    if (error) {
      Alert.alert(editTarget ? 'Update Failed' : 'Add Failed', error.message);
      return;
    }
    closeForm();
    load();
  };

  const markComplete = async (r: MaintenanceRow) => {
    const { error } = await supabase.from('maintenance_schedule').update({ status: 'Completed', updated_at: new Date().toISOString() }).eq('id', r.id);
    if (error) {
      Alert.alert('Failed', error.message);
      return;
    }
    load();
  };

  const remove = (r: MaintenanceRow) => {
    Alert.alert('Delete Record', `Remove this ${r.vehicle_id} maintenance record?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('maintenance_schedule').delete().eq('id', r.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<MaintenanceRow>[] = [
    { key: 'vehicle_id', label: 'Vehicle', primary: true },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={STATUS_TONE[r.status] || 'muted'} label={r.status} /> },
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description', render: (r) => r.description || '—' },
    { key: 'cost', label: 'Cost', render: (r) => `GHS ${r.cost.toLocaleString()}` },
    { key: 'mechanic', label: 'Mechanic', render: (r) => r.mechanic || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Schedule Maintenance" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
        <View style={{ width: '47%' }}><MetricCard label="Scheduled" value={loading ? '—' : counts.scheduled} icon={<Clock size={16} color={t.colors.status.warning.text} />} /></View>
        <View style={{ width: '47%' }}><MetricCard label="In Progress" value={loading ? '—' : counts.inProgress} icon={<Wrench size={16} color={t.colors.status.info.text} />} /></View>
        <View style={{ width: '47%' }}><MetricCard label="Completed" value={loading ? '—' : counts.completed} icon={<CheckCircle2 size={16} color={t.colors.status.success.text} />} /></View>
        <View style={{ width: '47%' }}><MetricCard label="Total Cost (GHS)" value={loading ? '—' : counts.totalCost.toLocaleString()} icon={<Banknote size={16} color={t.colors.accent} />} /></View>
      </View>

      {upcoming.length > 0 && (
        <Card style={{ marginBottom: t.spacing.lg, backgroundColor: t.colors.status.warning.bg, borderColor: t.colors.status.warning.text + '40' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
            <AlertTriangle size={16} color={t.colors.status.warning.text} />
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.status.warning.text }}>Upcoming in Next 7 Days</Text>
          </View>
          <View style={{ gap: t.spacing.xs }}>
            {upcoming.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{r.vehicle_id} · {r.type}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{r.date}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      <View style={{ gap: t.spacing.sm, marginBottom: t.spacing.md }}>
        <SearchablePicker value={vehicleFilter} onChange={setVehicleFilter} options={[{ value: 'All', label: 'All Vehicles' }, ...uniqueVehicles.map((v) => ({ value: v, label: v }))]} />
        <SearchablePicker value={statusFilter} onChange={setStatusFilter} options={[{ value: 'All', label: 'All Status' }, { value: 'Scheduled', label: 'Scheduled' }, { value: 'In Progress', label: 'In Progress' }, { value: 'Completed', label: 'Completed' }]} />
        <SearchablePicker value={typeFilter} onChange={setTypeFilter} options={[{ value: 'All', label: 'All Types' }, { value: 'Service', label: 'Service' }, { value: 'Repair', label: 'Repair' }, { value: 'Inspection', label: 'Inspection' }]} />
      </View>

      <DataList
        columns={columns}
        data={filteredRecords}
        rowKey={(r) => r.id}
        loading={loading}
        emptyTitle="No maintenance records"
        renderActions={(r) => (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {r.status !== 'Completed' && <Button label="Complete" size="sm" onPress={() => markComplete(r)} />}
            <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(r)} />
            <Button label="Delete" size="sm" variant="danger" onPress={() => remove(r)} />
          </View>
        )}
      />

      <Sheet
        open={showAdd || !!editTarget}
        onClose={closeForm}
        title={editTarget ? 'Edit Maintenance Record' : 'Schedule Maintenance'}
        side="bottom"
        footer={<Button label={submitting ? 'Saving…' : 'Save'} onPress={save} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Date"><Input value={form.date} onChangeText={(v) => setForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" /></Field>
        <Field label="Vehicle ID *"><Input value={form.vehicleId} onChangeText={(v) => setForm((f) => ({ ...f, vehicleId: v }))} placeholder="E.g., GR-1234-20" /></Field>
        <Field label="Type">
          <SearchablePicker value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={[{ value: 'Service', label: 'Service' }, { value: 'Repair', label: 'Repair' }, { value: 'Inspection', label: 'Inspection' }]} />
        </Field>
        <Field label="Description *"><Input value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="E.g., Oil change and brake check" /></Field>
        <Field label="Cost (GHS)" hint="Optional"><Input value={form.cost} onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))} placeholder="E.g., 450" keyboardType="decimal-pad" /></Field>
        <Field label="Mechanic" hint="Optional"><Input value={form.mechanic} onChangeText={(v) => setForm((f) => ({ ...f, mechanic: v }))} placeholder="Mechanic or shop name" /></Field>
      </Sheet>
    </Screen>
  );
}
