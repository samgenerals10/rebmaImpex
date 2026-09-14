// rebma-mobile/screens/adminWarehouse/ProofOfDeliveryScreen.tsx
// Ports: rebma-web/src/views/dispatch/ProofOfDeliveryView.tsx — the
// pending-proof list + live camera capture with a front/back switch.
// Confirms into `delivery_logs.status = 'PENDING_RISK_REVIEW'`, same as
// ActiveDeliveriesScreen's "Submit for Risk Review" action (Risk's own
// approval, not this screen, is what sets DELIVERED — RiskApprovalsView.tsx
// on web). Proof photos upload to the real `delivery-proofs` Storage
// bucket (lib/storage.ts), matching web's uploadFile() call exactly —
// see lib/media.ts's header comment for why this differs from cargo
// intake's inline base64 photos.
//
// Phase 7.12, D123: this screen makes two sequential network calls per
// submission (photo upload, then the status update) with zero resilience
// before this phase. The photo upload itself needs live bytes-over-the-
// wire and can't be meaningfully queued — but the final status-flip
// update (submitForReview) is a plain write that CAN be queued via
// lib/offlineQueue.ts's update support, so a delivery already
// photographed doesn't get stuck re-prompting for a retake just because
// the last, simplest step failed to round-trip.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Alert, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera as CameraIcon, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { uploadToBucket } from '../../lib/storage';
import { enqueueUpdate, QUEUE_KEYS } from '../../lib/offlineQueue';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';

interface DeliveryRow {
  id: string;
  order_id: string | null;
  driver_name: string | null;
  proof_photo: string | null;
  status: string;
  orders: { client_name: string; destination: string } | null;
}

export default function ProofOfDeliveryScreen() {
  const t = useTheme();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DeliveryRow | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('delivery_logs')
      .select('id, order_id, driver_name, proof_photo, status, orders:order_id(client_name, destination)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setRows(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera Permission Needed', 'Enable camera access in your device settings to capture proof of delivery.');
        return;
      }
    }
    setCameraOpen(true);
  };

  const capture = async () => {
    if (!cameraRef.current || !detail) return;
    setSubmitting(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (!photo?.uri) throw new Error('Capture failed.');
      const url = await uploadToBucket(photo.uri, 'delivery-proofs', detail.id, 'image/jpeg');
      if (!url) throw new Error('Upload failed.');
      const { error } = await supabase.from('delivery_logs').update({ proof_photo: url }).eq('id', detail.id);
      if (error) throw error;
      setDetail((d) => (d ? { ...d, proof_photo: url } : d));
      setCameraOpen(false);
      load();
    } catch (e: any) {
      Alert.alert('Capture Failed', e.message || 'Could not capture proof of delivery.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitForReview = async () => {
    if (!detail) return;
    if (!detail.proof_photo) {
      Alert.alert('Photo Required', 'Capture a proof-of-delivery photo before submitting for review.');
      return;
    }
    setSubmitting(true);
    const statusPayload = { status: 'PENDING_RISK_REVIEW' };
    const { error } = await supabase.from('delivery_logs').update(statusPayload).eq('id', detail.id);
    setSubmitting(false);
    if (error) {
      await enqueueUpdate(QUEUE_KEYS.proofOfDelivery, 'delivery_logs', statusPayload, { id: detail.id });
      Alert.alert('Saved Offline', 'Photo captured. The submit-for-review step will sync automatically once you\'re back online.');
      setDetail(null);
      load();
      return;
    }
    try {
      await supabase.from('supplier_order_notifications').insert([{ message: `Proof of delivery submitted for Risk review: Delivery ${detail.id}`, notified_department: 'RISK', read: false }]);
    } catch {}
    setDetail(null);
    load();
  };

  const columns: DataColumn<DeliveryRow>[] = [
    { key: 'client', label: 'Customer', primary: true, render: (r) => r.orders?.client_name || 'Generic Client' },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={statusTone(r.status)} label={r.status.replace(/_/g, ' ')} /> },
    { key: 'driver_name', label: 'Driver', render: (r) => r.driver_name || 'Unassigned' },
    { key: 'destination', label: 'Destination', render: (r) => r.orders?.destination || '—' },
    { key: 'proof', label: 'Proof', render: (r) => r.proof_photo ? 'Captured' : 'None' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <DataList columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} emptyTitle="No deliveries found" onRowPress={setDetail} />

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.orders?.client_name || 'Delivery'}
        subtitle={detail?.status.replace(/_/g, ' ')}
        side="bottom"
        footer={<Button label={submitting ? 'Submitting…' : 'Submit for Risk Review'} onPress={submitForReview} loading={submitting} disabled={submitting} fullWidth />}
      >
        {detail?.proof_photo ? (
          <Image source={{ uri: detail.proof_photo }} style={{ width: '100%', height: 200, borderRadius: t.radius.md, marginBottom: t.spacing.md }} resizeMode="cover" />
        ) : (
          <View style={{ height: 120, borderRadius: t.radius.md, backgroundColor: t.colors.bgPage, alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.md, borderWidth: 1, borderColor: t.colors.border }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>No proof captured yet</Text>
          </View>
        )}
        <Button
          variant="ghost"
          icon={<CameraIcon size={14} color={t.colors.textSecondary} />}
          label={detail?.proof_photo ? 'Retake Photo' : 'Capture Proof'}
          onPress={openCamera}
          fullWidth
        />
      </Sheet>

      <Sheet open={cameraOpen} onClose={() => setCameraOpen(false)} title="Proof of Delivery" side="full">
        <View style={{ height: 460, borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing.lg, marginTop: t.spacing.lg }}>
          <Button variant="ghost" icon={<RefreshCw size={14} color={t.colors.textSecondary} />} label="Flip Camera" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
          <Button label={submitting ? 'Capturing…' : 'Capture'} onPress={capture} loading={submitting} disabled={submitting} />
        </View>
      </Sheet>
    </Screen>
  );
}
