import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  ShoppingCart, UserPlus, ClipboardList, CreditCard, FileText, BarChart2,
  TrendingUp, TrendingDown, ArrowRight, RefreshCw, MoreVertical,
  CheckCircle
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import type { Order, Customer } from '../../types/erp';
import ProductCatalogCard from '../../components/ProductCatalogCard';
import PendingApprovalsAlert from '../../components/global/PendingApprovalsAlert';

interface Props {
  addNotification?: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
  currentUser?: { fullName: string; department: string } | null;
  ordersList?: Order[];
  customersList?: Customer[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_FINANCE: 'bg-yellow-100 text-yellow-700',
  PENDING_MANAGEMENT: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-teal-100 text-teal-700',
  DELIVERED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_FINANCE: 'Finance Review',
  PENDING_MANAGEMENT: 'Mgmt Review',
  APPROVED: 'Approved',
  PROCESSING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
};

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const Tt = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: GHS {p.value.toLocaleString()}</p>)}
    </div>
  );
};

export default function MarketingOverviewView({ addNotification, setActiveSubTab, currentUser }: Props) {
  const firstName = currentUser?.fullName?.split(' ')[0] || 'Marketing';
  const [salesPeriod, setSalesPeriod] = useState('This Week');
  const [revPeriod, setRevPeriod] = useState('This Month');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [goodsPrices, setGoodsPrices] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [soldLedger, setSoldLedger] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: ords, error: errO } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      const { data: custs, error: errC } = await supabase
        .from('customers')
        .select('*')
        .order('registered_at', { ascending: false });

      if (errO) console.error('Error fetching orders:', errO);
      if (errC) console.error('Error fetching customers:', errC);

      const formattedOrders: Order[] = (ords || []).map((o: any) => ({
        id: o.id,
        ticketNumber: o.ticket_number,
        clientName: o.client_name,
        productName: o.product_name || 'Generic Goods',
        destination: o.destination,
        paymentMode: o.payment_mode || 'CASH',
        totalAmount: Number(o.total_amount),
        status: o.status || 'PENDING_FINANCE',
        createdAt: o.created_at,
      }));

      const formattedCustomers: Customer[] = (custs || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        companyName: c.company_name,
        phone: c.phone || '',
        location: c.location || '',
        registeredAt: c.registered_at,
      }));

      setOrders(formattedOrders);
      setCustomers(formattedCustomers);

      // Goods available to sell — prices set by Management
      supabase.from('goods_prices').select('product_name, unit_price, cost_price, currency, category, product_image').then(({ data }) => {
        if (data) setGoodsPrices(data as any[]);
      }, () => {});
      supabase.from('stock').select('product_name, quantity').then(({ data }) => {
        if (data) setStock(data as any[]);
      }, () => {});
      // Actual quantity sold — real deductions logged when a sale is confirmed (see deductStockForOrder)
      supabase.from('stock_ledger').select('product_name, quantity').eq('movement_type', 'REMOVE').then(({ data }) => {
        if (data) setSoldLedger(data as any[]);
      }, () => {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes
    const channel = supabase.channel('marketing-overview-realtime-' + Math.random().toString(36).substring(7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goods_prices' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute stats
  const totalOrders = orders.length;
  const totalCustomers = customers.length;
  const pendingFinance = orders.filter(o => o.status === 'PENDING_FINANCE').length;
  const revenue = orders.filter(o => ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status)).reduce((s, o) => s + o.totalAmount, 0);

  // Compute change badges based on real data
  const nowMs = Date.now();
  const oneDay = 86400000;
  const thisWeekStart = nowMs - 7 * oneDay;
  const lastWeekStart = nowMs - 14 * oneDay;
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();
  
  const thisWeekOrders = orders.filter(o => new Date(o.createdAt).getTime() >= thisWeekStart).length;
  const lastWeekOrders = orders.filter(o => { const t = new Date(o.createdAt).getTime(); return t >= lastWeekStart && t < thisWeekStart; }).length;
  const ordersChange = lastWeekOrders === 0 ? (thisWeekOrders > 0 ? 100 : 0) : Math.round(((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100);
  const ordersUp = ordersChange >= 0;

  const thisMonthRevenue = orders.filter(o => ['APPROVED','PROCESSING','DELIVERED','OUT_FOR_DELIVERY'].includes(o.status) && new Date(o.createdAt).getTime() >= thisMonthStart).reduce((s, o) => s + o.totalAmount, 0);
  const lastMonthRevenue = orders.filter(o => ['APPROVED','PROCESSING','DELIVERED','OUT_FOR_DELIVERY'].includes(o.status) && new Date(o.createdAt).getTime() >= lastMonthStart && new Date(o.createdAt).getTime() < thisMonthStart).reduce((s, o) => s + o.totalAmount, 0);
  const revenueChange = lastMonthRevenue === 0 ? (thisMonthRevenue > 0 ? 100 : 0) : Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
  const revenueUp = revenueChange >= 0;

  const thisMonthCustomers = customers.filter(c => new Date(c.registeredAt).getTime() >= thisMonthStart).length;
  const lastMonthCustomers = customers.filter(c => { const t = new Date(c.registeredAt).getTime(); return t >= lastMonthStart && t < thisMonthStart; }).length;
  const customersUp = thisMonthCustomers >= lastMonthCustomers;

  const sevenDaysAgo = nowMs - 7 * oneDay;
  const pendingNow = orders.filter(o => o.status === 'PENDING_FINANCE').length;
  const pendingLastWeek = orders.filter(o => o.status === 'PENDING_FINANCE' && new Date(o.createdAt).getTime() < sevenDaysAgo).length;
  const pendingChange = pendingNow - pendingLastWeek;
  const pendingUp = pendingChange <= 0;

  // SALES_DATA: sales of the last 7 days grouped by day
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateStr: d.toDateString(),
      dayName: dayNames[d.getDay()],
      value: 0
    };
  });
  orders.forEach(o => {
    const oDate = new Date(o.createdAt);
    const dateStr = oDate.toDateString();
    const dayItem = last7Days.find(item => item.dateStr === dateStr);
    if (dayItem) {
      dayItem.value += o.totalAmount;
    }
  });
  const salesData = last7Days.map(item => ({ d: item.dayName, value: item.value }));

  // REVENUE_DATA: last 4 weeks revenue
  const weeks = [
    { week: 'W1', revenue: 0 },
    { week: 'W2', revenue: 0 },
    { week: 'W3', revenue: 0 },
    { week: 'W4', revenue: 0 },
  ];
  const now = Date.now();
  orders.forEach(o => {
    const diffDays = (now - new Date(o.createdAt).getTime()) / oneDay;
    if (diffDays >= 0 && diffDays < 28) {
      if (diffDays < 7) {
        weeks[3].revenue += o.totalAmount;
      } else if (diffDays < 14) {
        weeks[2].revenue += o.totalAmount;
      } else if (diffDays < 21) {
        weeks[1].revenue += o.totalAmount;
      } else {
        weeks[0].revenue += o.totalAmount;
      }
    }
  });
  const revenueData = weeks;

  // PRODUCT_PIE
  const productCounts: Record<string, number> = {};
  orders.forEach(o => {
    const prod = o.productName || 'Generic Goods';
    productCounts[prod] = (productCounts[prod] || 0) + 1;
  });
  const totalOrderCountForPie = orders.length || 1;
  const productColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#94a3b8'];
  const sortedProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]);
  const topProductsListForPie = sortedProducts.slice(0, 3);
  const otherProductsCount = sortedProducts.slice(3).reduce((sum, item) => sum + item[1], 0);

  const productPie = topProductsListForPie.map(([name, count], idx) => ({
    name,
    value: Math.round((count / totalOrderCountForPie) * 100),
    color: productColors[idx % productColors.length]
  }));
  if (otherProductsCount > 0) {
    productPie.push({
      name: 'Other',
      value: Math.round((otherProductsCount / totalOrderCountForPie) * 100),
      color: '#94a3b8'
    });
  }

  // STATUS_PIE
  const statusCounts: Record<string, number> = {};
  orders.forEach(o => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });
  const statusColorsMap: Record<string, string> = {
    DELIVERED: '#10b981',
    PROCESSING: '#6366f1',
    PENDING_FINANCE: '#f59e0b',
    PENDING_MANAGEMENT: '#a855f7',
    APPROVED: '#3b82f6',
    REJECTED: '#ef4444',
  };
  const statusPie = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: Math.round((count / totalOrderCountForPie) * 100),
    color: statusColorsMap[status] || '#94a3b8'
  }));

  // CUST_GROWTH
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      monthKey: `${d.getFullYear()}-${d.getMonth()}`,
      monthName: monthNames[d.getMonth()],
      n: 0
    };
  });
  customers.forEach(c => {
    const d = new Date(c.registeredAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const item = last6Months.find(m => m.monthKey === key);
    if (item) {
      item.n += 1;
    }
  });
  const custGrowth = last6Months.map(item => ({ month: item.monthName, n: item.n }));

  // PAYMENT_PIE
  const paymentCounts: Record<string, number> = {};
  orders.forEach(o => {
    const mode = o.paymentMode || 'CASH';
    paymentCounts[mode] = (paymentCounts[mode] || 0) + 1;
  });
  const paymentColorsMap: Record<string, string> = {
    CASH: '#10b981',
    CHEQUE: '#3b82f6',
    MOBILE_MONEY: '#f59e0b',
    CREDIT: '#8b5cf6',
  };
  const paymentLabelsMap: Record<string, string> = {
    CASH: 'Cash',
    CHEQUE: 'Cheque',
    MOBILE_MONEY: 'Mobile Money',
    CREDIT: 'Credit',
  };
  const paymentPie = Object.entries(paymentCounts).map(([mode, count]) => ({
    name: paymentLabelsMap[mode] || mode,
    value: Math.round((count / totalOrderCountForPie) * 100),
    color: paymentColorsMap[mode] || '#94a3b8'
  }));

  // TOP_PRODUCTS list
  const topProductStats: Record<string, { orders: number; qty: number; revenue: number }> = {};
  orders.forEach(o => {
    const prod = o.productName || 'Generic Goods';
    if (!topProductStats[prod]) {
      topProductStats[prod] = { orders: 0, qty: 0, revenue: 0 };
    }
    topProductStats[prod].orders += 1;
    topProductStats[prod].qty += 1;
    topProductStats[prod].revenue += o.totalAmount;
  });
  const topProducts = Object.entries(topProductStats)
    .map(([name, s]) => ({
      name,
      orders: s.orders,
      qty: s.qty,
      revenue: s.revenue
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  // CREDIT REQUESTS
  const creditRequests = orders
    .filter(o => o.paymentMode === 'CREDIT')
    .map(o => ({
      id: o.id,
      customer: o.clientName,
      amount: o.totalAmount,
      date: new Date(o.createdAt).toISOString().split('T')[0],
      status: o.status === 'PENDING_MANAGEMENT' ? 'Pending Management' : o.status === 'APPROVED' ? 'Management Approved' : 'Finance Processing'
    }))
    .slice(0, 5);

  const recentOrders = orders.slice(0, 5);

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
          <p className="text-sm text-[var(--text-secondary)]">Here's your sales overview today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={() => { fetchData(); addNotification?.('Dashboard refreshed'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"><RefreshCw size={14} /> Refresh</button>
      </div>

      <PendingApprovalsAlert department="MARKETING" onNavigate={setActiveSubTab} addNotification={addNotification} />

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'New Order', tab: 'CreateOrder', icon: ShoppingCart },
          { label: 'Add Customer', tab: 'RegisterCustomer', icon: UserPlus },
          { label: 'View Orders', tab: 'CreateOrder', icon: ClipboardList },
          { label: 'Credit Request', tab: 'CreditRequests', icon: CreditCard },
          { label: 'Invoices', tab: 'Invoices', icon: FileText },
          { label: 'Analytics', tab: 'MktAnalytics', icon: BarChart2 },
        ].map(({ label, tab, icon: Icon }) => (
          <button key={label} onClick={() => setActiveSubTab?.(tab)} className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors">
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: totalOrders, change: `${ordersUp ? '+' : ''}${ordersChange}%`, up: ordersUp, sub: 'vs last week', tab: 'CreateOrder' },
          { label: 'Total Customers', value: totalCustomers, change: `+${thisMonthCustomers} new`, up: customersUp, sub: 'this month', tab: 'RegisterCustomer' },
          { label: 'Pending Finance', value: pendingFinance, change: pendingChange === 0 ? 'no change' : `${pendingChange > 0 ? '+' : ''}${pendingChange} orders`, up: pendingUp, sub: 'vs 7 days ago', tab: 'CreateOrder' },
          { label: 'Revenue Generated', value: `GHS ${revenue.toLocaleString()}`, change: `${revenueUp ? '+' : ''}${revenueChange}%`, up: revenueUp, sub: 'vs last month', tab: 'MktAnalytics' },
        ].map(({ label, value, change, up, sub, tab }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 cursor-pointer hover:border-[var(--accent)] transition-colors" onClick={() => setActiveSubTab?.(tab)}>
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

      {/* Available Products — priced by Management, ready to sell */}
      {goodsPrices.length > 0 && (() => {
        const items = goodsPrices.map((gp: any) => {
          const key = String(gp.product_name || '').toLowerCase().trim();
          const qty = stock.filter((s: any) => String(s.product_name || '').toLowerCase().trim() === key).reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
          const soldQty = soldLedger.filter((l: any) => String(l.product_name || '').toLowerCase().trim() === key)
            .reduce((sum: number, l: any) => sum + (Number(l.quantity) || 0), 0);
          return { name: gp.product_name, unitPrice: Number(gp.unit_price || 0), currency: gp.currency || 'GHS', category: gp.category || '—', qty, soldQty, image: gp.product_image || '' };
        });
        return (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-500" /> Products Available to Sell
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {items.length} product{items.length !== 1 ? 's' : ''} priced by Management
                </p>
              </div>
              <button onClick={() => setActiveSubTab?.('CreateOrder')} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer" style={{ background: 'var(--accent)' }}>+ New Order</button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2.5">
              {items.map((item: any) => (
                <ProductCatalogCard key={item.name} item={item} onSelect={() => setActiveSubTab?.('CreateOrder')} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* ROW 2 - Sales Overview + Orders by Category */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Sales Overview</h3>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">GHS {revenue.toLocaleString()} <span className="text-sm font-normal text-green-500">+14.2%</span></p>
            </div>
            <select value={salesPeriod} onChange={e => setSalesPeriod(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none">
              {['This Week', 'This Month', '6 Months', 'Year'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="h-44">
            {salesData.length === 0 || salesData.every(s => s.value === 0) ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No sales data for this week</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="mktSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<Tt />} />
                  <Area type="monotone" dataKey="value" name="Sales" stroke="var(--accent)" strokeWidth={2} fill="url(#mktSales)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Orders by Product</h3>
            <button onClick={() => setActiveSubTab?.('MktAnalytics')} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>View All</button>
          </div>
          {productPie.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-[var(--text-muted)] text-xs">No product ordering data available</div>
          ) : (
            <div className="flex items-center gap-5">
              <div className="relative" style={{ width: 130, height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={productPie} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={62} strokeWidth={0}>
                      {productPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-lg font-bold text-[var(--text-primary)]">{totalOrders}</p>
                  <p className="text-xs text-[var(--text-muted)]">orders</p>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {productPie.map(p => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-xs text-[var(--text-secondary)] truncate max-w-[110px]">{p.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{p.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 3 - Recent Orders + Top Products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Recent Orders</h3>
            <button onClick={() => setActiveSubTab?.('CreateOrder')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>View All <ArrowRight size={12} /></button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
              <CheckCircle size={28} className="opacity-30 mb-2" />
              <p className="text-sm">No recent orders found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(order => (
                <div key={order.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl group hover:bg-[var(--border)] transition-colors cursor-pointer" onClick={() => setActiveSubTab?.('CreateOrder')}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--accent)' }}>{initials(order.clientName)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{order.clientName}</p>
                    <p className="text-xs text-[var(--text-muted)]">{order.id} · {order.productName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">GHS {order.totalAmount.toLocaleString()}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || ''}`}>{STATUS_LABELS[order.status] || order.status}</span>
                  </div>
                  <div className="relative opacity-0 group-hover:opacity-100">
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === order.id ? null : order.id); }} className="p-1 rounded-lg hover:bg-[var(--bg-card)]"><MoreVertical size={12} className="text-[var(--text-muted)]" /></button>
                    {menuOpen === order.id && (
                      <div className="absolute right-0 top-6 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setActiveSubTab?.('CreateOrder'); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Details</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Top Products</h3>
            <button onClick={() => setActiveSubTab?.('MktAnalytics')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>View All <ArrowRight size={12} /></button>
          </div>
          {topProducts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
              <CheckCircle size={28} className="opacity-30 mb-2" />
              <p className="text-sm">No product stats recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: ['#10b981', '#6366f1', '#f59e0b'][i % 3] }}>#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{p.orders} orders · {p.qty} units</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">GHS {(p.revenue / 1000).toFixed(0)}K</p>
                    <TrendingUp size={11} className="text-green-500 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 4 - Revenue Overview */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Revenue Overview</h3>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">GHS {revenue.toLocaleString()} <span className="text-sm font-normal text-green-500">+8.2%</span></p>
          </div>
          <select value={revPeriod} onChange={e => setRevPeriod(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none">
            {['This Month', 'This Quarter', 'This Year'].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="h-44">
          {revenueData.every(w => w.revenue === 0) ? (
            <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No revenue data to display</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<Tt />} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ROW 5 - Order Pipeline + Credit Requests */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Order Pipeline</h3>
          {statusPie.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-[var(--text-muted)] text-xs">No orders in pipeline</div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="relative" style={{ width: 130, height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={62} strokeWidth={0}>
                      {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-lg font-bold text-[var(--text-primary)]">{totalOrders}</p>
                  <p className="text-xs text-[var(--text-muted)]">total</p>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {statusPie.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-xs text-[var(--text-secondary)]">{s.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Credit Requests</h3>
            <button onClick={() => setActiveSubTab?.('CreditRequests')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>View All <ArrowRight size={12} /></button>
          </div>
          {creditRequests.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
              <CheckCircle size={28} className="opacity-30 mb-2" />
              <p className="text-sm">No pending credit requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {creditRequests.map(cr => (
                <div key={cr.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl cursor-pointer hover:bg-[var(--border)]" onClick={() => setActiveSubTab?.('CreditRequests')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{cr.customer}</p>
                    <p className="text-xs text-[var(--text-muted)]">{cr.id} · {cr.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">GHS {cr.amount.toLocaleString()}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cr.status === 'Pending Management' ? 'bg-yellow-100 text-yellow-700' : cr.status === 'Management Approved' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{cr.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 6 - Customer Growth + Payment Methods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[var(--text-primary)]">Customer Growth</h3>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{totalCustomers} <span className="text-sm font-normal text-green-500">+3 this month</span></p>
          <div className="h-40">
            {custGrowth.every(g => g.n === 0) ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">No customer growth data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={custGrowth}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="n" name="New Customers" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Payment Methods</h3>
          {paymentPie.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-[var(--text-muted)] text-xs">No payment methods logged</div>
          ) : (
            <div className="flex items-center gap-5">
              <div style={{ width: 120, height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentPie} dataKey="value" cx="50%" cy="50%" innerRadius={36} outerRadius={58} strokeWidth={0}>
                      {paymentPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {paymentPie.map(p => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-xs text-[var(--text-secondary)]">{p.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{p.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
