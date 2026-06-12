import { useState, useEffect } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import type { Order } from '../../types/erp';

const MOCK_ORDERS: Order[] = Array.from({ length: 20 }, (_, i) => {
  const statuses: Order['status'][] = ['DELIVERED', 'DELIVERED', 'APPROVED', 'PROCESSING', 'PENDING_FINANCE', 'REJECTED', 'DELIVERED'];
  const modes: Order['paymentMode'][] = ['CASH', 'CREDIT', 'ONLINE', 'CREDIT', 'CASH'];
  const clients = ['Accra Traders Ltd', 'Gulf Imports Co.', 'Kama Industries', 'Prime Suppliers', 'Delta Logistics'];
  const products = ['Steel Rods 12mm', 'Cement Bags (50kg)', 'Roofing Sheets', 'PVC Pipes', 'Electrical Cables'];
  const d = new Date(Date.now() - i * 86400000 * 9);
  return {
    id: `ord-${i + 1}`,
    ticketNumber: `RBM-${String(2001 + i).padStart(4, '0')}`,
    clientName: clients[i % 5],
    productName: products[i % 5],
    destination: ['Accra', 'Kumasi', 'Takoradi'][i % 3],
    paymentMode: modes[i % 5],
    totalAmount: Math.round(6000 + i * 4100),
    status: statuses[i % 7],
    createdAt: d.toISOString(),
  };
});

const STATUS_CREDIT_STYLES: Record<string, string> = {
  PENDING_FINANCE: 'bg-amber-100 text-amber-700',
  PENDING_MANAGEMENT: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-violet-100 text-violet-700',
};

const CREDIT_LABEL: Record<string, string> = {
  PENDING_FINANCE: 'Pending Finance',
  PENDING_MANAGEMENT: 'Pending Management',
  APPROVED: 'Approved',
  DELIVERED: 'Approved',
  REJECTED: 'Rejected',
  PROCESSING: 'Processing',
  OUT_FOR_DELIVERY: 'Out for Delivery',
};

function buildMonthlyData(orders: Order[]) {
  const now = new Date();
  const months: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    const revenue = orders
      .filter(o => o.status === 'DELIVERED')
      .filter(o => {
        const od = new Date(o.createdAt);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
      })
      .reduce((s, o) => s + o.totalAmount, 0);
    months.push({ month: label, revenue });
  }
  return months;
}

interface Props {
  ordersList: Order[];
  addNotification: (msg: string) => void;
}

export default function SalesHistoryView({ ordersList, addNotification }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sales' | 'credit'>('sales');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('orders').select('*').order('createdAt', { ascending: false }).limit(500);
        setOrders(data && data.length > 0 ? data : ordersList.length > 0 ? ordersList : MOCK_ORDERS);
      } catch {
        setOrders(ordersList.length > 0 ? ordersList : MOCK_ORDERS);
      }
      setLoading(false);
    };
    load();
  }, []);

  const delivered = orders.filter(o => o.status === 'DELIVERED' || o.status === 'APPROVED');
  const totalRevenue = orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0);
  const avgOrder = delivered.length > 0 ? Math.round(totalRevenue / Math.max(1, orders.filter(o => o.status === 'DELIVERED').length)) : 0;
  const monthlyData = buildMonthlyData(orders);
  const bestMonth = monthlyData.reduce((best, m) => m.revenue > best.revenue ? m : best, { month: '—', revenue: 0 });

  const creditOrders = orders.filter(o => o.paymentMode === 'CREDIT');
  const creditPending = creditOrders.filter(o => o.status === 'PENDING_FINANCE' || o.status === 'PENDING_MANAGEMENT').length;
  const creditApproved = creditOrders.filter(o => o.status === 'APPROVED' || o.status === 'DELIVERED').length;
  const creditRejected = creditOrders.filter(o => o.status === 'REJECTED').length;

  const exportCSV = () => {
    const rows = delivered.map(o => [o.ticketNumber || o.id, o.clientName, o.productName || '', o.totalAmount, o.paymentMode, o.createdAt.split('T')[0]]);
    const csv = [['Invoice#', 'Customer', 'Product', 'Amount', 'Payment Mode', 'Date'], ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'sales_history.csv'; a.click();
    addNotification('Sales history exported.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Sales History & Credit Requests</h2>
          <p className="text-xs text-[var(--text-muted)]">Revenue analytics and credit tracking</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-input)] rounded-xl self-start sm:self-auto">
          {(['sales', 'credit'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${tab === t ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
              {t === 'sales' ? 'Sales History' : 'Credit Requests'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">Loading…</div>
      ) : tab === 'sales' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue (GHS)', value: totalRevenue.toLocaleString(), color: 'text-emerald-600', icon: TrendingUp },
              { label: 'Avg Order Value (GHS)', value: avgOrder.toLocaleString(), color: 'text-[var(--accent)]', icon: TrendingUp },
              { label: 'Best Month', value: bestMonth.month, color: 'text-[var(--text-primary)]', icon: TrendingUp },
            ].map(c => (
              <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)] flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                  <c.icon className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">{c.label}</p>
                  <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-4">Revenue — Last 6 Months</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: 'var(--accent)', r: 4 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Sales Records ({delivered.length})</p>
              <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl hover:opacity-90">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)]">
                  {['Invoice #', 'Customer', 'Product', 'Amount', 'Payment', 'Date'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {delivered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-[var(--text-muted)] text-sm">No records.</td></tr>
                  ) : delivered.map(o => (
                    <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-input)] transition-colors">
                      <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{o.ticketNumber || o.id}</td>
                      <td className="py-3 px-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{o.clientName}</td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{o.productName || '—'}</td>
                      <td className="py-3 px-3 font-semibold text-emerald-600 whitespace-nowrap">GHS {o.totalAmount.toLocaleString()}</td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">{o.paymentMode}</td>
                      <td className="py-3 px-3 text-[var(--text-muted)] whitespace-nowrap">{o.createdAt.split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Credit Requests', value: creditOrders.length, color: 'text-[var(--text-primary)]' },
              { label: 'Pending', value: creditPending, color: 'text-amber-600' },
              { label: 'Approved', value: creditApproved, color: 'text-emerald-600' },
              { label: 'Rejected', value: creditRejected, color: 'text-rose-600' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-4">Credit Requests ({creditOrders.length})</p>
            {creditOrders.length === 0 ? (
              <p className="text-center py-8 text-sm text-[var(--text-muted)]">No credit requests found.</p>
            ) : (
              <div className="space-y-3">
                {creditOrders.map(o => (
                  <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-[var(--text-muted)]">{o.ticketNumber || o.id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CREDIT_STYLES[o.status] || 'bg-gray-100 text-gray-600'}`}>{CREDIT_LABEL[o.status] || o.status}</span>
                        </div>
                        <p className="font-semibold text-sm text-[var(--text-primary)] truncate mt-0.5">{o.clientName}</p>
                        <p className="text-xs text-[var(--text-muted)]">Submitted {o.createdAt.split('T')[0]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-bold text-emerald-600 text-sm whitespace-nowrap">GHS {o.totalAmount.toLocaleString()}</span>
                      <button onClick={() => addNotification(`Tracking order ${o.ticketNumber || o.id}.`)}
                        className="px-3 py-1.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-light)] transition-colors whitespace-nowrap">
                        Track
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
