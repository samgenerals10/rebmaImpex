// rebma-mobile/screens/adminWarehouse/ActiveDeliveriesScreen.tsx
// Ports: rebma-web/src/views/dispatch/DeliveriesView.tsx — the full CRUD
// delivery list. Web's row action is a floating dropdown menu with ~9
// items; there's no natural touch equivalent to a hover/click context
// menu at that density, so it becomes a detail Sheet opened on row press
// (the same "tap the row for more" adaptation this app already uses
// elsewhere), holding every action except two dropped by design:
// "Track on GPS Map" (this screen already links straight to the Tracking
// sub-tab) and "Export Delivery Note PDF" (no PDF-generation dependency in
// this app yet — same D11 print-omission precedent as ApprovedGoodsScreen).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera as CameraIcon, MessageCircle, Trash2, MapPin } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { assignDriverToDelivery, sendWhatsAppDirections } from '../../lib/dispatchActions';
import { pickOrCaptureImageAsset } from '../../lib/media';
import { uploadToBucket } from '../../lib/storage';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import SearchablePicker from '../../components/ui/SearchablePicker';

interface DeliveryRow {
  id: string;
  order_id: string | null;
  customer_name: string | null;
  delivery_address: string | null;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  status: string;
  proof_photo: string | null;
}

interface DriverRow {
  id: string;
  full_name: string;
  status: string;
  vehicle_id: string | null;
}

export default function ActiveDeliveriesScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const isManagementOrAdmin = !!profile?.isAdmin || profile?.department === 'MANAGEMENT';

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DeliveryRow | null>(null);
  const [reassignDriverId, setReassignDriverId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [dRes, drRes] = await Promise.all([
      supabase.from('delivery_logs').select('id, order_id, customer_name, delivery_address, driver_id, driver_name, vehicle_id, status, proof_photo').order('created_at', { ascending: false }).limit(100),
      supabase.from('drivers').select('id, full_name, status, vehicle_id'),
    ]);
    if (dRes.data) setDeliveries(dRes.data as any);
    if (drRes.data) setDrivers(drRes.data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (d: DeliveryRow) => {
    setDetail(d);
    setReassignDriverId(d.driver_id || '');
  };

  const refreshDetail = (updated: Partial<DeliveryRow>) => {
    setDetail((d) => (d ? { ...d, ...updated } : d));
    load();
  };

  const doAssign = async () => {
    if (!detail || !reassignDriverId) return;
    const driver = drivers.find((d) => d.id === reassignDriverId);
    if (!driver) return;
    setBusy(true);
    try {
      const { pending } = await assignDriverToDelivery(detail.id, driver.id, driver.full_name, driver.vehicle_id, isManagementOrAdmin);
      if (pending) {
        Alert.alert('Sent for Approval', 'Management must approve this driver assignment.');
      } else {
        refreshDetail({ driver_id: driver.id, driver_name: driver.full_name, vehicle_id: driver.vehicle_id, status: 'ASSIGNED' });
      }
    } catch (e: any) {
      Alert.alert('Assignment Failed', e.message || 'Could not assign this driver.');
    } finally {
      setBusy(false);
    }
  };

  const doWhatsApp = async () => {
    if (!detail?.driver_id) return;
    try {
      await sendWhatsAppDirections(detail.driver_id, detail.delivery_address);
    } catch (e: any) {
      Alert.alert('Could Not Open WhatsApp', e.message);
    }
  };

  const doProof = async () => {
    if (!detail) return;
    const asset = await pickOrCaptureImageAsset();
    if (!asset) return;
    try {
      const url = await uploadToBucket(asset.uri, 'delivery-proofs', detail.id, asset.mimeType);
      if (!url) throw new Error('Upload failed.');
      const { error } = await supabase.from('delivery_logs').update({ proof_photo: url }).eq('id', detail.id);
      if (error) throw error;
      refreshDetail({ proof_photo: url });
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message || 'Could not upload the proof photo.');
    }
  };

  const doSubmitForReview = async () => {
    if (!detail) return;
    setBusy(true);
    const { error } = await supabase.from('delivery_logs').update({ status: 'PENDING_RISK_REVIEW' }).eq('id', detail.id);
    setBusy(false);
    if (error) {
      Alert.alert('Failed', error.message);
      return;
    }
    try {
      await supabase.from('supplier_order_notifications').insert([{ message: `Proof of delivery submitted for Risk review: Delivery ${detail.id}`, notified_department: 'RISK', read: false }]);
    } catch {}
    refreshDetail({ status: 'PENDING_RISK_REVIEW' });
  };

  const doMarkFailed = async () => {
    if (!detail) return;
    setBusy(true);
    const { error } = await supabase.from('delivery_logs').update({ status: 'FAILED' }).eq('id', detail.id);
    setBusy(false);
    if (error) {
      Alert.alert('Failed', error.message);
      return;
    }
    refreshDetail({ status: 'FAILED' });
  };

  const doDelete = () => {
    if (!detail) return;
    Alert.alert('Delete Delivery Log', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('delivery_logs').delete().eq('id', detail.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          setDetail(null);
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<DeliveryRow>[] = [
    { key: 'customer_name', label: 'Customer', primary: true, render: (d) => d.customer_name || '—' },
    { key: 'status', label: 'Status', status: true, render: (d) => <Badge tone={statusTone(d.status)} label={d.status.replace(/_/g, ' ')} /> },
    { key: 'order_id', label: 'Order', render: (d) => d.order_id || '—' },
    { key: 'destination', label: 'Destination', render: (d) => d.delivery_address || '—' },
    {
      key: 'driver', label: 'Driver / Vehicle',
      render: (d) => d.driver_name ? `${d.driver_name}${d.vehicle_id ? ` · ${d.vehicle_id}` : ''}` : 'Unassigned',
    },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <DataList columns={columns} data={deliveries} rowKey={(d) => d.id} loading={loading} emptyTitle="No deliveries found" onRowPress={openDetail} />

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.customer_name || 'Delivery'}
        subtitle={detail ? `${detail.order_id || detail.id} · ${detail.status.replace(/_/g, ' ')}` : undefined}
        side="bottom"
        maxHeight={640}
      >
        {detail && (
          <>
            <SheetSection label="Assign Driver">
              <SearchablePicker
                value={reassignDriverId}
                onChange={setReassignDriverId}
                placeholder="Select a driver"
                options={drivers.map((d) => ({ value: d.id, label: d.full_name, sublabel: d.status }))}
              />
              <View style={{ height: t.spacing.sm }} />
              <Button label={detail.driver_id ? 'Reassign Driver' : 'Assign Driver'} size="sm" onPress={doAssign} loading={busy} disabled={busy || !reassignDriverId} />
            </SheetSection>

            <SheetSection label="Actions">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {detail.driver_id && (detail.status === 'ASSIGNED' || detail.status === 'IN_TRANSIT') && (
                  <Button variant="ghost" size="sm" icon={<MessageCircle size={13} color={t.colors.textSecondary} />} label="WhatsApp Driver" onPress={doWhatsApp} />
                )}
                <Button variant="ghost" size="sm" icon={<CameraIcon size={13} color={t.colors.textSecondary} />} label={detail.proof_photo ? 'Change Proof Photo' : 'Add Proof Photo'} onPress={doProof} />
                <Button variant="ghost" size="sm" icon={<MapPin size={13} color={t.colors.textSecondary} />} label="Track on GPS Map" onPress={() => { setDetail(null); navigation.navigate('Tracking'); }} />
              </View>
            </SheetSection>

            <SheetSection label="Status">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {detail.status === 'IN_TRANSIT' && (
                  <Button size="sm" label="Submit for Risk Review" onPress={doSubmitForReview} loading={busy} disabled={busy} />
                )}
                {detail.status !== 'DELIVERED' && detail.status !== 'FAILED' && (
                  <Button variant="danger" size="sm" label="Mark as Failed" onPress={doMarkFailed} loading={busy} disabled={busy} />
                )}
              </View>
            </SheetSection>

            <SheetSection label="Danger Zone">
              <Button variant="danger" size="sm" icon={<Trash2 size={13} color={t.colors.onAccent} />} label="Delete Delivery Log" onPress={doDelete} />
            </SheetSection>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
