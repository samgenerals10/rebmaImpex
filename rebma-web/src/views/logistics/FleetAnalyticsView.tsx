import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../../lib/supabaseClient';

type Period = 'week' | 'month' | 'quarter' | 'year';

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90, year: 365 };

const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13 };

export default function FleetAnalyticsView({ addNotification: _addNotification }: { addNotification: (msg: string) => void }) {
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: v }, { data: f }, { data: m }, { data: d }] = await Promise.all([
        supabase.from('fleet_vehicles').select('*').then(r => r, () => ({ data: [] })),
        supabase.from('fuel_logs').select('*').then(r => r, () => ({ data: [] })),
        supabase.from('maintenance_schedule').select('*').then(r => r, () => ({ data: [] })),
        supabase.from('delivery_logs').select('vehicle_id, driver_name, status').then(r => r, () => ({ data: [] })),
      ]);
      setVehicles(v || []);
      setFuelLogs(f || []);
      setMaintenance(m || []);
      setDeliveries(d || []);
      setLoading(false);
    };
    load();
  }, []);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PERIOD_DAYS[period]);
    return d;
  }, [period]);

  const fuelInPeriod = useMemo(() => fuelLogs.filter(f => new Date(f.date || f.created_at) >= since), [fuelLogs, since]);
  const maintInPeriod = useMemo(() => maintenance.filter(m => new Date(m.date || m.created_at) >= since), [maintenance, since]);

  // Per-vehicle distance estimate: max(odometer) - min(odometer) from fuel log readings
  const distanceByVehicle = useMemo(() => {
    const byVehicle: Record<string, number[]> = {};
    for (const f of fuelLogs) {
      const vid = f.vehicle_id;
      if (!vid || !f.odometer) continue;
      (byVehicle[vid] ||= []).push(Number(f.odometer));
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
    for (const f of fuelLogs) {
      if (!f.vehicle_id) continue;
      result[f.vehicle_id] = (result[f.vehicle_id] || 0) + Number(f.liters || 0);
    }
    return result;
  }, [fuelLogs]);

  const costByVehicle = useMemo(() => {
    const result: Record<string, number> = {};
    for (const f of fuelInPeriod) {
      if (!f.vehicle_id) continue;
      result[f.vehicle_id] = (result[f.vehicle_id] || 0) + Number(f.cost || 0);
    }
    return result;
  }, [fuelInPeriod]);

  const deliveredByVehicle = useMemo(() => {
    const result: Record<string, number> = {};
    for (const d of deliveries) {
      if (d.status !== 'DELIVERED' || !d.vehicle_id) continue;
      result[d.vehicle_id] = (result[d.vehicle_id] || 0) + 1;
    }
    return result;
  }, [deliveries]);

  const deliveredByDriver = useMemo(() => {
    const result: Record<string, number> = {};
    for (const d of deliveries) {
      if (d.status !== 'DELIVERED' || !d.driver_name) continue;
      result[d.driver_name] = (result[d.driver_name] || 0) + 1;
    }
    return result;
  }, [deliveries]);

  const totalVehicles = vehicles.length;
  const operationalCount = vehicles.filter(v => v.status === 'Operational').length;
  const utilizationRate = totalVehicles > 0 ? Math.round((operationalCount / totalVehicles) * 100) : 0;

  const totalFuelCostPeriod = fuelInPeriod.reduce((s, f) => s + Number(f.cost || 0), 0);
  const totalDeliveredPeriod = Object.values(deliveredByVehicle).reduce((s, n) => s + n, 0);
  const costPerDelivery = totalDeliveredPeriod > 0 ? Math.round(totalFuelCostPeriod / totalDeliveredPeriod) : 0;

  const totalDistance = Object.values(distanceByVehicle).reduce((s, n) => s + n, 0);
  const totalLitersWithDistance = Object.keys(distanceByVehicle).reduce((s, vid) => s + (litersByVehicle[vid] || 0), 0);
  const avgFuelEfficiency = totalLitersWithDistance > 0 ? (totalDistance / totalLitersWithDistance).toFixed(1) : '—';

  const fuelCostByVehicleData = Object.entries(costByVehicle).map(([vehicle, cost]) => ({ vehicle, cost: Math.round(cost) }));
  const driverPerfData = Object.entries(deliveredByDriver).map(([driver, deliveries]) => ({ driver, deliveries }));
  const distanceData = Object.entries(distanceByVehicle).map(([vehicle, distance]) => ({ vehicle, distance: Math.round(distance) }));

  const maintenanceTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return d; });
    return months.map(m => {
      const key = `${m.getFullYear()}-${m.getMonth()}`;
      const cost = maintenance.filter(r => { const d = new Date(r.date || r.created_at); return `${d.getFullYear()}-${d.getMonth()}` === key; }).reduce((s, r) => s + Number(r.cost || 0), 0);
      return { month: m.toLocaleDateString('en-GB', { month: 'short' }), cost: Math.round(cost) };
    });
  }, [maintenance]);

  const efficiencyTable = Object.entries(distanceByVehicle).map(([vehicleId, distance]) => {
    const liters = litersByVehicle[vehicleId] || 0;
    return { vehicleId, distance: Math.round(distance), fuelUsed: Math.round(liters), efficiency: liters > 0 ? Number((distance / liters).toFixed(1)) : 0 };
  });

  const periods: { key: Period; label: string }[] = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'quarter', label: 'This Quarter' },
    { key: 'year', label: 'This Year' },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Fleet Analytics Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>Performance insights across the entire fleet</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--border)', padding: 4, gap: 4 }}>
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: period === p.key ? 'var(--accent)' : 'transparent', color: period === p.key ? '#fff' : 'var(--text-secondary)' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl" />)}
        </div>
      ) : (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {[
          { label: 'Fleet Utilization', value: `${utilizationRate}%`, color: 'var(--accent)' },
          { label: 'Cost per Delivery', value: costPerDelivery > 0 ? `GHS ${costPerDelivery}` : '—', color: '#d97706' },
          { label: 'Avg Fuel Efficiency', value: avgFuelEfficiency !== '—' ? `${avgFuelEfficiency} km/L` : '—', color: '#059669' },
          { label: 'Total Distance', value: totalDistance > 0 ? `${totalDistance.toLocaleString()} km` : '—', color: '#7c3aed' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: 24, fontWeight: 700, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Fuel Cost by Vehicle (period)</h3>
          {fuelCostByVehicleData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No fuel logs in this period.</p>
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fuelCostByVehicleData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="vehicle" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="cost" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Deliveries Completed by Driver</h3>
          {driverPerfData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No completed deliveries logged yet.</p>
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={driverPerfData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="driver" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deliveries" name="Deliveries" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Maintenance Cost Trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={maintenanceTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Open Maintenance Work Orders</h3>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{maintenance.filter(m => m.status !== 'Completed').length}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>{maintInPeriod.length} logged this period</p>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Distance Covered per Vehicle (est. from odometer readings)</h3>
        {distanceData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Need at least two fuel log entries per vehicle to estimate distance.</p>
        ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={distanceData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="vehicle" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="distance" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Fuel Efficiency by Vehicle</h3>
        {efficiencyTable.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Not enough fuel log data yet.</p>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Vehicle ID', 'Total Distance (km)', 'Total Fuel Used (L)', 'Efficiency (km/L)'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {efficiencyTable.map(row => (
                <tr key={row.vehicleId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>{row.vehicleId}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>{row.distance.toLocaleString()}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>{row.fuelUsed.toLocaleString()}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 13, fontWeight: 700, background: row.efficiency >= 10 ? 'rgba(16,185,129,0.15)' : row.efficiency >= 8 ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)', color: row.efficiency >= 10 ? '#059669' : row.efficiency >= 8 ? '#d97706' : '#dc2626' }}>
                      {row.efficiency}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
