import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertTriangle,
  Package, CreditCard, DollarSign, Activity, Users, BarChart2,
  ArrowRight, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts';

interface Props {
  addNotification?: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function MgmtOverviewView({ addNotification, setActiveSubTab, currentUser }: Props) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cargoIntake, setCargoIntake] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  
  const [cashflowTab, setCashflowTab] = useState<'income' | 'expense' | 'savings'>('income');
  const [earnPeriod, setEarnPeriod] = useState('6M');
  const [activities, setActivities] = useState<any[]>([]);
  const feedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const firstName = currentUser?.fullName?.split(' ')[0] || 'Manager';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: ords },
        { data: txns },
        { data: cargo },
        { data: depts },
        { data: profs }
      ] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('cargo_intake').select('*'),
        supabase.from('departments').select('*'),
        supabase.from('profiles').select('*')
      ]);

      setOrders(ords || []);
      setTransactions(txns || []);
      setCargoIntake(cargo || []);
      setDepartments(depts || []);
      setProfiles(profs || []);
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    refreshFeed();
    feedRef.current = setInterval(refreshFeed, 30000);
    return () => { if (feedRef.current) clearInterval(feedRef.current); };
  }, []);

  async function refreshFeed() {
    try {
      const { data } = await supabase
        .from('global_audit_history')
        .select('*')
        .neq('department', 'CEO')
        .order('timestamp', { ascending: false })
        .limit(6);
      if (data && data.length > 0) {
        setActivities(data.map((row: any) => ({
          dept: String(row.department || ''),
          action: String(row.action || ''),
          time: timeAgo(String(row.timestamp || '')),
          icon: Activity,
          color: 'var(--accent)',
        })));
      }
    } catch (_) {}
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    return `${Math.floor(h / 24)} days ago`;
  }

  // Monthly Revenue
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = orders
    .filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && ['APPROVED', 'PROCESSING', 'DELIVERED'].includes(o.status);
    })
    .reduce((s, o) => s + Number(o.total_amount), 0);

  // Pending count across all categories
  const pendingOrders = orders.filter(o => o.status === 'PENDING_MANAGEMENT');
  const pendingCargo = cargoIntake.filter(c => c.status === 'PENDING_APPROVAL');
  const pendingProfiles = profiles.filter(p => p.status === 'PENDING_APPROVAL');
  const pendingCount = pendingOrders.length + pendingCargo.length + pendingProfiles.length;

  const pendingApprovalsList = [
    ...pendingOrders.map(o => ({
      id: o.id,
      type: 'Credit Order',
      desc: `Credit terms request for ${o.client_name}`,
      priority: 'High',
      amount: Number(o.total_amount)
    })),
    ...pendingCargo.map(c => ({
      id: c.id,
      type: 'Cargo Intake',
      desc: `Intake of ${c.product_name} from ${c.company}`,
      priority: 'High',
      amount: Number(c.unit_price || 0) * (c.quantity || 0)
    })),
    ...pendingProfiles.map(p => ({
      id: p.id,
      type: 'Staff Reg',
      desc: `${p.full_name} signup approval`,
      priority: 'Medium',
      amount: null
    }))
  ].slice(0, 4);

  // Avg profit score
  const avgDeptScore = departments.length > 0 
    ? Math.round(departments.reduce((sum, d) => sum + (d.performance_score || 0), 0) / departments.length)
    : 87;

  // Earning Overview
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      monthKey: `${d.getFullYear()}-${d.getMonth()}`,
      monthName: MONTHS[d.getMonth()],
      value: 0
    };
  });
  orders.forEach(o => {
    if (['APPROVED', 'PROCESSING', 'DELIVERED'].includes(o.status)) {
      const oDate = new Date(o.created_at);
      const key = `${oDate.getFullYear()}-${oDate.getMonth()}`;
      const item = last6Months.find(m => m.monthKey === key);
      if (item) {
        item.value += Number(o.total_amount);
      }
    }
  });
  const earningData = last6Months.map(item => ({ month: item.monthName, value: item.value }));

  // Spending Breakdown
  const spendingData = last6Months.map(item => {
    const monthTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return `${d.getFullYear()}-${d.getMonth()}` === item.monthKey && t.type === 'out';
    });
    const logistics = monthTxns.filter(t => t.department === 'LOGISTICS').reduce((sum, t) => sum + Number(t.amount), 0);
    const operations = monthTxns.filter(t => t.department === 'OPERATIONS').reduce((sum, t) => sum + Number(t.amount), 0);
    const payroll = monthTxns.filter(t => ['HR', 'PAYROLL'].includes(t.department)).reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      month: item.monthName,
      logistics,
      operations,
      payroll
    };
  });

  // Cash Flow
  const cashflowData = last6Months.map(item => {
    const monthTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return `${d.getFullYear()}-${d.getMonth()}` === item.monthKey;
    });
    const income = monthTxns.filter(t => t.type === 'in').reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = monthTxns.filter(t => t.type === 'out').reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      month: item.monthName,
      income,
      expense
    };
  });

  // YoY
  const currentYearYoY = new Date().getFullYear();
  const lastYearYoY = currentYearYoY - 1;
  const yoyData = MONTHS.map((mName, mIdx) => {
    const thisYearVal = orders
      .filter(o => {
        const d = new Date(o.created_at);
        return d.getMonth() === mIdx && d.getFullYear() === currentYearYoY && ['APPROVED', 'PROCESSING', 'DELIVERED'].includes(o.status);
      })
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const lastYearVal = orders
      .filter(o => {
        const d = new Date(o.created_at);
        return d.getMonth() === mIdx && d.getFullYear() === lastYearYoY && ['APPROVED', 'PROCESSING', 'DELIVERED'].includes(o.status);
      })
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    return {
      month: mName,
      thisYear: thisYearVal,
      lastYear: lastYearVal
    };
  });

  // Stock मूवमेंट
  const last5Months = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (4 - i));
    return {
      monthKey: `${d.getFullYear()}-${d.getMonth()}`,
      monthName: MONTHS[d.getMonth()],
      in: 0,
      out: 0
    };
  });
  cargoIntake.forEach(c => {
    if (c.status === 'APPROVED') {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const item = last5Months.find(m => m.monthKey === key);
      if (item) {
        item.in += c.quantity || 0;
      }
    }
  });
  orders.forEach(o => {
    if (['APPROVED', 'PROCESSING', 'DELIVERED'].includes(o.status)) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const item = last5Months.find(m => m.monthKey === key);
      if (item) {
        item.out += o.quantity || 1;
      }
    }
  });
  const stockData = last5Months.map(item => ({
    month: item.monthName,
    in: item.in,
    out: item.out
  }));

  // Low Stock Alert
  const productQuantities: Record<string, { sku: string; current: number; capacity: number }> = {};
  cargoIntake.forEach(c => {
    const name = c.product_name || 'Generic Goods';
    if (!productQuantities[name]) {
      productQuantities[name] = { sku: c.goods_code || 'SKU-TEMP', current: 0, capacity: 500 };
    }
    productQuantities[name].current += c.quantity || 0;
  });
  const lowStock = Object.entries(productQuantities)
    .map(([name, item]) => ({
      name,
      sku: item.sku,
      current: item.current,
      capacity: item.capacity
    }))
    .filter(item => item.current < 100)
    .slice(0, 4);

  // Recent Txn
  const recentTxn = transactions.slice(0, 4).map((t: any) => ({
    id: t.id,
    description: t.description,
    type: t.type === 'in' ? 'Credit' : 'Debit',
    amount: Number(t.amount),
    date: t.date,
    status: t.status === 'completed' ? 'Completed' : 'Pending'
  }));

  // Approval Pie
  let appCount = 0;
  let penCount = 0;
  let rejCount = 0;
  orders.forEach(o => {
    if (['APPROVED', 'PROCESSING', 'DELIVERED'].includes(o.status)) appCount++;
    else if (o.status.startsWith('PENDING')) penCount++;
    else if (o.status === 'REJECTED') rejCount++;
  });
  cargoIntake.forEach(c => {
    if (c.status === 'APPROVED') appCount++;
    else if (c.status === 'PENDING_APPROVAL') penCount++;
    else if (c.status === 'REJECTED') rejCount++;
  });
  const totalApprovalsCountForPie = appCount + penCount + rejCount || 1;
  const approvalPie = [
    { name: 'Approved', value: Math.round((appCount / totalApprovalsCountForPie) * 100), color: '#10b981' },
    { name: 'Pending', value: Math.round((penCount / totalApprovalsCountForPie) * 100), color: '#f59e0b' },
    { name: 'Rejected', value: Math.round((rejCount / totalApprovalsCountForPie) * 100), color: '#ef4444' },
  ];

  const deptPerfData = departments.map(d => ({
    dept: d.name.substring(0, 3).toUpperCase(),
    score: d.performance_score || 80
  }));

  const cashflowValue = cashflowData[cashflowData.length - 1] || { income: 0, expense: 0 };
  const cashflowDisplay = cashflowTab === 'income' ? cashflowValue.income : cashflowTab === 'expense' ? cashflowValue.expense : cashflowValue.income - cashflowValue.expense;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
        <p className="text-[var(--text-muted)] mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: GHS {p.value.toLocaleString()}</p>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto animate-pulse">
        <div className="h-8 bg-[var(--border)] rounded w-1/4 mb-4" />
        <div className="h-4 bg-[var(--border)] rounded w-1/3 mb-6" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 h-64" />
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{timeGreeting()}, {firstName} 👋</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Here's what needs your attention today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => { fetchData(); refreshFeed(); addNotification?.('Dashboard refreshed'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'Approvals Queue', tab: 'CreditApproval', icon: CheckCircle, badge: pendingCount },
          { label: 'Set Prices', tab: 'SetPrices', icon: BarChart2 },
          { label: 'Transactions', tab: 'Transactions', icon: DollarSign },
          { label: 'Audit Log', tab: 'Ledger', icon: Activity },
          { label: 'Dept Activity', tab: 'DeptActivity', icon: Users },
          { label: 'Analytics', tab: 'MgmtAnalytics', icon: TrendingUp },
        ].map(({ label, tab, icon: Icon, badge }) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab?.(tab)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors relative"
          >
            <Icon size={13} />
            {label}
            {badge ? <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ROW 1: KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Revenue', value: `GHS ${(monthlyRevenue / 1000).toFixed(0)}K`, change: '+12.3%', up: true, sub: 'vs last month' },
          { label: 'Pending Approvals', value: pendingCount, change: `${pendingCount > 0 ? 'requires action' : 'all clear'}`, up: pendingCount === 0, sub: 'approvals log' },
          { label: 'Avg profit Margin', value: '52.4%', change: '+2.1%', up: true, sub: 'across products' },
          { label: 'Staff Performance', value: `${avgDeptScore}/100`, change: '+5 pts', up: true, sub: 'average rating' },
        ].map(({ label, value, change, up, sub }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {up ? <TrendingUp size={11} className="text-green-500" /> : <TrendingDown size={11} className="text-red-400" />}
              <span className={`text-xs font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>{change}</span>
              <span className="text-xs text-[var(--text-muted)]">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2: Earning + Spending */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Earning Overview */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Earning Overview</h3>
              <p className="text-xs text-[var(--text-muted)]">Total revenue trend</p>
            </div>
            <select value={earnPeriod} onChange={e => setEarnPeriod(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none">
              <option value="3M">3 Months</option>
              <option value="6M">6 Months</option>
              <option value="12M">12 Months</option>
            </select>
          </div>
          <div className="h-44">
            {earningData.every(e => e.value === 0) ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No earning data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningData}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" name="Revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#earnGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Spending Overview */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Spending Breakdown</h3>
              <p className="text-xs text-[var(--text-muted)]">By category</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Logistics</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />Operations</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} />Payroll</span>
            </div>
          </div>
          <div className="h-44">
            {spendingData.every(s => s.logistics === 0 && s.operations === 0 && s.payroll === 0) ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No spending data logged</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingData}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="logistics" name="Logistics" fill="#60a5fa" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="operations" name="Operations" fill="#c084fc" stackId="a" />
                  <Bar dataKey="payroll" name="Payroll" fill="var(--accent)" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ROW 3: Cash Flow + Pending Approvals */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Cash Flow */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-3">Cash Flow</h3>
          <div className="flex items-center gap-2 mb-4">
            {(['income', 'expense', 'savings'] as const).map(t => (
              <button key={t} onClick={() => setCashflowTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${cashflowTab === t ? 'text-white' : 'text-[var(--text-secondary)] bg-[var(--bg-input)]'}`} style={cashflowTab === t ? { background: 'var(--accent)' } : {}}>{t}</button>
            ))}
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-4">GHS {cashflowDisplay.toLocaleString()}</p>
          <div className="h-36">
            {cashflowData.every(c => c.income === 0 && c.expense === 0) ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No cashflow logs</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashflowData}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey={cashflowTab === 'income' ? 'income' : cashflowTab === 'expense' ? 'expense' : 'income'} name={cashflowTab} fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Pending Approvals</h3>
              <p className="text-xs text-[var(--text-muted)]">{pendingCount} requests awaiting action</p>
            </div>
            <button onClick={() => setActiveSubTab?.('CreditApproval')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ArrowRight size={12} />
            </button>
          </div>
          {pendingApprovalsList.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-[var(--text-muted)]">
              <CheckCircle size={32} className="opacity-30 mb-2" />
              <p className="text-sm">All clear! No pending approvals</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingApprovalsList.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl hover:bg-[var(--border)] transition-colors cursor-pointer" onClick={() => setActiveSubTab?.('CreditApproval')}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.priority === 'High' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{item.desc}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.type} · {item.id}</p>
                  </div>
                  {item.amount !== null && (
                    <p className="text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">GHS {item.amount.toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 4: Department Performance + Approval Status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Dept Performance Bar */}
        <div className="xl:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Department Performance</h3>
              <p className="text-xs text-[var(--text-muted)]">Score out of 100</p>
            </div>
          </div>
          <div className="h-44">
            {deptPerfData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No department data recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptPerfData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="dept" type="category" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" name="Score" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Approval Status Donut */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 flex flex-col">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">Approval Status</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Summary statistics</p>
          <div className="relative flex-1 flex items-center justify-center">
            <div style={{ width: 140, height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={approvalPie} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65} strokeWidth={0}>
                    {approvalPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-bold text-[var(--text-primary)]">{appCount + penCount + rejCount}</p>
              <p className="text-xs text-[var(--text-muted)]">Total</p>
            </div>
          </div>
          <div className="space-y-2 mt-3">
            {approvalPie.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-[var(--text-secondary)]">{item.name}</span>
                </div>
                <span className="font-semibold text-[var(--text-primary)]">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 5: Department Activity Feed */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Department Activity Feed</h3>
            <p className="text-xs text-[var(--text-muted)]">Auto-refreshes every 30 seconds</p>
          </div>
          <button onClick={() => setActiveSubTab?.('DeptActivity')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            Full Log <ArrowRight size={12} />
          </button>
        </div>
        {activities.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">No recent department logs found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {activities.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-[var(--bg-input)] rounded-xl">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}20` }}>
                    <Icon size={14} style={{ color: a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] leading-snug truncate">{a.action}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{a.dept} · {a.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ROW 6: Year-on-Year + Low Stock */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* YoY Revenue */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Year-on-Year Revenue</h3>
              <p className="text-xs text-[var(--text-muted)]">This Year vs Last Year</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} />2026</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />2025</span>
            </div>
          </div>
          <div className="h-44">
            {yoyData.every(y => y.thisYear === 0 && y.lastYear === 0) ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No annual comparison data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yoyData}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="thisYear" name="2026" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="lastYear" name="2025" stroke="#9ca3af" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Low Stock Alerts</h3>
              <p className="text-xs text-[var(--text-muted)]">{lowStock.length} items below threshold</p>
            </div>
            <AlertTriangle size={16} className="text-yellow-500" />
          </div>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
              <CheckCircle size={32} className="opacity-30 mb-2" />
              <p className="text-sm">Stock levels are healthy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lowStock.map(item => {
                const pct = Math.max(1, Math.min(100, Math.round((item.current / item.capacity) * 100)));
                const color = pct < 10 ? '#ef4444' : pct < 20 ? '#f59e0b' : '#10b981';
                return (
                  <div key={item.sku}>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-xs font-medium text-[var(--text-primary)]">{item.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.sku}</p>
                      </div>
                      <p className="text-xs font-semibold" style={{ color }}>{item.current} / {item.capacity}</p>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ROW 7: Recent Transactions + Stock Movement */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Recent Transactions */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Recent Transactions</h3>
            <button onClick={() => setActiveSubTab?.('Transactions')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ArrowRight size={12} />
            </button>
          </div>
          {recentTxn.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
              <AlertTriangle size={32} className="opacity-30 mb-2" />
              <p className="text-sm">No recent transactions recorded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTxn.map((txn, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${txn.type === 'Credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {txn.type === 'Credit' ? <TrendingUp size={14} className="text-green-600" /> : <TrendingDown size={14} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{txn.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">{txn.id} · {txn.date}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${txn.type === 'Credit' ? 'text-green-500' : 'text-red-500'}`}>
                      {txn.type === 'Credit' ? '+' : '-'}GHS {txn.amount.toLocaleString()}
                    </p>
                    <p className={`text-xs ${txn.status === 'Completed' ? 'text-green-500' : 'text-yellow-500'}`}>{txn.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock In vs Out */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Stock Movement</h3>
              <p className="text-xs text-[var(--text-muted)]">Stock In vs Stock Out</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} />In</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Out</span>
            </div>
          </div>
          <div className="h-44">
            {stockData.every(s => s.in === 0 && s.out === 0) ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No stock movement logs</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockData}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="in" name="Stock In" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="out" name="Stock Out" fill="#fb923c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
