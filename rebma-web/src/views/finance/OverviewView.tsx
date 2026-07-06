import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PendingApprovalsAlert from '../../components/global/PendingApprovalsAlert';
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

interface Bill { id: string; desc: string; amount: number; due: string; status: string; }
interface MonthlyRevenue { month: string; value: number; }
interface PaymentSlice { name: string; value: number; color: string; }
interface CashflowPoint { month: string; income: number; expense: number; }

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
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [earningData, setEarningData] = useState<MonthlyRevenue[]>([]);
  const [cashflowData, setCashflowData] = useState<CashflowPoint[]>([]);
  const [paymentPie, setPaymentPie] = useState<PaymentSlice[]>([]);
  const [liveOrders, setLiveOrders] = useState<typeof ordersList>([]);

  // Live wallet totals from finance_payments (not dependent on ordersList prop)
  const [walletCash, setWalletCash] = useState(0);
  const [walletMomo, setWalletMomo] = useState(0);
  const [walletCheque, setWalletCheque] = useState(0);
  const [walletTotal, setWalletTotal] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [goodsPrices, setGoodsPrices] = useState<any[]>([]);
  const [cargoForInventory, setCargoForInventory] = useState<any[]>([]);

  // Master fetch — called on mount and by Refresh button
  const fetchAllData = async () => {
    // Orders — live fetch so KPI cards don't depend on stale prop
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500).then(({ data }) => {
      if (!data) return;
      const mapped = (data as any[]).map(r => ({
        id: r.id,
        clientName: r.client_name || '',
        productName: r.product_name || '',
        totalAmount: Number(r.total_amount || 0),
        status: r.status || 'PENDING_FINANCE',
        paymentMode: r.payment_mode || 'CASH',
        createdAt: r.created_at || '',
      }));
      setLiveOrders(mapped as any);
    }, () => {});

    // Payments / wallets
    supabase.from('finance_payments').select('amount, payment_mode').then(({ data }) => {
      if (!data) return;
      let total = 0, cash = 0, momo = 0, cheque = 0;
      for (const p of data as any[]) {
        const amt = Number(p.amount || 0);
        total += amt;
        const m = (p.payment_mode || '').toUpperCase().replace(/[\s_-]/g, '');
        if (m === 'CASH') cash += amt;
        else if (m === 'MOBILEMONEY' || m === 'MOMO') momo += amt;
        else if (m === 'CHEQUE' || m === 'CHECK') cheque += amt;
      }
      setWalletTotal(total); setWalletCash(cash); setWalletMomo(momo); setWalletCheque(cheque);
    }, () => {});

    supabase.from('finance_expenses').select('amount').eq('status', 'Approved').then(({ data }) => {
      if (data) setTotalExpenses((data as any[]).reduce((s, e) => s + Number(e.amount || 0), 0));
    }, () => {});
    supabase.from('goods_prices').select('product_name, unit_price, cost_price, currency').then(({ data }) => {
      if (data) setGoodsPrices(data as any[]);
    }, () => {});
    supabase.from('cargo_intake').select('product_name, quantity').eq('status', 'APPROVED').then(({ data }) => {
      if (data) setCargoForInventory(data as any[]);
    }, () => {});

    // Upcoming bills + earning / cashflow charts
    try {
      const { data: bills } = await supabase.from('finance_expenses')
        .select('id, description, amount, due_date, status')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true }).limit(5);
      if (bills) {
        setUpcomingBills(bills.map((b: any) => ({
          id: b.id, desc: b.description, amount: b.amount, due: b.due_date,
          status: new Date(b.due_date) < new Date() ? 'Overdue' : b.status === 'PENDING' ? 'Due Soon' : 'Scheduled',
        })));
      }

      const { data: orders } = await supabase.from('orders').select('total_amount, created_at').in('status', ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY']);
      const { data: payments } = await supabase.from('finance_payments').select('amount, created_at');
      const { data: expenses } = await supabase.from('finance_expenses').select('amount, created_at');

      const monthKey = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString('en-GB', { month: 'short' }); };
      const nMonths = earnPeriod === '3M' ? 3 : earnPeriod === '12M' ? 12 : 6;
      const last = Array.from({ length: nMonths }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - (nMonths - 1 - i));
        return d.toLocaleDateString('en-GB', { month: 'short' });
      });

      const revenueMap: Record<string, number> = {};
      const paymentMap: Record<string, number> = {};
      const expenseMap: Record<string, number> = {};
      for (const o of (orders || []) as any[]) { const k = monthKey(o.created_at); revenueMap[k] = (revenueMap[k] || 0) + Number(o.total_amount || 0); }
      for (const p of (payments || []) as any[]) { const k = monthKey(p.created_at); paymentMap[k] = (paymentMap[k] || 0) + Number(p.amount || 0); }
      for (const e of (expenses || []) as any[]) { const k = monthKey(e.created_at); expenseMap[k] = (expenseMap[k] || 0) + Number(e.amount || 0); }

      // Income = payments received (actual cash) + order revenue; expense = finance_expenses
      const earning = last.map(k => ({ month: k, value: (paymentMap[k] || 0) + (revenueMap[k] || 0) }));
      setEarningData(earning);
      setCashflowData(earning.map(p => ({ month: p.month, income: p.value, expense: expenseMap[p.month] || 0 })));
    } catch { /* silent */ }
  };

  useEffect(() => { fetchAllData(); }, []);

  // Recompute KPI cards whenever liveOrders updates
  useEffect(() => {
    const effective = liveOrders.length > 0 ? liveOrders : ordersList;
    const rev = effective.reduce((s, o) => s + (['DELIVERED', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status) ? o.totalAmount : 0), 0);
    setTotalRevenue(rev || 0);
    setPendingCount(effective.filter(o => o.status === 'PENDING_FINANCE').length || 0);
    setInvoiceCount(effective.filter(o => ['APPROVED', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status)).length || 0);
    setCreditOutstanding(effective.filter(o => o.paymentMode === 'CREDIT').reduce((s, o) => s + o.totalAmount, 0) || 0);

    const total = effective.length || 1;
    const modeGroups: Record<string, number> = {};
    for (const o of effective) { modeGroups[o.paymentMode || 'CASH'] = (modeGroups[o.paymentMode || 'CASH'] || 0) + 1; }
    const modeColors: Record<string, string> = { CASH: '#10b981', CHEQUE: '#3b82f6', MOBILE_MONEY: '#f59e0b', CREDIT: '#ef4444' };
    const modeLabels: Record<string, string> = { CASH: 'Cash', CHEQUE: 'Cheque', MOBILE_MONEY: 'Mobile Money', CREDIT: 'Credit' };
    setPaymentPie(Object.entries(modeGroups).map(([k, v]) => ({ name: modeLabels[k] || k, value: Math.round((v / total) * 100), color: modeColors[k] || '#94a3b8' })));
  }, [liveOrders, ordersList]);

  const firstName = currentUser?.fullName?.split(' ')[0] || 'Finance';
  const effective = liveOrders.length > 0 ? liveOrders : ordersList;
  const pendingOrders = effective.filter(o => o.status === 'PENDING_FINANCE');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{timeGreeting()}, {firstName} 👋</h1>
          <p className="text-sm text-[var(--text-secondary)]">Here's your financial overview today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={() => { fetchAllData(); addNotification?.('Dashboard refreshed'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
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

      {/* Pending approvals alert */}
      <PendingApprovalsAlert department="FINANCE" onNavigate={setActiveSubTab} />

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
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-4">GHS {(totalRevenue / 1000).toFixed(0)}K</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningData}>
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
              <BarChart data={cashflowData}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income" name="Income" fill="var(--accent)" stackId="a" />
                <Bar dataKey="expense" name="Expenses" fill="#c084fc" stackId="a" radius={[4, 4, 0, 0]} />
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
            {cashflowTab === 'income'
              ? `GHS ${((cashflowData.reduce((s, d) => s + d.income, 0)) / 1000).toFixed(0)}K`
              : cashflowTab === 'expense'
              ? `GHS ${((cashflowData.reduce((s, d) => s + d.expense, 0)) / 1000).toFixed(0)}K`
              : `GHS ${((cashflowData.reduce((s, d) => s + d.income - d.expense, 0)) / 1000).toFixed(0)}K`}
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowData}>
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
            {upcomingBills.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-4">No upcoming bills scheduled</p>}
            {upcomingBills.map((bill, i) => (
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
            { name: 'Total Payments Received', num: `Cash: GHS ${walletCash.toLocaleString()} · MoMo: GHS ${walletMomo.toLocaleString()}`, balance: `GHS ${walletTotal.toLocaleString()}`, trend: 'Live from payment records', color: 'var(--accent)' },
            { name: 'Expenses Paid', num: 'Approved expense records', balance: `GHS ${totalExpenses.toLocaleString()}`, trend: 'Approved only', color: '#6366f1' },
            { name: 'Net Balance', num: `In: GHS ${walletTotal.toLocaleString()} · Out: GHS ${totalExpenses.toLocaleString()}`, balance: `GHS ${Math.abs(walletTotal - totalExpenses).toLocaleString()}`, trend: walletTotal - totalExpenses >= 0 ? 'Surplus' : 'Deficit', color: walletTotal - totalExpenses >= 0 ? '#10b981' : '#ef4444' },
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

      {/* ROW 4b - Goods Inventory Value */}
      {goodsPrices.length > 0 && (() => {
        const items = goodsPrices.map((gp: any) => {
          const key = String(gp.product_name || '').toLowerCase().trim();
          const qty = cargoForInventory.filter((c: any) => String(c.product_name || '').toLowerCase().trim() === key).reduce((s: number, c: any) => s + (Number(c.quantity) || 0), 0);
          // Revenue earned from approved/delivered orders for this product
          const soldRevenue = (effective as any[]).filter(o => ['APPROVED','PROCESSING','DELIVERED'].includes(o.status) && String(o.productName || o.product_name || '').toLowerCase().trim() === key).reduce((s: number, o: any) => s + (Number(o.totalAmount || o.total_amount) || 0), 0);
          return { name: gp.product_name, unitPrice: Number(gp.unit_price || 0), costPrice: Number(gp.cost_price || 0), currency: gp.currency || 'GHS', qty, sellingValue: Number(gp.unit_price || 0) * qty, costValue: Number(gp.cost_price || 0) * qty, soldRevenue };
        });
        const totalSell = items.reduce((s: number, i: any) => s + i.sellingValue, 0);
        const totalCost = items.reduce((s: number, i: any) => s + i.costValue, 0);
        const totalRevEarned = items.reduce((s: number, i: any) => s + i.soldRevenue, 0);
        const currency = items[0]?.currency || 'GHS';
        return (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Building2 size={15} className="text-[var(--accent)]" /> Goods Inventory &amp; Sales Value
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Approved cargo only · prices set by Management · updates as sales are made</p>
              </div>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
              <div className="rounded-xl p-4 bg-amber-500/10">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide mb-1">Stock Cost Value</p>
                <p className="text-xl font-bold text-amber-600">{currency} {totalCost.toLocaleString()}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">What goods cost us</p>
              </div>
              <div className="rounded-xl p-4 bg-sky-500/10">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide mb-1">Stock Selling Value</p>
                <p className="text-xl font-bold text-sky-600">{currency} {totalSell.toLocaleString()}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">At selling prices</p>
              </div>
              <div className="rounded-xl p-4 bg-emerald-500/10">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide mb-1">Revenue Earned</p>
                <p className="text-xl font-bold text-emerald-600">{currency} {totalRevEarned.toLocaleString()}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">From approved orders</p>
              </div>
              <div className="rounded-xl p-4 bg-violet-500/10">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide mb-1">Gross Margin</p>
                <p className="text-xl font-bold text-violet-600">{totalCost > 0 ? `${(((totalSell - totalCost) / totalCost) * 100).toFixed(1)}%` : '—'}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Stock margin</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--border)]">{['Product','Stock Qty','Cost Price','Selling Price','Stock Cost Value','Stock Selling Value','Revenue Earned'].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] text-[var(--text-muted)] uppercase font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((item: any) => (
                    <tr key={item.name} className="hover:bg-[var(--accent-light)]">
                      <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{item.name}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{item.qty.toLocaleString()}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{item.currency} {item.costPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-sky-600 font-semibold">{item.currency} {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-amber-600">{item.currency} {item.costValue.toLocaleString()}</td>
                      <td className="px-3 py-2 text-sky-600">{item.currency} {item.sellingValue.toLocaleString()}</td>
                      <td className="px-3 py-2 text-emerald-600 font-semibold">{item.currency} {item.soldRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ROW 5 - Transaction Overview + Payments Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Transaction Overview</h3>
            <span className="text-xs text-[var(--text-muted)]">This Month</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">GHS {(totalRevenue / 1000).toFixed(0)}K</p>
          <p className="text-xs text-green-500 mb-4 flex items-center gap-1"><TrendingUp size={11} />This period</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earningData}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" name="Revenue" stroke="var(--accent)" strokeWidth={2} dot={false} />
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
                  <Pie data={paymentPie} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} strokeWidth={0}>
                    {paymentPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {paymentPie.map(item => (
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
                  <button onClick={() => setActiveSubTab?.('orders-queue')} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}>Review in Queue</button>
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
              {(() => {
                const realTotal = effective.length;
                if (realTotal === 0) {
                  return (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-base font-bold text-[var(--text-primary)]">0</p>
                      <p className="text-xs text-[var(--text-muted)]">No orders yet</p>
                    </div>
                  );
                }
                const paid = effective.filter(o => ['DELIVERED', 'APPROVED', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
                const pending = effective.filter(o => o.status.startsWith('PENDING')).length;
                const rejected = realTotal - paid - pending;
                const invData = [
                  { name: 'Paid', value: Math.round((paid / realTotal) * 100), color: '#10b981' },
                  { name: 'Pending', value: Math.round((pending / realTotal) * 100), color: '#f59e0b' },
                  { name: 'Rejected', value: Math.round((rejected / realTotal) * 100), color: '#ef4444' },
                ].filter(d => d.value > 0);
                return (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={invData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} strokeWidth={0}>
                          {invData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-base font-bold text-[var(--text-primary)]">{invoiceCount}</p>
                      <p className="text-xs text-[var(--text-muted)]">Total</p>
                    </div>
                    <div className="absolute left-36 top-0 flex-1 space-y-2">
                      {invData.map(item => (
                        <div key={item.name} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            <span className="text-xs text-[var(--text-secondary)]">{item.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-primary)]">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
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
          {(() => {
            const creditOrders = effective.filter(o => o.paymentMode === 'CREDIT');
            const totalExtended = creditOrders.reduce((s, o) => s + o.totalAmount, 0);
            const collected = creditOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0);
            const outstanding = totalExtended - collected;
            const pct = totalExtended > 0 ? Math.round((collected / totalExtended) * 100) : 0;
            return (
              <>
                {[
                  { label: 'Total Extended', value: `GHS ${totalExtended.toLocaleString()}`, color: 'text-[var(--text-primary)]' },
                  { label: 'Total Collected', value: `GHS ${collected.toLocaleString()}`, color: 'text-green-500' },
                  { label: 'Outstanding', value: `GHS ${outstanding.toLocaleString()}`, color: 'text-red-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs text-[var(--text-muted)]">{label}</span>
                    <span className={`text-sm font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
                <div className="mt-3 h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{pct}% collected</p>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
