import { useState, useEffect, useRef } from 'react';
import { Plus, Download, Search, MoreVertical, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useFullscreenToggle, FullscreenButton } from '../../components/global/FullscreenToggle';
import RatingBadge from '../../components/RatingBadge';
import { computeCustomerRating, ordersForCustomer } from '../../utils/customerRating';
import CountUp from '../../components/CountUp';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import DestinationLocator, { type Coords } from '../../components/dispatch/DestinationLocator';
import type { Order, OrderLineItem } from '../../types/erp';
import SidePanel, { SidePanelSection } from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';


const STATUS_STYLES: Record<Order['status'], string> = {
  PENDING_FINANCE: 'bg-amber-100 text-amber-700',
  PENDING_MANAGEMENT: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-violet-100 text-violet-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};

const STATUS_LABEL: Record<Order['status'], string> = {
  PENDING_FINANCE: 'Pending Finance',
  PENDING_MANAGEMENT: 'Pending Mgmt',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
};

const STEPPER = [
  { key: 'PENDING_MANAGEMENT', label: 'Pending Management' },
  { key: 'PENDING_FINANCE', label: 'Pending Finance' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
];

const PAGE_SIZE = 15;

interface Props {
  ordersList: Order[];
  onCreateOrder: (data: Partial<Order>) => void;
  addNotification: (msg: string) => void;
}

export default function OrdersView({ ordersList, onCreateOrder, addNotification }: Props) {
  const { getSetting } = useCeoSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const [productPrices, setProductPrices] = useState<Record<string, number>>({});
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string; discountPercent: number; isSpecialCustomer: boolean }[]>([]);
  const [destinationCoords, setDestinationCoords] = useState<Coords | null>(null);

  const openNewOrderModal = () => {
    setShowNewModal(true);
    setLineItems([{ productName: '', quantity: 1 }]);
    setForm({ clientName: '', destination: '', paymentMode: 'CASH', customerId: '', phone: '' });
    setDestinationCoords(null);
    supabase.from('goods_prices').select('product_name, unit_price').order('product_name').then(({ data }) => {
      setAvailableProducts((data || []).map((r: any) => String(r.product_name)));
      const priceMap: Record<string, number> = {};
      (data || []).forEach((r: any) => { priceMap[r.product_name] = Number(r.unit_price ?? 0); });
      setProductPrices(priceMap);
    }, () => {});
    supabase.from('stock').select('product_name, quantity').then(({ data }) => {
      const stockMap: Record<string, number> = {};
      (data || []).forEach((r: any) => { stockMap[String(r.product_name).trim().toLowerCase()] = Number(r.quantity ?? 0); });
      setStockLevels(stockMap);
    }, () => {});
    // select('*') rather than naming discount_percent/is_special_customer explicitly —
    // if those columns haven't been migrated onto the live DB yet, an explicit column
    // list would fail the whole query and silently break customer selection entirely,
    // not just the discount feature. This degrades gracefully either way.
    supabase.from('customers').select('*').order('name').then(({ data }) => {
      const seen = new Set<string>();
      const unique = (data || []).filter((r: any) => {
        const n = String(r.name || '').trim().toLowerCase();
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
      });
      setCustomers(unique.map((r: any) => ({
        id: String(r.id),
        name: String(r.name).trim(),
        phone: String(r.phone || '').trim(),
        discountPercent: Number(r.discount_percent) || 0,
        isSpecialCustomer: r.is_special_customer ?? false,
      })));
    }, () => {});
  };

  // Resolves to a real customer.id only on an exact name match (e.g. picked from the
  // datalist) — typing a name that doesn't match anyone leaves no customer linked and
  // no discount applied, rather than guessing.
  const resolveCustomer = (name: string) => customers.find(c => c.name.toLowerCase() === name.trim().toLowerCase());

  const getStock = (productName: string): number => stockLevels[productName.trim().toLowerCase()] ?? 0;

  const updateLineItem = (index: number, field: 'productName' | 'quantity', value: string | number) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addLineItem = () => setLineItems(prev => [...prev, { productName: '', quantity: 1 }]);

  const removeLineItem = (index: number) => setLineItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({ clientName: '', destination: '', paymentMode: 'CASH' as Order['paymentMode'], customerId: '', phone: '' });
  const [lineItems, setLineItems] = useState<{ productName: string; quantity: number }[]>([{ productName: '', quantity: 1 }]);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const tableFullscreen = useFullscreenToggle();

  const mapOrder = (r: any): Order => ({
    id: r.id,
    ticketNumber: r.ticket_number || r.ticketNumber || r.id,
    clientName: r.client_name || r.clientName || '',
    customerId: r.customer_id || r.customerId || undefined,
    phone: r.phone || undefined,
    productName: r.product_name || r.productName || '',
    destination: r.destination || '',
    totalAmount: Number(r.total_amount ?? r.totalAmount ?? 0),
    paymentMode: r.payment_mode || r.paymentMode || 'CASH',
    status: r.status || 'PENDING_FINANCE',
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
    quantity: Number(r.quantity ?? 0),
    metadata: r.metadata || null,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300);
        const mapped = (data || []).map(mapOrder);
        setOrders(mapped.length > 0 ? mapped : ordersList.length > 0 ? ordersList : []);
      } catch {
        setOrders(ordersList.length > 0 ? ordersList : []);
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = orders.filter(o => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.clientName.toLowerCase().includes(q) && !(o.ticketNumber || '').toLowerCase().includes(q)) return false;
    }
    if (dateFrom && o.createdAt < dateFrom) return false;
    if (dateTo && o.createdAt > dateTo + 'T23:59:59') return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalValue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const pending = orders.filter(o => o.status === 'PENDING_FINANCE' || o.status === 'PENDING_MANAGEMENT').length;
  const active = orders.filter(o => o.status === 'PROCESSING' || o.status === 'DELIVERED').length;

  const handleSave = async () => {
    if (submitting) return;
    if (!form.clientName.trim()) { addNotification('Customer name is required.'); return; }
    const validItems = lineItems.filter(item => item.productName.trim());
    if (validItems.length === 0) { addNotification('Add at least one product.'); return; }

    const shortages = validItems.filter(item => item.quantity > getStock(item.productName));
    if (shortages.length > 0) {
      addNotification(`Cannot order more than what's in stock: ${shortages.map(i => `${i.productName} (only ${getStock(i.productName).toLocaleString()} available)`).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const ticketNumber = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
      const now = new Date().toISOString();

      // Resolve the customer one more time at submit — the discount that lands on
      // the order is whatever's true right now, not a stale value from when the
      // field was last typed into.
      const resolvedCustomer = form.customerId ? customers.find(c => c.id === form.customerId) : resolveCustomer(form.clientName);
      const discountPct = resolvedCustomer?.discountPercent || 0;

      // Build line items with pricing
      const itemsWithPricing = validItems.map(item => {
        const unitPrice = (productPrices[item.productName] ?? 0) * (1 - discountPct / 100);
        const qty = Math.max(1, item.quantity);
        return { productName: item.productName, quantity: qty, unitPrice, lineTotal: unitPrice * qty };
      });
      const orderTotal = itemsWithPricing.reduce((s, i) => s + i.lineTotal, 0);

      const creditLimit = getSetting('max_credit_amount', 0);
      if (form.paymentMode === 'CREDIT' && creditLimit > 0 && orderTotal > creditLimit) {
        addNotification(`Credit orders are capped at GHS ${Number(creditLimit).toLocaleString()} by the CEO — this order is GHS ${orderTotal.toLocaleString()}.`);
        setSubmitting(false);
        return;
      }

      // Product name display: join all product names with commas
      const productDisplay = itemsWithPricing.map(item => item.productName).join(', ');

      // Routed through an atomic DB function (not a plain insert) so two
      // concurrent orders for the same product can't both pass a stock
      // check against a stale snapshot and jointly oversell — it locks per
      // product, checks stock minus everything already promised to open
      // orders, and inserts, all in one transaction.
      const { data: inserted, error } = await supabase.rpc('create_order_with_stock_check', {
        p_ticket_number: ticketNumber,
        p_client_name: form.clientName.trim(),
        p_product_name: productDisplay,
        p_destination: form.destination || null,
        p_payment_mode: form.paymentMode,
        p_total_amount: orderTotal,
        p_status: 'PENDING_MANAGEMENT',
        p_metadata: { items: itemsWithPricing, discountPercent: discountPct },
        p_customer_id: resolvedCustomer?.id || null,
        p_destination_lat: destinationCoords?.lat ?? null,
        p_destination_lng: destinationCoords?.lng ?? null,
        p_phone: form.phone.trim() || resolvedCustomer?.phone || null,
      });

      if (error) { addNotification(`Failed to create order: ${error.message}`); return; }
      const newOrder = mapOrder(inserted || {
        id: `ord-${Date.now()}`, ticket_number: ticketNumber,
        client_name: form.clientName, product_name: productDisplay,
        destination: form.destination, payment_mode: form.paymentMode,
        total_amount: orderTotal, status: 'PENDING_MANAGEMENT', created_at: now,
      });
      onCreateOrder(newOrder);
      setOrders(prev => [newOrder, ...prev]);
      setShowNewModal(false);
      setLineItems([{ productName: '', quantity: 1 }]);
      setForm({ clientName: '', destination: '', paymentMode: 'CASH', customerId: '', phone: '' });
      setDestinationCoords(null);
      addNotification('Order created successfully. Routed to Management for review.');
    } catch (e: any) {
      console.error(e);
      addNotification(`Error creating order: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Order#', 'Customer', 'Product', 'Amount', 'Payment Mode', 'Status', 'Date'];
    const rows = filtered.map(o => [o.ticketNumber || o.id, o.clientName, o.productName || '', o.totalAmount ?? 0, o.paymentMode, o.status, (o.createdAt || '').split('T')[0]]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'orders.csv'; a.click();
    addNotification('Exported CSV.');
  };

  const stepperIndex = (status: Order['status']) => STEPPER.findIndex(s => s.key === status);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Sales Orders</h2>
          <p className="text-xs text-[var(--text-muted)]">{orders.length} total orders</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => addNotification('PDF export ready.')} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-input)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={openNewOrderModal} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> New Order
          </button>
          <FullscreenButton expanded={tableFullscreen.expanded} onClick={tableFullscreen.toggle} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'All Orders', value: orders.length, decimals: 0, color: 'text-[var(--text-primary)]' },
          { label: 'Pending', value: pending, decimals: 0, color: 'text-amber-600' },
          { label: 'Active / Delivered', value: active, decimals: 0, color: 'text-emerald-600' },
          { label: 'Total Value (GHS)', value: totalValue, decimals: 2, color: 'text-[var(--accent)]' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}><CountUp value={c.value} decimals={c.decimals} /></p>
          </div>
        ))}
      </div>

      <div className={`bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)] ${tableFullscreen.expanded ? tableFullscreen.fullscreenClass : 'rounded-2xl'}`}>
        {tableFullscreen.expanded && (
          <div className="flex justify-end mb-3"><FullscreenButton expanded onClick={tableFullscreen.toggle} /></div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search by client or order ID…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <SearchableDropdown
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(0); }}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'PENDING_FINANCE', label: 'Pending Finance' },
              { value: 'PENDING_MANAGEMENT', label: 'Pending Mgmt' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'PROCESSING', label: 'Processing' },
              { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
              { value: 'DELIVERED', label: 'Delivered' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
            className="w-48"
          />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Order #', 'Customer', 'Product', 'Amount', 'Payment', 'Status', 'Date', ''].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-[var(--text-muted)] text-sm">Loading…</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-[var(--text-muted)] text-sm">No orders found.</td></tr>
              ) : paginated.map(o => (
                <tr key={o.id} onClick={() => setSelectedOrder(o)} className="border-b border-[var(--border)] hover:bg-[var(--bg-input)] cursor-pointer transition-colors">
                  <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">{o.ticketNumber || o.id}</td>
                  <td className="py-3 px-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{o.clientName}</span>
                      <RatingBadge rating={computeCustomerRating(ordersForCustomer(orders, o.clientName))} size="xs" />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">
                    {(() => {
                      const items: OrderLineItem[] | undefined = o.metadata?.items;
                      if (items && items.length > 0) {
                        return (
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            {items.map((item, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent)] text-[10px] font-medium truncate max-w-[100px]" title={item.productName}>
                                {item.productName}
                              </span>
                            ))}
                          </span>
                        );
                      }
                      return <span>{o.productName || '—'}</span>;
                    })()}
                  </td>
                  <td className="py-3 px-3 font-semibold text-emerald-600 whitespace-nowrap">GHS {(o.totalAmount ?? 0).toLocaleString()}</td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{o.paymentMode}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-muted)] whitespace-nowrap">{o.createdAt.split('T')[0]}</td>
                  <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                    <div className="relative" ref={activeMenu === o.id ? menuRef : undefined}>
                      <button onClick={() => setActiveMenu(activeMenu === o.id ? null : o.id)}
                        className="p-1 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)]">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeMenu === o.id && (
                        <div className="absolute right-0 top-7 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg w-32 py-1">
                          {['View', 'Edit', 'Cancel'].map(a => (
                            <button key={a} onClick={() => { setActiveMenu(null); if (a === 'View') setSelectedOrder(o); else addNotification(`${a} order ${o.ticketNumber || o.id}.`); }}
                              className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">{a}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[var(--text-muted)]">Showing {paginated.length} of {filtered.length}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 rounded-lg border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--bg-input)] text-[var(--text-secondary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-[var(--text-secondary)]">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--bg-input)] text-[var(--text-secondary)]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {(() => {
        const discountPct = customers.find(c => c.id === form.customerId)?.discountPercent || 0;
        const orderTotal = lineItems.reduce((s, item) => {
          const price = (productPrices[item.productName] ?? 0) * (1 - discountPct / 100);
          return s + price * Math.max(1, item.quantity);
        }, 0);
        return (
          <SidePanel
            open={showNewModal}
            onClose={() => setShowNewModal(false)}
            title="New Sales Order"
            width="lg"
            footer={
              <>
                <button disabled={submitting} onClick={() => setShowNewModal(false)} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
                <button disabled={submitting} onClick={handleSave} className="erp-btn erp-btn-primary disabled:opacity-50">
                  {submitting ? 'Saving...' : `Save Order${lineItems.filter(i => i.productName).length > 1 ? `s (${lineItems.filter(i => i.productName).length})` : ''}`}
                </button>
              </>
            }
          >
            <datalist id="customer-names-list">
              {customers.map(c => <option key={c.id} value={c.name} />)}
            </datalist>

            <SidePanelSection label="Customer & Destination">
              <div className="erp-form-group">
                <label className="erp-label">Customer Name *</label>
                <input type="text" list="customer-names-list" value={form.clientName}
                  onChange={e => {
                    const name = e.target.value;
                    const match = resolveCustomer(name);
                    // Auto-fill phone from a matched customer, but don't clobber
                    // a phone the user already typed manually for a new customer.
                    setForm(prev => ({ ...prev, clientName: name, customerId: match?.id || '', phone: match?.phone || prev.phone }));
                  }}
                  placeholder="Type or select customer name..."
                  className="erp-input" />
                {form.customerId && !!customers.find(c => c.id === form.customerId)?.discountPercent && (
                  <p className="text-[10px] font-semibold text-emerald-600 mt-1">
                    {customers.find(c => c.id === form.customerId)?.discountPercent}% customer discount will be applied
                  </p>
                )}
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Customer Phone</label>
                <input type="tel" value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 024 123 4567. Sent to the driver so they can reach the customer"
                  className="erp-input" />
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Destination</label>
                <DestinationLocator
                  value={form.destination}
                  onChange={text => setForm(prev => ({ ...prev, destination: text }))}
                  onResolve={setDestinationCoords}
                  placeholder="Enter the destination name, or its coordinates…"
                />
              </div>
            </SidePanelSection>

            <SidePanelSection label="Products">
              <div className="flex items-center justify-between -mt-2 mb-1">
                <span className="text-[10px] text-[var(--text-muted)]">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {lineItems.map((item, index) => {
                  const basePrice = productPrices[item.productName] ?? null;
                  const unitPrice = basePrice != null ? basePrice * (1 - discountPct / 100) : null;
                  const lineTotal = unitPrice != null ? unitPrice * Math.max(1, item.quantity) : null;
                  const stockAvailable = item.productName ? getStock(item.productName) : null;
                  const exceedsStock = stockAvailable != null && item.quantity > stockAvailable;
                  return (
                    <div key={index} className={`rounded-xl border p-3 space-y-2 ${exceedsStock ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20' : 'border-[var(--border)] bg-[var(--bg)]'}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          {availableProducts.length > 0 ? (
                            <SearchableDropdown
                              value={item.productName}
                              onChange={v => updateLineItem(index, 'productName', v)}
                              placeholder="Select product"
                              options={availableProducts.map(p => ({ value: p, label: p, sublabel: `in stock: ${getStock(p).toLocaleString()}` }))}
                            />
                          ) : (
                            <input type="text" value={item.productName} onChange={e => updateLineItem(index, 'productName', e.target.value)}
                              placeholder="Product name…"
                              className="erp-input" />
                          )}
                        </div>
                        <div className="w-24 shrink-0">
                          <input type="number" min="1" value={item.quantity} onChange={e => updateLineItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                            className={`w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border text-[var(--text-primary)] focus:outline-none text-center ${exceedsStock ? 'border-rose-400 focus:border-rose-500' : 'border-[var(--border)] focus:border-[var(--accent)]'}`} />
                        </div>
                        {lineItems.length > 1 && (
                          <button onClick={() => removeLineItem(index)} className="p-1.5 rounded-lg hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-500 shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {exceedsStock && (
                        <p className="px-1 text-xs font-semibold text-rose-600">
                          Only {stockAvailable!.toLocaleString()} in stock. Cannot order {item.quantity}.
                        </p>
                      )}
                      {unitPrice != null ? (
                        <div className="flex items-center justify-between px-1 text-xs text-[var(--text-muted)]">
                          <span>GHS {unitPrice.toLocaleString()} per unit{discountPct > 0 ? ` (${discountPct}% off)` : ''}</span>
                          <span className="font-semibold text-[var(--accent)]">= GHS {lineTotal!.toLocaleString()}</span>
                        </div>
                      ) : item.productName ? (
                        <p className="text-[10px] text-amber-600 px-1">No price set. Management must price this product</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <button onClick={addLineItem}
                className="mt-2 w-full py-2 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--accent)] hover:bg-[var(--accent-light)] flex items-center justify-center gap-1.5 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add another product
              </button>

              {orderTotal > 0 && (
                <div className="rounded-xl bg-[var(--accent-light)] border border-[var(--border)] px-4 py-3 flex items-center justify-between mt-3">
                  <span className="text-xs text-[var(--text-secondary)]">Order Total ({lineItems.filter(i => i.productName).length} item{lineItems.filter(i => i.productName).length !== 1 ? 's' : ''})</span>
                  <span className="text-base font-bold text-[var(--accent)]">GHS {orderTotal.toLocaleString()}</span>
                </div>
              )}
            </SidePanelSection>

            <SidePanelSection label="Payment">
              <div className="erp-form-group">
                <label className="erp-label">Payment Mode</label>
                <SearchableDropdown
                  value={form.paymentMode}
                  onChange={v => setForm(prev => ({ ...prev, paymentMode: v as Order['paymentMode'] }))}
                  options={[
                    { value: 'CASH', label: 'Cash' },
                    { value: 'MOBILE_MONEY', label: 'Mobile Money' },
                    { value: 'CHEQUE', label: 'Cheque' },
                    { value: 'CREDIT', label: 'Credit' },
                  ]}
                />
              </div>
            </SidePanelSection>
          </SidePanel>
        );
      })()}

      {selectedOrder && (() => {
        const lineItems: OrderLineItem[] | undefined = selectedOrder.metadata?.items;
        return (
          <SidePanel
            open
            onClose={() => setSelectedOrder(null)}
            title="Order Details"
            subtitle={selectedOrder.ticketNumber || selectedOrder.id}
            footer={<button onClick={() => setSelectedOrder(null)} className="erp-btn erp-btn-primary w-full">Close</button>}
          >
            <div className="space-y-4">
                {/* Order meta grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Customer', selectedOrder.clientName],
                    ['Destination', selectedOrder.destination || '—'],
                    ['Payment Mode', selectedOrder.paymentMode],
                    ['Date', (selectedOrder.createdAt || '').split('T')[0]],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-[var(--text-muted)]">{k}</p>
                      <p className="font-medium text-[var(--text-primary)]">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--text-muted)]">Customer rating:</span>
                  <RatingBadge rating={computeCustomerRating(ordersForCustomer(orders, selectedOrder.clientName))} />
                </div>

                {/* Line items table */}
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                    {lineItems && lineItems.length > 0 ? `Order Items (${lineItems.length})` : 'Product'}
                  </p>
                  {lineItems && lineItems.length > 0 ? (
                    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
                            <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">Product</th>
                            <th className="text-center py-2 px-3 font-semibold text-[var(--text-muted)]">Qty</th>
                            <th className="text-right py-2 px-3 font-semibold text-[var(--text-muted)]">Unit Price</th>
                            <th className="text-right py-2 px-3 font-semibold text-[var(--text-muted)]">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-[var(--border)] last:border-0">
                              <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">{item.productName}</td>
                              <td className="py-2.5 px-3 text-center text-[var(--text-secondary)]">{item.quantity}</td>
                              <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                                {item.unitPrice > 0 ? `GHS ${item.unitPrice.toLocaleString()}` : <span className="text-amber-500 text-[10px]">No price set</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                                {item.lineTotal > 0 ? `GHS ${item.lineTotal.toLocaleString()}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[var(--accent-light)] border-t border-[var(--border)]">
                            <td colSpan={3} className="py-2.5 px-3 font-bold text-[var(--text-primary)]">Order Total</td>
                            <td className="py-2.5 px-3 text-right font-bold text-[var(--accent)]">
                              GHS {(Number(selectedOrder.totalAmount ?? 0)).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--border)] px-4 py-3 flex items-center justify-between">
                      <span className="font-medium text-[var(--text-primary)]">{selectedOrder.productName || '—'}</span>
                      <span className="font-bold text-emerald-600">GHS {(Number(selectedOrder.totalAmount ?? 0)).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Progress stepper */}
                {selectedOrder.status !== 'REJECTED' && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-3">Order Progress</p>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {STEPPER.map((step, idx) => {
                        const current = stepperIndex(selectedOrder.status);
                        const done = idx <= current;
                        return (
                          <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
                            <div className={`flex flex-col items-center gap-1`}>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${done ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-input)]'}`}>{idx + 1}</div>
                              <span className={`text-[10px] whitespace-nowrap ${done ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)]'}`}>{step.label}</span>
                            </div>
                            {idx < STEPPER.length - 1 && <div className={`w-6 h-0.5 mb-4 flex-shrink-0 ${idx < current ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {selectedOrder.status === 'REJECTED' && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 font-medium">Order Rejected</div>
                )}
            </div>
          </SidePanel>
        );
      })()}
    </div>
  );
}
