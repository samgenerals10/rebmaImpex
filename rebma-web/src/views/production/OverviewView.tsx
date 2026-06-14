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

const INITIAL_WIP: WipItem[] = [
  { id: 'WIP-001', productName: 'Refined Palm Oil', stage: 'Processing', qty: 250, updatedAt: '2026-05-25 09:00' },
  { id: 'WIP-002', productName: 'Polymer Granules (Grade A)', stage: 'Quality Check', qty: 1200, updatedAt: '2026-05-25 10:30' },
  { id: 'WIP-003', productName: 'Cocoa Butter Blocks', stage: 'Packaging', qty: 80, updatedAt: '2026-05-24 15:00' },
  { id: 'WIP-004', productName: 'Shea Butter Cream', stage: 'Awaiting Dispatch', qty: 340, updatedAt: '2026-05-24 17:00' },
];

const MOCK_OUTPUT: OutputRecord[] = [
  { id: '1', date: '2026-06-01', product: 'Shea Butter Sachet', received: 200, boxes: 40, sachets: 4000, quality: 'Pass', notes: '' },
  { id: '2', date: '2026-06-02', product: 'Palm Oil Pouch', received: 150, boxes: 30, sachets: 3000, quality: 'Pass', notes: '' },
  { id: '3', date: '2026-06-03', product: 'Coconut Oil', received: 180, boxes: 35, sachets: 3500, quality: 'Fail', notes: 'Sealing issue' },
  { id: '4', date: '2026-06-04', product: 'Groundnut Oil', received: 220, boxes: 44, sachets: 4400, quality: 'Pass', notes: '' },
  { id: '5', date: '2026-06-05', product: 'Shea Butter Sachet', received: 190, boxes: 38, sachets: 3800, quality: 'Pass', notes: '' },
  { id: '6', date: '2026-06-08', product: 'Cocoa Butter Pouch', received: 160, boxes: 32, sachets: 3200, quality: 'Pass', notes: '' },
];

const OUTPUT_CHART_DATA = [
  { day: 'Mon', boxes: 40, sachets: 4000 },
  { day: 'Tue', boxes: 30, sachets: 3000 },
  { day: 'Wed', boxes: 35, sachets: 3500 },
  { day: 'Thu', boxes: 44, sachets: 4400 },
  { day: 'Fri', boxes: 38, sachets: 3800 },
  { day: 'Sat', boxes: 32, sachets: 3200 },
  { day: 'Sun', boxes: 0, sachets: 0 },
];

const INPUT_OUTPUT_DATA = [
  { day: 'Mon', received: 200, produced: 40 },
  { day: 'Tue', received: 150, produced: 30 },
  { day: 'Wed', received: 180, produced: 35 },
  { day: 'Thu', received: 220, produced: 44 },
  { day: 'Fri', received: 190, produced: 38 },
  { day: 'Sat', received: 160, produced: 32 },
];

const SCHEDULE = [
  { product: 'Shea Butter Sachet 500g', qty: 500, required: '2026-06-20', priority: 'Urgent', status: 'Approved' },
  { product: 'Palm Oil Pouch 1L', qty: 300, required: '2026-06-22', priority: 'Normal', status: 'Pending' },
  { product: 'Margarine Block 250g', qty: 800, required: '2026-06-25', priority: 'Critical', status: 'Approved' },
];

const QUALITY_DATA = [
  { name: 'Passed', value: 5, color: '#10b981' },
  { name: 'Partial', value: 1, color: '#f59e0b' },
  { name: 'Failed', value: 1, color: '#ef4444' },
];

function MiniBar({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8 w-16 shrink-0">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm bg-[var(--accent)] opacity-60"
          style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
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
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = currentUser?.fullName?.split(' ')[0] || 'Supervisor';

  const [output, setOutput] = useState<OutputRecord[]>(MOCK_OUTPUT);
  const [wip] = useState<WipItem[]>(INITIAL_WIP);
  const [orderMenu, setOrderMenu] = useState<string | null>(null);
  const [kpiMenu, setKpiMenu] = useState<number | null>(null);
  const [outputTab, setOutputTab] = useState<'boxes' | 'sachets' | 'both'>('both');
  const [outputPeriod, setOutputPeriod] = useState('Week');

  useEffect(() => {
    supabase.from('production_output').select('*').order('date', { ascending: false }).then(({ data }) => {
      if (data && data.length > 0) setOutput(data as OutputRecord[]);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayOutput = output.filter(r => r.date === today);
  const todayBoxes = todayOutput.reduce((s, r) => s + r.boxes, 0);
  const todaySachets = todayOutput.reduce((s, r) => s + r.sachets, 0);
  const passRate = output.length ? Math.round((output.filter(r => r.quality === 'Pass').length / output.length) * 100) : 0;
  const ordersToday = productionRequests.filter(r => r.createdAt?.startsWith(today)).length;

  const kpiCards = [
    { label: 'Orders Received Today', value: ordersToday || productionRequests.filter(r => r.status === 'APPROVED').length, sub: 'approved requests', spark: [2,3,4,2,5,3,ordersToday||4], trend: 'up', tab: 'InternalOrders' },
    { label: 'Boxes Produced Today', value: todayBoxes || 44, sub: 'vs 38 yesterday', spark: [30,35,40,44,38,42,todayBoxes||44], trend: 'up', tab: 'OutputRecording' },
    { label: 'Sachets Today', value: (todaySachets || 4400).toLocaleString(), sub: 'vs 3800 yesterday', spark: [3000,3500,4000,4400,3800,4200,todaySachets||4400], trend: 'up', tab: 'OutputRecording' },
    { label: 'Quality Pass Rate', value: `${passRate || 85}%`, sub: passRate >= 90 ? 'Excellent' : passRate >= 70 ? 'Good' : 'Needs review', spark: [80,85,82,90,88,85,passRate||85], trend: passRate >= 85 ? 'up' : 'down', tab: 'OutputRecording', color: passRate >= 90 ? '#10b981' : passRate >= 70 ? '#f59e0b' : '#ef4444' },
  ];

  const chartData = outputTab === 'boxes' ? OUTPUT_CHART_DATA.map(d => ({ ...d, value: d.boxes }))
    : outputTab === 'sachets' ? OUTPUT_CHART_DATA.map(d => ({ ...d, value: d.sachets }))
    : OUTPUT_CHART_DATA;

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
          <button onClick={() => window.print()}
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
          <button key={card.label} onClick={() => setActiveSubTab(card.tab)}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 text-left hover:shadow-md transition-shadow cursor-pointer w-full relative group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide leading-tight">{card.label}</p>
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
                <p className="text-3xl font-bold leading-none" style={{ color: (card as any).color || 'var(--text-primary)' }}>{card.value}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  {card.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                  <p className="text-[10px] text-[var(--text-muted)]">{card.sub}</p>
                </div>
              </div>
              <MiniBar data={card.spark.map(Number)} />
            </div>
          </button>
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
              <select value={outputPeriod} onChange={e => setOutputPeriod(e.target.value)}
                className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2 py-1 text-[10px] text-[var(--text-secondary)] outline-none cursor-pointer">
                {['Today', 'Week', 'Month', 'Quarter'].map(p => <option key={p}>{p}</option>)}
              </select>
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
              <BarChart data={outputTab === 'both' ? OUTPUT_CHART_DATA : chartData} barSize={18}>
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
              <p className="text-2xl font-bold text-emerald-600 mt-1">1,100</p>
              <p className="text-[10px] text-[var(--text-muted)]">units from Operations</p>
            </div>
            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Goods Produced</p>
              <p className="text-2xl font-bold text-[var(--accent)] mt-1">219</p>
              <p className="text-[10px] text-[var(--text-muted)]">boxes this week</p>
            </div>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={INPUT_OUTPUT_DATA} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={9} />
                <YAxis stroke="var(--text-muted)" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Bar dataKey="received" name="Received" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="produced" name="Produced" fill="var(--accent)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Efficiency: <strong className="text-emerald-600">~20%</strong> (boxes per raw unit)</p>
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
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusBadge(order.status)}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
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
                  <Pie data={QUALITY_DATA} cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} dataKey="value">
                    {QUALITY_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="text-center mb-2">
                <p className="text-3xl font-bold text-emerald-600">{passRate || 85}%</p>
                <p className="text-[10px] text-[var(--text-muted)]">Pass Rate</p>
              </div>
              {QUALITY_DATA.map(d => (
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
            {SCHEDULE.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{s.product}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Qty: {s.qty} · Due: {s.required}</p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${priorityBadge(s.priority)}`}>{s.priority}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge(s.status === 'Approved' ? 'APPROVED' : 'PENDING_MANAGEMENT')}`}>{s.status}</span>
              </div>
            ))}
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
          <button onClick={() => exportToCSV(OUTPUT_CHART_DATA, ['day','boxes','sachets'], 'production_volume')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={OUTPUT_CHART_DATA} barSize={22}>
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
