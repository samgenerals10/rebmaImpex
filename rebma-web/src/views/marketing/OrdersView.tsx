import { useState, useEffect, useRef } from 'react';
import { Plus, Download, Search, MoreVertical, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Order, OrderLineItem } from '../../types/erp';


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
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  const openNewOrderModal = () => {
    setShowNewModal(true);
    setLineItems([{ productName: '', quantity: 1 }]);
    setForm({ clientName: '', destination: '', paymentMode: 'CASH' });
    supabase.from('goods_prices').select('product_name, unit_price').order('product_name').then(({ data }) => {
      setAvailableProducts((data || []).map((r: any) => String(r.product_name)));
      const priceMap: Record<string, number> = {};
      (data || []).forEach((r: any) => { priceMap[r.product_name] = Number(r.unit_price ?? 0); });
      setProductPrices(priceMap);
    }, () => {});
    supabase.from('customers').select('id, name').order('name').then(({ data }) => {
      const seen = new Set<string>();
      const unique = (data || []).filter((r: any) => {
        const n = String(r.name || '').trim().toLowerCase();
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
      });
      setCustomers(unique.map((r: any) => ({ id: String(r.id), name: String(r.name).trim() })));
    }, () => {});
  };

  const updateLineItem = (index: number, field: 'productName' | 'quantity', value: string | number) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addLineItem = () => setLineItems(prev => [...prev, { productName: '', quantity: 1 }]);

  const removeLineItem = (index: number) => setLineItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({ clientName: '', destination: '', paymentMode: 'CASH' as Order['paymentMode'] });
  const [lineItems, setLineItems] = useState<{ productName: string; quantity: number }[]>([{ productName: '', quantity: 1 }]);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);

  const mapOrder = (r: any): Order => ({
    id: r.id,
    ticketNumber: r.ticket_number || r.ticketNumber || r.id,
    clientName: r.client_name || r.clientName || '',
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
    if (!form.clientName.trim()) { addNotification('Customer name is required.'); return; }
    const validItems = lineItems.filter(item => item.productName.trim());
    if (validItems.length === 0) { addNotification('Add at least one product.'); return; }

    const ticketNumber = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();

    // Build line items with pricing
    const itemsWithPricing = validItems.map(item => {
      const unitPrice = productPrices[item.productName] ?? 0;
      const qty = Math.max(1, item.quantity);
      return { productName: item.productName, quantity: qty, unitPrice, lineTotal: unitPrice * qty };
    });
    const orderTotal = itemsWithPricing.reduce((s, i) => s + i.lineTotal, 0);

    // Single product name display: one product → its name, multiple → "Product A + 2 more"
    const primaryProduct = itemsWithPricing[0].productName;
    const productDisplay = itemsWithPricing.length === 1
      ? primaryProduct
      : `${primaryProduct} + ${itemsWithPricing.length - 1} more`;

    const { data: inserted, error } = await supabase.from('orders').insert({
      ticket_number: ticketNumber,
      client_name: form.clientName.trim(),
      product_name: productDisplay,
      destination: form.destination || null,
      payment_mode: form.paymentMode,
      total_amount: orderTotal,
      status: 'PENDING_FINANCE',
      created_at: now,
      updated_at: now,
      metadata: { items: itemsWithPricing },
    }).select().single();

    if (error) { addNotification(`Failed to create order: ${error.message}`); return; }
    const newOrder = mapOrder(inserted || {
      id: `ord-${Date.now()}`, ticket_number: ticketNumber,
      client_name: form.clientName, product_name: productDisplay,
      destination: form.destination, payment_mode: form.paymentMode,
      total_amount: orderTotal, status: 'PENDING_FINANCE', created_at: now,
    });
    onCreateOrder(newOrder);
    setOrders(prev => [newOrder, ...prev]);
    setShowNewModal(false);
    setLineItems([{ productName: '', quantity: 1 }]);
    setForm({ clientName: '', destination: '', paymentMode: 'CASH' });
    addNotification('Order created successfully. Routed to Finance for review.');
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
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'All Orders', value: orders.length, color: 'text-[var(--text-primary)]' },
          { label: 'Pending', value: pending, color: 'text-amber-600' },
          { label: 'Active / Delivered', value: active, color: 'text-emerald-600' },
          { label: 'Total Value (GHS)', value: totalValue.toLocaleString('en-GH', { minimumFractionDigits: 2 }), color: 'text-[var(--accent)]' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search by client or order ID…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
            <option value="ALL">All Statuses</option>
            <option value="PENDING_FINANCE">Pending Finance</option>
            <option value="PENDING_MANAGEMENT">Pending Mgmt</option>
            <option value="APPROVED">Approved</option>
            <option value="PROCESSING">Processing</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REJECTED">Rejected</option>
          </select>
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
                  <td className="py-3 px-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{o.clientName}</td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">
                    {(() => {
                      const items: OrderLineItem[] | undefined = o.metadata?.items;
                      if (items && items.length > 1) {
                        return (
                          <span className="inline-flex items-center gap-1">
                            <span className="truncate max-w-[100px]">{items[0].productName}</span>
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-[10px] font-bold">+{items.length - 1} more</span>
                          </span>
                        );
                      }
                      return <span>{items?.[0]?.productName || o.productName || '—'}</span>;
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

      {showNewModal && (() => {
        const orderTotal = lineItems.reduce((s, item) => {
          const price = productPrices[item.productName] ?? 0;
          return s + price * Math.max(1, item.quantity);
        }, 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
                <h3 className="font-bold text-[var(--text-primary)]">New Sales Order</h3>
                <button onClick={() => setShowNewModal(false)} className="p-1 rounded-lg hover:bg-[var(--bg-input)]"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-6 space-y-4 pb-2">
                <datalist id="customer-names-list">
                  {customers.map(c => <option key={c.id} value={c.name} />)}
                </datalist>

                {/* Customer + Destination */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Customer Name *</label>
                    <input type="text" list="customer-names-list" value={form.clientName}
                      onChange={e => setForm(prev => ({ ...prev, clientName: e.target.value }))}
                      placeholder="Type or select customer name..."
                      className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Destination</label>
                    <input type="text" value={form.destination}
                      onChange={e => setForm(prev => ({ ...prev, destination: e.target.value }))}
                      placeholder="e.g. Accra, Tema, Kumasi..."
                      className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Products *</label>
                    <span className="text-[10px] text-[var(--text-muted)]">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {lineItems.map((item, index) => {
                      const unitPrice = productPrices[item.productName] ?? null;
                      const lineTotal = unitPrice != null ? unitPrice * Math.max(1, item.quantity) : null;
                      return (
                        <div key={index} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              {availableProducts.length > 0 ? (
                                <select value={item.productName} onChange={e => updateLineItem(index, 'productName', e.target.value)}
                                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                                  <option value="">— Select product —</option>
                                  {availableProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                              ) : (
                                <input type="text" value={item.productName} onChange={e => updateLineItem(index, 'productName', e.target.value)}
                                  placeholder="Product name…"
                                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                              )}
                            </div>
                            <div className="w-24 shrink-0">
                              <input type="number" min="1" value={item.quantity} onChange={e => updateLineItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] text-center" />
                            </div>
                            {lineItems.length > 1 && (
                              <button onClick={() => removeLineItem(index)} className="p-1.5 rounded-lg hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-500 shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {unitPrice != null ? (
                            <div className="flex items-center justify-between px-1 text-xs text-[var(--text-muted)]">
                              <span>GHS {unitPrice.toLocaleString()} per unit</span>
                              <span className="font-semibold text-[var(--accent)]">= GHS {lineTotal!.toLocaleString()}</span>
                            </div>
                          ) : item.productName ? (
                            <p className="text-[10px] text-amber-600 px-1">No price set — Management must price this product</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={addLineItem}
                    className="mt-2 w-full py-2 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--accent)] hover:bg-[var(--accent-light)] flex items-center justify-center gap-1.5 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add another product
                  </button>
                </div>

                {/* Order summary */}
                {orderTotal > 0 && (
                  <div className="rounded-xl bg-[var(--accent-light)] border border-[var(--border)] px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Order Total ({lineItems.filter(i => i.productName).length} item{lineItems.filter(i => i.productName).length !== 1 ? 's' : ''})</span>
                    <span className="text-base font-bold text-[var(--accent)]">GHS {orderTotal.toLocaleString()}</span>
                  </div>
                )}

                {/* Payment Mode */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Payment Mode</label>
                  <select value={form.paymentMode} onChange={e => setForm(prev => ({ ...prev, paymentMode: e.target.value as Order['paymentMode'] }))}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                    <option value="CASH">Cash</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 shrink-0 border-t border-[var(--border)]">
                <button onClick={() => setShowNewModal(false)} className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90">
                  Save Order{lineItems.filter(i => i.productName).length > 1 ? `s (${lineItems.filter(i => i.productName).length})` : ''}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedOrder && (() => {
        const lineItems: OrderLineItem[] | undefined = selectedOrder.metadata?.items;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-[var(--border)]">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">Order Details</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">{selectedOrder.ticketNumber || selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-lg hover:bg-[var(--bg-input)]"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
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

              {/* Footer */}
              <div className="px-6 py-4 shrink-0 border-t border-[var(--border)]">
                <button onClick={() => setSelectedOrder(null)} className="w-full py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
