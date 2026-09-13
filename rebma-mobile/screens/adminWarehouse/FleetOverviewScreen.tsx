// rebma-mobile/screens/adminWarehouse/FleetOverviewScreen.tsx
// Ports: rebma-web/src/views/logistics/FleetOverviewView.tsx — plain CRUD
// on `fleet_vehicles` (add/edit/retire).
//
// `fleet_vehicles` was noted absent from the live DB when
// supabase_admin_warehouse_merge.sql was written (its RLS block is
// guarded by an information_schema existence check) — writing against the
// target schema per this phase's convention, same testability caveat as
// the rest of the unrun migration backlog.
import { useCallback, useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

interface VehicleRow {
  id: string;
  vehicle_id: string;
  type: string;
  driver: string | null;
  status: string;
  last_maintenance: string | null;
}

const emptyForm = { vehicleId: '', type: 'Pickup', driver: '', status: 'Operational' };
const STATUS_TONE: Record<string, 'success' | 'warning' | 'muted'> = { Operational: 'success', 'In Maintenance': 'warning', Retired: 'muted' };

export default function FleetOverviewScreen() {
  const t = useTheme();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<VehicleRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('fleet_vehicles').select('id, vehicle_id, type, driver, status, last_maintenance').order('created_at', { ascending: false });
    if (!error && data) setVehicles(data as any);
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

  const openEdit = (v: VehicleRow) => {
    setForm({ vehicleId: v.vehicle_id, type: v.type, driver: v.driver || '', status: v.status });
    setEditTarget(v);
  };

  const save = async () => {
    if (!form.vehicleId.trim()) {
      Alert.alert('Missing Info', 'Vehicle ID is required.');
      return;
    }
    setSubmitting(true);
    const payload = { vehicle_id: form.vehicleId.trim(), type: form.type, driver: form.driver.trim() || null, status: form.status };
    const { error } = editTarget
      ? await supabase.from('fleet_vehicles').update(payload).eq('id', editTarget.id)
      : await supabase.from('fleet_vehicles').insert([payload]);
    setSubmitting(false);
    if (error) {
      Alert.alert(editTarget ? 'Update Failed' : 'Add Failed', error.message);
      return;
    }
    closeForm();
    load();
  };

  const retire = async (v: VehicleRow) => {
    const { error } = await supabase.from('fleet_vehicles').update({ status: 'Retired' }).eq('id', v.id);
    if (error) {
      Alert.alert('Failed', error.message);
      return;
    }
    load();
  };

  const columns: DataColumn<VehicleRow>[] = [
    { key: 'vehicle_id', label: 'Vehicle', primary: true },
    { key: 'status', label: 'Status', status: true, render: (v) => <Badge tone={STATUS_TONE[v.status] || 'muted'} label={v.status} /> },
    { key: 'type', label: 'Type' },
    { key: 'driver', label: 'Driver', render: (v) => v.driver || 'Unassigned' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Vehicle" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <DataList
        columns={columns}
        data={vehicles}
        rowKey={(v) => v.id}
        loading={loading}
        emptyTitle="No vehicles on file"
        renderActions={(v) => (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(v)} />
            {v.status !== 'Retired' && <Button label="Retire" size="sm" variant="danger" onPress={() => retire(v)} />}
          </View>
        )}
      />

      <Sheet
        open={showAdd || !!editTarget}
        onClose={closeForm}
        title={editTarget ? 'Edit Vehicle' : 'Add Vehicle'}
        side="bottom"
        footer={<Button label={submitting ? 'Saving…' : 'Save Vehicle'} onPress={save} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Vehicle ID *"><Input value={form.vehicleId} onChangeText={(v) => setForm((f) => ({ ...f, vehicleId: v }))} placeholder="E.g., GR-1234-20" /></Field>
        <Field label="Type">
          <SearchablePicker value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={[{ value: 'Pickup', label: 'Pickup' }, { value: 'Container', label: 'Container' }, { value: 'Tanker', label: 'Tanker' }]} />
        </Field>
        <Field label="Driver" hint="Optional"><Input value={form.driver} onChangeText={(v) => setForm((f) => ({ ...f, driver: v }))} placeholder="Driver name" /></Field>
        <Field label="Status">
          <SearchablePicker value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={[{ value: 'Operational', label: 'Operational' }, { value: 'In Maintenance', label: 'In Maintenance' }, { value: 'Retired', label: 'Retired' }]} />
        </Field>
      </Sheet>
    </Screen>
  );
}
