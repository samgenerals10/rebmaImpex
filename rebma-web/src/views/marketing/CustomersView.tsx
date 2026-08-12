import { useState, useEffect, useRef } from 'react';
import { Plus, Search, ArrowLeft, X, Pencil, Trash2, Download, Star, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Customer, Order } from '../../types/erp';
import CustomerAvatar from '../../components/CustomerAvatar';
import RatingBadge from '../../components/RatingBadge';
import { computeCustomerRating, ordersForCustomer } from '../../utils/customerRating';
import CountUp from '../../components/CountUp';
import { uploadFile } from '../../utils/uploadFile';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: '', companyName: '', phone: '', location: '', email: '', ghanaCard: '', isSpecialCustomer: false });

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
          photo: r.customer_photo || r.photo || undefined,
          registeredAt: r.registered_at || r.registeredAt || new Date().toISOString(),
          orderHistory: [],
          creditHistory: [],
          isSpecialCustomer: r.is_special_customer ?? false,
          discountPercent: Number(r.discount_percent) || 0,
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

  useEffect(() => {
    if (customersList && customersList.length > 0) {
      setCustomers(customersList);
    }
  }, [customersList]);

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
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: form.name,
      companyName: form.companyName || form.name,
      phone: form.phone,
      location: form.location,
      email: form.email,
      ghanaCard: form.ghanaCard,
      registeredAt: now,
      orderHistory: [],
      creditHistory: [],
      isSpecialCustomer: form.isSpecialCustomer,
      discountPercent: 0,
    };
    onRegisterCustomer(newCust);
    setCustomers(prev => [newCust, ...prev]);
    setShowModal(false);
    setForm({ name: '', companyName: '', phone: '', location: '', email: '', ghanaCard: '', isSpecialCustomer: false });
  };

  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({ name: c.name, companyName: c.companyName || '', phone: c.phone, location: c.location || '', email: c.email || '', ghanaCard: c.ghanaCard || '', isSpecialCustomer: c.isSpecialCustomer || false });
    setShowModal(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!form.name || !form.phone) { addNotification('Name and phone are required.'); return; }
    const basePayload = {
      name: form.name, company_name: form.companyName, phone: form.phone,
      email: form.email || null, location: form.location || null,
      ghana_card_id: form.ghanaCard || null,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from('customers').update({ ...basePayload, is_special_customer: form.isSpecialCustomer }).eq('id', editTarget.id);
    if (error?.message?.includes('is_special_customer')) {
      // Column not migrated yet — don't let that block saving the rest of the edit.
      ({ error } = await supabase.from('customers').update(basePayload).eq('id', editTarget.id));
    }
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
    if (selectedCustomer?.id === deleteTarget.id) setSelectedCustomer(null);
    setDeleteTarget(null);
    addNotification(`Customer "${deleteTarget.name}" deleted.`);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!selectedCustomer) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadFile(file, 'customer-photos', selectedCustomer.id);
      if (!url) throw new Error('Upload failed.');
      const { error } = await supabase.from('customers').update({ customer_photo: url, updated_at: new Date().toISOString() }).eq('id', selectedCustomer.id);
      if (error) throw error;
      setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, photo: url } : c));
      setSelectedCustomer(prev => prev ? { ...prev, photo: url } : prev);
      addNotification(`Photo updated for ${selectedCustomer.name}.`);
    } catch (e: any) {
      addNotification(`Photo upload failed: ${e.message || 'Unknown error'}`);
    } finally {
      setUploadingPhoto(false);
    }
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
    const custOrders = ordersForCustomer(orders, selectedCustomer.name);
    const totalSpend = custOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0);
    const outstanding = (selectedCustomer.creditHistory || []).filter(h => h.status !== 'PAID').reduce((s, h) => s + h.amount, 0);
    const rating = computeCustomerRating(custOrders);
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back to Customers
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => openEdit(selectedCustomer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors cursor-pointer">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => exportCustomerCSV(selectedCustomer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={() => setDeleteTarget(selectedCustomer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-500 text-xs font-semibold hover:bg-rose-50 transition-colors cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-[var(--box-shadow)]">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="relative inline-block cursor-pointer group" onClick={() => photoInputRef.current?.click()} title="Update photo">
                <CustomerAvatar name={selectedCustomer.name} photo={selectedCustomer.photo} isSpecial={selectedCustomer.isSpecialCustomer} size={72} rounded="full" />
                <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                {uploadingPhoto && (
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <span className="text-[8px] text-white font-semibold">Uploading…</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-[var(--text-muted)]">Click to update</span>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handlePhotoUpload(f); }} />
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex items-center gap-2 flex-wrap">
                {selectedCustomer.isSpecialCustomer && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    <Star size={9} className="fill-amber-500" /> Special Customer
                  </span>
                )}
                <RatingBadge rating={rating} />
                <span className="text-[10px] text-[var(--text-muted)]"><CountUp value={rating.orderCount} /> order{rating.orderCount === 1 ? '' : 's'} counted</span>
              </div>
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Orders', value: custOrders.length, color: 'text-[var(--text-primary)]' },
            { label: 'Total Spend (GHS)', value: totalSpend, color: 'text-emerald-600' },
            { label: 'Outstanding (GHS)', value: outstanding, color: 'text-rose-600' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}><CountUp value={c.value} /></p>
            </div>
          ))}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">Rating — {rating.grade}</p>
            <p className="text-xl font-bold" style={{ color: rating.color }}><CountUp value={rating.score} /><span className="text-xs text-[var(--text-muted)] font-normal">/100</span></p>
            <p className="text-[9px] text-[var(--text-muted)] mt-1">Consistency {rating.consistencyScore} · Volume {rating.volumeScore}</p>
          </div>
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
          <button onClick={() => { setEditTarget(null); setForm({ name:'',companyName:'',phone:'',location:'',email:'',ghanaCard:'',isSpecialCustomer:false }); setShowModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: customers.length, prefix: '', color: 'text-[var(--text-primary)]' },
          { label: 'Active (with Orders)', value: withOrders, prefix: '', color: 'text-emerald-600' },
          { label: 'New This Month', value: thisMonth, prefix: '', color: 'text-blue-600' },
          { label: 'Credit Outstanding', value: totalCredit, prefix: 'GHS ', color: 'text-rose-600' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}><CountUp value={c.value} prefix={c.prefix} /></p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, phone…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <SearchableDropdown
          value={locationFilter}
          onChange={setLocationFilter}
          options={[{ value: 'ALL', label: 'All Locations' }, ...locations.map(l => ({ value: l, label: l }))]}
          className="sm:w-48"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">Loading customers…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">No customers found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filtered.map(c => {
            const custOrders = ordersForCustomer(orders, c.name);
            const rating = computeCustomerRating(custOrders);
            return (
              <div key={c.id} className="group rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)] flex flex-col gap-2.5 hover:border-[var(--accent)] hover:shadow-lg transition-all">
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setSelectedCustomer(c)} title="View profile" className="cursor-pointer shrink-0">
                    <CustomerAvatar name={c.name} photo={c.photo} isSpecial={c.isSpecialCustomer} size={40} rounded="full" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{c.name}</p>
                      {c.isSpecialCustomer && <Star size={9} className="fill-amber-500 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{c.companyName || c.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <RatingBadge rating={rating} size="xs" />
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-input)] px-1.5 py-0.5 rounded-full">
                    {custOrders.length} order{custOrders.length === 1 ? '' : 's'}
                  </span>
                  {!!c.discountPercent && <span className="text-[10px] font-semibold text-emerald-600">{c.discountPercent}% off</span>}
                </div>
                <button onClick={() => setSelectedCustomer(c)}
                  className="w-full py-1.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-light)] transition-colors cursor-pointer">
                  View Profile
                </button>
              </div>
            );
          })}
        </div>
      )}

      <SidePanel
        open={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null); }}
        title={editTarget ? 'Edit Customer' : 'Register New Customer'}
        footer={
          <>
            <button onClick={() => { setShowModal(false); setEditTarget(null); }} className="erp-btn erp-btn-ghost">Cancel</button>
            <button onClick={editTarget ? handleEditSave : handleSave} className="erp-btn erp-btn-primary">
              {editTarget ? 'Save Changes' : 'Register'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {[
            { label: 'Full Name *', key: 'name', placeholder: 'E.g., Kofi Owusu' },
            { label: 'Company Name', key: 'companyName', placeholder: 'E.g., Owusu Retail Hub' },
            { label: 'Phone *', key: 'phone', placeholder: 'E.g., +233 24 123 4567' },
            { label: 'Location', key: 'location', placeholder: 'E.g., Kumasi' },
            { label: 'Email', key: 'email', placeholder: 'client@company.com' },
            { label: 'Ghana Card', key: 'ghanaCard', placeholder: 'E.g., GHA-721839210-9' },
          ].map(f => (
            <div key={f.key} className="erp-form-group">
              <label className="erp-label">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="erp-input" />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.isSpecialCustomer} onChange={e => setForm(prev => ({ ...prev, isSpecialCustomer: e.target.checked }))}
              className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer" />
            Special customer <span className="text-xs text-[var(--text-muted)]">(flag for Management's attention. Management sets any discount separately)</span>
          </label>
        </div>
      </SidePanel>

      <SidePanel
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Customer"
        subtitle="This cannot be undone."
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="erp-btn erp-btn-danger disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-rose-500" /></div>
            <p className="text-sm text-[var(--text-secondary)] pt-2">Delete <strong>{deleteTarget.name}</strong> and all their records from the directory?</p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
