// rebma-mobile/screens/adminWarehouse/FleetAnalyticsScreen.tsx
// Ports: rebma-web/src/views/logistics/FleetAnalyticsView.tsx — read-only
// aggregates over fleet_vehicles/fuel_logs/maintenance_schedule/
// delivery_logs. Web's distance-based fuel-efficiency figure requires a
// per-delivery route-distance computation (a live OSRM call, same class of
// thing dropped from TrackingScreen per D8) — simplified here to
// cost/count aggregates, which is what MetricCard + BarChart can render
// meaningfully without that dependency.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';
import { View } from 'react-native';

export default function FleetAnalyticsScreen() {
  const t = useTheme();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [v, f, m, d] = await Promise.all([
      supabase.from('fleet_vehicles').select('id, status').then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('fuel_logs').select('vehicle_id, cost, liters').then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('maintenance_schedule').select('vehicle_id, cost, status').then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('delivery_logs').select('vehicle_id, status').then((r) => r, () => ({ data: [] as any[] })),
    ]);
    setVehicles((v as any).data || []);
    setFuelLogs((f as any).data || []);
    setMaintenance((m as any).data || []);
    setDeliveries((d as any).data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalVehicles = vehicles.length;
  const operationalCount = vehicles.filter((v) => v.status === 'Operational').length;
  const totalFuelCost = fuelLogs.reduce((s, f) => s + Number(f.cost || 0), 0);
  const totalMaintenanceCost = maintenance.reduce((s, m) => s + Number(m.cost || 0), 0);
  const pendingMaintenance = maintenance.filter((m) => m.status !== 'Completed').length;
  const deliveredCount = deliveries.filter((d) => d.status === 'DELIVERED').length;

  const fuelByVehicle: Record<string, number> = {};
  for (const f of fuelLogs) fuelByVehicle[f.vehicle_id] = (fuelByVehicle[f.vehicle_id] || 0) + Number(f.cost || 0);
  const topFuelVehicles = Object.entries(fuelByVehicle).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <Screen refreshing={false}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Fleet Size" value={loading ? '—' : totalVehicles} sublabel={`${operationalCount} operational`} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Deliveries Completed" value={loading ? '—' : deliveredCount} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Fuel Spend" value={loading ? '—' : `GHS ${totalFuelCost.toLocaleString()}`} tone="warning" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Maintenance Cost" value={loading ? '—' : `GHS ${totalMaintenanceCost.toLocaleString()}`} sublabel={`${pendingMaintenance} pending`} tone="danger" /></View>
        </View>

        {!loading && topFuelVehicles.length > 0 && (
          <Card>
            <BarChart data={topFuelVehicles.map(([vehicleId, cost]) => ({ label: vehicleId, value: cost, formattedValue: `GHS ${cost.toLocaleString()}` }))} />
          </Card>
        )}
      </View>
    </Screen>
  );
}
