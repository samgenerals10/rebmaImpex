// rebma-web/src/views/ceo/SupplierOrdersView.tsx

import { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag, Plus, FileSpreadsheet, FileText, X, ChevronDown,
  MoreVertical, Bell, CheckCircle, Trash2, Search, Filter,
  Package, DollarSign, Truck, Clock, AlertCircle, Mail, MessageCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
import { ChevronRight as BcChevron } from 'lucide-react';

function InlineBreadcrumb({ crumbs, onBack }: { crumbs: string[]; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {crumbs.map((c, i) => (
        <div key={i} className="flex items-center gap-1 min-w-0">
          {i > 0 && <BcChevron className="w-3 h-3 text-[var(--text-muted)] flex-none" />}
          {i === 0 && onBack ? (
            <button onClick={onBack} className="text-[var(--text-muted)] hover:text-[var(--accent)] hover:underline">{c}</button>
          ) : i < crumbs.length - 1 ? (
            <span className="text-[var(--text-muted)]">{c}</span>
          ) : (
            <span className="font-medium text-[var(--text-primary)]">{c}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SupplierOrder {
  id: string;
  order_number: string;
  supplier_name: string;
  supplier_country: string;
  supplier_email?: string;
  products: ProductItem[];
  total_amount: number;
  currency: string;
  exchange_rate: number;
  total_amount_ghs: number;
  expected_delivery_date: string;
  shipping_method: string;
  shipping_details?: string;
  port_of_entry: string;
  status: 'pending' | 'payment_authorised' | 'shipped' | 'arrived' | 'received' | 'completed';
  payment_authorised: boolean;
  payment_authorised_at?: string;
  payment_reference?: string;
  notes?: string;
  created_at: string;
}

interface ProductItem {
  product_name: string;
  product_code?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  currency: string;
  total_price: number;
}

interface Props {
  currentUser: { fullName: string; department: string } | null;
  addNotification: (msg: string) => void;
  onNavigateToOrders?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  Poland: '🇵🇱', Turkey: '🇹🇷', Germany: '🇩🇪', UK: '🇬🇧',
  USA: '🇺🇸', China: '🇨🇳', India: '🇮🇳', Other: '🌍',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:             { label: 'Pending',            color: '#b45309', bg: '#fef3c7' },
  payment_authorised:  { label: 'Payment Authorised', color: '#1d4ed8', bg: '#dbeafe' },
  shipped:             { label: 'Shipped',             color: '#7c3aed', bg: '#ede9fe' },
  arrived:             { label: 'Arrived',             color: '#c2410c', bg: '#fff7ed' },
  received:            { label: 'Received',            color: '#15803d', bg: '#dcfce7' },
  completed:           { label: 'Completed',           color: '#166534', bg: '#bbf7d0' },
};

const MOCK_ORDERS: SupplierOrder[] = [
  {
    id: '1', order_number: 'SUP-2026-001', supplier_name: 'Gdansk Food Exports', supplier_country: 'Poland',
    supplier_email: 'orders@gdanskfood.pl', currency: 'USD', exchange_rate: 15.4,
    products: [{ product_name: 'Milk Powder 500g', product_code: 'MP-500', quantity: 20, unit: 'Tons', unit_price: 3200, currency: 'USD', total_price: 64000 }],
    total_amount: 64000, total_amount_ghs: 985600, expected_delivery_date: '2026-07-15',
    shipping_method: 'Sea Freight', shipping_details: 'Vessel: MV Atlantic Star', port_of_entry: 'Tema Port',
    status: 'payment_authorised', payment_authorised: true, payment_authorised_at: '2026-06-10T09:30:00Z',
    payment_reference: 'REF-GHC-2026-001', created_at: '2026-06-08T10:00:00Z', notes: 'Priority shipment'
  },
  {
    id: '2', order_number: 'SUP-2026-002', supplier_name: 'Istanbul Grain Co.', supplier_country: 'Turkey',
    supplier_email: 'exports@istgrains.com.tr', currency: 'EUR', exchange_rate: 16.8,
    products: [
      { product_name: 'Bread Flour 10kg', product_code: 'BF-10', quantity: 15, unit: 'Tons', unit_price: 850, currency: 'EUR', total_price: 12750 },
      { product_name: 'Semolina 25kg', product_code: 'SEM-25', quantity: 8, unit: 'Tons', unit_price: 920, currency: 'EUR', total_price: 7360 },
    ],
    total_amount: 20110, total_amount_ghs: 337848, expected_delivery_date: '2026-07-28',
    shipping_method: 'Sea Freight', port_of_entry: 'Tema Port',
    status: 'pending', payment_authorised: false, created_at: '2026-06-10T14:00:00Z',
  },
  {
    id: '3', order_number: 'SUP-2026-003', supplier_name: 'Warsaw Margarine Ltd.', supplier_country: 'Poland',
    supplier_email: 'trade@warsawmarg.pl', currency: 'USD', exchange_rate: 15.4,
    products: [{ product_name: 'Margarine 250g', product_code: 'MRG-250', quantity: 30, unit: 'Tons', unit_price: 2800, currency: 'USD', total_price: 84000 }],
    total_amount: 84000, total_amount_ghs: 1293600, expected_delivery_date: '2026-08-10',
    shipping_method: 'Sea Freight', port_of_entry: 'Takoradi Port',
    status: 'shipped', payment_authorised: true, payment_authorised_at: '2026-06-05T08:00:00Z',
    payment_reference: 'REF-GHC-2026-003', shipping_details: 'Vessel: MV Baltic Pearl | ETA Aug 10',
    created_at: '2026-06-02T09:00:00Z',
  },
];

function generateOrderNumber(existing: SupplierOrder[]) {
  const year = new Date().getFullYear();
  const max = existing.reduce((m, o) => {
    const n = parseInt(o.order_number.split('-')[2] || '0');
    return n > m ? n : m;
  }, 0);
  return `SUP-${year}-${String(max + 1).padStart(3, '0')}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SupplierOrdersView({ currentUser, addNotification }: Props) {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Load orders ──
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('supplier_orders')
          .select('*')
          .order('created_at', { ascending: false });
        setOrders(!error && data && data.length > 0 ? data : MOCK_ORDERS);
      } catch {
        setOrders(MOCK_ORDERS);
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const handler = () => setActiveMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // ── Derived stats ──
  const totalOrders = orders.length;
  const pendingPayment = orders.filter(o => o.status === 'pending').length;
  const inTransit = orders.filter(o => o.status === 'shipped').length;
  const thisMonthGhs = orders
    .filter(o => new Date(o.created_at).getMonth() === new Date().getMonth())
    .reduce((s, o) => s + (o.total_amount_ghs || 0), 0);

  // ── Filtered orders ──
  const filtered = orders.filter(o => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const q = searchText.toLowerCase();
    const matchesSearch = !q || o.order_number.toLowerCase().includes(q) ||
      o.supplier_name.toLowerCase().includes(q) ||
      o.products.some(p => p.product_name.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  // ── Status badge ──
  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
    return (
      <span style={{ background: cfg.bg, color: cfg.color }}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap">
        {cfg.label}
      </span>
    );
  };

  // ── Row menu actions ──
  const handleMenuAction = (action: string, order: SupplierOrder) => {
    setActiveMenu(null);
    if (action === 'view') { setSelectedOrder(order); setShowDetail(true); }
    else if (action === 'authorise') { setSelectedOrder(order); setShowAuthModal(true); }
    else if (action === 'notify') { setSelectedOrder(order); setShowNotifyModal(true); }
    else if (action === 'shipped') { updateStatus(order.id, 'shipped'); }
    else if (action === 'arrived') { updateStatus(order.id, 'arrived'); }
    else if (action === 'pdf') {
      exportToPDF(`Supplier Order ${order.order_number}`, order.products, ['product_name', 'quantity', 'unit', 'unit_price', 'total_price']);
    }
  };

  const updateStatus = (id: string, status: SupplierOrder['status']) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    supabase.from('supplier_orders').update({ status }).eq('id', id).then(() => {}, () => {});
    addNotification(`Order status updated to ${STATUS_CONFIG[status]?.label || status}.`);
  };

  return (
    <div className="space-y-5">
      <InlineBreadcrumb crumbs={['CEO Command', 'Supplier Orders']} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[var(--accent)]" />
            Supplier Orders
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Manage international supplier orders and payment authorisations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => exportToCSV(orders, ['order_number','supplier_name','supplier_country','total_amount','currency','total_amount_ghs','status','expected_delivery_date'], 'supplier_orders')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl hover:opacity-90">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => exportToPDF('Supplier Orders Report', orders, ['order_number','supplier_name','total_amount','currency','status'])}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl hover:opacity-90">
            <FileText className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-bold rounded-xl hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> New Order
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: totalOrders, icon: ShoppingBag, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Pending Payment', value: pendingPayment, icon: Clock, color: '#b45309', bg: '#fef3c7' },
          { label: 'In Transit', value: inTransit, icon: Truck, color: '#7c3aed', bg: '#ede9fe' },
          { label: 'This Month (GHS)', value: `GHS ${(thisMonthGhs / 1000).toFixed(0)}k`, icon: DollarSign, color: '#15803d', bg: '#dcfce7' },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
                <Icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">{c.label}</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Search by order #, supplier, product..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none">
          <option value="ALL">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Orders table */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--box-shadow)] overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-[var(--text-muted)] text-sm">Loading orders…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-input)]">
                  {['Order #', 'Supplier', 'Products', 'Amount', 'GHS Equiv.', 'Exp. Delivery', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-[var(--text-muted)] text-sm">No orders found.</td></tr>
                ) : filtered.map(order => (
                  <tr key={order.id}
                    onClick={() => { setSelectedOrder(order); setShowDetail(true); }}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-input)] transition-colors cursor-pointer">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[var(--accent)]">{order.order_number}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-semibold text-[var(--text-primary)] text-sm">{order.supplier_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{COUNTRY_FLAGS[order.supplier_country] || '🌍'} {order.supplier_country}</p>
                    </td>
                    <td className="py-3 px-4 max-w-[180px]">
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        {order.products.map(p => p.product_name).join(', ')}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">{order.products.length} item{order.products.length !== 1 ? 's' : ''}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                      {order.currency} {order.total_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-emerald-600 font-semibold">
                      GHS {(order.total_amount_ghs || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-[var(--text-muted)] text-xs">{order.expected_delivery_date}</td>
                    <td className="py-3 px-4"><StatusBadge status={order.status} /></td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <div className="relative" ref={activeMenu === order.id ? menuRef : null}>
                        <button onClick={() => setActiveMenu(activeMenu === order.id ? null : order.id)}
                          className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] transition-colors">
                          <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                        {activeMenu === order.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleMenuAction('view', order)} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">View Details</button>
                            {order.status === 'pending' && <button onClick={() => handleMenuAction('authorise', order)} className="px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg text-left font-semibold">Authorise Payment</button>}
                            {order.status === 'payment_authorised' && <button onClick={() => handleMenuAction('shipped', order)} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Mark as Shipped</button>}
                            {order.status === 'shipped' && <button onClick={() => handleMenuAction('arrived', order)} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Mark as Arrived</button>}
                            <button onClick={() => handleMenuAction('notify', order)} className="px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg text-left">Notify Operations</button>
                            <button onClick={() => handleMenuAction('pdf', order)} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export PDF</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Order Form Panel */}
      {showForm && (
        <NewOrderForm
          orders={orders}
          currentUser={currentUser}
          onClose={() => setShowForm(false)}
          onSave={(order) => {
            setOrders(prev => [order, ...prev]);
            setShowForm(false);
            addNotification(`Supplier order ${order.order_number} created.`);
          }}
        />
      )}

      {/* Order Detail View */}
      {showDetail && selectedOrder && (
        <OrderDetailView
          order={selectedOrder}
          onBack={() => { setShowDetail(false); setSelectedOrder(null); }}
          onAuthorise={() => { setShowDetail(false); setShowAuthModal(true); }}
          onNotify={() => { setShowDetail(false); setShowNotifyModal(true); }}
          onStatusUpdate={updateStatus}
          currentUser={currentUser}
          addNotification={addNotification}
        />
      )}

      {/* Payment Authorisation Modal */}
      {showAuthModal && selectedOrder && (
        <PaymentAuthModal
          order={selectedOrder}
          currentUser={currentUser}
          onClose={() => { setShowAuthModal(false); setSelectedOrder(null); }}
          onAuthorise={(ref, bank, date) => {
            const updated: SupplierOrder = {
              ...selectedOrder,
              status: 'payment_authorised',
              payment_authorised: true,
              payment_authorised_at: new Date().toISOString(),
              payment_reference: ref,
            };
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updated : o));
            supabase.from('supplier_orders').update({
              status: 'payment_authorised',
              payment_authorised: true,
              payment_authorised_at: new Date().toISOString(),
              payment_reference: ref,
            }).eq('id', selectedOrder.id).then(() => {}, () => {});
            supabase.from('global_audit_history').insert([{
              action: 'PAYMENT_AUTHORISED',
              details: `Order ${selectedOrder.order_number} | ${selectedOrder.supplier_name} | ${selectedOrder.currency} ${selectedOrder.total_amount} | Ref: ${ref}`,
              performed_by: currentUser?.fullName || 'CEO',
            }]).then(() => {}, () => {});
            addNotification(`Payment authorised for ${selectedOrder.order_number}. Supplier notified.`);
            setShowAuthModal(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {/* Notify Operations Modal */}
      {showNotifyModal && selectedOrder && (
        <NotifyOperationsModal
          order={selectedOrder}
          onClose={() => { setShowNotifyModal(false); setSelectedOrder(null); }}
          currentUser={currentUser}
          onSend={(msg, dept, userId) => {
            supabase.from('supplier_order_notifications').insert([{
              order_id: selectedOrder.id,
              notified_department: dept || 'OPERATIONS',
              notified_user_id: userId || null,
              message: msg,
              sent_by: null,
              read: false,
            }]).then(() => {}, () => {});
            addNotification(`Operations notified about ${selectedOrder.order_number}.`);
            setShowNotifyModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}

// ─── New Order Form ───────────────────────────────────────────────────────────

function NewOrderForm({ orders, currentUser, onClose, onSave }: {
  orders: SupplierOrder[];
  currentUser: { fullName: string; department: string } | null;
  onClose: () => void;
  onSave: (order: SupplierOrder) => void;
}) {
  const [supplierName, setSupplierName] = useState('');
  const [supplierCountry, setSupplierCountry] = useState('Poland');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [portOfEntry, setPortOfEntry] = useState('Tema Port');
  const [expectedDate, setExpectedDate] = useState('');
  const [shippingMethod, setShippingMethod] = useState('Sea Freight');
  const [shippingDetails, setShippingDetails] = useState('');

  const [products, setProducts] = useState<ProductItem[]>([
    { product_name: '', product_code: '', quantity: 0, unit: 'Tons', unit_price: 0, currency: 'USD', total_price: 0 }
  ]);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(15.4);
  const [paymentMethod, setPaymentMethod] = useState('Wire Transfer');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendChannel, setSendChannel] = useState<'email' | 'whatsapp' | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState('');

  const knownSuppliers = [...new Set(orders.map(o => o.supplier_name))];

  useEffect(() => {
    if (supplierName.length > 1) {
      const matches = knownSuppliers.filter(s => s.toLowerCase().includes(supplierName.toLowerCase()));
      setSupplierSuggestions(matches);
      setShowSuggestions(matches.length > 0);
      setIsNewSupplier(!knownSuppliers.includes(supplierName) && supplierName.length > 2);
    } else {
      setShowSuggestions(false);
      setIsNewSupplier(false);
    }
  }, [supplierName]);

  // Pre-fill send email when supplier email is known
  useEffect(() => {
    if (supplierEmail && !sendEmail) setSendEmail(supplierEmail);
  }, [supplierEmail]);

  const updateProduct = (i: number, field: keyof ProductItem, value: string | number) => {
    setProducts(prev => {
      const next = [...prev];
      const p = { ...next[i], [field]: value };
      p.total_price = p.quantity * p.unit_price;
      next[i] = p;
      return next;
    });
  };

  const totalAmount = products.reduce((s, p) => s + p.total_price, 0);
  const totalGhs = totalAmount * exchangeRate;

  const handleSubmit = async (draft = false) => {
    if (!supplierName || products.some(p => !p.product_name)) return;
    setSaving(true);
    const orderNumber = generateOrderNumber(orders);
    const order: SupplierOrder = {
      id: String(Date.now()),
      order_number: orderNumber,
      supplier_name: supplierName,
      supplier_country: supplierCountry,
      supplier_email: supplierEmail,
      products,
      total_amount: totalAmount,
      currency,
      exchange_rate: exchangeRate,
      total_amount_ghs: totalGhs,
      expected_delivery_date: expectedDate,
      shipping_method: shippingMethod,
      shipping_details: shippingDetails,
      port_of_entry: portOfEntry,
      status: 'pending',
      payment_authorised: false,
      notes,
      created_at: new Date().toISOString(),
    };

    // Save to Supabase
    if (isNewSupplier && supplierName) {
      supabase.from('suppliers').insert([{
        name: supplierName, country: supplierCountry,
        contact_name: supplierContact, contact_email: supplierEmail,
        currency,
      }]).then(() => {}, () => {});
    }
    supabase.from('supplier_orders').insert([{
      ...order, id: undefined,
    }]).then(() => {}, () => {});

    setSaving(false);
    onSave(order);
  };

  const buildWhatsAppMessage = (order: SupplierOrder) => {
    const lines = [
      `*New Purchase Order — REBMA IMPEX Ghana Limited*`,
      `Order #: ${order.order_number}`,
      `Date: ${new Date(order.created_at).toLocaleDateString()}`,
      ``,
      `*Products:*`,
      ...order.products.map(p => `• ${p.product_name} — ${p.quantity} ${p.unit} @ ${p.currency} ${p.unit_price}/unit = ${p.currency} ${p.total_price.toLocaleString()}`),
      ``,
      `Total: ${order.currency} ${order.total_amount.toLocaleString()} (approx GHS ${(order.total_amount_ghs || 0).toLocaleString()})`,
      `Port of Entry: ${order.port_of_entry}`,
      `Expected Delivery: ${order.expected_delivery_date || 'TBD'}`,
      ``,
      `Please confirm receipt and proceed as agreed.`,
      `Regards, ${currentUser?.fullName || 'CEO'} | REBMA IMPEX`,
    ];
    return encodeURIComponent(lines.join('\n'));
  };

  const buildOrder = (): SupplierOrder | null => {
    if (!supplierName || products.some(p => !p.product_name)) return null;
    return {
      id: String(Date.now()),
      order_number: generateOrderNumber(orders),
      supplier_name: supplierName,
      supplier_country: supplierCountry,
      supplier_email: supplierEmail,
      products,
      total_amount: totalAmount,
      currency,
      exchange_rate: exchangeRate,
      total_amount_ghs: totalGhs,
      expected_delivery_date: expectedDate,
      shipping_method: shippingMethod,
      shipping_details: shippingDetails,
      port_of_entry: portOfEntry,
      status: 'pending',
      payment_authorised: false,
      notes,
      created_at: new Date().toISOString(),
    };
  };

  const saveToSupabase = (order: SupplierOrder) => {
    if (isNewSupplier && supplierName) {
      supabase.from('suppliers').insert([{
        name: supplierName, country: supplierCountry,
        contact_name: supplierContact, contact_email: supplierEmail, currency,
      }]).then(() => {}, () => {});
    }
    supabase.from('supplier_orders').insert([{ ...order, id: undefined }]).then(() => {}, () => {});
  };

  const handleSendNow = async () => {
    const order = buildOrder();
    if (!order) return;
    setSaving(true);
    saveToSupabase(order);
    if (sendChannel === 'whatsapp') {
      const num = sendWhatsapp.replace(/\D/g, '');
      if (num) window.open(`https://wa.me/${num}?text=${buildWhatsAppMessage(order)}`, '_blank');
    }
    setSaving(false);
    onSave(order);
  };

  const handleSaveDraft = async () => {
    const order = buildOrder();
    if (!order) return;
    setSaving(true);
    saveToSupabase(order);
    setSaving(false);
    onSave(order);
  };

  const inputCls = "w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative h-full w-full sm:w-[600px] bg-[var(--bg-card)] shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)] z-10">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">New Supplier Order</h3>
            <p className="text-xs text-[var(--text-muted)]">International procurement order</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--accent-light)] transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-5 space-y-6 flex-1">
          {/* ── Supplier Details ── */}
          <section>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Supplier Details</h4>
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Supplier Name *</label>
                <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
                  placeholder="Start typing supplier name..." className={inputCls} />
                {showSuggestions && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg z-20 overflow-hidden">
                    {supplierSuggestions.map((s, i) => (
                      <button key={i} onClick={() => { setSupplierName(s); setShowSuggestions(false); setIsNewSupplier(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--accent-light)] text-[var(--text-primary)]">{s}</button>
                    ))}
                  </div>
                )}
              </div>
              {isNewSupplier && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-3">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold">New supplier — enter details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Country *</label>
                      <select value={supplierCountry} onChange={e => setSupplierCountry(e.target.value)} className={inputCls}>
                        {['Poland','Turkey','Germany','UK','USA','China','India','Other'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Contact Name</label>
                      <input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} placeholder="Full name" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Contact Email</label>
                    <input value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} placeholder="supplier@example.com" type="email" className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Order Details ── */}
          <section>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Order Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Port of Entry</label>
                <select value={portOfEntry} onChange={e => setPortOfEntry(e.target.value)} className={inputCls}>
                  <option>Tema Port</option>
                  <option>Takoradi Port</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Expected Delivery</label>
                <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Shipping Method</label>
                <select value={shippingMethod} onChange={e => setShippingMethod(e.target.value)} className={inputCls}>
                  <option>Sea Freight</option>
                  <option>Air Freight</option>
                  <option>Road Freight</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Shipping Details</label>
              <input value={shippingDetails} onChange={e => setShippingDetails(e.target.value)} placeholder="Vessel name, tracking # ..." className={inputCls} />
            </div>
          </section>

          {/* ── Products ── */}
          <section>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Products Ordered</h4>
            <div className="space-y-3">
              {products.map((p, i) => (
                <div key={i} className="bg-[var(--bg-input)] rounded-xl p-3 space-y-2 border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">Product {i + 1}</span>
                    {products.length > 1 && (
                      <button onClick={() => setProducts(prev => prev.filter((_, j) => j !== i))}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <input value={p.product_name} onChange={e => updateProduct(i, 'product_name', e.target.value)}
                        placeholder="Product name *" className={inputCls} />
                    </div>
                    <input value={p.quantity || ''} onChange={e => updateProduct(i, 'quantity', Number(e.target.value))}
                      placeholder="Quantity" type="number" className={inputCls} />
                    <select value={p.unit} onChange={e => updateProduct(i, 'unit', e.target.value)} className={inputCls}>
                      {['Tons','Kg','Cartons','Units'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input value={p.unit_price || ''} onChange={e => updateProduct(i, 'unit_price', Number(e.target.value))}
                      placeholder="Unit price" type="number" className={inputCls} />
                    <div className="flex items-center px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm font-semibold text-emerald-600">
                      {currency} {p.total_price.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setProducts(prev => [...prev, { product_name: '', product_code: '', quantity: 0, unit: 'Tons', unit_price: 0, currency, total_price: 0 }])}
                className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)] hover:opacity-80">
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </div>

            {/* Totals */}
            <div className="mt-4 bg-[var(--bg-input)] rounded-xl p-3 space-y-2 border border-[var(--border)]">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Subtotal</span>
                <span className="font-semibold text-[var(--text-primary)]">{currency} {totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)] flex-1">Exchange Rate (GHS)</span>
                <input value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))}
                  type="number" step="0.01" className="w-24 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-right text-[var(--text-primary)]" />
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-[var(--border)] pt-2">
                <span className="text-[var(--text-primary)]">Total in GHS</span>
                <span className="text-emerald-600">GHS {totalGhs.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </section>

          {/* ── Payment Details ── */}
          <section>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Payment Details</h4>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
              <option>Wire Transfer</option>
              <option>Letter of Credit</option>
              <option>Documentary Collection</option>
            </select>
          </section>

          {/* ── Notes ── */}
          <section>
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Notes</h4>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Additional notes..." className={`${inputCls} resize-none`} />
          </section>
        </div>

        {/* ── Send Channel Selection ── */}
        <div className="px-5 pb-2 space-y-4">
          <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Send Order Via</h4>

          <div className="grid grid-cols-2 gap-3">
            {/* Email card */}
            <button
              type="button"
              onClick={() => setSendChannel(sendChannel === 'email' ? null : 'email')}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                sendChannel === 'email'
                  ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                  : 'border-[var(--border)] bg-[var(--bg-input)] hover:border-[var(--accent)]'
              }`}
            >
              <Mail className={`w-6 h-6 ${sendChannel === 'email' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
              <span className={`text-sm font-semibold ${sendChannel === 'email' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                Send via Email
              </span>
            </button>

            {/* WhatsApp card */}
            <button
              type="button"
              onClick={() => setSendChannel(sendChannel === 'whatsapp' ? null : 'whatsapp')}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                sendChannel === 'whatsapp'
                  ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                  : 'border-[var(--border)] bg-[var(--bg-input)] hover:border-green-400'
              }`}
            >
              <MessageCircle className={`w-6 h-6 ${sendChannel === 'whatsapp' ? 'text-green-600' : 'text-[var(--text-muted)]'}`} />
              <span className={`text-sm font-semibold ${sendChannel === 'whatsapp' ? 'text-green-700 dark:text-green-400' : 'text-[var(--text-secondary)]'}`}>
                Send via WhatsApp
              </span>
            </button>
          </div>

          {/* Email input when email selected */}
          {sendChannel === 'email' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Supplier Email Address</label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={e => setSendEmail(e.target.value)}
                  placeholder="supplier@example.com"
                  className={inputCls}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSendNow} disabled={saving || !sendEmail}
                  className="flex-1 px-4 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                  {saving ? 'Sending…' : 'Send Now'}
                </button>
                <button onClick={handleSaveDraft} disabled={saving}
                  className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
                  Save Draft
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp input when whatsapp selected */}
          {sendChannel === 'whatsapp' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">WhatsApp Number (with country code)</label>
                <input
                  type="tel"
                  value={sendWhatsapp}
                  onChange={e => setSendWhatsapp(e.target.value)}
                  placeholder="+48123456789"
                  className={inputCls}
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Include country code, e.g. +48 for Poland, +90 for Turkey</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSendNow} disabled={saving || !sendWhatsapp}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {saving ? 'Opening…' : 'Send Now'}
                </button>
                <button onClick={handleSaveDraft} disabled={saving}
                  className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
                  Save Draft
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Always-visible Save as Draft */}
        <div className="px-5 pb-5 border-t border-[var(--border)] pt-4 sticky bottom-0 bg-[var(--bg-card)]">
          <button onClick={handleSaveDraft} disabled={saving}
            className="w-full px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors">
            {saving ? 'Saving…' : 'Save as Draft'}
          </button>
          <p className="text-[11px] text-[var(--text-muted)] text-center mt-2">Saves without sending. Status set to Pending.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail View ────────────────────────────────────────────────────────

function OrderDetailView({ order, onBack, onAuthorise, onNotify, onStatusUpdate, currentUser, addNotification }: {
  order: SupplierOrder;
  onBack: () => void;
  onAuthorise: () => void;
  onNotify: () => void;
  onStatusUpdate: (id: string, status: SupplierOrder['status']) => void;
  currentUser: { fullName: string; department: string } | null;
  addNotification: (msg: string) => void;
}) {
  const cfg = STATUS_CONFIG[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6' };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <InlineBreadcrumb crumbs={['CEO Command', 'Supplier Orders', order.order_number]} onBack={onBack} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{order.order_number}</h2>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Created {new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {order.status === 'pending' && (
              <button onClick={onAuthorise} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700">Authorise Payment</button>
            )}
            {order.status === 'payment_authorised' && (
              <button onClick={() => onStatusUpdate(order.id, 'shipped')} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700">Mark as Shipped</button>
            )}
            {order.status === 'shipped' && (
              <button onClick={() => onStatusUpdate(order.id, 'arrived')} className="px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600">Mark as Arrived</button>
            )}
            <button onClick={onNotify} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700">
              <Bell className="w-3.5 h-3.5" /> Notify Operations
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Supplier info */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Supplier Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Name</span><span className="font-semibold text-[var(--text-primary)]">{order.supplier_name}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Country</span><span>{COUNTRY_FLAGS[order.supplier_country] || '🌍'} {order.supplier_country}</span></div>
              {order.supplier_email && <div className="flex justify-between"><span className="text-[var(--text-muted)]">Email</span><span className="text-[var(--accent)] text-xs">{order.supplier_email}</span></div>}
            </div>
          </div>

          {/* Shipment info */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Shipment Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Method</span><span>{order.shipping_method}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Port</span><span>{order.port_of_entry}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Expected</span><span className="font-semibold">{order.expected_delivery_date || '—'}</span></div>
              {order.shipping_details && <div className="flex justify-between"><span className="text-[var(--text-muted)]">Details</span><span className="text-xs text-right max-w-[180px]">{order.shipping_details}</span></div>}
            </div>
          </div>
        </div>

        {/* Products table */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Products Ordered</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Product', 'Qty', 'Unit', 'Unit Price', 'Total'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-[var(--text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.products.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{p.product_name}</td>
                    <td className="py-3 px-3 text-[var(--text-secondary)]">{p.quantity}</td>
                    <td className="py-3 px-3 text-[var(--text-secondary)]">{p.unit}</td>
                    <td className="py-3 px-3 text-[var(--text-secondary)]">{p.currency} {p.unit_price.toLocaleString()}</td>
                    <td className="py-3 px-3 font-semibold text-emerald-600">{p.currency} {p.total_price.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-6"><span className="text-[var(--text-muted)]">Subtotal</span><span className="font-semibold">{order.currency} {order.total_amount.toLocaleString()}</span></div>
            <div className="flex gap-6"><span className="text-[var(--text-muted)]">Exchange Rate</span><span>{order.exchange_rate} GHS</span></div>
            <div className="flex gap-6 font-bold text-base"><span className="text-[var(--text-primary)]">Total (GHS)</span><span className="text-emerald-600">GHS {(order.total_amount_ghs || 0).toLocaleString()}</span></div>
          </div>
        </div>

        {/* Payment status */}
        <div className={`bg-[var(--bg-card)] rounded-2xl border p-5 shadow-[var(--box-shadow)] ${order.payment_authorised ? 'border-blue-200 dark:border-blue-800' : 'border-[var(--border)]'}`}>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Payment Status</h3>
          {order.payment_authorised ? (
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-blue-700 dark:text-blue-400">Payment Authorised</p>
                {order.payment_reference && <p className="text-[var(--text-muted)]">Reference: <span className="font-mono font-semibold text-[var(--text-primary)]">{order.payment_reference}</span></p>}
                {order.payment_authorised_at && <p className="text-[var(--text-muted)]">Authorised: {new Date(order.payment_authorised_at).toLocaleString()}</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <p className="text-sm text-amber-600 dark:text-amber-400">Awaiting payment authorisation</p>
              <button onClick={onAuthorise} className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700">Authorise Now</button>
            </div>
          )}
        </div>

        {order.notes && (
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Notes</h3>
            <p className="text-sm text-[var(--text-secondary)]">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payment Authorisation Modal ──────────────────────────────────────────────

function PaymentAuthModal({ order, currentUser, onClose, onAuthorise }: {
  order: SupplierOrder;
  currentUser: { fullName: string; department: string } | null;
  onClose: () => void;
  onAuthorise: (ref: string, bank: string, date: string) => void;
}) {
  const [ref, setRef] = useState('');
  const [bank, setBank] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const inputCls = "w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h3 className="font-bold text-[var(--text-primary)]">Authorise Payment</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--accent-light)]"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Order summary */}
          <div className="bg-[var(--bg-input)] rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Order</span><span className="font-mono font-semibold text-[var(--text-primary)]">{order.order_number}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Supplier</span><span className="font-semibold">{order.supplier_name}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Products</span><span className="text-right text-xs">{order.products.map(p => p.product_name).join(', ')}</span></div>
            <div className="flex justify-between border-t border-[var(--border)] pt-2 font-bold"><span>Total</span><span className="text-emerald-600">{order.currency} {order.total_amount.toLocaleString()} ≈ GHS {(order.total_amount_ghs || 0).toLocaleString()}</span></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Payment Reference *</label>
            <input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. REF-GHC-2026-001" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Bank / Institution</label>
              <input value={bank} onChange={e => setBank(e.target.value)} placeholder="GCB Bank..." className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Payment Date</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--accent)]" />
            <span className="text-xs text-[var(--text-secondary)] leading-relaxed">
              I confirm authorisation of this international payment on behalf of <strong>REBMA IMPEX Ghana Limited</strong>
            </span>
          </label>
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border)]">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Cancel</button>
          <button
            onClick={() => { if (ref && confirmed) onAuthorise(ref, bank, payDate); }}
            disabled={!ref || !confirmed}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
            Authorise & Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notify Operations Modal ──────────────────────────────────────────────────

function NotifyOperationsModal({ order, onClose, currentUser, onSend }: {
  order: SupplierOrder;
  onClose: () => void;
  currentUser: { fullName: string; department: string } | null;
  onSend: (msg: string, dept: string, userId: string | null) => void;
}) {
  const defaultMsg = `Incoming goods from ${order.supplier_name} (${order.supplier_country}).\nProducts: ${order.products.map(p => `${p.product_name} — ${p.quantity} ${p.unit}`).join(', ')}.\nExpected: ${order.expected_delivery_date || 'TBD'}.\nPlease prepare to receive.`;
  const [msg, setMsg] = useState(defaultMsg);
  const [notifyDept, setNotifyDept] = useState(true);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-[var(--bg-card)] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h3 className="font-bold text-[var(--text-primary)]">Notify Operations</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--accent-light)]"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-[var(--text-muted)]">Order <span className="font-mono font-semibold text-[var(--text-primary)]">{order.order_number}</span> — Operations will be able to see this in their Incoming Goods section.</p>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Message</label>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={5}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={notifyDept} onChange={e => setNotifyDept(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Operations Department</span>
          </label>
        </div>
        <div className="flex gap-3 p-5 border-t border-[var(--border)]">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Cancel</button>
          <button onClick={() => onSend(msg, notifyDept ? 'OPERATIONS' : '', null)}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">
            Send Notification
          </button>
        </div>
      </div>
    </div>
  );
}
