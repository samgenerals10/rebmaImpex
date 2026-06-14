import React, { useState } from 'react';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { exportToCSV } from '../../utils/export';

type Period = '7D' | '30D' | '90D' | '12M';

const OUTPUT_TREND: Record<Period, { label: string; boxes: number; sachets: number }[]> = {
  '7D': [
    { label: 'Mon', boxes: 40, sachets: 4000 },
    { label: 'Tue', boxes: 30, sachets: 3000 },
    { label: 'Wed', boxes: 35, sachets: 3500 },
    { label: 'Thu', boxes: 44, sachets: 4400 },
    { label: 'Fri', boxes: 38, sachets: 3800 },
    { label: 'Sat', boxes: 32, sachets: 3200 },
    { label: 'Sun', boxes: 0, sachets: 0 },
  ],
  '30D': [
    { label: 'W1', boxes: 180, sachets: 18000 },
    { label: 'W2', boxes: 210, sachets: 21000 },
    { label: 'W3', boxes: 195, sachets: 19500 },
    { label: 'W4', boxes: 230, sachets: 23000 },
  ],
  '90D': [
    { label: 'Apr', boxes: 720, sachets: 72000 },
    { label: 'May', boxes: 820, sachets: 82000 },
    { label: 'Jun', boxes: 890, sachets: 89000 },
  ],
  '12M': [
    { label: 'Jul', boxes: 650, sachets: 65000 },
    { label: 'Aug', boxes: 700, sachets: 70000 },
    { label: 'Sep', boxes: 680, sachets: 68000 },
    { label: 'Oct', boxes: 750, sachets: 75000 },
    { label: 'Nov', boxes: 800, sachets: 80000 },
    { label: 'Dec', boxes: 820, sachets: 82000 },
    { label: 'Jan', boxes: 760, sachets: 76000 },
    { label: 'Feb', boxes: 790, sachets: 79000 },
    { label: 'Mar', boxes: 830, sachets: 83000 },
    { label: 'Apr', boxes: 720, sachets: 72000 },
    { label: 'May', boxes: 820, sachets: 82000 },
    { label: 'Jun', boxes: 890, sachets: 89000 },
  ],
};

const QUALITY_DATA = [
  { name: 'Passed', value: 82, color: '#10b981' },
  { name: 'Partial', value: 10, color: '#f59e0b' },
  { name: 'Failed', value: 8, color: '#ef4444' },
];

const PRODUCT_DATA = [
  { product: 'Shea Butter Sachet', boxes: 340, sachets: 34000 },
  { product: 'Palm Oil Pouch', boxes: 280, sachets: 28000 },
  { product: 'Coconut Oil', boxes: 210, sachets: 21000 },
  { product: 'Groundnut Oil', boxes: 190, sachets: 19000 },
  { product: 'Cocoa Butter', boxes: 160, sachets: 16000 },
];

const EFFICIENCY_DATA: Record<Period, { label: string; input: number; output: number; efficiency: number }[]> = {
  '7D': [
    { label: 'Mon', input: 200, output: 40, efficiency: 20 },
    { label: 'Tue', input: 150, output: 30, efficiency: 20 },
    { label: 'Wed', input: 180, output: 35, efficiency: 19.4 },
    { label: 'Thu', input: 220, output: 44, efficiency: 20 },
    { label: 'Fri', input: 190, output: 38, efficiency: 20 },
    { label: 'Sat', input: 160, output: 32, efficiency: 20 },
    { label: 'Sun', input: 0, output: 0, efficiency: 0 },
  ],
  '30D': [
    { label: 'W1', input: 900, output: 180, efficiency: 20 },
    { label: 'W2', input: 1050, output: 210, efficiency: 20 },
    { label: 'W3', input: 975, output: 195, efficiency: 20 },
    { label: 'W4', input: 1150, output: 230, efficiency: 20 },
  ],
  '90D': [
    { label: 'Apr', input: 3600, output: 720, efficiency: 20 },
    { label: 'May', input: 4100, output: 820, efficiency: 20 },
    { label: 'Jun', input: 4450, output: 890, efficiency: 20 },
  ],
  '12M': [
    { label: 'Jul', input: 3250, output: 650, efficiency: 20 },
    { label: 'Aug', input: 3500, output: 700, efficiency: 20 },
    { label: 'Sep', input: 3400, output: 680, efficiency: 20 },
    { label: 'Oct', input: 3750, output: 750, efficiency: 20 },
    { label: 'Nov', input: 4000, output: 800, efficiency: 20 },
    { label: 'Dec', input: 4100, output: 820, efficiency: 20 },
    { label: 'Jan', input: 3800, output: 760, efficiency: 20 },
    { label: 'Feb', input: 3950, output: 790, efficiency: 20 },
    { label: 'Mar', input: 4150, output: 830, efficiency: 20 },
    { label: 'Apr', input: 3600, output: 720, efficiency: 20 },
    { label: 'May', input: 4100, output: 820, efficiency: 20 },
    { label: 'Jun', input: 4450, output: 890, efficiency: 20 },
  ],
};

const MONTHLY_TARGETS = [
  { month: 'Apr', target: 700, actual: 720 },
  { month: 'May', target: 800, actual: 820 },
  { month: 'Jun', target: 900, actual: 890 },
];

const SUMMARY_TABLE = [
  { product: 'Shea Butter Sachet', batches: 12, totalBoxes: 340, totalSachets: 34000, passRate: '92%', avgPerBatch: 28 },
  { product: 'Palm Oil Pouch', batches: 10, totalBoxes: 280, totalSachets: 28000, passRate: '88%', avgPerBatch: 28 },
  { product: 'Coconut Oil', batches: 8, totalBoxes: 210, totalSachets: 21000, passRate: '85%', avgPerBatch: 26 },
  { product: 'Groundnut Oil', batches: 7, totalBoxes: 190, totalSachets: 19000, passRate: '90%', avgPerBatch: 27 },
  { product: 'Cocoa Butter', batches: 6, totalBoxes: 160, totalSachets: 16000, passRate: '82%', avgPerBatch: 27 },
];

interface Props {
  addNotification: (msg: string) => void;
}

export default function ProductionAnalyticsView({ addNotification }: Props) {
  const [period, setPeriod] = useState<Period>('7D');

  const trend = OUTPUT_TREND[period];
  const eff = EFFICIENCY_DATA[period];
  const totalBoxes = trend.reduce((s, d) => s + d.boxes, 0);
  const totalSachets = trend.reduce((s, d) => s + d.sachets, 0);
  const avgEff = eff.filter(d => d.efficiency > 0).reduce((s, d) => s + d.efficiency, 0) / Math.max(eff.filter(d => d.efficiency > 0).length, 1);

  const kpis = [
    { label: 'Boxes Produced', value: totalBoxes.toLocaleString(), trend: 'up', sub: `${period} period` },
    { label: 'Sachets Produced', value: totalSachets.toLocaleString(), trend: 'up', sub: `${period} period` },
    { label: 'Quality Pass Rate', value: '87%', trend: 'up', sub: 'above 85% threshold' },
    { label: 'Avg Efficiency', value: `${avgEff.toFixed(1)}%`, trend: 'neutral', sub: 'input to output ratio' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Production Analytics</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Track output, quality, efficiency and targets</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['7D', '30D', '90D', '12M'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer transition-all ${period === p ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => exportToCSV(trend, ['label','boxes','sachets'], `production_analytics_${period}`)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">{k.value}</p>
            <div className="flex items-center gap-1 mt-1.5">
              {k.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : k.trend === 'down' ? <TrendingDown className="w-3 h-3 text-rose-500" /> : null}
              <p className="text-[10px] text-[var(--text-muted)]">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: Output Trend + Quality Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">Production Output Trend</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Boxes and sachets produced over time</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="boxes" name="Boxes" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                <Area type="monotone" dataKey="sachets" name="Sachets" stroke="var(--accent)" fill="var(--accent-light)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">Quality Results</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Pass / Partial / Fail breakdown</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={QUALITY_DATA} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value">
                  {QUALITY_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} formatter={(v: number) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {QUALITY_DATA.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-xs text-[var(--text-muted)] flex-1">{d.name}</span>
                <span className="text-xs font-bold text-[var(--text-primary)]">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Efficiency + Production by Product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">Input vs Output Efficiency</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Goods received vs boxes produced</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eff} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="input" name="Input (units)" fill="#94a3b8" radius={[3,3,0,0]} />
                <Bar dataKey="output" name="Output (boxes)" fill="var(--accent)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">Production by Product</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Boxes per product line</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PRODUCT_DATA} layout="vertical" barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={10} />
                <YAxis type="category" dataKey="product" stroke="var(--text-muted)" fontSize={9} width={100} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Bar dataKey="boxes" name="Boxes" fill="var(--accent)" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Targets */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
        <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">Monthly Targets vs Actual</h3>
        <p className="text-xs text-[var(--text-muted)] mb-4">Boxes produced vs set targets</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MONTHLY_TARGETS} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="target" name="Target" fill="var(--border)" radius={[4,4,0,0]} />
              <Bar dataKey="actual" name="Actual" fill="var(--accent)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Production Summary Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="font-bold text-[var(--text-primary)] text-sm">Production Summary Table</h3>
          <button onClick={() => exportToCSV(SUMMARY_TABLE, ['product','batches','totalBoxes','totalSachets','passRate','avgPerBatch'], 'production_summary')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Product', 'Batches', 'Total Boxes', 'Total Sachets', 'Pass Rate', 'Avg/Batch'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUMMARY_TABLE.map(row => (
                <tr key={row.product} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{row.product}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{row.batches}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--accent)]">{row.totalBoxes.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{row.totalSachets.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${parseInt(row.passRate) >= 90 ? 'bg-emerald-500/10 text-emerald-600' : parseInt(row.passRate) >= 80 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'}`}>{row.passRate}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{row.avgPerBatch} boxes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
