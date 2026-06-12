import React, { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Period = 'week' | 'month' | 'quarter' | 'year';

const UTILIZATION_DATA = [
  { month: 'Jan', rate: 72 }, { month: 'Feb', rate: 68 }, { month: 'Mar', rate: 78 },
  { month: 'Apr', rate: 75 }, { month: 'May', rate: 82 }, { month: 'Jun', rate: 85 },
];

const COST_PER_DELIVERY = [
  { vehicle: 'GR-1234', cost: 45 }, { vehicle: 'GR-5678', cost: 62 }, { vehicle: 'GR-3456', cost: 38 },
  { vehicle: 'GR-2345', cost: 51 }, { vehicle: 'GR-0123', cost: 43 }, { vehicle: 'GR-9012', cost: 78 },
];

const DRIVER_PERF = [
  { driver: 'K. Asante', deliveries: 48, onTime: 92 },
  { driver: 'A. Boateng', deliveries: 36, onTime: 88 },
  { driver: 'K. Mensah', deliveries: 55, onTime: 95 },
  { driver: 'Y. Osei', deliveries: 29, onTime: 85 },
  { driver: 'A. Frimpong', deliveries: 22, onTime: 91 },
];

const MAINT_TREND = [
  { month: 'Jan', cost: 3200 }, { month: 'Feb', cost: 2800 }, { month: 'Mar', cost: 4100 },
  { month: 'Apr', cost: 3600 }, { month: 'May', cost: 5200 }, { month: 'Jun', cost: 4380 },
];

const DISTANCE_DATA = [
  { vehicle: 'GR-1234', distance: 12400 }, { vehicle: 'GR-5678', distance: 18700 }, { vehicle: 'GR-3456', distance: 9800 },
  { vehicle: 'GR-2345', distance: 7200 }, { vehicle: 'GR-0123', distance: 4500 }, { vehicle: 'GR-9012', distance: 22100 },
  { vehicle: 'GR-7890', distance: 6300 }, { vehicle: 'GR-6789', distance: 15600 },
];

const EFFICIENCY_TABLE = [
  { vehicleId: 'GR-1234-22', distance: 12400, fuelUsed: 1150, efficiency: 10.8 },
  { vehicleId: 'GR-5678-21', distance: 18700, fuelUsed: 2100, efficiency: 8.9 },
  { vehicleId: 'GR-3456-22', distance: 9800, fuelUsed: 780, efficiency: 12.6 },
  { vehicleId: 'GR-2345-23', distance: 7200, fuelUsed: 610, efficiency: 11.8 },
  { vehicleId: 'GR-0123-24', distance: 4500, fuelUsed: 420, efficiency: 10.7 },
  { vehicleId: 'GR-9012-20', distance: 22100, fuelUsed: 3100, efficiency: 7.1 },
  { vehicleId: 'GR-7890-19', distance: 6300, fuelUsed: 890, efficiency: 7.1 },
  { vehicleId: 'GR-6789-18', distance: 15600, fuelUsed: 2400, efficiency: 6.5 },
];

const KPI_BY_PERIOD: Record<Period, { utilization: string; costPerDelivery: string; fuelEff: string; totalDist: string }> = {
  week: { utilization: '83%', costPerDelivery: 'GHS 48', fuelEff: '9.8 km/L', totalDist: '4,280 km' },
  month: { utilization: '85%', costPerDelivery: 'GHS 52', fuelEff: '9.4 km/L', totalDist: '19,600 km' },
  quarter: { utilization: '79%', costPerDelivery: 'GHS 55', fuelEff: '9.1 km/L', totalDist: '58,400 km' },
  year: { utilization: '76%', costPerDelivery: 'GHS 58', fuelEff: '8.8 km/L', totalDist: '96,600 km' },
};

const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13 };

export default function FleetAnalyticsView({ addNotification }: { addNotification: (msg: string) => void }) {
  const [period, setPeriod] = useState<Period>('month');
  const kpi = KPI_BY_PERIOD[period];

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {[
          { label: 'Fleet Utilization', value: kpi.utilization, color: 'var(--accent)' },
          { label: 'Cost per Delivery', value: kpi.costPerDelivery, color: '#d97706' },
          { label: 'Avg Fuel Efficiency', value: kpi.fuelEff, color: '#059669' },
          { label: 'Total Distance', value: kpi.totalDist, color: '#7c3aed' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: 24, fontWeight: 700, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Fleet Utilization Rate</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={UTILIZATION_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="rate" stroke="var(--accent)" fill="url(#utilGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Cost per Delivery by Vehicle</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={COST_PER_DELIVERY} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="vehicle" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="cost" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Driver Performance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DRIVER_PERF} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="driver" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deliveries" name="Deliveries" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="onTime" name="On-Time %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Maintenance Cost Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MAINT_TREND} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Distance Covered per Vehicle</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={DISTANCE_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="vehicle" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="distance" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, margin: '0 0 16px' }}>Fuel Efficiency by Vehicle</h3>
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
              {EFFICIENCY_TABLE.map(row => (
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
      </div>
    </div>
  );
}
