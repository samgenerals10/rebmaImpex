// rebma-mobile/screens/adminWarehouse/FuelManagementScreen.tsx
// Ports: rebma-web/src/views/logistics/FuelManagementView.tsx — CRUD on
// `fuel_logs` (add/edit/delete). Web's CHART_DATA/VEHICLES constants are
// hardcoded chart-seed demo data, not read from the DB — not ported;
// FleetAnalyticsScreen aggregates real fuel_logs rows instead.
import { useCallback, useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';

interface FuelLogRow {
  id: string;
  date: string | null;
  vehicle_id: string;
  driver: string | null;
  liters: number;
  cost: number;
  station: string | null;
  odometer: number | null;
}

const emptyForm = { date: new Date().toISOString().slice(0, 10), vehicleId: '', driver: '', liters: '', cost: '', station: '', odometer: '' };

export default function FuelManagementScreen() {
  const t = useTheme();
  const [logs, setLogs] = useState<FuelLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<FuelLogRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('fuel_logs').select('id, date, vehicle_id, driver, liters, cost, station, odometer').order('date', { ascending: false }).limit(200);
    if (!error && data) setLogs(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setShowAdd(false);
    setEditTarget(null);
    setForm(emptyForm);
  };

  const openEdit = (l: FuelLogRow) => {
    setForm({ date: l.date || emptyForm.date, vehicleId: l.vehicle_id, driver: l.driver || '', liters: String(l.liters), cost: String(l.cost), station: l.station || '', odometer: String(l.odometer || '') });
    setEditTarget(l);
  };

  const save = async () => {
    if (!form.vehicleId.trim() || !form.liters || !form.cost) {
      Alert.alert('Missing Info', 'Vehicle, liters, and cost are required.');
      return;
    }
    setSubmitting(true);
    const payload = {
      date: form.date, vehicle_id: form.vehicleId.trim(), driver: form.driver.trim() || null,
      liters: Number(form.liters), cost: Number(form.cost), station: form.station.trim() || null,
      odometer: form.odometer ? Number(form.odometer) : null,
    };
    const { error } = editTarget
      ? await supabase.from('fuel_logs').update(payload).eq('id', editTarget.id)
      : await supabase.from('fuel_logs').insert([payload]);
    setSubmitting(false);
    if (error) {
      Alert.alert(editTarget ? 'Update Failed' : 'Add Failed', error.message);
      return;
    }
    closeForm();
    load();
  };

  const remove = (l: FuelLogRow) => {
    Alert.alert('Delete Fuel Log', `Remove this ${l.vehicle_id} entry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('fuel_logs').delete().eq('id', l.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<FuelLogRow>[] = [
    { key: 'vehicle_id', label: 'Vehicle', primary: true },
    { key: 'cost', label: 'Cost', status: true, render: (l) => `GHS ${l.cost.toLocaleString()}` },
    { key: 'date', label: 'Date', render: (l) => l.date || '—' },
    { key: 'liters', label: 'Liters', render: (l) => `${l.liters}L` },
    { key: 'station', label: 'Station', render: (l) => l.station || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Log Fuel Purchase" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <DataList
        columns={columns}
        data={logs}
        rowKey={(l) => l.id}
        loading={loading}
        emptyTitle="No fuel logs yet"
        renderActions={(l) => (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(l)} />
            <Button label="Delete" size="sm" variant="danger" onPress={() => remove(l)} />
          </View>
        )}
      />

      <Sheet
        open={showAdd || !!editTarget}
        onClose={closeForm}
        title={editTarget ? 'Edit Fuel Log' : 'Log Fuel Purchase'}
        side="bottom"
        footer={<Button label={submitting ? 'Saving…' : 'Save'} onPress={save} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Date"><Input value={form.date} onChangeText={(v) => setForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" /></Field>
        <Field label="Vehicle ID *"><Input value={form.vehicleId} onChangeText={(v) => setForm((f) => ({ ...f, vehicleId: v }))} placeholder="E.g., GR-1234-20" /></Field>
        <Field label="Driver" hint="Optional"><Input value={form.driver} onChangeText={(v) => setForm((f) => ({ ...f, driver: v }))} placeholder="Driver name" /></Field>
        <Field label="Liters *"><Input value={form.liters} onChangeText={(v) => setForm((f) => ({ ...f, liters: v }))} placeholder="E.g., 45" keyboardType="decimal-pad" /></Field>
        <Field label="Cost (GHS) *"><Input value={form.cost} onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))} placeholder="E.g., 550" keyboardType="decimal-pad" /></Field>
        <Field label="Station" hint="Optional"><Input value={form.station} onChangeText={(v) => setForm((f) => ({ ...f, station: v }))} placeholder="E.g., Shell Tema" /></Field>
        <Field label="Odometer" hint="Optional"><Input value={form.odometer} onChangeText={(v) => setForm((f) => ({ ...f, odometer: v }))} placeholder="E.g., 42000" keyboardType="numeric" /></Field>
      </Sheet>
    </Screen>
  );
}
