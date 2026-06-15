import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  DollarSign, FileText, ClipboardCheck, BarChart2, CreditCard, Receipt,
  TrendingUp, TrendingDown, ArrowRight, RefreshCw, MoreVertical,
  Clock, CheckCircle, AlertTriangle, Building2
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts';

interface Props {
  addNotification?: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
  currentUser?: { fullName: string; department: string } | null;
  ordersList?: { id: string; clientName: string; totalAmount: number; status: string; paymentMode?: string; createdAt?: string }[];
  onEvaluateOrder?: (id: string, approve: boolean) => void;
}

const EARNING_DATA = [
  { month: 'Jul', value: 310000 },
  { month: 'Aug', value: 280000 },
  { month: 'Sep', value: 395000 },
  { month: 'Oct', value: 350000 },
  { month: 'Nov', value: 480000 },
  { month: 'Dec', value: 440000 },
];
const SPENDING_DATA = [
  { month: 'Aug', payroll: 85000, ops: 60000, logistics: 22000, admin: 15000 },
  { month: 'Sep', payroll: 87000, ops: 72000, logistics: 28000, admin: 16000 },
  { month: 'Oct', payroll: 87000, ops: 65000, logistics: 24000, admin: 14000 },
  { month: 'Nov', payroll: 90000, ops: 80000, logistics: 30000, admin: 18000 },
  { month: 'Dec', payroll: 90000, ops: 75000, logistics: 27000, admin: 17000 },
];
const CASHFLOW_DATA = [
  { month: 'Aug', income: 280000, expense: 182000 },
  { month: 'Sep', income: 395000, expense: 203000 },
  { month: 'Oct', income: 350000, expense: 190000 },
  { month: 'Nov', income: 480000, expense: 218000 },
  { month: 'Dec', income: 440000, expense: 209000 },
];
const TXN_LINE_DATA = [
  { d: '1', amt: 48000 }, { d: '5', amt: 62000 }, { d: '10', amt: 55000 },
  { d: '15', amt: 78000 }, { d: '20', amt: 70000 }, { d: '25', amt: 90000 }, { d: '30', amt: 85000 },
];
const PAYMENT_PIE = [
  { name: 'Cash', value: 42, color: '#10b981' },
  { name: 'Cheque', value: 28, color: '#3b82f6' },
  { name: 'Mobile Money', value: 22, color: '#f59e0b' },
  { name: 'Credit', value: 8, color: '#ef4444' },
];
const INV_STATUS = [
  { name: 'Paid', value: 58, color: '#10b981' },
  { name: 'Pending', value: 32, color: '#f59e0b' },
  { name: 'Overdue', value: 10, color: '#ef4444' },
];
const UPCOMING_BILLS = [
  { desc: 'Office Rent', amount: 12000, due: '2024-12-15', status: 'Due Soon' },
  { desc: 'Electricity Bill', amount: 3500, due: '2024-12-18', status: 'Scheduled' },
  { desc: 'Supplier Payment — Kofi Ltd', amount: 45000, due: '2024-12-10', status: 'Overdue' },
  { desc: 'Insurance Premium', amount: 8000, due: '2024-12-31', status: 'Scheduled' },
];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: GHS {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</p>
      ))}
    </div>
  );
};

export default function FinanceOverviewView({ addNotification, setActiveSubTab, currentUser, ordersList = [], onEvaluateOrder }: Props) {
  const [cashflowTab, setCashflowTab] = useState<'income' | 'expense' | 'savings'>('income');
  const [earnPeriod, setEarnPeriod] = useState('6M');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [creditOutstanding, setCreditOutstanding] = useState(0);

  const firstName = currentUser?.fullName?.split(' ')[0] || 'Finance';
  const pendingOrders = ordersList.filter(o => o.status === 'PENDING_FINANCE');

  useEffect(() => {
    const rev = ordersList.reduce((s, o) => s + (['DELIVERED', 'APPROVED', 'PROCESSING'].includes(o.status) ? o.totalAmount : 0), 0);
    setTotalRevenue(rev || 440000);
    setPendingCount(ordersList.filter(o => o.status === 'PENDING_FINANCE').length || 5);
    setInvoiceCount(ordersList.filter(o => ['APPROVED', 'DELIVERED'].includes(o.status)).length || 23);
    setCreditOutstanding(ordersList.filter(o => o.paymentMode === 'CREDIT').reduce((s, o) => s + o.totalAmount, 0) || 182000);
  }, [ordersList]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{timeGreeting()}, {firstName} 👋</h1>
          <p className="text-sm text-[var(--text-secondary)]">Here's your financial overview today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={() => addNotification?.('Dashboard refreshed')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'Record Payment', tab: 'RecordPayment', icon: DollarSign },
          { label: 'Orders Queue', tab: 'OrdersQueue', icon: ClipboardCheck },
          { label: 'Invoices', tab: 'Invoices', icon: FileText },
          { label: 'Credit Mgmt', tab: 'CreditMgmt', icon: CreditCard },
          { label: 'Reports', tab: 'FinReports', icon: BarChart2 },
          { label: 'Petty Cash', tab: 'PettyCash', icon: Receipt },
        ].map(({ label, tab, icon: Icon }) => (
          <button key={tab} onClick={() => setActiveSubTab?.(tab)} className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors">
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ROW 1 - KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `GHS ${(totalRevenue / 1000).toFixed(0)}K`, change: '+8.2%', up: true, sub: 'vs last month', tab: 'Transactions' },
          { label: 'Pending Orders', value: pendingCount, change: `${pendingOrders.filter(o => (o.totalAmount || 0) > 50000).length} high value`, up: false, sub: 'needs review', tab: 'OrdersQueue' },
          { label: 'Invoices Generated', value: invoiceCount, change: '+12%', up: true, sub: 'this month', tab: 'Invoices' },
          { label: 'Credit Outstanding', value: `GHS ${(creditOutstanding / 1000).toFixed(0)}K`, change: '-5.1%', up: true, sub: 'being collected', tab: 'CreditMgmt' },
        ].map(({ label, value, change, up, sub, tab }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 cursor-pointer hover:border-[var(--accent)] transition-colors" onClick={() => setActiveSubTab?.(tab)}>
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {up ? <TrendingUp size={11} className="text-green-500" /> : <AlertTriangle size={11} className="text-yellow-500" />}
              <span className={`text-xs font-medium ${up ? 'text-green-500' : 'text-yellow-500'}`}>{change}</span>
              <span className="text-xs text-[var(--text-muted)]">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2 - Earning + Spending */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
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
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-4">GHS 440,000</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={EARNING_DATA}>
                <defs>
                  <linearGradient id="earnFin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#earnFin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Spending Overview</h3>
              <p className="text-xs text-[var(--text-muted)]">By category</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
              {[{ label: 'Payroll', color: 'var(--accent)' }, { label: 'Ops', color: '#c084fc' }, { label: 'Logistics', color: '#60a5fa' }].map(i => (
                <span key={i.label} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: i.color }} />{i.label}</span>
              ))}
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SPENDING_DATA}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="payroll" name="Payroll" fill="var(--accent)" stackId="a" />
                <Bar dataKey="ops" name="Operations" fill="#c084fc" stackId="a" />
                <Bar dataKey="logistics" name="Logistics" fill="#60a5fa" stackId="a" />
                <Bar dataKey="admin" name="Admin" fill="#94a3b8" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ROW 3 - Cash Flow + Upcoming Bills */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-3">Cash Flow</h3>
          <div className="flex items-center gap-2 mb-4">
            {(['income', 'expense', 'savings'] as const).map(t => (
              <button key={t} onClick={() => setCashflowTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${cashflowTab === t ? 'text-white' : 'text-[var(--text-secondary)] bg-[var(--bg-input)]'}`} style={cashflowTab === t ? { background: 'var(--accent)' } : {}}>{t}</button>
            ))}
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-4">
            {cashflowTab === 'income' ? 'GHS 440K' : cashflowTab === 'expense' ? 'GHS 209K' : 'GHS 231K'}
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CASHFLOW_DATA}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={cashflowTab === 'income' ? 'income' : 'expense'} name={cashflowTab} fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Upcoming & Overdue Payments</h3>
            <button className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-input)] text-xl leading-none">+</button>
          </div>
          <div className="space-y-2">
            {UPCOMING_BILLS.map((bill, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${bill.status === 'Overdue' ? 'bg-red-50 border border-red-200' : 'bg-[var(--bg-input)]'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bill.status === 'Overdue' ? 'bg-red-100' : bill.status === 'Due Soon' ? 'bg-yellow-100' : 'bg-[var(--accent-light)]'}`}>
                  <Receipt size={14} className={bill.status === 'Overdue' ? 'text-red-500' : bill.status === 'Due Soon' ? 'text-yellow-500' : ''} style={bill.status === 'Scheduled' ? { color: 'var(--accent)' } : {}} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{bill.desc}</p>
                  <p className="text-xs text-[var(--text-muted)]">Due: {bill.due}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">GHS {bill.amount.toLocaleString()}</p>
                  <span className={`text-xs font-medium ${bill.status === 'Overdue' ? 'text-red-500' : bill.status === 'Due Soon' ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`}>{bill.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 4 - Accounts */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Company Accounts</h3>
          <button onClick={() => setActiveSubTab?.('Wallets')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            View All <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'GHS Main Account', num: '···· ···· 4821', balance: 'GHS 1,240,500', trend: '+3.2%', color: 'var(--accent)' },
            { name: 'USD Account', num: '···· ···· 7203', balance: 'USD 84,200', trend: '+1.8%', color: '#6366f1' },
            { name: 'Petty Cash Float', num: 'Last: Dec 8', balance: 'GHS 8,400', trend: '-12%', color: '#f59e0b' },
          ].map(acc => (
            <div key={acc.name} className="rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${acc.color}CC, ${acc.color})` }}>
              <p className="text-xs text-white/70 mb-1">{acc.name}</p>
              <p className="text-xs text-white/60 mb-3 font-mono">{acc.num}</p>
              <p className="text-xl font-bold">{acc.balance}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-white/70">{acc.trend}</span>
                <button onClick={() => setActiveSubTab?.('Wallets')} className="text-xs text-white/80 hover:text-white flex items-center gap-1">Details <ArrowRight size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROW 5 - Transaction Overview + Payments Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Transaction Overview</h3>
            <span className="text-xs text-[var(--text-muted)]">This Month</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">GHS 440,000</p>
          <p className="text-xs text-green-500 mb-4 flex items-center gap-1"><TrendingUp size={11} />+8.2% vs last month</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TXN_LINE_DATA}>
                <XAxis dataKey="d" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="amt" name="Amount" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Payment Methods Breakdown</h3>
          <div className="flex items-center gap-6">
            <div style={{ width: 130, height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={PAYMENT_PIE} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} strokeWidth={0}>
                    {PAYMENT_PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {PAYMENT_PIE.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-[var(--text-secondary)]">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 7 - Orders Queue Preview */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Orders Awaiting Review</h3>
          <button onClick={() => setActiveSubTab?.('OrdersQueue')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            View All Orders <ArrowRight size={12} />
          </button>
        </div>
        {pendingOrders.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-[var(--text-muted)]">
            <CheckCircle size={32} className="opacity-30 mb-2" />
            <p className="text-sm">No pending orders 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingOrders.slice(0, 5).map(order => (
              <div key={order.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{order.id} — {order.clientName}</p>
                  <p className="text-xs text-[var(--text-muted)]">GHS {order.totalAmount.toLocaleString()} · {order.paymentMode || 'CASH'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { onEvaluateOrder?.(order.id, true); addNotification?.(`Order ${order.id} approved`); }} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600">Approve</button>
                  <button onClick={() => { onEvaluateOrder?.(order.id, false); addNotification?.(`Order ${order.id} rejected`); }} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ROW 8 - Invoice Status + Credit Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Invoice Status</h3>
          <div className="flex items-center gap-6">
            <div className="relative" style={{ width: 130, height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={INV_STATUS} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} strokeWidth={0}>
                    {INV_STATUS.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-base font-bold text-[var(--text-primary)]">{invoiceCount}</p>
                <p className="text-xs text-[var(--text-muted)]">Total</p>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {INV_STATUS.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-[var(--text-secondary)]">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Credit Management</h3>
            <button onClick={() => setActiveSubTab?.('CreditMgmt')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ArrowRight size={12} />
            </button>
          </div>
          {[
            { label: 'Total Extended', value: 'GHS 182,000', color: 'text-[var(--text-primary)]' },
            { label: 'Total Collected', value: 'GHS 124,500', color: 'text-green-500' },
            { label: 'Outstanding', value: 'GHS 57,500', color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <span className="text-xs text-[var(--text-muted)]">{label}</span>
              <span className={`text-sm font-semibold ${color}`}>{value}</span>
            </div>
          ))}
          <div className="mt-3 h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-green-500" style={{ width: '68%' }} />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">68% collected</p>
        </div>
      </div>
    </div>
  );
}
