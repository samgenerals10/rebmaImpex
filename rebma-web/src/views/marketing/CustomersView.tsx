import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, X, Pencil, Trash2, Download } from 'lucide-react';
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
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', companyName: '', phone: '', location: '', email: '', ghanaCard: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: cData }, { data: oData }] = await Promise.all([
          supabase.from('customers').select('*').order('registered_at', { ascending: false }).limit(200),
          supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300),
        ]);
        const mappedCustomers = (cData || []).map((r: any) => ({
          id: r.id,
          name: r.name || '',
          companyName: r.company_name || r.companyName || '',
          phone: r.phone || '',
          email: r.email || '',
          location: r.location || '',
          ghanaCard: r.ghana_card_id || r.ghanaCard || '',
          registeredAt: r.registered_at || r.registeredAt || new Date().toISOString(),
          orderHistory: [],
          creditHistory: [],
        }));
        const mappedOrders = (oData || []).map((r: any) => ({
          id: r.id,
          ticketNumber: r.ticket_number || r.ticketNumber || r.id,
          clientName: r.client_name || r.clientName || '',
          productName: r.product_name || r.productName || '',
          destination: r.destination || '',
          totalAmount: Number(r.total_amount || r.totalAmount || 0),
          paymentMode: r.payment_mode || r.paymentMode || 'CASH',
          status: r.status || 'PENDING_FINANCE',
          createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        }));
        setCustomers(mappedCustomers.length > 0 ? mappedCustomers : customersList.length > 0 ? customersList : []);
        setOrders(mappedOrders.length > 0 ? mappedOrders : []);
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

  const handleSave = async () => {
    if (!form.name || !form.phone) { addNotification('Name and phone are required.'); return; }
    const now = new Date().toISOString();
    const { data: inserted, error } = await supabase.from('customers').insert({
      name: form.name,
      company_name: form.companyName || form.name,
      phone: form.phone,
      email: form.email || null,
      location: form.location || null,
      ghana_card_id: form.ghanaCard || null,
      registered_at: now,
      updated_at: now,
    }).select().single();
    if (error) { addNotification(`Failed to register customer: ${error.message}`); return; }
    const newCust: Customer = {
      id: inserted?.id || `cust-${Date.now()}`,
      name: form.name,
      companyName: form.companyName,
      phone: form.phone,
      location: form.location,
      email: form.email,
      ghanaCard: form.ghanaCard,
      registeredAt: now,
      orderHistory: [],
      creditHistory: [],
    };
    onRegisterCustomer(newCust);
    setCustomers(prev => [newCust, ...prev]);
    setShowModal(false);
    setForm({ name: '', companyName: '', phone: '', location: '', email: '', ghanaCard: '' });
    addNotification('Customer registered successfully.');
  };

  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({ name: c.name, companyName: c.companyName || '', phone: c.phone, location: c.location || '', email: c.email || '', ghanaCard: c.ghanaCard || '' });
    setShowModal(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!form.name || !form.phone) { addNotification('Name and phone are required.'); return; }
    const { error } = await supabase.from('customers').update({
      name: form.name, company_name: form.companyName, phone: form.phone,
      email: form.email || null, location: form.location || null,
      ghana_card_id: form.ghanaCard || null, updated_at: new Date().toISOString(),
    }).eq('id', editTarget.id);
    if (error) { addNotification(`Update failed: ${error.message}`); return; }
    setCustomers(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...form, companyName: form.companyName } : c));
    setShowModal(false); setEditTarget(null);
    addNotification('Customer updated.');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { addNotification(`Delete failed: ${error.message}`); return; }
    setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    addNotification(`Customer "${deleteTarget.name}" deleted.`);
  };

  const exportCustomerCSV = (c: Customer) => {
    const csv = `Name,Company,Phone,Email,Location,Ghana Card,Registered\n${c.name},${c.companyName || ''},${c.phone},${c.email || ''},${c.location || ''},${c.ghanaCard || ''},${(c.registeredAt || '').split('T')[0]}`;
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = `customer_${c.name.replace(/\s+/g,'_')}.csv`; a.click();
    addNotification(`Exported ${c.name}.`);
  };

  const exportAllCSV = () => {
    const rows = filtered.map(c => `${c.name},${c.companyName || ''},${c.phone},${c.email || ''},${c.location || ''},${(c.registeredAt || '').split('T')[0]}`);
    const csv = `Name,Company,Phone,Email,Location,Registered\n${rows.join('\n')}`;
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'customers.csv'; a.click();
    addNotification('All customers exported.');
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
        <div className="flex gap-2">
          <button onClick={exportAllCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Download className="w-3.5 h-3.5" /> Export All
          </button>
          <button onClick={() => { setEditTarget(null); setForm({ name:'',companyName:'',phone:'',location:'',email:'',ghanaCard:'' }); setShowModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Add Customer
          </button>
        </div>
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
              <div className="mt-auto grid grid-cols-4 gap-1.5">
                <button onClick={() => setSelectedCustomer(c)}
                  className="col-span-2 py-1.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-light)] transition-colors cursor-pointer">
                  View Profile
                </button>
                <button onClick={() => openEdit(c)} title="Edit"
                  className="py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors cursor-pointer flex items-center justify-center">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => exportCustomerCSV(c)} title="Export"
                  className="py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors cursor-pointer flex items-center justify-center">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
              <button onClick={() => setDeleteTarget(c)}
                className="w-full py-1.5 rounded-xl border border-rose-200 text-rose-500 text-xs font-semibold hover:bg-rose-50 transition-colors cursor-pointer flex items-center justify-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-primary)]">{editTarget ? 'Edit Customer' : 'Register New Customer'}</h3>
              <button onClick={() => { setShowModal(false); setEditTarget(null); }} className="p-1 rounded-lg hover:bg-[var(--bg-input)]"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            {[
              { label: 'Full Name *', key: 'name', placeholder: 'E.g., Kofi Owusu' },
              { label: 'Company Name', key: 'companyName', placeholder: 'E.g., Owusu Retail Hub' },
              { label: 'Phone *', key: 'phone', placeholder: 'E.g., +233 24 123 4567' },
              { label: 'Location', key: 'location', placeholder: 'E.g., Kumasi' },
              { label: 'Email', key: 'email', placeholder: 'client@company.com' },
              { label: 'Ghana Card', key: 'ghanaCard', placeholder: 'E.g., GHA-721839210-9' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setEditTarget(null); }} className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">Cancel</button>
              <button onClick={editTarget ? handleEditSave : handleSave} className="flex-1 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 cursor-pointer">
                {editTarget ? 'Save Changes' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-rose-300 shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-rose-500" /></div>
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">Delete Customer</h3>
                <p className="text-xs text-[var(--text-muted)]">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">Delete <strong>{deleteTarget.name}</strong> and all their records from the directory?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 cursor-pointer disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
