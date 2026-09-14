// rebma-mobile/screens/adminWarehouse/FleetAnalyticsScreen.tsx
// Ports: rebma-web/src/views/logistics/FleetAnalyticsView.tsx — read-only
// aggregates over fleet_vehicles/fuel_logs/maintenance_schedule/
// delivery_logs.
//
// Correction from an earlier pass: this file's own prior header comment
// claimed distance/fuel-efficiency needed a live OSRM route-distance call
// and was dropped for that reason. Re-reading web's actual source shows
// that's wrong — distance is estimated purely from
// max(odometer) - min(odometer) across a vehicle's own fuel_logs rows, no
// external API involved at all. Ported for real below, along with the
// period selector, Cost per Delivery, Open Work Orders, Maintenance Cost
// Trend, Distance Covered per Vehicle, and the Fuel Efficiency table —
// none of which need a new dependency.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Button from '../../components/ui/Button';

type Period = 'week' | 'month' | 'quarter' | 'year';
const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90, year: 365 };
const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' }, { key: 'year', label: 'Year' },
];

interface EfficiencyRow { vehicleId: string; distance: number; fuelUsed: number; efficiency: number; }

export default function FleetAnalyticsScreen() {
  const t = useTheme();
  const [period, setPeriod] = useState<Period>('month');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [v, f, m, d] = await Promise.all([
      supabase.from('fleet_vehicles').select('id, status').then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('fuel_logs').select('vehicle_id, cost, liters, odometer, date, created_at').then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('maintenance_schedule').select('vehicle_id, cost, status, date, created_at').then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('delivery_logs').select('vehicle_id, driver_name, status').then((r) => r, () => ({ data: [] as any[] })),
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

  const since = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - PERIOD_DAYS[period]); return d; }, [period]);
  const fuelInPeriod = useMemo(() => fuelLogs.filter((f) => new Date(f.date || f.created_at) >= since), [fuelLogs, since]);
  const maintInPeriod = useMemo(() => maintenance.filter((m) => new Date(m.date || m.created_at) >= since), [maintenance, since]);

  const distanceByVehicle = useMemo(() => {
    const byVehicle: Record<string, number[]> = {};
    for (const f of fuelLogs) {
      if (!f.vehicle_id || !f.odometer) continue;
      (byVehicle[f.vehicle_id] ||= []).push(Number(f.odometer));
    }
    const result: Record<string, number> = {};
    for (const [vid, readings] of Object.entries(byVehicle)) {
      if (readings.length < 2) continue;
      result[vid] = Math.max(...readings) - Math.min(...readings);
    }
    return result;
  }, [fuelLogs]);

  const litersByVehicle = useMemo(() => {
    const result: Record<string, number> = {};
    for (const f of fuelLogs) { if (f.vehicle_id) result[f.vehicle_id] = (result[f.vehicle_id] || 0) + Number(f.liters || 0); }
    return result;
  }, [fuelLogs]);

  const costByVehicle = useMemo(() => {
    const result: Record<string, number> = {};
    for (const f of fuelInPeriod) { if (f.vehicle_id) result[f.vehicle_id] = (result[f.vehicle_id] || 0) + Number(f.cost || 0); }
    return result;
  }, [fuelInPeriod]);

  const deliveredByVehicle = useMemo(() => {
    const result: Record<string, number> = {};
    for (const d of deliveries) { if (d.status === 'DELIVERED' && d.vehicle_id) result[d.vehicle_id] = (result[d.vehicle_id] || 0) + 1; }
    return result;
  }, [deliveries]);

  const deliveredByDriver = useMemo(() => {
    const result: Record<string, number> = {};
    for (const d of deliveries) { if (d.status === 'DELIVERED' && d.driver_name) result[d.driver_name] = (result[d.driver_name] || 0) + 1; }
    return result;
  }, [deliveries]);

  const totalVehicles = vehicles.length;
  const operationalCount = vehicles.filter((v) => v.status === 'Operational').length;
  const utilizationRate = totalVehicles > 0 ? Math.round((operationalCount / totalVehicles) * 100) : 0;

  const totalFuelCostPeriod = fuelInPeriod.reduce((s, f) => s + Number(f.cost || 0), 0);
  const totalDeliveredPeriod = Object.values(deliveredByVehicle).reduce((s, n) => s + n, 0);
  const costPerDelivery = totalDeliveredPeriod > 0 ? Math.round(totalFuelCostPeriod / totalDeliveredPeriod) : 0;

  const totalDistance = Object.values(distanceByVehicle).reduce((s, n) => s + n, 0);
  const totalLitersWithDistance = Object.keys(distanceByVehicle).reduce((s, vid) => s + (litersByVehicle[vid] || 0), 0);
  const avgFuelEfficiency = totalLitersWithDistance > 0 ? (totalDistance / totalLitersWithDistance).toFixed(1) : null;

  const openWorkOrders = maintenance.filter((m) => m.status !== 'Completed').length;

  const maintenanceTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return d; });
    return months.map((m) => {
      const key = `${m.getFullYear()}-${m.getMonth()}`;
      const cost = maintenance.filter((r) => { const d = new Date(r.date || r.created_at); return `${d.getFullYear()}-${d.getMonth()}` === key; }).reduce((s, r) => s + Number(r.cost || 0), 0);
      return { label: m.toLocaleDateString('en-GB', { month: 'short' }), value: Math.round(cost), formattedValue: `GHS ${Math.round(cost).toLocaleString()}` };
    });
  }, [maintenance]);

  const distanceData = Object.entries(distanceByVehicle).map(([vehicle, distance]) => ({ label: vehicle, value: Math.round(distance), formattedValue: `${Math.round(distance).toLocaleString()} km` }));
  const driverData = Object.entries(deliveredByDriver).map(([driver, n]) => ({ label: driver, value: n }));

  const efficiencyTable: EfficiencyRow[] = Object.entries(distanceByVehicle).map(([vehicleId, distance]) => {
    const liters = litersByVehicle[vehicleId] || 0;
    return { vehicleId, distance: Math.round(distance), fuelUsed: Math.round(liters), efficiency: liters > 0 ? Number((distance / liters).toFixed(1)) : 0 };
  });
  const efficiencyCols: DataColumn<EfficiencyRow>[] = [
    { key: 'vehicleId', label: 'Vehicle', primary: true },
    { key: 'distance', label: 'Distance (km)', render: (r) => r.distance.toLocaleString() },
    { key: 'fuelUsed', label: 'Fuel Used (L)', render: (r) => r.fuelUsed.toLocaleString() },
    {
      key: 'efficiency', label: 'km/L', status: true,
      render: (r) => <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: r.efficiency >= 10 ? t.colors.status.success.text : r.efficiency >= 8 ? t.colors.status.warning.text : t.colors.status.danger.text }}>{r.efficiency}</Text>,
    },
  ];

  return (
    <Screen refreshing={false}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
          {PERIODS.map((p) => (
            <Button key={p.key} label={p.label} size="sm" variant={period === p.key ? 'primary' : 'ghost'} onPress={() => setPeriod(p.key)} />
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Fleet Size" value={loading ? '—' : totalVehicles} sublabel={`${operationalCount} operational`} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Fleet Utilization" value={loading ? '—' : `${utilizationRate}%`} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Cost per Delivery" value={loading ? '—' : (costPerDelivery > 0 ? `GHS ${costPerDelivery}` : '—')} tone="warning" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Avg Fuel Efficiency" value={loading ? '—' : (avgFuelEfficiency ? `${avgFuelEfficiency} km/L` : '—')} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Deliveries Completed" value={loading ? '—' : deliveredByVehicleTotal(deliveredByVehicle)} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Fuel Spend (period)" value={loading ? '—' : `GHS ${totalFuelCostPeriod.toLocaleString()}`} tone="warning" /></View>
        </View>

        {!loading && driverData.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Deliveries Completed by Driver</Text>
            <BarChart data={driverData} />
          </Card>
        )}

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Maintenance Cost Trend (6 months)</Text>
          <BarChart data={maintenanceTrend} />
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: 4 }}>Open Maintenance Work Orders</Text>
          <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: t.colors.textPrimary }}>{loading ? '—' : openWorkOrders}</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>{maintInPeriod.length} logged this period</Text>
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Distance Covered per Vehicle</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>Estimated from odometer readings</Text>
          {distanceData.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>
              Need at least two fuel log entries per vehicle to estimate distance.
            </Text>
          ) : <BarChart data={distanceData} />}
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Fuel Efficiency by Vehicle</Text>
          {efficiencyTable.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>Not enough fuel log data yet.</Text>
          ) : <DataList columns={efficiencyCols} data={efficiencyTable} rowKey={(r) => r.vehicleId} />}
        </Card>
      </View>
    </Screen>
  );
}

function deliveredByVehicleTotal(m: Record<string, number>): number {
  return Object.values(m).reduce((s, n) => s + n, 0);
}
