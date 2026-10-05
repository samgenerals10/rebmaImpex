import React, { useState, useEffect } from 'react';
import { Download, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';
import CountUp from '../../components/CountUp';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

import DateRangeField from '../../components/ui/DateRangeField';
import type { CalendarValue } from '../../components/ui/CalendarPicker';
import { lastNDays, inRange, rangeLabel, trendBuckets, bucketKeyFor } from '../../utils/dateRange';

interface OutputRecord { date: string; product: string; boxes: number; sachets: number; quality: string; received: number; }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// production_logs.date is a plain 'YYYY-MM-DD'; read it at midday so it
// never slips to the previous day in any time zone.
const asDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d);

// Calendar range (Part C): one bar per day for short ranges, per month for
// long ones.
function buildOutputTrend(records: OutputRecord[], range: CalendarValue) {
  const { granularity, buckets } = trendBuckets(range);
  const totals: Record<string, { boxes: number; sachets: number }> = {};
  records.filter(r => inRange(r.date, range)).forEach(r => {
    const k = bucketKeyFor(asDate(r.date), granularity);
    if (!totals[k]) totals[k] = { boxes: 0, sachets: 0 };
    totals[k].boxes += r.boxes; totals[k].sachets += r.sachets;
  });
  return buckets.map(b => ({ label: b.label, boxes: totals[b.key]?.boxes || 0, sachets: totals[b.key]?.sachets || 0 }));
}

// Input (goods_received) and output (boxes_produced) both come from the
// same production_logs row — this ties them to the actual production run
// instead of a company-wide stock_ledger tally that has no guaranteed
// relationship to what a specific batch consumed.
function buildEfficiency(output: OutputRecord[], range: CalendarValue) {
  const { granularity, buckets } = trendBuckets(range);
  const outBy: Record<string, number> = {};
  const inBy: Record<string, number> = {};
  output.filter(r => inRange(r.date, range)).forEach(r => {
    const k = bucketKeyFor(asDate(r.date), granularity);
    outBy[k] = (outBy[k] || 0) + r.boxes;
    inBy[k] = (inBy[k] || 0) + r.received;
  });
  return buckets.map(b => ({
    label: b.label, input: inBy[b.key] || 0, output: outBy[b.key] || 0,
    efficiency: (inBy[b.key] || 0) > 0 ? +(((outBy[b.key] || 0) / inBy[b.key]) * 100).toFixed(1) : 0,
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
      passRate: v.total > 0 ? `${Math.round((v.pass / v.total) * 100)}%` : 'Not set',
      passRateNum: v.total > 0 ? Math.round((v.pass / v.total) * 100) : 0,
      avgPerBatch: v.dates.size > 0 ? Math.round(v.boxes / v.dates.size) : 0,
    }))
    .sort((a, b) => b.totalBoxes - a.totalBoxes)
    .slice(0, 10);
}

interface Props { addNotification: (msg: string) => void; }

export default function ProductionAnalyticsView({ addNotification }: Props) {
  // Calendar range instead of 7D / 30D / 90D / 12M (Part C); starts on the
  // last 7 days, the old default.
  const [range, setRange] = useState<CalendarValue>(() => lastNDays(7));
  const [outputRecords, setOutputRecords] = useState<OutputRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Bounded to exactly the chosen dates, not a flat row cap, so a busy
  // production line never has rows silently cut off.
  const fetchData = () => {
    setLoading(true);
    let q = supabase.from('production_logs')
      .select('date, product_name, boxes_produced, total_sachets, quality_result, goods_received');
    if (range.start) q = q.gte('date', range.start);
    if (range.end) q = q.lte('date', range.end);
    q
      .order('date', { ascending: false })
      .limit(5000)
      .then(({ data }) => {
        if (data) {
          setOutputRecords(data.map((row: any) => ({
            date: row.date || '',
            product: row.product_name || '',
            boxes: Number(row.boxes_produced || 0),
            sachets: Number(row.total_sachets || 0),
            quality: row.quality_result || 'Pass',
            received: Number(row.goods_received || 0),
          })));
        }
        setLoading(false);
      }, () => { setLoading(false); });
  };

  useEffect(() => { fetchData(); }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const trend = buildOutputTrend(outputRecords, range);
  const eff = buildEfficiency(outputRecords, range);
  const qualityData = buildQualityData(outputRecords);
  const productData = buildProductData(outputRecords);
  const monthlyOutput = buildMonthlyOutput(outputRecords);
  const summaryTable = buildSummaryTable(outputRecords);

  const totalBoxes = trend.reduce((s, d) => s + d.boxes, 0);
  const totalSachets = trend.reduce((s, d) => s + d.sachets, 0);
  const effRows = eff.filter(d => d.efficiency > 0);
  const avgEff = effRows.length > 0 ? effRows.reduce((s, d) => s + d.efficiency, 0) / effRows.length : 0;
  const qualityPassRow = qualityData.find(d => d.name === 'Passed');

  const kpis = [
    { label: 'Boxes Produced', value: totalBoxes, suffix: '', decimals: 0, trend: 'neutral', sub: rangeLabel(range) },
    { label: 'Sachets Produced', value: totalSachets, suffix: '', decimals: 0, trend: 'neutral', sub: rangeLabel(range) },
    { label: 'Quality Pass Rate', value: qualityPassRow ? qualityPassRow.value : null, suffix: '%', decimals: 0, trend: 'neutral', sub: 'pass / partial / fail' },
    { label: 'Avg Efficiency', value: avgEff > 0 ? avgEff : null, suffix: '%', decimals: 1, trend: 'neutral', sub: 'input to output ratio' },
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
          <DateRangeField value={range} onChange={setRange} align="right" />
          <button onClick={fetchData} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => exportToCSV(trend, ['label','boxes','sachets'], `production_analytics_${range.start}_to_${range.end}`)}
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
                <p className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-wide">{k.label}</p>
                <p className="text-3xl font-bold text-[var(--text-primary)] mt-1"><CountUp value={k.value} suffix={k.suffix} decimals={k.decimals} /></p>
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
            <div className="p-3">
              <ResponsiveDataView<typeof summaryTable[number]>
                columns={[
                  { key: 'product', label: 'Product', primary: true },
                  { key: 'batches', label: 'Batches' },
                  { key: 'totalBoxes', label: 'Total Boxes', render: row => <span className="font-semibold text-[var(--accent)]">{row.totalBoxes.toLocaleString()}</span> },
                  { key: 'totalSachets', label: 'Total Sachets', render: row => row.totalSachets.toLocaleString() },
                  {
                    key: 'passRate', label: 'Pass Rate', status: true, render: row => (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.passRateNum >= 90 ? 'bg-emerald-500/10 text-emerald-600' : row.passRateNum >= 80 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'}`}>{row.passRate}</span>
                    )
                  },
                  { key: 'avgPerBatch', label: 'Avg/Batch', render: row => `${row.avgPerBatch} boxes` },
                ]}
                data={summaryTable}
                rowKey={row => row.product}
                emptyTitle="No production records yet"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
