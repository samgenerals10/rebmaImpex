// rebma-mobile/screens/adminWarehouse/DeliveriesScreen.tsx
// Ports: rebma-web/src/views/dispatch/OverviewView.tsx (the "Dispatch
// Board" sub-tab) — status-count tiles, a driver strip, and the
// assign-driver form. Web's volume/performance charts and full delivery
// history table are covered by ActiveDeliveriesScreen (the full CRUD list)
// and the Overview KPI snapshot elsewhere, so this screen keeps to the
// board's own distinct job: see driver availability and assign deliveries.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { assignDriverToDelivery, sendWhatsAppDirections } from '../../lib/dispatchActions';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import SearchablePicker from '../../components/ui/SearchablePicker';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';

interface DeliveryRow {
  id: string;
  order_id: string | null;
  customer_name: string | null;
  status: string;
  driver_id: string | null;
}

interface DriverRow {
  id: string;
  full_name: string;
  status: string;
  phone: string | null;
}

const DRIVER_STATUS_TONE: Record<string, 'success' | 'info' | 'muted'> = {
  ACTIVE: 'success',
  ON_DELIVERY: 'info',
  OFFLINE: 'muted',
};

export default function DeliveriesScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const isManagementOrAdmin = !!profile?.isAdmin || profile?.department === 'MANAGEMENT';

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignDeliveryId, setAssignDeliveryId] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    const [dRes, drRes] = await Promise.all([
      supabase.from('delivery_logs').select('id, order_id, customer_name, status, driver_id').order('created_at', { ascending: false }).limit(50),
      supabase.from('drivers').select('id, full_name, status, phone').order('created_at', { ascending: false }),
    ]);
    if (dRes.data) setDeliveries(dRes.data as any);
    if (drRes.data) setDrivers(drRes.data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = deliveries.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const unassignedDeliveries = deliveries.filter((d) => d.status === 'PENDING_ASSIGNMENT');

  const handleAssign = async () => {
    if (!assignDeliveryId || !assignDriverId) {
      Alert.alert('Missing Info', 'Select a delivery and a driver.');
      return;
    }
    const driver = drivers.find((d) => d.id === assignDriverId);
    if (!driver) return;
    setAssigning(true);
    try {
      const { pending } = await assignDriverToDelivery(assignDeliveryId, driver.id, driver.full_name, null, isManagementOrAdmin);
      if (pending) {
        Alert.alert('Sent for Approval', 'Management must approve this driver assignment.');
      } else {
        Alert.alert('Assigned', `${driver.full_name} assigned to the delivery.`);
        try {
          await sendWhatsAppDirections(driver.id);
        } catch {}
      }
      setAssignDeliveryId('');
      setAssignDriverId('');
      load();
    } catch (e: any) {
      Alert.alert('Assignment Failed', e.message || 'Could not assign this driver.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '30%' }}><MetricCard label="Pending" value={counts.PENDING_ASSIGNMENT || 0} tone="neutral" /></View>
          <View style={{ width: '30%' }}><MetricCard label="Assigned" value={counts.ASSIGNED || 0} tone="warning" /></View>
          <View style={{ width: '30%' }}><MetricCard label="In Transit" value={counts.IN_TRANSIT || 0} /></View>
          <View style={{ width: '30%' }}><MetricCard label="Delivered" value={counts.DELIVERED || 0} /></View>
          <View style={{ width: '30%' }}><MetricCard label="Failed" value={counts.FAILED || 0} tone="danger" /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Drivers</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
            {drivers.map((d) => (
              <View key={d.id} style={{ alignItems: 'center', gap: 4, width: 64 }}>
                <Avatar name={d.full_name} size={44} />
                <Badge tone={DRIVER_STATUS_TONE[d.status] || 'muted'} label={d.status === 'ACTIVE' ? 'Free' : d.status === 'ON_DELIVERY' ? 'Busy' : 'Off'} size="xs" />
              </View>
            ))}
            {drivers.length === 0 && !loading && (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>No drivers on file.</Text>
            )}
          </View>
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Assign Driver</Text>
          <SearchablePicker
            label="Delivery"
            value={assignDeliveryId}
            onChange={setAssignDeliveryId}
            placeholder="Select an unassigned delivery"
            options={unassignedDeliveries.map((d) => ({ value: d.id, label: d.customer_name || d.order_id || d.id }))}
          />
          <View style={{ height: t.spacing.md }} />
          <SearchablePicker
            label="Driver"
            value={assignDriverId}
            onChange={setAssignDriverId}
            placeholder="Select a driver"
            options={drivers.filter((d) => d.status === 'ACTIVE').map((d) => ({ value: d.id, label: d.full_name }))}
          />
          <View style={{ height: t.spacing.lg }} />
          <Button label={assigning ? 'Assigning…' : 'Assign & Notify'} onPress={handleAssign} loading={assigning} disabled={assigning} fullWidth />
        </Card>
      </View>
    </Screen>
  );
}
