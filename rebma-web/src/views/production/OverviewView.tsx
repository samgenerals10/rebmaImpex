import React, { useState, useEffect } from 'react';
import {
  ClipboardList, PackageCheck, Layers, Factory, BarChart2, AlertTriangle,
  MoreVertical, TrendingUp, TrendingDown, ChevronRight, Plus, Download, Printer
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import CountUp from '../../components/CountUp';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import type { ProductionRequest, CurrentUser } from '../../types/erp';

interface OutputRecord {
  id: string; date: string; product: string;
  received: number; boxes: number; sachets: number;
  quality: string; notes: string;
}

interface WipItem { id: string; productName: string; stage: string; qty: number; updatedAt: string; }

interface Props {
  currentUser: CurrentUser | null;
  productionRequests: ProductionRequest[];
  addNotification: (msg: string) => void;
  setActiveSubTab: (tab: string) => void;
}


const ORDERED_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MiniLine({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const w = 64, h = 32, pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" viewBox={`0 0 ${w} ${h}`}>
      {data.length > 1 && (
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const statusBadge = (status: string) => {
  const m: Record<string, string> = {
    'PENDING_MANAGEMENT': 'bg-amber-500/10 text-amber-600',
    'APPROVED': 'bg-blue-500/10 text-blue-600',
    'TICKETS_ISSUED': 'bg-indigo-500/10 text-indigo-600',
    'COMPLETED': 'bg-emerald-500/10 text-emerald-600',
  };
  return m[status] || 'bg-slate-500/10 text-slate-500';
};

const getDisplayStatus = (order: any, wipList: any[]) => {
  if (order.status === 'COMPLETED' || order.status === 'REJECTED') {
    return { text: order.status.replace(/_/g, ' '), style: statusBadge(order.status) };
  }
  const productName = order.items?.[0]?.materialName;
  if (productName) {
    const match = wipList.find(w => w.productName.toLowerCase().trim() === productName.toLowerCase().trim());
    if (match) {
      return { text: match.stage, style: stageBadge(match.stage) };
    }
  }
  return { text: order.status.replace(/_/g, ' '), style: statusBadge(order.status) };
};

const stageBadge = (stage: string) => {
  const m: Record<string, string> = {
    'Processing': 'bg-blue-500/10 text-blue-600',
    'Quality Check': 'bg-amber-500/10 text-amber-600',
    'Packaging': 'bg-orange-500/10 text-orange-600',
    'Awaiting Dispatch': 'bg-emerald-500/10 text-emerald-600',
  };
  return m[stage] || 'bg-slate-500/10 text-slate-500';
};

const priorityBadge = (p: string) => {
  if (p === 'Critical') return 'bg-rose-500/10 text-rose-600';
  if (p === 'Urgent') return 'bg-amber-500/10 text-amber-600';
  return 'bg-slate-500/10 text-slate-500';
};

export default function ProductionOverviewView({ currentUser, productionRequests, addNotification, setActiveSubTab }: Props) {
  const { getSetting } = useCeoSettings();
  const handlePrint = () => {
    if (!getSetting('print_enabled', true)) { addNotification('Printing is currently disabled by the CEO.'); return; }
    window.print();
  };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = currentUser?.fullName?.split(' ')[0] || 'Supervisor';

  const [output, setOutput] = useState<OutputRecord[]>([]);
  const [wip, setWip] = useState<WipItem[]>([]);
  const [goodsReceived, setGoodsReceived] = useState(0);
  const [receivedByDay, setReceivedByDay] = useState<Record<string, number>>({});
  const [orderMenu, setOrderMenu] = useState<string | null>(null);
  const [kpiMenu, setKpiMenu] = useState<number | null>(null);
  const [outputTab, setOutputTab] = useState<'boxes' | 'sachets' | 'both'>('both');
  const [outputPeriod, setOutputPeriod] = useState('Week');

  useEffect(() => {
    supabase.from('production_logs').select('*').order('date', { ascending: false }).then(({ data }) => {
      if (data) {
        setOutput(data.map((row: any) => ({
          id: row.id,
          date: row.date || '',
          product: row.product_name || '',
          received: Number(row.goods_received || 0),
          boxes: Number(row.boxes_produced || 0),
          sachets: Number(row.total_sachets || 0),
          quality: row.quality_result || 'Pass',
          notes: row.notes || '',
        })));
      } else {
        setOutput([]);
      }
    });
    supabase.from('wip_stock').select('*').order('updated_at', { ascending: false }).then(({ data }) => {
      if (data) {
        setWip(data.map((row: any) => ({
          id: row.id,
          productName: row.product_name,
          stage: row.stage,
          qty: Number(row.qty || 0),
          updatedAt: row.updated_at
        })));
      } else {
        setWip([]);
      }
    });
  }, []);

  // Goods received per production run — same production_logs rows as
  // "boxes produced", instead of a company-wide stock_ledger tally that
  // has no guaranteed relationship to what a specific batch consumed.
  useEffect(() => {
    setGoodsReceived(output.reduce((s, r) => s + r.received, 0));
    const byDay: Record<string, number> = {};
    ORDERED_DAYS.forEach(d => { byDay[d] = 0; });
    output.forEach(r => {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
        if (dayName in byDay) byDay[dayName] += r.received;
      }
    });
    setReceivedByDay(byDay);
  }, [output]);

  const today = new Date().toISOString().slice(0, 10);
  const todayOutput = output.filter(r => r.date === today);
  const todayBoxes = todayOutput.reduce((s, r) => s + r.boxes, 0);
  const todaySachets = todayOutput.reduce((s, r) => s + r.sachets, 0);
  const passRate = output.length ? Math.round((output.filter(r => r.quality === 'Pass').length / output.length) * 100) : 0;
  const ordersToday = productionRequests.filter(r => r.createdAt?.startsWith(today)).length;

  // Build output chart data from last 7 records in production_output
  const outputChartData = (() => {
    const byDay: Record<string, { boxes: number; sachets: number }> = {};
    ORDERED_DAYS.forEach(d => { byDay[d] = { boxes: 0, sachets: 0 }; });
    output.forEach(r => {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
        if (byDay[dayName]) {
          byDay[dayName].boxes += r.boxes;
          byDay[dayName].sachets += r.sachets;
        }
      }
    });
    return ORDERED_DAYS.map(d => ({ day: d, boxes: byDay[d].boxes, sachets: byDay[d].sachets }));
  })();

  // Derive quality data from production_output quality field
  const qualityData = (() => {
    const passed = output.filter(r => r.quality === 'Pass').length;
    const partial = output.filter(r => r.quality === 'Partial').length;
    const failed = output.filter(r => r.quality === 'Fail' || r.quality === 'Failed').length;
    if (passed + partial + failed === 0) return [
      { name: 'No Data', value: 1, color: 'var(--border)' },
    ];
    return [
      { name: 'Passed', value: passed, color: '#10b981' },
      { name: 'Partial', value: partial, color: '#f59e0b' },
      { name: 'Failed', value: failed, color: '#ef4444' },
    ].filter(d => d.value > 0);
  })();

  // Input vs output by day of week — received from real stock_ledger ADD movements
  const inputOutputData = outputChartData.map(d => ({
    day: d.day,
    received: receivedByDay[d.day] ?? 0,
    produced: d.boxes,
  })).filter(d => d.produced > 0 || d.received > 0).slice(0, 6);

  const weekBoxes = output.reduce((s, r) => s + r.boxes, 0);

  const kpiCards = [
    { label: 'Orders Received Today', value: ordersToday || productionRequests.filter(r => r.status === 'APPROVED').length, suffix: '', sub: 'approved requests', spark: [2,3,4,2,5,3,ordersToday||0], trend: 'up', tab: 'InternalOrders' },
    { label: 'Boxes Produced Today', value: todayBoxes, suffix: '', sub: 'boxes logged today', spark: outputChartData.map(d => d.boxes), trend: 'up', tab: 'OutputRecording' },
    { label: 'Sachets Today', value: todaySachets, suffix: '', sub: 'sachets logged today', spark: outputChartData.map(d => d.sachets), trend: 'up', tab: 'OutputRecording' },
    { label: 'Quality Pass Rate', value: passRate, suffix: '%', sub: passRate >= 90 ? 'Excellent' : passRate >= 70 ? 'Good' : output.length === 0 ? 'No data yet' : 'Needs review', spark: [passRate, passRate, passRate, passRate, passRate, passRate, passRate], trend: passRate >= 85 ? 'up' : 'down', tab: 'OutputRecording', color: passRate >= 90 ? '#10b981' : passRate >= 70 ? '#f59e0b' : '#ef4444' },
  ];

  const chartData = outputTab === 'boxes' ? outputChartData.map(d => ({ ...d, value: d.boxes }))
    : outputTab === 'sachets' ? outputChartData.map(d => ({ ...d, value: d.sachets }))
    : outputChartData;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* Greeting */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{greeting}, {name} 👋</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Here's your production overview today.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportToCSV(output, ['date','product','boxes','sachets','quality'], 'production_today')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--accent-light)] cursor-pointer transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--accent-light)] cursor-pointer transition-colors">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'New Internal Order', icon: ClipboardList, tab: 'InternalOrders' },
          { label: 'Record Output', icon: PackageCheck, tab: 'OutputRecording' },
          { label: 'WIP Stock', icon: Layers, tab: 'WIPStock' },
          { label: 'Production History', icon: Factory, tab: 'OrdersHistory' },
          { label: 'Analytics', icon: BarChart2, tab: 'ProdAnalytics' },
          { label: 'Report Issue', icon: AlertTriangle, tab: 'OutputRecording' },
        ].map(qa => (
          <button key={qa.label} onClick={() => setActiveSubTab(qa.tab)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-full hover:bg-[var(--accent-light)] hover:text-[var(--accent)] hover:border-[var(--accent)] cursor-pointer transition-all">
            <qa.icon className="w-3.5 h-3.5" />
            {qa.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <div key={card.label} role="button" tabIndex={0}
            onClick={() => setActiveSubTab(card.tab)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSubTab(card.tab); } }}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 text-left hover:shadow-md transition-shadow cursor-pointer w-full relative group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wide leading-tight">{card.label}</p>
              <div className="relative" onClick={e => { e.stopPropagation(); setKpiMenu(kpiMenu === idx ? null : idx); }}>
                <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--accent-light)] cursor-pointer transition-opacity">
                  <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
                {kpiMenu === idx && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1">
                    <button onClick={() => { setActiveSubTab(card.tab); setKpiMenu(null); }} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">View Details</button>
                    <button onClick={() => { exportToCSV(output, ['date','product','boxes','sachets'], card.label); setKpiMenu(null); }} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">Export CSV</button>
                    <button onClick={() => setKpiMenu(null)} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">Refresh</button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-3xl font-bold leading-none" style={{ color: (card as any).color || 'var(--text-primary)' }}><CountUp value={card.value} suffix={card.suffix} /></p>
                <div className="flex items-center gap-1 mt-1.5">
                  {card.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                  <p className="text-[10px] text-[var(--text-secondary)]">{card.sub}</p>
                </div>
              </div>
              <MiniLine data={card.spark.map(Number)} />
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Output Chart + Input vs Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Production Output Chart */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-sm">Production Output</h3>
              <p className="text-xs text-[var(--text-muted)]">Daily production volumes</p>
            </div>
            <div className="flex items-center gap-2">
              <SearchableDropdown
                value={outputPeriod}
                onChange={setOutputPeriod}
                className="min-w-[110px] text-[10px]"
                options={['Today', 'Week', 'Month', 'Quarter'].map(p => ({ value: p, label: p }))}
              />
              <div className="flex bg-[var(--bg-input)] rounded-lg border border-[var(--border)] p-0.5">
                {(['boxes', 'sachets', 'both'] as const).map(tab => (
                  <button key={tab} onClick={() => setOutputTab(tab)}
                    className={`px-2 py-1 text-[10px] font-semibold rounded cursor-pointer transition-all capitalize ${outputTab === tab ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'}`}>
                    {tab === 'both' ? 'Both' : tab}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outputTab === 'both' ? outputChartData : chartData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                {(outputTab === 'boxes' || outputTab === 'both') && <Bar dataKey="boxes" name="Boxes" fill="#10b981" radius={[3,3,0,0]} />}
                {(outputTab === 'sachets' || outputTab === 'both') && <Bar dataKey="sachets" name="Sachets" fill="var(--accent)" radius={[3,3,0,0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Input vs Output */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-sm">Input vs Output</h3>
              <p className="text-xs text-[var(--text-muted)]">Goods received vs boxes produced</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Goods Received</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1"><CountUp value={goodsReceived} /></p>
              <p className="text-[10px] text-[var(--text-muted)]">units from stock ledger</p>
            </div>
            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Goods Produced</p>
              <p className="text-2xl font-bold text-[var(--accent)] mt-1"><CountUp value={weekBoxes} /></p>
              <p className="text-[10px] text-[var(--text-muted)]">boxes recorded</p>
            </div>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inputOutputData.length > 0 ? inputOutputData : outputChartData.map(d => ({ day: d.day, received: 0, produced: d.boxes }))} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={9} />
                <YAxis stroke="var(--text-muted)" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Bar dataKey="received" name="Received" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="produced" name="Produced" fill="var(--accent)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Efficiency: <strong className="text-emerald-600">{goodsReceived > 0 ? `${((weekBoxes / goodsReceived) * 100).toFixed(1)}%` : weekBoxes > 0 ? '100%' : '—'}</strong> (boxes per raw unit)</p>
        </div>
      </div>

      {/* Row 3: Internal Orders + WIP Stock Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Internal Orders */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Internal Orders</h3>
            <button onClick={() => setActiveSubTab('InternalOrders')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {productionRequests.slice(0, 6).map(order => (
              <div key={order.id} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
                  {order.id.slice(-2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{order.id}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{order.items.map(i => i.materialName).join(', ')}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(() => {
                    const disp = getDisplayStatus(order, wip);
                    return (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${disp.style}`}>
                        {disp.text}
                      </span>
                    );
                  })()}
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setOrderMenu(orderMenu === order.id ? null : order.id)}
                      className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] rounded cursor-pointer">
                      <MoreVertical className="w-3 h-3" />
                    </button>
                    {orderMenu === order.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1">
                        <button onClick={() => { setActiveSubTab('InternalOrders'); setOrderMenu(null); }} className="flex w-full px-2 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded cursor-pointer">View Details</button>
                        <button onClick={() => { setActiveSubTab('InternalOrders'); setOrderMenu(null); }} className="flex w-full px-2 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded cursor-pointer">Track Status</button>
                        {order.status === 'PENDING_MANAGEMENT' && (
                          <button onClick={() => { addNotification(`${order.id} cancelled`); setOrderMenu(null); }} className="flex w-full px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer">Cancel</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {productionRequests.length === 0 && (
              <div className="text-center text-[var(--text-muted)] text-xs py-8">No orders yet</div>
            )}
          </div>
          <button onClick={() => setActiveSubTab('InternalOrders')}
            className="w-full mt-3 py-2 flex items-center justify-center gap-1.5 border border-[var(--border)] rounded-xl text-xs text-[var(--accent)] font-semibold cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Order
          </button>
        </div>

        {/* WIP Stock Levels */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">WIP Stock Levels</h3>
            <button onClick={() => setActiveSubTab('WIPStock')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              Full Inventory <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {wip.map(item => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)] truncate flex-1 mr-2">{item.productName}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${stageBadge(item.stage)}`}>{item.stage}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                    <div className="h-2 rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.min((item.qty / 1500) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0 font-mono">{item.qty.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setActiveSubTab('WIPStock')}
            className="w-full mt-4 py-2 flex items-center justify-center gap-1.5 border border-[var(--border)] rounded-xl text-xs text-[var(--accent)] font-semibold cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add WIP Item
          </button>
        </div>
      </div>

      {/* Row 4: Quality Check + Production Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quality Results Donut */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Quality Results</h3>
          <div className="flex items-center gap-6">
            <div className="h-44 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={qualityData} cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} dataKey="value">
                    {qualityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="text-center mb-2">
                <p className="text-3xl font-bold text-emerald-600"><CountUp value={passRate} suffix="%" /></p>
                <p className="text-[10px] text-[var(--text-muted)]">Pass Rate</p>
              </div>
              {qualityData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-[10px] text-[var(--text-muted)]">{d.name}</span>
                  <span className="text-[10px] font-bold text-[var(--text-primary)] ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Production Schedule */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Production Schedule</h3>
            <button onClick={() => setActiveSubTab('InternalOrders')} className="text-xs text-[var(--accent)] font-semibold cursor-pointer flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {productionRequests.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{r.items.map(i => i.materialName).join(', ') || r.id}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">ID: {r.id} · {r.createdAt?.slice(0, 10) || ''}</p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${priorityBadge('Normal')}`}>Normal</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge(r.status)}`}>{r.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {productionRequests.length === 0 && (
              <p className="text-center text-[var(--text-muted)] text-xs py-4">No production requests yet</p>
            )}
          </div>
          <button onClick={() => setActiveSubTab('InternalOrders')}
            className="w-full mt-3 py-2 flex items-center justify-center gap-1.5 border border-[var(--border)] rounded-xl text-xs text-[var(--accent)] font-semibold cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Schedule Production
          </button>
        </div>
      </div>

      {/* Row 5: Full-width Production Volume Chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Production Volume — Weekly</h3>
            <p className="text-xs text-[var(--text-muted)]">Boxes and sachets produced per day</p>
          </div>
          <button onClick={() => exportToCSV(outputChartData, ['day','boxes','sachets'], 'production_volume')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={outputChartData} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="boxes" name="Boxes" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="sachets" name="Sachets" fill="var(--accent)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {orderMenu && <div className="fixed inset-0 z-20" onClick={() => setOrderMenu(null)} />}
      {kpiMenu !== null && <div className="fixed inset-0 z-20" onClick={() => setKpiMenu(null)} />}
    </div>
  );
}
