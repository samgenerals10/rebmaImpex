// rebma-mobile/screens/adminWarehouse/DriversScreen.tsx
// Ports: rebma-web/src/views/dispatch/DriversView.tsx — the roster CRUD
// (add/edit/deactivate/delete). Web renders drivers as colored-initial
// circles with no photo field anywhere in the file (verified by grep) —
// the Avatar primitive already does exactly that, so no image-picker code
// belongs on this screen.
//
// Scope note: web's "Invite Driver" flow (a modal that calls
// /api/register-driver-user to create the driver a real Supabase login +
// temp password) is not ported here. That's a web-server API route whose
// reachability/CORS behaviour from a native app context is a separate,
// unverified concern from the plain-Supabase-table CRUD every other
// screen in this phase uses — flagged as a gap, not silently dropped.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';

interface DriverRow {
  id: string;
  driver_id: string | null;
  full_name: string;
  phone: string | null;
  ghana_card_id: string | null;
  license_number: string | null;
  vehicle_id: string | null;
  status: string;
}

const emptyForm = { fullName: '', phone: '', ghanaCard: '', licenseNumber: '', truckId: '' };

export default function DriversScreen() {
  const t = useTheme();
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<DriverRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('drivers').select('id, driver_id, full_name, phone, ghana_card_id, license_number, vehicle_id, status').order('full_name');
    if (data) setDrivers(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm(emptyForm);
    setShowAdd(true);
  };

  const openEdit = (d: DriverRow) => {
    setForm({ fullName: d.full_name, phone: d.phone || '', ghanaCard: d.ghana_card_id || '', licenseNumber: d.license_number || '', truckId: d.vehicle_id || '' });
    setEditTarget(d);
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditTarget(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.fullName.trim() || !form.phone.trim()) {
      Alert.alert('Missing Info', 'Full name and phone are required.');
      return;
    }
    setSubmitting(true);
    if (editTarget) {
      const { error } = await supabase.from('drivers').update({
        full_name: form.fullName.trim(), phone: form.phone.trim(), ghana_card_id: form.ghanaCard.trim() || null,
        license_number: form.licenseNumber.trim() || null, vehicle_id: form.truckId.trim() || null,
      }).eq('id', editTarget.id);
      setSubmitting(false);
      if (error) {
        Alert.alert('Update Failed', error.message);
        return;
      }
    } else {
      const generatedId = `DRV-${String(drivers.length + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('drivers').insert([{
        driver_id: generatedId, full_name: form.fullName.trim(), phone: form.phone.trim(), ghana_card_id: form.ghanaCard.trim() || null,
        license_number: form.licenseNumber.trim() || null, vehicle_id: form.truckId.trim() || null, status: 'ACTIVE',
      }]);
      setSubmitting(false);
      if (error) {
        Alert.alert('Add Failed', error.message);
        return;
      }
    }
    closeForm();
    load();
  };

  const deactivate = async (d: DriverRow) => {
    const { error } = await supabase.from('drivers').update({ status: 'OFFLINE' }).eq('id', d.id);
    if (error) {
      Alert.alert('Failed', error.message);
      return;
    }
    load();
  };

  const remove = (d: DriverRow) => {
    Alert.alert('Delete Driver', `Remove ${d.full_name} from the roster?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('drivers').delete().eq('id', d.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<DriverRow>[] = [
    {
      key: 'full_name', label: 'Driver', primary: true,
      render: (d) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Avatar name={d.full_name} size={32} />
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{d.full_name}</Text>
        </View>
      ),
    },
    { key: 'status', label: 'Status', status: true, render: (d) => <Badge tone={d.status === 'ACTIVE' ? 'success' : d.status === 'ON_DELIVERY' ? 'info' : 'muted'} label={d.status.replace(/_/g, ' ')} /> },
    { key: 'driver_id', label: 'ID', render: (d) => d.driver_id || '—' },
    { key: 'phone', label: 'Phone', render: (d) => d.phone || '—' },
    { key: 'vehicle_id', label: 'Vehicle', render: (d) => d.vehicle_id || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Driver" onPress={openAdd} fullWidth /></View>}
    >
      <DataList
        columns={columns}
        data={drivers}
        rowKey={(d) => d.id}
        loading={loading}
        emptyTitle="No drivers on file"
        renderActions={(d) => (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(d)} />
            {d.status !== 'OFFLINE' && <Button label="Deactivate" size="sm" variant="ghost" onPress={() => deactivate(d)} />}
            <Button label="Delete" size="sm" variant="danger" onPress={() => remove(d)} />
          </View>
        )}
      />

      <Sheet
        open={showAdd || !!editTarget}
        onClose={closeForm}
        title={editTarget ? 'Edit Driver' : 'Add Driver'}
        side="bottom"
        footer={<Button label={submitting ? 'Saving…' : 'Save Driver'} onPress={save} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Full Name *"><Input value={form.fullName} onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))} placeholder="Driver name" /></Field>
        <Field label="Phone *"><Input value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="E.g., 0244000000" keyboardType="phone-pad" /></Field>
        <Field label="Ghana Card ID"><Input value={form.ghanaCard} onChangeText={(v) => setForm((f) => ({ ...f, ghanaCard: v }))} placeholder="GHA-000000000-0" /></Field>
        <Field label="License Number"><Input value={form.licenseNumber} onChangeText={(v) => setForm((f) => ({ ...f, licenseNumber: v }))} placeholder="License number" /></Field>
        <Field label="Vehicle ID"><Input value={form.truckId} onChangeText={(v) => setForm((f) => ({ ...f, truckId: v }))} placeholder="E.g., GR-1234-20" /></Field>
      </Sheet>
    </Screen>
  );
}
