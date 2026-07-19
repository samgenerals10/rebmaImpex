import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertTriangle,
  Package, CreditCard, DollarSign, Activity, Users, BarChart2,
  ArrowRight, RefreshCw
} from 'lucide-react';
import PendingApprovalsAlert from '../../components/global/PendingApprovalsAlert';
import ProductCatalogCard from '../../components/ProductCatalogCard';
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
  const [productionRequests, setProductionRequests] = useState<any[]>([]);
  const [generalPurchases, setGeneralPurchases] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [financeExpenses, setFinanceExpenses] = useState<any[]>([]);

  const [cashflowTab, setCashflowTab] = useState<'income' | 'expense' | 'savings'>('income');
  const [earnPeriod, setEarnPeriod] = useState('6M');
  const [activities, setActivities] = useState<any[]>([]);
  const [goodsPrices, setGoodsPrices] = useState<any[]>([]);
  const [soldLedger, setSoldLedger] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);
  const feedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [revenueModalTab, setRevenueModalTab] = useState<'raw' | 'finished'>('raw');

  const firstName = currentUser?.fullName?.split(' ')[0] || 'Manager';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: ords },
        { data: txns },
        { data: cargo },
        { data: depts },
        { data: profs },
        { data: prodReqs },
        { data: genPurch },
        { data: att },
        { data: expenses },
        { data: stocks }
      ] = await Promise.all([
        supabase.from('orders').select('*'),
        Promise.resolve({ data: [] }),
        supabase.from('cargo_intake').select('*'),
        Promise.resolve({ data: [] }),
        supabase.from('profiles').select('*'),
        supabase.from('production_requests').select('*').then(r => r, () => ({ data: [] })),
        supabase.from('general_purchases').select('*').then(r => r, () => ({ data: [] })),
        supabase.from('attendance').select('*').then(r => r, () => ({ data: [] })),
        supabase.from('finance_expenses').select('*').then(r => r, () => ({ data: [] })),
        supabase.from('stock').select('*').then(r => r, () => ({ data: [] })),
      ]);

      setOrders(ords || []);
      setTransactions(txns || []);
      setCargoIntake(cargo || []);
      setDepartments(depts || []);
      setProfiles(profs || []);
      setProductionRequests((prodReqs as any) || []);
      setGeneralPurchases((genPurch as any) || []);
      setAttendanceRecords((att as any) || []);
      setFinanceExpenses((expenses as any) || []);
      setStockList(stocks || []);

      // Goods prices — drives inventory value display
      supabase.from('goods_prices').select('product_name, unit_price, cost_price, currency, product_image').then(({ data }) => {
        if (data) setGoodsPrices(data);
      }, () => {});

      // Actual quantity sold — real deductions logged when a sale is confirmed (see deductStockForOrder)
      supabase.from('stock_ledger').select('product_name, quantity').eq('movement_type', 'REMOVE').then(({ data }) => {
        if (data) setSoldLedger(data);
      }, () => {});
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

    const channel = supabase.channel('mgmt-overview-realtime-' + Math.random().toString(36).substring(7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'general_purchases' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cargo_intake' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goods_prices' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      if (feedRef.current) clearInterval(feedRef.current);
      supabase.removeChannel(channel);
    };
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
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const monthlyRevenue = orders
    .filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status);
    })
    .reduce((s, o) => s + Number(o.total_amount), 0);

  const cumulativeRevenue = orders
    .filter(o => ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status))
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);

  const lastMonthRevenue = orders
    .filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear && ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status);
    })
    .reduce((s, o) => s + Number(o.total_amount), 0);

  const revenueChangeNum = lastMonthRevenue > 0
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : null;
  const revenueChangeStr = revenueChangeNum !== null
    ? `${revenueChangeNum >= 0 ? '+' : ''}${revenueChangeNum.toFixed(1)}% vs last month`
    : monthlyRevenue > 0 ? 'First month data' : 'No orders yet';
  const revenueUp = revenueChangeNum === null ? true : revenueChangeNum >= 0;

  // Pending count across ALL Management approval categories
  const pendingOrders = orders.filter(o => o.status === 'PENDING_MANAGEMENT');
  const pendingCargo = cargoIntake.filter(c => c.status === 'PENDING_MANAGEMENT_APPROVAL');
  const pendingProfiles = profiles.filter(p => p.status === 'PENDING_APPROVAL');
  const pendingProduction = productionRequests.filter(r => r.status === 'PENDING_MANAGEMENT');
  const pendingGenPurchases = generalPurchases.filter(g => g.status === 'PENDING_MANAGEMENT_APPROVAL');
  const pendingCount = pendingOrders.length + pendingCargo.length + pendingProfiles.length + pendingProduction.length + pendingGenPurchases.length;

  const approvedCargoCount = cargoIntake.filter(c => c.status === 'APPROVED').length;
  const approvedOrdersCount = orders.filter(o => o.status === 'APPROVED' || o.status === 'PROCESSING' || o.status === 'DELIVERED').length;
  const approvedGeneralPurchasesCount = generalPurchases.filter(g => g.status === 'APPROVED').length;

  const pendingApprovalsList = [
    ...pendingCargo.map(c => ({
      id: c.id,
      type: 'Cargo Intake',
      desc: `Intake of ${c.product_name} from ${c.company || 'Operations'}`,
      priority: 'High',
      amount: Number(c.unit_price || 0) * (c.quantity || 0)
    })),
    ...pendingOrders.map(o => ({
      id: o.id,
      type: 'Credit Order',
      desc: `Credit terms request for ${o.client_name}`,
      priority: 'High',
      amount: Number(o.total_amount)
    })),
    ...pendingProduction.map(r => ({
      id: r.id,
      type: 'Production Request',
      desc: `Production batch: ${r.items?.[0]?.materialName || r.id}`,
      priority: 'Medium',
      amount: null
    })),
    ...pendingGenPurchases.map(g => ({
      id: g.id,
      type: 'General Purchase',
      desc: `Purchase: ${g.item_name || g.description || g.id}`,
      priority: 'Medium',
      amount: Number(g.total_cost || g.cost || 0) || null
    })),
    ...pendingProfiles.map(p => ({
      id: p.id,
      type: 'Staff Reg',
      desc: `${p.full_name} signup approval`,
      priority: 'Medium',
      amount: null
    }))
  ].slice(0, 4);

  // Average Profit Margin — computed from real revenue vs finance_expenses this month
  const monthlyExpenses = financeExpenses
    .filter(e => {
      const d = new Date(e.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const avgProfitMargin: number | null = monthlyRevenue > 0 && financeExpenses.length > 0
    ? Math.round(((monthlyRevenue - monthlyExpenses) / monthlyRevenue) * 100)
    : null;

  // Staff Reliability — from real attendance records (PRESENT / total)
  const presentCount = attendanceRecords.filter(a => a.status === 'PRESENT').length;
  const lateCount = attendanceRecords.filter(a => a.status === 'LATE').length;
  const totalAttendance = presentCount + lateCount;
  const attendanceReliability: number | null = totalAttendance > 0
    ? Math.round((presentCount / totalAttendance) * 100)
    : null;

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
    if (['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status)) {
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
        return d.getMonth() === mIdx && d.getFullYear() === currentYearYoY && ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status);
      })
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const lastYearVal = orders
      .filter(o => {
        const d = new Date(o.created_at);
        return d.getMonth() === mIdx && d.getFullYear() === lastYearYoY && ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status);
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
    if (['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status)) {
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
  const lowStock = stockList
    .map(s => ({
      name: s.product_name,
      sku: s.product_code || 'SKU-TEMP',
      current: Number(s.quantity || 0),
      capacity: Number(s.maximum_level || 500)
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

  // Approval Pie — all Management approval categories combined
  let appCount = 0;
  let penCount = 0;
  let rejCount = 0;
  orders.forEach(o => {
    if (['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status)) appCount++;
    else if (o.status.startsWith('PENDING')) penCount++;
    else if (o.status === 'REJECTED') rejCount++;
  });
  cargoIntake.forEach(c => {
    if (c.status === 'APPROVED') appCount++;
    else if (c.status === 'PENDING_MANAGEMENT_APPROVAL') penCount++;
    else if (c.status === 'REJECTED') rejCount++;
  });
  productionRequests.forEach(r => {
    if (['APPROVED', 'COMPLETED', 'TICKETS_ISSUED'].includes(r.status)) appCount++;
    else if (r.status === 'PENDING_MANAGEMENT') penCount++;
    else if (r.status === 'REJECTED') rejCount++;
  });
  profiles.forEach(p => {
    if (p.status === 'ACTIVE') appCount++;
    else if (p.status === 'PENDING_APPROVAL') penCount++;
    else if (p.status === 'REJECTED') rejCount++;
  });
  generalPurchases.forEach(g => {
    if (g.status === 'APPROVED') appCount++;
    else if (g.status === 'PENDING_MANAGEMENT_APPROVAL') penCount++;
    else if (g.status === 'REJECTED') rejCount++;
  });
  const totalApprovalsCountForPie = appCount + penCount + rejCount || 1;
  const approvalPie = [
    { name: 'Approved', value: Math.round((appCount / totalApprovalsCountForPie) * 100), color: '#10b981' },
    { name: 'Pending', value: Math.round((penCount / totalApprovalsCountForPie) * 100), color: '#f59e0b' },
    { name: 'Rejected', value: Math.round((rejCount / totalApprovalsCountForPie) * 100), color: '#ef4444' },
  ];

  const deptPerfData = departments.map(d => ({
    dept: d.name.substring(0, 3).toUpperCase(),
    score: d.performance_score || 0
  }));

  // Inventory: join goods_prices × approved cargo_intake by product name, subtract sold orders
  const inventoryItems = goodsPrices.map(gp => {
    const key = String(gp.product_name || '').toLowerCase().trim();
    // Get live quantity directly from the stock table instead of summing historical cargo intakes
    const stockItem = stockList.find(s => String(s.product_name || '').toLowerCase().trim() === key);
    const qty = stockItem ? Number(stockItem.quantity || 0) : 0;
    const category = stockItem ? stockItem.category : 'INCOMING_GOODS';
    
    const clearedForKey = (orders as any[]).filter(o => ['APPROVED','PROCESSING','DELIVERED','OUT_FOR_DELIVERY'].includes(o.status));
    let soldRevenue = 0;
    for (const o of clearedForKey) {
      const items = o.metadata?.items;
      if (Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          if (String(it.productName || it.product_name || '').toLowerCase().trim() === key) {
            soldRevenue += Number(it.lineTotal || it.line_total || it.amount || 0);
          }
        }
      } else if (String(o.product_name || '').toLowerCase().trim() === key) {
        soldRevenue += Number(o.total_amount || 0);
      }
    }
    // Actual quantity sold — real stock_ledger deductions, not order line-item estimates
    const soldQty = soldLedger.filter(l => String(l.product_name || '').toLowerCase().trim() === key)
      .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    return {
      name: gp.product_name,
      category,
      unitPrice: Number(gp.unit_price || 0),
      costPrice: Number(gp.cost_price || 0),
      currency: gp.currency || 'GHS',
      qty,
      sellingValue: Number(gp.unit_price || 0) * qty,
      costValue: Number(gp.cost_price || 0) * qty,
      soldQty,
      soldRevenue,
      image: gp.product_image || '',
    };
  });
  const totalSellingValue = inventoryItems.reduce((s, i) => s + i.sellingValue, 0);
  const totalCostValue = inventoryItems.reduce((s, i) => s + i.costValue, 0);
  const potentialProfit = totalSellingValue - totalCostValue;
  const totalRevenueEarned = inventoryItems.reduce((s, i) => s + i.soldRevenue, 0);

  // Cargo Discrepancies statement logic
  const cargoDiscrepancies = cargoIntake
    .filter(c => c.status === 'APPROVED' && c.is_fault_or_damaged)
    .map(c => {
      let originalQty = c.quantity || 0;
      let damagedCount = 0;
      let unitCost = Number(c.unit_price || 0);
      let costLoss = 0;
      let sellingPriceVal = 0;
      let notes = c.discrepancies || '';

      try {
        if (c.discrepancies && c.discrepancies.trim().startsWith('{')) {
          const parsed = JSON.parse(c.discrepancies);
          originalQty = parsed.originalQty ?? originalQty;
          damagedCount = parsed.damagedCount ?? 0;
          unitCost = parsed.unitCost ?? unitCost;
          costLoss = parsed.costLoss ?? (damagedCount * unitCost);
          sellingPriceVal = parsed.sellingPrice ?? 0;
          notes = parsed.notes ?? '';
        } else if (c.discrepancies && c.discrepancies !== 'None') {
          const dmgMatch = c.discrepancies.match(/Confirmed:\s*(\d+)/i);
          if (dmgMatch) {
            damagedCount = parseInt(dmgMatch[1], 10);
            costLoss = damagedCount * unitCost;
          }
        }
      } catch (err) {
        console.error('Error parsing discrepancies JSON:', err);
      }

      return {
        id: c.id,
        productName: c.product_name || 'Unknown',
        company: c.company || 'N/A',
        originalQty,
        damagedCount,
        unitCost,
        costLoss,
        sellingPrice: sellingPriceVal,
        notes
      };
    })
    .filter(d => d.damagedCount > 0);

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

      {/* Pending approvals alert banner */}
      <PendingApprovalsAlert department="MANAGEMENT" onNavigate={setActiveSubTab} addNotification={addNotification} />

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
          {
            label: 'Revenue',
            value: `GHS ${cumulativeRevenue.toLocaleString()}`,
            change: `${orders.filter(o => ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status)).length} approved orders`,
            up: true,
            sub: 'Cumulative Sales',
            isClickable: true
          },
          {
            label: 'Pending Approvals',
            value: pendingCount,
            change: pendingCount > 0 ? 'requires action' : 'all clear',
            up: pendingCount === 0,
            sub: `${pendingCargo.length} cargo · ${pendingOrders.length} credit · ${pendingProduction.length} prod · ${pendingProfiles.length} staff`,
            linkTab: 'CreditApproval'
          },
          {
            label: 'Avg Profit Margin',
            value: avgProfitMargin !== null ? `${avgProfitMargin}%` : '—',
            change: avgProfitMargin !== null ? (avgProfitMargin >= 0 ? 'positive margin' : 'negative margin') : 'No expense data yet',
            up: avgProfitMargin === null ? true : avgProfitMargin >= 0,
            sub: avgProfitMargin !== null ? 'revenue vs expenses' : 'log expenses in Finance',
            linkTab: 'MgmtAnalytics'
          },
          {
            label: 'Staff Reliability',
            value: attendanceReliability !== null ? `${attendanceReliability}%` : '—',
            change: attendanceReliability !== null
              ? `${presentCount} on-time / ${totalAttendance} total`
              : 'No attendance recorded',
            up: attendanceReliability === null ? true : attendanceReliability >= 80,
            sub: attendanceReliability !== null ? 'attendance-based' : 'check HR attendance',
            linkTab: 'DeptActivity'
          },
        ].map(({ label, value, change, up, sub, isClickable, linkTab }) => (
          <div
            key={label}
            onClick={() => { if (isClickable) setShowRevenueModal(true); else if (linkTab) setActiveSubTab?.(linkTab); }}
            className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 transition-all ${isClickable || linkTab ? 'cursor-pointer hover:border-[var(--accent)] hover:shadow-md' : ''}`}
          >
            <p className="text-xs text-[var(--text-muted)] mb-1 flex items-center justify-between">
              <span>{label}</span>
              {(isClickable || linkTab) && <span className="text-[9px] text-[var(--accent)] font-semibold font-mono bg-[var(--accent-light)] px-1 py-0.5 rounded">{isClickable ? 'Drill down →' : 'View →'}</span>}
            </p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {up ? <TrendingUp size={11} className="text-green-500" /> : <TrendingDown size={11} className="text-red-400" />}
              <span className={`text-xs font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>{change}</span>
            </div>
            {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Approved Metrics KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Approved Cargo Goods', value: approvedCargoCount, sub: 'Logistics intake items approved' },
          { label: 'Approved Credit Orders', value: approvedOrdersCount, sub: 'Sales orders approved' },
          { label: 'Approved General Purchases', value: approvedGeneralPurchasesCount, sub: 'Company expense requests approved' }
        ].map(item => (
          <div key={item.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between shadow-[var(--box-shadow)]">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1 font-semibold">{item.label}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{item.value}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{item.sub}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)]">
              <CheckCircle size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* Products Available to Sell */}
      {inventoryItems.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)] mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <CheckCircle size={15} className="text-emerald-500" /> Products Available to Sell
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {inventoryItems.length} product{inventoryItems.length !== 1 ? 's' : ''} priced by Management
              </p>
            </div>
            <button onClick={() => setActiveSubTab?.('SetPrices')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Manage Prices →</button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2.5">
            {inventoryItems.map((item: any) => (
              <ProductCatalogCard key={item.name} item={item} onSelect={() => setActiveSubTab?.('SetPrices')} />
            ))}
          </div>
        </div>
      )}

      {/* Inventory Overview — from goods_prices × approved cargo_intake */}
      {goodsPrices.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Package size={16} className="text-[var(--accent)]" /> Goods Inventory &amp; Sales Value
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Approved cargo only · {goodsPrices.length} priced product{goodsPrices.length !== 1 ? 's' : ''} · updates as sales are made</p>
            </div>
            <button onClick={() => setActiveSubTab?.('SetPrices')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Manage Prices →</button>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <div className="rounded-xl p-4 bg-amber-500/10">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide mb-1">Stock Cost Value</p>
              <p className="text-xl font-bold text-amber-600">{inventoryItems[0]?.currency || 'GHS'} {totalCostValue.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">What goods cost us</p>
            </div>
            <div className="rounded-xl p-4 bg-sky-500/10">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide mb-1">Stock Selling Value</p>
              <p className="text-xl font-bold text-sky-600">{inventoryItems[0]?.currency || 'GHS'} {totalSellingValue.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">At set prices</p>
            </div>
            <div className="rounded-xl p-4 bg-emerald-500/10">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide mb-1">Revenue Earned</p>
              <p className="text-xl font-bold text-emerald-600">{inventoryItems[0]?.currency || 'GHS'} {totalRevenueEarned.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">From approved orders</p>
            </div>
            <div className="rounded-xl p-4 bg-violet-500/10">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide mb-1">Stock Margin</p>
              <p className={`text-xl font-bold ${potentialProfit >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>{totalCostValue > 0 ? `${(((totalSellingValue - totalCostValue) / totalCostValue) * 100).toFixed(1)}%` : '—'}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Selling − Cost</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[var(--border)]">{['Product','Stock Qty','Cost Price','Selling Price','Stock Cost','Stock Value','Revenue Earned'].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] text-[var(--text-muted)] uppercase font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {inventoryItems.map(item => (
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
                {inventoryItems.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-4 text-center text-[var(--text-muted)]">No matching approved cargo for priced products yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* ROW 8: Discrepancy Statement */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500 animate-pulse" /> Cargo Discrepancy Statement
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Logs of confirmed inventory damages, write-offs, and resulting financial losses at cost</p>
          </div>
          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold">
            Total Damages: {cargoDiscrepancies.reduce((s, d) => s + d.damagedCount, 0)} units
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-input)]">
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Cargo ID</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Product Name</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Supplier</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-center">Original Qty</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-center">Damaged Qty</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-right">Unit Cost (GHS)</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-right">Financial Loss (GHS)</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Description / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {cargoDiscrepancies.map(d => (
                <tr key={d.id} className="hover:bg-red-500/5">
                  <td className="py-3 px-3 font-mono text-[10px] text-[var(--text-secondary)]">{d.id.slice(0, 8).toUpperCase()}</td>
                  <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{d.productName}</td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{d.company}</td>
                  <td className="py-3 px-3 text-center text-[var(--text-secondary)]">{d.originalQty}</td>
                  <td className="py-3 px-3 text-center text-red-500 font-bold">{d.damagedCount}</td>
                  <td className="py-3 px-3 text-right text-[var(--text-secondary)]">{d.unitCost.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-red-650 font-extrabold">GHS {d.costLoss.toLocaleString()}</td>
                  <td className="py-3 px-3 text-[var(--text-muted)] max-w-xs truncate" title={d.notes}>{d.notes}</td>
                </tr>
              ))}
              {cargoDiscrepancies.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">
                    No approved cargo discrepancies or damages logged.
                  </td>
                </tr>
              )}
            </tbody>
            {cargoDiscrepancies.length > 0 && (
              <tfoot>
                <tr className="bg-red-500/10 border-t border-[var(--border)] font-bold">
                  <td colSpan={6} className="py-2.5 px-3 text-[var(--text-primary)]">Total Loss (At Cost)</td>
                  <td className="py-2.5 px-3 text-right text-red-600">
                    GHS {cargoDiscrepancies.reduce((s, d) => s + d.costLoss, 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Revenue drill-down modal */}
      {showRevenueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)] bg-[var(--bg-card)]">
              <div>
                <h3 className="font-bold text-lg text-[var(--text-primary)]">Revenue Drill-Down Analysis</h3>
                <p className="text-xs text-[var(--text-muted)]">Analysis of sales revenue split by inventory types</p>
              </div>
              <button 
                onClick={() => setShowRevenueModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Tab Switched Header */}
            <div className="flex border-b border-[var(--border)] bg-[var(--bg-input)] px-6 py-2 gap-4">
              <button
                onClick={() => setRevenueModalTab('raw')}
                className={`pb-1 text-xs font-bold border-b-2 transition-all ${revenueModalTab === 'raw' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)]'}`}
              >
                Raw Materials (Cargo Goods)
              </button>
              <button
                onClick={() => setRevenueModalTab('finished')}
                className={`pb-1 text-xs font-bold border-b-2 transition-all ${revenueModalTab === 'finished' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)]'}`}
              >
                Finished Products
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 flex-1 bg-[var(--bg-card)]">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-input)]">
                    <th className="py-2 px-3 text-[var(--text-muted)] uppercase tracking-wider font-semibold">Product Name</th>
                    <th className="py-2 px-3 text-[var(--text-muted)] uppercase tracking-wider font-semibold text-right">Unit Cost (GHS)</th>
                    <th className="py-2 px-3 text-[var(--text-muted)] uppercase tracking-wider font-semibold text-right">Selling Price (GHS)</th>
                    <th className="py-2 px-3 text-[var(--text-muted)] uppercase tracking-wider font-semibold text-center">Qty Sold</th>
                    <th className="py-2 px-3 text-[var(--text-muted)] uppercase tracking-wider font-semibold text-right">Total Revenue (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {inventoryItems
                    .filter(item => revenueModalTab === 'raw' ? item.category === 'INCOMING_GOODS' : item.category === 'FINISHED_GOODS')
                    .map(item => (
                      <tr key={item.name} className="hover:bg-[var(--accent-light)]">
                        <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{item.name}</td>
                        <td className="py-3 px-3 text-right text-[var(--text-secondary)]">{item.costPrice.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-sky-600 font-semibold">{item.unitPrice.toLocaleString()}</td>
                        <td className="py-3 px-3 text-center text-[var(--text-secondary)] font-medium">{item.soldQty.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-emerald-600 font-bold">{(item.soldQty * item.unitPrice).toLocaleString()}</td>
                      </tr>
                    ))}
                  {inventoryItems.filter(item => revenueModalTab === 'raw' ? item.category === 'INCOMING_GOODS' : item.category === 'FINISHED_GOODS').length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[var(--text-muted)]">
                        No product items matched this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-input)] flex justify-end">
              <button 
                onClick={() => setShowRevenueModal(false)}
                className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
