// rebma-web/src/views/MarketingDashboard.tsx

import { useState, useRef, useEffect } from 'react';
import type { Order, Customer } from '../types/erp';
import { FileSpreadsheet, FileText, UserPlus, Users, DollarSign, Clipboard, ShieldCheck, X, Camera, ChevronRight, History } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface MarketingDashboardProps {
  ordersList: Order[];
  onCreateOrder: (data: Partial<Order>) => void;
  customersList: Customer[];
  onRegisterCustomer: (data: Partial<Customer>) => void;
  addNotification: (msg: string) => void;
}

const handleSort = (
  field: string,
  currentField: string,
  setField: (f: string) => void,
  currentDir: 'asc' | 'desc',
  setDir: (d: 'asc' | 'desc') => void
) => {
  if (currentField === field) {
    setDir(currentDir === 'asc' ? 'desc' : 'asc');
  } else {
    setField(field);
    setDir('asc');
  }
};

export default function MarketingDashboard({
  ordersList,
  onCreateOrder,
  customersList,
  onRegisterCustomer,
  addNotification
}: MarketingDashboardProps) {

  // Local state copies of lists to allow full client-side actions
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customersList);
  const [localOrders, setLocalOrders] = useState<Order[]>(ordersList);

  // Modal states
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Order form state
  const [orderPayMode, setOrderPayMode] = useState<'CASH' | 'CREDIT' | 'ONLINE'>('CASH');
  const [orderClient, setOrderClient] = useState('');
  const [orderProduct, setOrderProduct] = useState('');
  const [orderDestination, setOrderDestination] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderGhanaCard, setOrderGhanaCard] = useState('');

  // Customer form state
  const [custName, setCustName] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custLocation, setCustLocation] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custGhanaCard, setCustGhanaCard] = useState('');
  const [custPhoto, setCustPhoto] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);

  // Table interactive states: Customer Directory
  const [custSearch, setCustSearch] = useState('');
  const [custLocationFilter, setCustLocationFilter] = useState('ALL');
  const [isCustFilterOpen, setIsCustFilterOpen] = useState(false);
  const [selectedCustRows, setSelectedCustRows] = useState<Set<string>>(new Set());
  const [activeCustMenu, setActiveCustMenu] = useState<string | null>(null);

  // Table interactive states: Active Sales Orders
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersModeFilter, setOrdersModeFilter] = useState('ALL');
  const [isOrdersFilterOpen, setIsOrdersFilterOpen] = useState(false);
  const [selectedOrdersRows, setSelectedOrdersRows] = useState<Set<string>>(new Set());
  const [activeOrdersMenu, setActiveOrdersMenu] = useState<string | null>(null);

  // Sorting states for Customers
  const [customerSortField, setCustomerSortField] = useState<string>('');
  const [customerSortDir, setCustomerSortDir] = useState<'asc' | 'desc'>('asc');

  // Sorting states for Sales Orders
  const [ordersSortField, setOrdersSortField] = useState<string>('');
  const [ordersSortDir, setOrdersSortDir] = useState<'asc' | 'desc'>('asc');

  // Sync props to local states
  useEffect(() => {
    setLocalCustomers(customersList);
  }, [customersList]);

  useEffect(() => {
    setLocalOrders(ordersList);
  }, [ordersList]);

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveCustMenu(null);
      setActiveOrdersMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const lineChartData = [
    { name: 'Mon', Sales: 3, Leads: 8 },
    { name: 'Tue', Sales: 5, Leads: 12 },
    { name: 'Wed', Sales: 2, Leads: 15 },
    { name: 'Thu', Sales: 8, Leads: 10 },
    { name: 'Fri', Sales: 6, Leads: 14 },
  ];

  const totalOrdersCount = localOrders.length;
  const totalCustomersCount = localCustomers.length;
  const completedDealsCount = localOrders.filter(o => o.status === 'DELIVERED').length;
  const pipelineValue = localOrders.reduce((acc, o) => acc + o.totalAmount, 0);

  const stats = [
    { title: 'Registered Customers', value: `${totalCustomersCount} Accounts`, sub: 'Client directory profiles', icon: Users, color: 'text-blue-500' },
    { title: 'Total Sales Booked', value: `${totalOrdersCount} Orders`, sub: 'Active & archived logs', icon: Clipboard, color: 'text-amber-500' },
    { title: 'Pipeline Net Value', value: `GHS ${pipelineValue.toLocaleString()}`, sub: 'Estimated bookings value', icon: DollarSign, color: 'text-emerald-500' },
    { title: 'Completed Deliveries', value: `${completedDealsCount} Closed`, sub: 'Successfully delivered deals', icon: ShieldCheck, color: 'text-indigo-500' },
  ];

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderClient || !orderProduct || !orderAmount) {
      alert('Please fill all required fields');
      return;
    }
    const ticketNum = `TKT-${Date.now().toString().slice(-5)}`;
    const newOrder: Order = {
      id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
      clientName: orderClient,
      productName: orderProduct,
      destination: orderDestination,
      paymentMode: orderPayMode,
      totalAmount: parseFloat(orderAmount),
      ghanaCard: orderPayMode === 'CREDIT' ? orderGhanaCard : undefined,
      ticketNumber: ticketNum,
      status: orderPayMode === 'CREDIT' ? 'PENDING_MANAGEMENT' : 'PENDING_FINANCE',
      createdAt: new Date().toLocaleString()
    };
    onCreateOrder(newOrder);
    setLocalOrders(prev => [newOrder, ...prev]);
    addNotification(`New order created for ${orderClient} — Ticket: ${ticketNum}`);
    setShowOrderModal(false);
    setOrderClient(''); setOrderProduct(''); setOrderDestination(''); setOrderAmount(''); setOrderGhanaCard('');
    setOrderPayMode('CASH');
  };

  const handleSubmitCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) {
      alert('Please fill required fields');
      return;
    }
    const newCust: Customer = {
      id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
      name: custName,
      companyName: custCompany || custName,
      phone: custPhone,
      location: custLocation,
      email: custEmail,
      ghanaCard: custGhanaCard,
      photo: custPhoto || undefined,
      registeredAt: new Date().toLocaleString()
    };
    onRegisterCustomer(newCust);
    setLocalCustomers(prev => [...prev, newCust]);
    addNotification(`New customer registered: ${custName}`);
    setShowCustomerModal(false);
    setCustName(''); setCustCompany(''); setCustPhone(''); setCustLocation(''); setCustEmail(''); setCustGhanaCard(''); setCustPhoto('');
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCustPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const statusColor = (status: string) => {
    const m: Record<string, string> = {
      DELIVERED: 'bg-emerald-500/10 text-emerald-400',
      PROCESSING: 'bg-indigo-500/10 text-indigo-400',
      PENDING_MANAGEMENT: 'bg-purple-500/10 text-purple-400',
      REJECTED: 'bg-red-500/10 text-red-400',
      APPROVED: 'bg-blue-500/10 text-blue-400',
      PENDING_FINANCE: 'bg-amber-500/10 text-amber-400',
    };
    return m[status] || 'bg-slate-500/10 text-slate-400';
  };

  const customerOrders = (cust: Customer) => localOrders.filter(o => o.clientName === cust.name);

  // Customer Directory Actions
  const handleEditCustomer = async (cust: Customer) => {
    const newName = await prompt('Edit customer name:', cust.name);
    if (!newName) return;
    const newCompany = await prompt('Edit company name:', cust.companyName);
    const newPhone = await prompt('Edit phone number:', cust.phone);
    setLocalCustomers(prev => prev.map(c => c.id === cust.id ? { ...c, name: newName, companyName: newCompany || c.companyName, phone: newPhone || c.phone } : c));
    addNotification(`Updated customer profile for ${cust.name}`);
  };

  const handleDuplicateCustomer = (cust: Customer) => {
    const duplicated: Customer = {
      ...cust,
      id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
      name: `${cust.name} (Copy)`,
      registeredAt: new Date().toLocaleString()
    };
    setLocalCustomers(prev => [...prev, duplicated]);
    addNotification(`Duplicated customer profile for ${cust.name}`);
  };

  const handleShareCustomer = (cust: Customer) => {
    const shareText = `Rebma Customer Account: ${cust.name} - Company: ${cust.companyName} - Phone: ${cust.phone} - Location: ${cust.location}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied customer account details to clipboard!`);
    }).catch(() => alert(shareText));
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!await confirm('Are you sure you want to delete this customer directory profile?')) return;
    setLocalCustomers(prev => prev.filter(c => c.id !== id));
    addNotification(`Deleted customer account ${id}`);
  };

  // Active Sales Orders Actions
  const handleEditOrder = async (order: Order) => {
    const newProduct = await prompt('Edit product name:', order.productName || '');
    if (!newProduct) return;
    const newAmt = await prompt('Edit order amount (GHS):', order.totalAmount.toString());
    if (!newAmt || isNaN(parseFloat(newAmt))) return;
    setLocalOrders(prev => prev.map(o => o.id === order.id ? { ...o, productName: newProduct, totalAmount: parseFloat(newAmt) } : o));
    addNotification(`Updated order invoice values for ${order.id}`);
  };

  const handleDuplicateOrder = (order: Order) => {
    const duplicated: Order = {
      ...order,
      id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
      ticketNumber: `TKT-${Math.floor(10000 + Math.random() * 90000)}`,
      createdAt: new Date().toLocaleString()
    };
    setLocalOrders(prev => [duplicated, ...prev]);
    addNotification(`Duplicated sales order ${order.id} as ${duplicated.id}`);
  };

  const handleShareOrder = (order: Order) => {
    const shareText = `Rebma Sales Order: ID: ${order.id} - Ticket: ${order.ticketNumber || 'N/A'} - Client: ${order.clientName} - Amt: GHS ${order.totalAmount}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied sales order sharing details to clipboard!`);
    }).catch(() => alert(shareText));
  };

  const handleDeleteOrder = async (id: string) => {
    if (!await confirm(`Delete sales order record ${id}?`)) return;
    setLocalOrders(prev => prev.filter(o => o.id !== id));
    addNotification(`Deleted sales order entry ${id}`);
  };

  // Checkbox row selections
  const handleSelectAllCust = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCustRows(new Set(filteredCust.map(c => c.id)));
    } else {
      setSelectedCustRows(new Set());
    }
  };

  const handleSelectCustRow = (id: string) => {
    const updated = new Set(selectedCustRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedCustRows(updated);
  };

  const handleSelectAllOrders = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrdersRows(new Set(filteredOrders.map(o => o.id)));
    } else {
      setSelectedOrdersRows(new Set());
    }
  };

  const handleSelectOrdersRow = (id: string) => {
    const updated = new Set(selectedOrdersRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedOrdersRows(updated);
  };

  // Filtering Directories
  const filteredCust = localCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
                          c.companyName.toLowerCase().includes(custSearch.toLowerCase()) ||
                          c.phone.toLowerCase().includes(custSearch.toLowerCase());
    const matchesLocation = custLocationFilter === 'ALL' || c.location === custLocationFilter;
    return matchesSearch && matchesLocation;
  });

  const filteredOrders = localOrders.filter(o => {
    const matchesSearch = o.clientName.toLowerCase().includes(ordersSearch.toLowerCase()) ||
                          o.id.toLowerCase().includes(ordersSearch.toLowerCase()) ||
                          (o.productName && o.productName.toLowerCase().includes(ordersSearch.toLowerCase()));
    const matchesMode = ordersModeFilter === 'ALL' || o.paymentMode === ordersModeFilter;
    return matchesSearch && matchesMode;
  });

  const sortedCust = [...filteredCust].sort((a, b) => {
    if (!customerSortField) return 0;
    const aVal = a[customerSortField as keyof Customer];
    const bVal = b[customerSortField as keyof Customer];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return customerSortDir === 'asc' ? comp : -comp;
  });

  const sortedOrders = !ordersSortField ? [...filteredOrders].reverse() : [...filteredOrders].sort((a, b) => {
    if (!ordersSortField) return 0;
    const aVal = a[ordersSortField as keyof Order];
    const bVal = b[ordersSortField as keyof Order];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return ordersSortDir === 'asc' ? comp : -comp;
  });

  return (
    <div className="space-y-6">

      {/* ── ORDER MODAL ── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowOrderModal(false)}>
          <div className="bg-[var(--bg-card)] border border-custom rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center text-white">
              <div>
                <h2 className="font-bold text-lg">Create Client Sales Order</h2>
                <p className="text-white/70 text-xs mt-0.5">Fill all required fields to book a new sales order</p>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client Customer <span className="text-rose-500">*</span></label>
                <select value={orderClient} onChange={e => setOrderClient(e.target.value)} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                  <option value="">-- Select a registered customer --</option>
                  {localCustomers.map(c => <option key={c.id} value={c.name}>{c.name} ({c.companyName})</option>)}
                  <option value="Walk-in Customer">Walk-in Customer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product Name <span className="text-rose-500">*</span></label>
                  <input type="text" value={orderProduct} onChange={e => setOrderProduct(e.target.value)} required placeholder="E.g., Palm Oil Barrel" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Mode</label>
                  <select value={orderPayMode} onChange={e => setOrderPayMode(e.target.value as any)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                    <option value="CASH">Cash Payment</option>
                    <option value="ONLINE">Prepaid Online</option>
                    <option value="CREDIT">On Credit Terms</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Delivery Destination</label>
                <input type="text" value={orderDestination} onChange={e => setOrderDestination(e.target.value)} placeholder="E.g., Kumasi Central Depot" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
              </div>

              {orderPayMode === 'CREDIT' && (
                <div className="p-3 bg-amber-500/10 border border-amber-900/50 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-amber-400">Credit Order — Ghana Card Required</p>
                  <input type="text" value={orderGhanaCard} onChange={e => setOrderGhanaCard(e.target.value)} required placeholder="E.g., GHA-1234567-8" className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs focus:outline-none focus:border-amber-500" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Order Amount (GHS) <span className="text-rose-500">*</span></label>
                <input type="number" value={orderAmount} onChange={e => setOrderAmount(e.target.value)} required placeholder="35000" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-755 rounded-xl text-xs font-bold cursor-pointer transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow transition-colors">Submit Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REGISTER CUSTOMER MODAL ── */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCustomerModal(false)}>
          <div className="bg-[var(--bg-card)] border border-custom rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 flex justify-between items-center text-white">
              <div>
                <h2 className="font-bold text-white text-lg">Register New Customer</h2>
                <p className="text-white/70 text-xs mt-0.5">Add a new client to the customer directory</p>
              </div>
              <button onClick={() => setShowCustomerModal(false)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitCustomer} className="p-6 space-y-4">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {custPhoto ? (
                    <img src={custPhoto} alt="Customer" className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100/10 border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <button type="button" onClick={() => photoRef.current?.click()} className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center cursor-pointer text-[10px]">+</button>
                  <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Customer Photo <span className="text-slate-400 font-normal">(optional)</span></p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Click the + button to upload a photo</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Customer Name <span className="text-rose-500">*</span></label>
                  <input type="text" value={custName} onChange={e => setCustName(e.target.value)} required placeholder="E.g., Kofi Owusu" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Company Name</label>
                  <input type="text" value={custCompany} onChange={e => setCustCompany(e.target.value)} placeholder="E.g., Owusu Retail Hub" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone Number <span className="text-rose-500">*</span></label>
                  <input type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)} required placeholder="+233 24 123 4567" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">City / Location</label>
                  <input type="text" value={custLocation} onChange={e => setCustLocation(e.target.value)} placeholder="E.g., Kumasi" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email Address</label>
                  <input type="email" value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="client@company.com" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ghana Card ID</label>
                  <input type="text" value={custGhanaCard} onChange={e => setCustGhanaCard(e.target.value)} placeholder="GHA-XXXXXXX-X" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCustomerModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow transition-colors">Add to Directory</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CUSTOMER PROFILE MODAL ── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-[var(--bg-card)] border border-custom rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-5 text-white">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg">Customer Profile</h2>
                <button onClick={() => setSelectedCustomer(null)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Profile header */}
              <div className="flex items-center gap-4">
                {selectedCustomer.photo ? (
                  <img src={selectedCustomer.photo} alt={selectedCustomer.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-custom">
                    <Users className="w-7 h-7 text-blue-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-500">{selectedCustomer.companyName}</p>
                  <p className="text-[10px] text-slate-450 mt-0.5 font-mono">Registered: {selectedCustomer.registeredAt}</p>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-100/50 dark:bg-slate-800/10 border border-custom rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-semibold">Phone</p>
                  <p className="font-medium mt-0.5 font-mono">{selectedCustomer.phone}</p>
                </div>
                <div className="p-3 bg-slate-100/50 dark:bg-slate-800/10 border border-custom rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-semibold">Location</p>
                  <p className="font-medium mt-0.5">{selectedCustomer.location || '—'}</p>
                </div>
                {selectedCustomer.email && (
                  <div className="p-3 bg-slate-100/50 dark:bg-slate-800/10 border border-custom rounded-xl">
                    <p className="text-slate-400 text-[10px] uppercase font-semibold">Email</p>
                    <p className="font-medium mt-0.5 font-mono">{selectedCustomer.email}</p>
                  </div>
                )}
                {selectedCustomer.ghanaCard && (
                  <div className="p-3 bg-slate-100/50 dark:bg-slate-800/10 border border-custom rounded-xl">
                    <p className="text-slate-400 text-[10px] uppercase font-semibold">Ghana Card</p>
                    <p className="font-mono font-medium mt-0.5">{selectedCustomer.ghanaCard}</p>
                  </div>
                )}
              </div>

              {/* Order history */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-indigo-500" />
                  <p className="text-xs font-bold">Order History ({customerOrders(selectedCustomer).length})</p>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border-t border-custom pt-1.5">
                  {customerOrders(selectedCustomer).length === 0 && (
                    <p className="text-[10px] text-slate-500 text-center py-3">No orders found for this customer.</p>
                  )}
                  {customerOrders(selectedCustomer).map(o => (
                    <div key={o.id} className="flex justify-between items-center p-2 bg-slate-100/5 dark:bg-slate-800/20 border border-custom rounded-lg text-[10px]">
                      <span className="font-mono text-slate-550">{o.id}</span>
                      <span className="text-slate-400">{o.productName || '—'}</span>
                      <span className="font-bold font-mono">GHS {o.totalAmount.toLocaleString()}</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] ${statusColor(o.status)}`}>{o.status.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL MODAL ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[var(--bg-card)] border border-custom rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center text-white">
              <div>
                <h2 className="font-bold">Order Details</h2>
                <p className="text-white/70 text-xs mt-0.5 font-mono">{selectedOrder.id}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              {selectedOrder.ticketNumber && (
                <div className="text-center">
                  <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold font-mono">🎫 Ticket: {selectedOrder.ticketNumber}</span>
                </div>
              )}
              {[
                ['Client', selectedOrder.clientName],
                ['Product', selectedOrder.productName || '—'],
                ['Destination', selectedOrder.destination || '—'],
                ['Payment Mode', selectedOrder.paymentMode],
                ['Amount', `GHS ${selectedOrder.totalAmount.toLocaleString()}`],
                ['Status', selectedOrder.status.replace(/_/g, ' ')],
                ['Submitted', selectedOrder.createdAt],
                ...(selectedOrder.ghanaCard ? [['Ghana Card', selectedOrder.ghanaCard]] : [])
              ].map(([label, value], idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-custom">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">{label}</span>
                  <span className="font-medium text-slate-300">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketing Pipeline</h1>
          <p className="text-sm text-muted">Create client sales orders, register customers, and inspect history logs.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowOrderModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-colors">
            <Clipboard className="w-3.5 h-3.5" /> Create Order
          </button>
          <button onClick={() => setShowCustomerModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Register Customer
          </button>
          <button onClick={() => exportToCSV(localOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'marketing_orders')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportToPDF('Sales Orders Ledger', localOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-6 app-card flex items-center justify-between hover:scale-102 transition-all duration-300">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">{card.title}</span>
                <h3 className="text-2xl font-bold mt-1">{card.value}</h3>
                <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
              </div>
              <div className={`p-4 bg-slate-100 rounded-2xl ${card.color} bg-accent-light`}><Icon className="w-6 h-6" /></div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-6 app-card">
        <h3 className="text-lg font-bold">Marketing Lead Inflow & Sales Closures</h3>
        <p className="text-xs text-muted">Weekly lead pipeline velocity vs sales order bookings.</p>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="Leads" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Customer Directory — Table */}
      <div className="theme-table-wrapper">
        {/* Toolbar */}
        <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold">Customer Directory</h3>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredCust.length} accounts</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-550 text-xs pointer-events-none">🔍</span>
              <input
                type="text"
                placeholder="Search customers…"
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-40"
              />
            </div>
            {/* Location filter */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsCustFilterOpen(!isCustFilterOpen); }}
                className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom"
              >
                <span>City: {custLocationFilter === 'ALL' ? 'All' : custLocationFilter}</span>
                <span className="text-[10px]">▼</span>
              </button>
              {isCustFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                  {(['ALL', 'Accra', 'Kumasi', 'Tema', 'Takoradi'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => { setCustLocationFilter(st); setIsCustFilterOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {st === 'ALL' ? 'All Cities' : st}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Export */}
            <button onClick={() => exportToCSV(localCustomers, ['id', 'name', 'phone', 'location', 'companyName', 'ghanaCard', 'email', 'registeredAt'], 'customers')} className="flex items-center gap-1 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom">
              <span>⬇</span> Export
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="theme-table-header-row text-slate-400 uppercase font-semibold text-[10px]">
                <th className="py-3 px-5 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={filteredCust.length > 0 && selectedCustRows.size === filteredCust.length}
                    onChange={handleSelectAllCust}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Photo</th>
                <th onClick={() => handleSort('name', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'name' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('companyName', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Company</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'companyName' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('phone', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Phone</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'phone' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('location', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Location</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'location' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('ghanaCard', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Ghana Card</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'ghanaCard' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Orders</th>
                <th onClick={() => handleSort('registeredAt', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Registered</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'registeredAt' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-custom">
              {sortedCust.map(cust => (
                <tr key={cust.id} className="theme-table-row group cursor-pointer" onClick={() => setSelectedCustomer(cust)}>
                  <td className="py-3.5 px-5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedCustRows.has(cust.id)}
                      onChange={() => handleSelectCustRow(cust.id)}
                      className="accent-blue-600 w-3.5 h-3.5"
                    />
                  </td>
                  <td className="py-3.5 px-3">
                    {cust.photo ? (
                      <img src={cust.photo} alt={cust.name} className="w-8 h-8 rounded-full object-cover border border-custom" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-custom">
                        <span className="text-xs font-bold text-blue-400">{cust.name[0]}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-sm">{cust.name}</td>
                  <td className="py-3.5 px-3 text-slate-400">{cust.companyName}</td>
                  <td className="py-3.5 px-3 text-slate-400 font-mono">{cust.phone}</td>
                  <td className="py-3.5 px-3 text-slate-450">{cust.location}</td>
                  <td className="py-3.5 px-3 font-mono text-[10px] text-slate-400">{cust.ghanaCard || '—'}</td>
                  <td className="py-3.5 px-3 text-center">
                    <span className="px-2.5 py-0.5 bg-blue-500/15 text-blue-400 rounded-full text-[9px] font-bold">{customerOrders(cust).length}</span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-400 font-mono text-[10px]">{cust.registeredAt}</td>
                  <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveCustMenu(activeCustMenu === cust.id ? null : cust.id)}
                      className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                    >
                      ···
                    </button>
                    {activeCustMenu === cust.id && (
                      <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                        <button onClick={() => setSelectedCustomer(cust)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">👤 View Profile</button>
                        <button onClick={() => handleEditCustomer(cust)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">✏ Edit Account</button>
                        <button onClick={() => handleDuplicateCustomer(cust)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate</button>
                        <button onClick={() => handleShareCustomer(cust)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                        <button onClick={() => handleDeleteCustomer(cust.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
          <p className="text-xs text-slate-400 font-mono">Showing {filteredCust.length} of {localCustomers.length} client accounts</p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
            <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
            <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
          </div>
        </div>
      </div>

      {/* Active Sales Orders — Clickable */}
      <div className="theme-table-wrapper">
        {/* Toolbar */}
        <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">Active Sales Orders Pipeline</h3>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredOrders.length} bookings</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
              <input
                type="text"
                placeholder="Search bookings…"
                value={ordersSearch}
                onChange={e => setOrdersSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-40"
              />
            </div>
            {/* Mode dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsOrdersFilterOpen(!isOrdersFilterOpen); }}
                className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom"
              >
                <span>Mode: {ordersModeFilter === 'ALL' ? 'All' : ordersModeFilter}</span>
                <span className="text-[10px]">▼</span>
              </button>
              {isOrdersFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                  {(['ALL', 'CASH', 'CREDIT', 'ONLINE'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => { setOrdersModeFilter(st); setIsOrdersFilterOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                    >
                      <span className={`w-2 h-2 rounded-full ${st === 'CASH' ? 'bg-emerald-400' : st === 'CREDIT' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                      {st === 'ALL' ? 'All Modes' : st}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="theme-table-header-row text-slate-400 uppercase font-semibold text-[10px]">
                <th className="py-3 px-5 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={filteredOrders.length > 0 && selectedOrdersRows.size === filteredOrders.length}
                    onChange={handleSelectAllOrders}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                </th>
                <th onClick={() => handleSort('ticketNumber', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Ticket #</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'ticketNumber' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('id', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Order ID</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'id' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('clientName', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Client</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'clientName' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('productName', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Product</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'productName' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('destination', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Destination</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'destination' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('paymentMode', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Mode</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'paymentMode' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('totalAmount', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center justify-end gap-1">
                    <span>Amount</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'totalAmount' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('status', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'status' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('createdAt', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                  <div className="flex items-center gap-1">
                    <span>Submitted</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'createdAt' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-custom">
              {sortedOrders.map(order => (
                <tr key={order.id} className="theme-table-row group cursor-pointer animate-fade-in-up" onClick={() => setSelectedOrder(order)}>
                  <td className="py-3 px-5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrdersRows.has(order.id)}
                      onChange={() => handleSelectOrdersRow(order.id)}
                      className="accent-blue-600 w-3.5 h-3.5"
                    />
                  </td>
                  <td className="py-3.5 px-3 font-mono text-emerald-450 font-bold">{order.ticketNumber || '—'}</td>
                  <td className="py-3.5 px-3 font-mono text-slate-400">{order.id}</td>
                  <td className="py-3.5 px-3 font-semibold text-sm">{order.clientName}</td>
                  <td className="py-3.5 px-3 text-slate-350">{order.productName || '—'}</td>
                  <td className="py-3.5 px-3 text-slate-400">{order.destination || '—'}</td>
                  <td className="py-3.5 px-3">
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${order.paymentMode === 'CREDIT' ? 'bg-amber-500/10 text-amber-400' : order.paymentMode === 'CASH' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-450'}`}>{order.paymentMode}</span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px]">GHS {order.totalAmount.toLocaleString()}</td>
                  <td className="py-3.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(order.status)}`}>{order.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-400 font-mono text-[10px]">{order.createdAt}</td>
                  <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveOrdersMenu(activeOrdersMenu === order.id ? null : order.id)}
                      className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                    >
                      ···
                    </button>
                    {activeOrdersMenu === order.id && (
                      <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                        <button onClick={() => setSelectedOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 View Order</button>
                        <button onClick={() => handleEditOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">✏ Edit Value</button>
                        <button onClick={() => handleDuplicateOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate</button>
                        <button onClick={() => handleShareOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                        <button onClick={() => handleDeleteOrder(order.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
          <p className="text-xs text-slate-400 font-mono">Showing {filteredOrders.length} of {localOrders.length} bookings</p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
            <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
            <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
