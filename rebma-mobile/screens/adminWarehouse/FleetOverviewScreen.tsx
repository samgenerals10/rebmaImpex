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
import { View, Text, Alert } from 'react-native';
import { Truck as TruckIcon, Package, Wrench, Settings, ChevronLeft } from 'lucide-react-native';
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
import EmptyState from '../../components/ui/EmptyState';

interface VehicleRow {
  id: string;
  vehicle_id: string;
  type: string;
  driver: string | null;
  status: string;
  last_maintenance: string | null;
  total_deliveries: number | null;
}

const emptyForm = { vehicleId: '', type: 'Pickup', driver: '', status: 'Operational', lastMaintenance: '' };
const STATUS_TONE: Record<string, 'success' | 'warning' | 'muted'> = { Operational: 'success', 'In Maintenance': 'warning', Retired: 'muted' };

export default function FleetOverviewScreen() {
  const t = useTheme();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<VehicleRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<VehicleRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('fleet_vehicles').select('id, vehicle_id, type, driver, status, last_maintenance, total_deliveries').order('created_at', { ascending: false });
    if (!error && data) setVehicles(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const counts = {
    total: vehicles.length,
    operational: vehicles.filter((v) => v.status === 'Operational').length,
    maintenance: vehicles.filter((v) => v.status === 'In Maintenance').length,
    deliveries: vehicles.reduce((s, v) => s + (v.total_deliveries || 0), 0),
  };

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setShowAdd(false);
    setEditTarget(null);
    setForm(emptyForm);
  };

  const openEdit = (v: VehicleRow) => {
    setForm({ vehicleId: v.vehicle_id, type: v.type, driver: v.driver || '', status: v.status, lastMaintenance: v.last_maintenance || '' });
    setEditTarget(v);
  };

  const save = async () => {
    if (!form.vehicleId.trim()) {
      Alert.alert('Missing Info', 'Vehicle ID is required.');
      return;
    }
    setSubmitting(true);
    const payload = { vehicle_id: form.vehicleId.trim(), type: form.type, driver: form.driver.trim() || null, status: form.status, last_maintenance: form.lastMaintenance.trim() || null };
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

  if (detailTarget) {
    return (
      <Screen>
        <Button label="Back to Fleet" size="sm" variant="ghost" icon={<ChevronLeft size={14} color={t.colors.textSecondary} />} onPress={() => setDetailTarget(null)} />
        <Card style={{ marginTop: t.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.lg }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <TruckIcon size={26} color={t.colors.accent} />
            </View>
            <View>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.textPrimary }}>{detailTarget.vehicle_id}</Text>
              <Badge tone={STATUS_TONE[detailTarget.status] || 'muted'} label={detailTarget.status} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {[
              ['Type', detailTarget.type],
              ['Driver', detailTarget.driver || 'Unassigned'],
              ['Last Maintenance', detailTarget.last_maintenance || 'Not recorded'],
              ['Total Deliveries', String(detailTarget.total_deliveries || 0)],
            ].map(([k, v]) => (
              <View key={k} style={{ width: '47%', backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, padding: t.spacing.md }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{k}</Text>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginTop: 2 }}>{v}</Text>
              </View>
            ))}
          </View>
        </Card>
        <Card style={{ marginTop: t.spacing.lg }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Recent Delivery History</Text>
          <EmptyState icon={<TruckIcon size={20} color={t.colors.textMuted} />} title="No delivery history on file" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Vehicle" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
        <View style={{ width: '47%' }}><MetricCard label="Total Vehicles" value={loading ? '—' : counts.total} icon={<TruckIcon size={16} color={t.colors.accent} />} /></View>
        <View style={{ width: '47%' }}><MetricCard label="Operational" value={loading ? '—' : counts.operational} icon={<Package size={16} color={t.colors.status.success.text} />} /></View>
        <View style={{ width: '47%' }}><MetricCard label="In Maintenance" value={loading ? '—' : counts.maintenance} icon={<Wrench size={16} color={t.colors.status.warning.text} />} /></View>
        <View style={{ width: '47%' }}><MetricCard label="Total Deliveries" value={loading ? '—' : counts.deliveries} icon={<Settings size={16} color={t.colors.action.violet} />} /></View>
      </View>

      <DataList
        columns={columns}
        data={vehicles}
        rowKey={(v) => v.id}
        loading={loading}
        emptyTitle="No vehicles on file"
        onRowPress={(v) => setDetailTarget(v)}
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
        <Field label="Last Maintenance Date" hint="Optional, YYYY-MM-DD"><Input value={form.lastMaintenance} onChangeText={(v) => setForm((f) => ({ ...f, lastMaintenance: v }))} placeholder="E.g., 2026-03-14" /></Field>
      </Sheet>
    </Screen>
  );
}
