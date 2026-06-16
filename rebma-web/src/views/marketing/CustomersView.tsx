import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Customer, Order } from '../../types/erp';


function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface Props {
  customersList: Customer[];
  onRegisterCustomer: (data: Partial<Customer>) => void;
  addNotification: (msg: string) => void;
}

export default function CustomersView({ customersList, onRegisterCustomer, addNotification }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', companyName: '', phone: '', location: '', email: '', ghanaCard: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: cData }, { data: oData }] = await Promise.all([
          supabase.from('customers').select('*').order('registeredAt', { ascending: false }).limit(200),
          supabase.from('orders').select('*').order('createdAt', { ascending: false }).limit(300),
        ]);
        setCustomers(cData && cData.length > 0 ? cData : customersList.length > 0 ? customersList : []);
        setOrders(oData && oData.length > 0 ? oData : []);
      } catch {
        setCustomers(customersList.length > 0 ? customersList : []);
        setOrders([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const locations = Array.from(new Set(customers.map(c => c.location)));
  const now = new Date();
  const thisMonth = customers.filter(c => {
    const d = new Date(c.registeredAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const withOrders = customers.filter(c => (c.orderHistory || []).length > 0).length;
  const totalCredit = customers.reduce((sum, c) => sum + (c.creditHistory || []).filter(h => h.status !== 'PAID').reduce((s, h) => s + h.amount, 0), 0);

  const filtered = customers.filter(c => {
    if (locationFilter !== 'ALL' && c.location !== locationFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.companyName.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
    }
    return true;
  });

  const handleSave = () => {
    if (!form.name || !form.phone) { addNotification('Name and phone are required.'); return; }
    const newCust: Partial<Customer> = {
      id: `cust-${Date.now()}`,
      name: form.name,
      companyName: form.companyName,
      phone: form.phone,
      location: form.location,
      email: form.email,
      ghanaCard: form.ghanaCard,
      registeredAt: new Date().toISOString(),
      orderHistory: [],
      creditHistory: [],
    };
    onRegisterCustomer(newCust);
    setCustomers(prev => [newCust as Customer, ...prev]);
    setShowModal(false);
    setForm({ name: '', companyName: '', phone: '', location: '', email: '', ghanaCard: '' });
    addNotification('Customer registered successfully.');
  };

  if (selectedCustomer) {
    const custOrders = orders.filter(o => o.clientName === selectedCustomer.name);
    const totalSpend = custOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0);
    const outstanding = (selectedCustomer.creditHistory || []).filter(h => h.status !== 'PAID').reduce((s, h) => s + h.amount, 0);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Customers
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-[var(--box-shadow)]">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center text-2xl font-bold text-[var(--accent)] flex-shrink-0">
              {initials(selectedCustomer.name)}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Full Name', selectedCustomer.name],
                ['Company', selectedCustomer.companyName],
                ['Phone', selectedCustomer.phone],
                ['Email', selectedCustomer.email || '—'],
                ['Location', selectedCustomer.location],
                ['Ghana Card', selectedCustomer.ghanaCard || '—'],
                ['Registered', selectedCustomer.registeredAt.split('T')[0]],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-[var(--text-muted)]">{k}</p>
                  <p className="font-medium text-sm text-[var(--text-primary)]">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Orders', value: custOrders.length, color: 'text-[var(--text-primary)]' },
            { label: 'Total Spend (GHS)', value: totalSpend.toLocaleString(), color: 'text-emerald-600' },
            { label: 'Outstanding (GHS)', value: outstanding.toLocaleString(), color: 'text-rose-600' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
          <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Order History</h4>
          {custOrders.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No orders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)]">
                  {['Order #', 'Product', 'Amount', 'Payment', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-[var(--text-muted)]">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {custOrders.map(o => (
                    <tr key={o.id} className="border-b border-[var(--border)]">
                      <td className="py-2 px-2 font-mono text-xs text-[var(--text-secondary)]">{o.ticketNumber || o.id}</td>
                      <td className="py-2 px-2 text-[var(--text-secondary)]">{o.productName || '—'}</td>
                      <td className="py-2 px-2 text-emerald-600 font-semibold">GHS {o.totalAmount.toLocaleString()}</td>
                      <td className="py-2 px-2 text-[var(--text-secondary)]">{o.paymentMode}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          o.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                          o.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                          o.status === 'PROCESSING' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{o.status}</span>
                      </td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">{o.createdAt.split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(selectedCustomer.creditHistory || []).length > 0 && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Credit / Payment History</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)]">
                  {['Order ID', 'Amount (GHS)', 'Date', 'Status'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-[var(--text-muted)]">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(selectedCustomer.creditHistory || []).map((h, idx) => (
                    <tr key={idx} className="border-b border-[var(--border)]">
                      <td className="py-2 px-2 font-mono text-xs text-[var(--text-secondary)]">{h.orderId}</td>
                      <td className="py-2 px-2 text-emerald-600 font-semibold">GHS {h.amount.toLocaleString()}</td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">{h.date}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${h.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{h.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Customer Directory</h2>
          <p className="text-xs text-[var(--text-muted)]">{customers.length} registered customers</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90 self-start sm:self-auto">
          <Plus className="w-3.5 h-3.5" /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: customers.length, color: 'text-[var(--text-primary)]' },
          { label: 'Active (with Orders)', value: withOrders, color: 'text-emerald-600' },
          { label: 'New This Month', value: thisMonth, color: 'text-blue-600' },
          { label: 'Credit Outstanding', value: `GHS ${totalCredit.toLocaleString()}`, color: 'text-rose-600' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, phone…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
          <option value="ALL">All Locations</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">Loading customers…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">No customers found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)] flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[var(--accent-light)] flex items-center justify-center text-base font-bold text-[var(--accent)] flex-shrink-0">
                  {initials(c.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{c.name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{c.companyName}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                <p>{c.phone}</p>
                <p>{c.location}</p>
                <p className="text-[var(--text-muted)]">Registered {c.registeredAt.split('T')[0]}</p>
              </div>
              <button onClick={() => setSelectedCustomer(c)}
                className="mt-auto w-full py-1.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-light)] transition-colors">
                View Profile
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-primary)]">Register New Customer</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[var(--bg-input)]"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            {[
              { label: 'Full Name *', key: 'name' },
              { label: 'Company Name', key: 'companyName' },
              { label: 'Phone *', key: 'phone' },
              { label: 'Location', key: 'location' },
              { label: 'Email', key: 'email' },
              { label: 'Ghana Card', key: 'ghanaCard' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90">Register</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
