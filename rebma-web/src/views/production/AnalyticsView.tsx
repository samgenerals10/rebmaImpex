import React, { useState, useEffect } from 'react';
import { Download, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';

type Period = '7D' | '30D' | '90D' | '12M';

interface OutputRecord { date: string; product: string; boxes: number; sachets: number; quality: string; }
interface LedgerRecord { quantity: number; created_at: string; }

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const ORDERED_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function periodCutoff(period: Period): Date {
  const d = new Date();
  if (period === '7D') d.setDate(d.getDate() - 7);
  else if (period === '30D') d.setDate(d.getDate() - 30);
  else if (period === '90D') d.setDate(d.getDate() - 90);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

function buildOutputTrend(records: OutputRecord[], period: Period) {
  const cutoff = periodCutoff(period);
  const filtered = records.filter(r => new Date(r.date) >= cutoff);

  if (period === '7D') {
    const byDay: Record<string, { boxes: number; sachets: number }> = {};
    ORDERED_DAYS.forEach(d => { byDay[d] = { boxes: 0, sachets: 0 }; });
    filtered.forEach(r => {
      const name = DAY_NAMES[new Date(r.date).getDay()];
      if (byDay[name]) { byDay[name].boxes += r.boxes; byDay[name].sachets += r.sachets; }
    });
    return ORDERED_DAYS.map(d => ({ label: d, ...byDay[d] }));
  }

  if (period === '30D') {
    const now = Date.now();
    const buckets = ['W1','W2','W3','W4'];
    const byWeek: Record<string, { boxes: number; sachets: number }> = {};
    buckets.forEach(w => { byWeek[w] = { boxes: 0, sachets: 0 }; });
    filtered.forEach(r => {
      const diff = Math.floor((now - new Date(r.date).getTime()) / 86400000);
      const w = diff <= 7 ? 'W4' : diff <= 14 ? 'W3' : diff <= 21 ? 'W2' : 'W1';
      byWeek[w].boxes += r.boxes; byWeek[w].sachets += r.sachets;
    });
    return buckets.map(w => ({ label: w, ...byWeek[w] }));
  }

  // 90D + 12M — group by month
  const byMonth: Record<string, { boxes: number; sachets: number }> = {};
  filtered.forEach(r => {
    const d = new Date(r.date);
    const key = MONTH_NAMES[d.getMonth()];
    if (!byMonth[key]) byMonth[key] = { boxes: 0, sachets: 0 };
    byMonth[key].boxes += r.boxes; byMonth[key].sachets += r.sachets;
  });
  // return in chronological order
  const months = period === '90D' ? MONTH_NAMES.slice(-3) : MONTH_NAMES;
  return months.filter(m => byMonth[m]).map(m => ({ label: m, ...byMonth[m] }));
}

function buildEfficiency(output: OutputRecord[], input: LedgerRecord[], period: Period) {
  const cutoff = periodCutoff(period);

  if (period === '7D') {
    const outByDay: Record<string, number> = {};
    const inByDay: Record<string, number> = {};
    ORDERED_DAYS.forEach(d => { outByDay[d] = 0; inByDay[d] = 0; });
    output.filter(r => new Date(r.date) >= cutoff).forEach(r => {
      const n = DAY_NAMES[new Date(r.date).getDay()];
      if (n in outByDay) outByDay[n] += r.boxes;
    });
    input.filter(r => new Date(r.created_at) >= cutoff).forEach(r => {
      const n = DAY_NAMES[new Date(r.created_at).getDay()];
      if (n in inByDay) inByDay[n] += Number(r.quantity);
    });
    return ORDERED_DAYS.map(d => ({
      label: d, input: inByDay[d], output: outByDay[d],
      efficiency: inByDay[d] > 0 ? +((outByDay[d] / inByDay[d]) * 100).toFixed(1) : 0,
    }));
  }

  if (period === '30D') {
    const now = Date.now();
    const buckets = ['W1','W2','W3','W4'];
    const outByWeek: Record<string, number> = {}; const inByWeek: Record<string, number> = {};
    buckets.forEach(w => { outByWeek[w] = 0; inByWeek[w] = 0; });
    const week = (ts: number) => { const d = Math.floor((now - ts) / 86400000); return d <= 7 ? 'W4' : d <= 14 ? 'W3' : d <= 21 ? 'W2' : 'W1'; };
    output.filter(r => new Date(r.date) >= cutoff).forEach(r => { const w = week(new Date(r.date).getTime()); outByWeek[w] += r.boxes; });
    input.filter(r => new Date(r.created_at) >= cutoff).forEach(r => { const w = week(new Date(r.created_at).getTime()); inByWeek[w] += Number(r.quantity); });
    return buckets.map(w => ({ label: w, input: inByWeek[w], output: outByWeek[w], efficiency: inByWeek[w] > 0 ? +((outByWeek[w] / inByWeek[w]) * 100).toFixed(1) : 0 }));
  }

  // 90D + 12M
  const outByMonth: Record<string, number> = {}; const inByMonth: Record<string, number> = {};
  output.filter(r => new Date(r.date) >= cutoff).forEach(r => { const k = MONTH_NAMES[new Date(r.date).getMonth()]; outByMonth[k] = (outByMonth[k] || 0) + r.boxes; });
  input.filter(r => new Date(r.created_at) >= cutoff).forEach(r => { const k = MONTH_NAMES[new Date(r.created_at).getMonth()]; inByMonth[k] = (inByMonth[k] || 0) + Number(r.quantity); });
  const months = period === '90D' ? MONTH_NAMES.slice(-3) : MONTH_NAMES;
  return months.filter(m => outByMonth[m] || inByMonth[m]).map(m => ({
    label: m, input: inByMonth[m] || 0, output: outByMonth[m] || 0,
    efficiency: (inByMonth[m] || 0) > 0 ? +(((outByMonth[m] || 0) / inByMonth[m]) * 100).toFixed(1) : 0,
  }));
}

function buildMonthlyOutput(records: OutputRecord[]) {
  const byMonth: Record<string, number> = {};
  records.forEach(r => {
    const k = MONTH_NAMES[new Date(r.date).getMonth()];
    byMonth[k] = (byMonth[k] || 0) + r.boxes;
  });
  return MONTH_NAMES.filter(m => byMonth[m]).slice(-6).map(m => ({ month: m, actual: byMonth[m] }));
}

function buildProductData(records: OutputRecord[]) {
  const byProduct: Record<string, { boxes: number; sachets: number }> = {};
  records.forEach(r => {
    if (!byProduct[r.product]) byProduct[r.product] = { boxes: 0, sachets: 0 };
    byProduct[r.product].boxes += r.boxes;
    byProduct[r.product].sachets += r.sachets;
  });
  return Object.entries(byProduct)
    .map(([product, v]) => ({ product, ...v }))
    .sort((a, b) => b.boxes - a.boxes)
    .slice(0, 5);
}

function buildQualityData(records: OutputRecord[]) {
  const passed = records.filter(r => r.quality === 'Pass').length;
  const partial = records.filter(r => r.quality === 'Partial').length;
  const failed = records.filter(r => r.quality === 'Fail' || r.quality === 'Failed').length;
  const total = passed + partial + failed;
  if (total === 0) return [{ name: 'No Data', value: 1, color: 'var(--border)' }];
  return [
    { name: 'Passed', value: Math.round((passed / total) * 100), color: '#10b981' },
    { name: 'Partial', value: Math.round((partial / total) * 100), color: '#f59e0b' },
    { name: 'Failed', value: Math.round((failed / total) * 100), color: '#ef4444' },
  ].filter(d => d.value > 0);
}

function buildSummaryTable(records: OutputRecord[]) {
  const byProduct: Record<string, { dates: Set<string>; boxes: number; sachets: number; pass: number; total: number }> = {};
  records.forEach(r => {
    if (!byProduct[r.product]) byProduct[r.product] = { dates: new Set(), boxes: 0, sachets: 0, pass: 0, total: 0 };
    byProduct[r.product].dates.add(r.date);
    byProduct[r.product].boxes += r.boxes;
    byProduct[r.product].sachets += r.sachets;
    byProduct[r.product].total += 1;
    if (r.quality === 'Pass') byProduct[r.product].pass += 1;
  });
  return Object.entries(byProduct)
    .map(([product, v]) => ({
      product,
      batches: v.dates.size,
      totalBoxes: v.boxes,
      totalSachets: v.sachets,
      passRate: v.total > 0 ? `${Math.round((v.pass / v.total) * 100)}%` : '—',
      passRateNum: v.total > 0 ? Math.round((v.pass / v.total) * 100) : 0,
      avgPerBatch: v.dates.size > 0 ? Math.round(v.boxes / v.dates.size) : 0,
    }))
    .sort((a, b) => b.totalBoxes - a.totalBoxes)
    .slice(0, 10);
}

interface Props { addNotification: (msg: string) => void; }

export default function ProductionAnalyticsView({ addNotification }: Props) {
  const [period, setPeriod] = useState<Period>('7D');
  const [outputRecords, setOutputRecords] = useState<OutputRecord[]>([]);
  const [ledgerRecords, setLedgerRecords] = useState<LedgerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    supabase.from('production_output').select('date, product, boxes, sachets, quality').order('date', { ascending: false }).limit(2000)
      .then(({ data }) => { if (data) setOutputRecords(data as OutputRecord[]); }, () => {});
    supabase.from('stock_ledger').select('quantity, created_at').eq('movement_type', 'ADD')
      .then(({ data }) => {
        if (data) setLedgerRecords(data as LedgerRecord[]);
        setLoading(false);
      }, () => { setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const trend = buildOutputTrend(outputRecords, period);
  const eff = buildEfficiency(outputRecords, ledgerRecords, period);
  const qualityData = buildQualityData(outputRecords);
  const productData = buildProductData(outputRecords);
  const monthlyOutput = buildMonthlyOutput(outputRecords);
  const summaryTable = buildSummaryTable(outputRecords);

  const totalBoxes = trend.reduce((s, d) => s + d.boxes, 0);
  const totalSachets = trend.reduce((s, d) => s + d.sachets, 0);
  const effRows = eff.filter(d => d.efficiency > 0);
  const avgEff = effRows.length > 0 ? effRows.reduce((s, d) => s + d.efficiency, 0) / effRows.length : 0;
  const qualityPassRow = qualityData.find(d => d.name === 'Passed');
  const qualityPass = qualityPassRow ? `${qualityPassRow.value}%` : '—';

  const kpis = [
    { label: 'Boxes Produced', value: totalBoxes.toLocaleString(), trend: 'up', sub: `${period} period` },
    { label: 'Sachets Produced', value: totalSachets.toLocaleString(), trend: 'up', sub: `${period} period` },
    { label: 'Quality Pass Rate', value: qualityPass, trend: 'up', sub: 'above 85% threshold' },
    { label: 'Avg Efficiency', value: avgEff > 0 ? `${avgEff.toFixed(1)}%` : '—', trend: 'neutral', sub: 'input to output ratio' },
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
          <button onClick={fetchData} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => exportToCSV(trend, ['label','boxes','sachets'], `production_analytics_${period}`)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">Loading analytics…</div>
      )}

      {!loading && (
        <>
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
              {trend.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-[var(--text-muted)] text-sm">No data for this period</div>
              ) : (
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
              )}
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
              <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">Quality Results</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">Pass / Partial / Fail breakdown</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={qualityData} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value">
                      {qualityData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} formatter={(v: any) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {qualityData.map(d => (
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
              {eff.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-[var(--text-muted)] text-sm">No data for this period</div>
              ) : (
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
              )}
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
              <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">Production by Product</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">Boxes per product line (all time)</p>
              {productData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-[var(--text-muted)] text-sm">No product data yet</div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productData} layout="vertical" barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} horizontal={false} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={10} />
                      <YAxis type="category" dataKey="product" stroke="var(--text-muted)" fontSize={9} width={110} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                      <Bar dataKey="boxes" name="Boxes" fill="var(--accent)" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Output */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">Monthly Output</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">Boxes produced per month (last 6 months)</p>
            {monthlyOutput.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">No monthly data yet</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyOutput} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                    <Bar dataKey="actual" name="Boxes Produced" fill="var(--accent)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Production Summary Table */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-[var(--text-primary)] text-sm">Production Summary Table</h3>
              <button onClick={() => exportToCSV(summaryTable, ['product','batches','totalBoxes','totalSachets','passRate','avgPerBatch'], 'production_summary')}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            {summaryTable.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)] text-sm">No production records yet</div>
            ) : (
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
                    {summaryTable.map(row => (
                      <tr key={row.product} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{row.product}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row.batches}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--accent)]">{row.totalBoxes.toLocaleString()}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row.totalSachets.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.passRateNum >= 90 ? 'bg-emerald-500/10 text-emerald-600' : row.passRateNum >= 80 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'}`}>{row.passRate}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row.avgPerBatch} boxes</td>
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
