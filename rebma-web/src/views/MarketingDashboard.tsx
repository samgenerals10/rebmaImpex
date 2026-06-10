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

  // Mobile detail view
  const [activeMobileDetail, setActiveMobileDetail] = useState<{ type: 'customer' | 'order'; data: Customer | Order } | null>(null);

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
    return m[status] || 'bg-slate-500/10 text-text-muted';
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

  if (activeMobileDetail) {
    return (
      <div className="lg:hidden bg-bg-card min-h-screen p-4 pb-24 space-y-6 animate-fade-in-up text-text-primary">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveMobileDetail(null)}
            className="px-3 py-1.5 bg-bg-card dark:bg-slate-800 border border-[var(--border)] dark:border-slate-700 rounded-full text-xs font-bold text-text-secondary cursor-pointer shadow-card"
          >
            ← Back
          </button>
          <h2 className="text-sm font-bold">Record Details</h2>
        </div>

        {activeMobileDetail.type === 'customer' ? (() => {
          const cust = activeMobileDetail.data as Customer;
          return (
            <div className="space-y-4">
              <div className="bg-bg-card dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-700 text-center flex flex-col items-center gap-3">
                {cust.photo ? (
                  <img src={cust.photo} alt={cust.name} className="w-16 h-16 rounded-full object-cover border-2 border-[var(--border)]" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-500">{cust.name[0]}</span>
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold">{cust.name}</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{cust.id}</p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-[9px] font-bold uppercase">{cust.companyName}</span>
                </div>
              </div>
              <div className="bg-bg-card dark:bg-slate-800 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                {[['Phone', cust.phone], ['Location', cust.location || '—'], ['Email', cust.email || '—'], ['Ghana Card', cust.ghanaCard || '—'], ['Registered', cust.registeredAt]].map(([label, value]) => (
                  <div key={label} className="py-3 flex justify-between items-center text-xs">
                    <span className="text-text-muted font-medium">{label}</span>
                    <span className="font-semibold font-mono">{value}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { handleEditCustomer(cust); setActiveMobileDetail(null); }} className="py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-[var(--border)] dark:border-slate-700">Edit Account</button>
                <button onClick={() => { handleDeleteCustomer(cust.id); setActiveMobileDetail(null); }} className="py-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 cursor-pointer">Delete Customer</button>
              </div>
            </div>
          );
        })() : (() => {
          const order = activeMobileDetail.data as Order;
          return (
            <div className="space-y-4">
              <div className="bg-bg-card dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-700 text-center flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-xl">{order.clientName[0]}</div>
                <div>
                  <h3 className="text-base font-bold">{order.clientName}</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{order.id}</p>
                </div>
              </div>
              <div className="bg-bg-card dark:bg-slate-800 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                {[
                  ['Ticket', order.ticketNumber || '—'],
                  ['Product', order.productName || '—'],
                  ['Destination', order.destination || '—'],
                  ['Payment', order.paymentMode],
                  ['Amount', `GHS ${order.totalAmount.toLocaleString()}`],
                  ['Status', order.status.replace(/_/g, ' ')],
                  ['Submitted', order.createdAt],
                ].map(([label, value]) => (
                  <div key={label} className="py-3 flex justify-between items-center text-xs">
                    <span className="text-text-muted font-medium">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { handleEditOrder(order); setActiveMobileDetail(null); }} className="py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer border border-[var(--border)] dark:border-slate-700">Edit Order</button>
                <button onClick={() => { handleDeleteOrder(order.id); setActiveMobileDetail(null); }} className="py-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 cursor-pointer">Delete Order</button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <>
      {/* ══ MOBILE LAYOUT (< lg) ══ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Marketing</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Sales pipeline & customer records</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(localOrders, ['id', 'clientName', 'productName', 'totalAmount', 'status'], 'sales_orders')} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card" title="Export CSV">
              <FileSpreadsheet className="w-4 h-4 text-text-secondary" />
            </button>
            <button onClick={() => exportToPDF('Sales Orders Report', localOrders, ['id', 'clientName', 'totalAmount', 'status'])} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card" title="Export PDF">
              <FileText className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Physical Gradient Card */}
        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Pipeline Value</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">GHS {pipelineValue.toLocaleString()}</h2>
              <p className="text-[10px] text-white/70 mt-1">{totalOrdersCount} Total Bookings</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">•••• •••• •••• 5621</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">Marketing & Sales Bureau</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Customers', value: `${totalCustomersCount}`, sub: 'Accounts active', bg: '#eff6ff', color: '#3b82f6', icon: Users },
            { label: 'Completed', value: `${completedDealsCount}`, sub: 'Deals closed', bg: '#f0fdf4', color: '#16a34a', icon: ShieldCheck },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="mobile-stat-card">
                <div className="mobile-stat-icon" style={{ background: s.bg }}>
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider truncate">{s.label}</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.value}</p>
                  <p className="text-[9px] text-text-muted truncate">{s.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick actions panel */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setShowOrderModal(true)} className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-card">
            <UserPlus className="w-4 h-4" /> Book Order
          </button>
          <button onClick={() => setShowCustomerModal(true)} className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-text-primary rounded-xl text-xs font-bold transition-all border border-[var(--border)]">
            <Users className="w-4 h-4" /> Add Customer
          </button>
        </div>

        {/* Sales Orders List */}
        <div>
          <p className="mobile-section-label">Active Sales Orders</p>
          <div className="space-y-2">
            {localOrders.slice(0, 5).map(o => (
              <div key={o.id} onClick={() => setActiveMobileDetail({ type: 'order', data: o })} className="mobile-data-row cursor-pointer">
                <div className="mobile-data-row-icon bg-blue-50 text-blue-600">
                  <Clipboard className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{o.clientName}</p>
                  <p className="text-[10px] text-text-muted truncate">{o.productName} • GHS {o.totalAmount.toLocaleString()}</p>
                </div>
                <span className={`mobile-status-pill ${
                  o.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' :
                  o.status.startsWith('PENDING') ? 'bg-amber-50 text-amber-700' :
                  'bg-bg-input text-text-secondary'
                }`}>{o.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Profiles */}
        <div>
          <p className="mobile-section-label">Customer Profiles</p>
          <div className="space-y-2">
            {localCustomers.slice(0, 5).map(c => (
              <div key={c.id} onClick={() => setActiveMobileDetail({ type: 'customer', data: c })} className="mobile-data-row cursor-pointer">
                {c.photo ? (
                  <img src={c.photo} alt={c.name} className="w-8 h-8 rounded-full object-cover border border-[var(--border)]" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    {c.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0 ml-2">
                  <p className="text-xs font-bold text-text-primary truncate">{c.name}</p>
                  <p className="text-[10px] text-text-muted truncate">{c.companyName} • {c.location || 'No Location'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ DESKTOP LAYOUT (lg+) ══ */}
      <div className="hidden lg:block">
      <div className="space-y-6">

      {/* ── ORDER MODAL ── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4" onClick={() => setShowOrderModal(false)}>
          <div className="bg-[var(--bg-card)] border-0 md:border border-[var(--border)] rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[var(--accent)] to-indigo-600 p-5 flex justify-between items-center text-white">
              <div>
                <h2 className="font-bold text-lg text-white">Create Client Sales Order</h2>
                <p className="text-white/70 text-xs mt-0.5">Fill all required fields to book a new sales order</p>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="p-1.5 hover:bg-bg-card/10 rounded-full cursor-pointer"><X className="w-5 h-5 text-white" /></button>
            </div>
            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Client Customer <span className="text-rose-500">*</span></label>
                <select value={orderClient} onChange={e => setOrderClient(e.target.value)} required className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]">
                  <option value="">-- Select a registered customer --</option>
                  {localCustomers.map(c => <option key={c.id} value={c.name}>{c.name} ({c.companyName})</option>)}
                  <option value="Walk-in Customer">Walk-in Customer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Product Name <span className="text-rose-500">*</span></label>
                  <input type="text" value={orderProduct} onChange={e => setOrderProduct(e.target.value)} required placeholder="E.g., Palm Oil Barrel" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Payment Mode</label>
                  <select value={orderPayMode} onChange={e => setOrderPayMode(e.target.value as any)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]">
                    <option value="CASH">Cash Payment</option>
                    <option value="ONLINE">Prepaid Online</option>
                    <option value="CREDIT">On Credit Terms</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Delivery Destination</label>
                <input type="text" value={orderDestination} onChange={e => setOrderDestination(e.target.value)} placeholder="E.g., Kumasi Central Depot" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
              </div>

              {orderPayMode === 'CREDIT' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-amber-700">Credit Order — Ghana Card Required</p>
                  <input type="text" value={orderGhanaCard} onChange={e => setOrderGhanaCard(e.target.value)} required placeholder="E.g., GHA-1234567-8" className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Order Amount (GHS) <span className="text-rose-500">*</span></label>
                <input type="number" value={orderAmount} onChange={e => setOrderAmount(e.target.value)} required placeholder="35000" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 py-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent-light)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs font-bold cursor-pointer transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer shadow transition-opacity">Submit Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REGISTER CUSTOMER MODAL ── */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4" onClick={() => setShowCustomerModal(false)}>
          <div className="bg-[var(--bg-card)] border-0 md:border border-[var(--border)] rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 flex justify-between items-center text-white">
              <div>
                <h2 className="font-bold text-white text-lg">Register New Customer</h2>
                <p className="text-white/70 text-xs mt-0.5">Add a new client to the customer directory</p>
              </div>
              <button onClick={() => setShowCustomerModal(false)} className="p-1.5 hover:bg-bg-card/10 rounded-full cursor-pointer"><X className="w-5 h-5 text-white" /></button>
            </div>
            <form onSubmit={handleSubmitCustomer} className="p-6 space-y-4">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {custPhoto ? (
                    <img src={custPhoto} alt="Customer" className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--bg)] border-2 border-dashed border-[var(--border)] flex items-center justify-center">
                      <Camera className="w-6 h-6 text-[var(--text-muted)]" />
                    </div>
                  )}
                  <button type="button" onClick={() => photoRef.current?.click()} className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center cursor-pointer text-[10px]">+</button>
                  <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Customer Photo <span className="text-[var(--text-muted)] font-normal">(optional)</span></p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Click the + button to upload a photo</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Customer Name <span className="text-rose-500">*</span></label>
                  <input type="text" value={custName} onChange={e => setCustName(e.target.value)} required placeholder="E.g., Kofi Owusu" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Company Name</label>
                  <input type="text" value={custCompany} onChange={e => setCustCompany(e.target.value)} placeholder="E.g., Owusu Retail Hub" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Phone Number <span className="text-rose-500">*</span></label>
                  <input type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)} required placeholder="+233 24 123 4567" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">City / Location</label>
                  <input type="text" value={custLocation} onChange={e => setCustLocation(e.target.value)} placeholder="E.g., Kumasi" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Email Address</label>
                  <input type="email" value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="client@company.com" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Ghana Card ID</label>
                  <input type="text" value={custGhanaCard} onChange={e => setCustGhanaCard(e.target.value)} placeholder="GHA-XXXXXXX-X" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCustomerModal(false)} className="flex-1 py-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent-light)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs font-bold cursor-pointer transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow transition-colors">Add to Directory</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CUSTOMER PROFILE MODAL ── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-[var(--bg-card)] border-0 md:border border-[var(--border)] rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-5 text-white">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg text-white">Customer Profile</h2>
                <button onClick={() => setSelectedCustomer(null)} className="p-1.5 hover:bg-bg-card/10 rounded-full cursor-pointer"><X className="w-5 h-5 text-white" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Profile header */}
              <div className="flex items-center gap-4">
                {selectedCustomer.photo ? (
                  <img src={selectedCustomer.photo} alt={selectedCustomer.name} className="w-16 h-16 rounded-full object-cover border-2 border-[var(--border)]" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[var(--accent-light)] flex items-center justify-center border border-[var(--border)]">
                    <Users className="w-7 h-7 text-[var(--accent)]" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">{selectedCustomer.name}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{selectedCustomer.companyName}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">Registered: {selectedCustomer.registeredAt}</p>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                  <p className="text-[var(--text-muted)] text-[10px] uppercase font-semibold">Phone</p>
                  <p className="font-medium mt-0.5 font-mono text-[var(--text-primary)]">{selectedCustomer.phone}</p>
                </div>
                <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                  <p className="text-[var(--text-muted)] text-[10px] uppercase font-semibold">Location</p>
                  <p className="font-medium mt-0.5 text-[var(--text-primary)]">{selectedCustomer.location || '—'}</p>
                </div>
                {selectedCustomer.email && (
                  <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                    <p className="text-[var(--text-muted)] text-[10px] uppercase font-semibold">Email</p>
                    <p className="font-medium mt-0.5 font-mono text-[var(--text-primary)]">{selectedCustomer.email}</p>
                  </div>
                )}
                {selectedCustomer.ghanaCard && (
                  <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                    <p className="text-[var(--text-muted)] text-[10px] uppercase font-semibold">Ghana Card</p>
                    <p className="font-mono font-medium mt-0.5 text-[var(--text-primary)]">{selectedCustomer.ghanaCard}</p>
                  </div>
                )}
              </div>

              {/* Order history */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-[var(--accent)]" />
                  <p className="text-xs font-bold text-[var(--text-primary)]">Order History ({customerOrders(selectedCustomer).length})</p>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border-t border-[var(--border)] pt-1.5">
                  {customerOrders(selectedCustomer).length === 0 && (
                    <p className="text-[10px] text-[var(--text-muted)] text-center py-3">No orders found for this customer.</p>
                  )}
                  {customerOrders(selectedCustomer).map(o => (
                    <div key={o.id} className="flex justify-between items-center p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[10px]">
                      <span className="font-mono text-[var(--text-primary)]">{o.id}</span>
                      <span className="text-[var(--text-muted)]">{o.productName || '—'}</span>
                      <span className="font-bold font-mono text-[var(--text-primary)]">GHS {o.totalAmount.toLocaleString()}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[var(--bg-card)] border-0 md:border border-[var(--border)] rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-md overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center text-white">
              <div>
                <h2 className="font-bold text-white">Order Details</h2>
                <p className="text-white/70 text-xs mt-0.5 font-mono">{selectedOrder.id}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 hover:bg-bg-card/10 rounded-full cursor-pointer"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              {selectedOrder.ticketNumber && (
                <div className="text-center">
                  <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold font-mono">🎫 Ticket: {selectedOrder.ticketNumber}</span>
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
                <div key={idx} className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)] font-semibold uppercase text-[10px]">{label}</span>
                  <span className="font-medium text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Marketing Pipeline</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">Create client sales orders, register customers, and inspect history logs.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <button onClick={() => setShowOrderModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-opacity">
            <Clipboard className="w-3.5 h-3.5" /> Create Order
          </button>
          <button onClick={() => setShowCustomerModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Register Customer
          </button>
          <button onClick={() => exportToCSV(localOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'marketing_orders')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity">
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportToPDF('Sales Orders Ledger', localOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] flex items-center justify-between hover:scale-102 transition-all duration-300">
              <div>
                <span className="text-xs text-[var(--text-muted)] uppercase font-semibold">{card.title}</span>
                <h3 className="text-2xl font-bold mt-1 text-[var(--text-primary)]">{card.value}</h3>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">{card.sub}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[var(--accent-light)] flex items-center justify-center shrink-0">
                <Icon className="w-6 h-6 text-[var(--accent)]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)]">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Marketing Lead Inflow & Sales Closures</h3>
        <p className="text-xs text-[var(--text-muted)]">Weekly lead pipeline velocity vs sales order bookings.</p>
        <div className="h-[200px] sm:h-60 lg:h-[300px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="Leads" stroke="var(--accent)" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Customer Directory — Table */}
      <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
        {/* Toolbar */}
        <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Customer Directory</h3>
            <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">{filteredCust.length} accounts</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[var(--text-muted)] text-xs pointer-events-none">🔍</span>
              <input
                type="text"
                placeholder="Search customers…"
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border border-[var(--border)] transition w-40 bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--accent)]"
              />
            </div>
            {/* Location filter */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsCustFilterOpen(!isCustFilterOpen); }}
                className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)]"
              >
                <span>City: {custLocationFilter === 'ALL' ? 'All' : custLocationFilter}</span>
                <span className="text-[10px]">▼</span>
              </button>
              {isCustFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                  {(['ALL', 'Accra', 'Kumasi', 'Tema', 'Takoradi'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => { setCustLocationFilter(st); setIsCustFilterOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                      {st === 'ALL' ? 'All Cities' : st}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Export */}
            <button onClick={() => exportToCSV(localCustomers, ['id', 'name', 'phone', 'location', 'companyName', 'ghanaCard', 'email', 'registeredAt'], 'customers')} className="flex items-center gap-1 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)]">
              <span>⬇</span> Export
            </button>
          </div>
        </div>

        {/* Mobile Card List */}
        <div className="lg:hidden space-y-3 p-4">
          {filteredCust.map(cust => (
            <div
              key={cust.id}
              onClick={() => setActiveMobileDetail({ type: 'customer', data: cust })}
              className="bg-bg-card dark:bg-slate-800 rounded-2xl shadow-card p-4 border border-[var(--border)] dark:border-slate-700 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {cust.photo ? (
                  <img src={cust.photo} alt={cust.name} className="w-10 h-10 rounded-full object-cover border border-[var(--border)]" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm shrink-0">{cust.name[0]}</div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-text-primary dark:text-slate-200">{cust.name}</h4>
                  <p className="text-xs text-text-muted">{cust.companyName}</p>
                  <p className="text-[10px] text-text-muted font-mono mt-0.5">{cust.phone}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
            </div>
          ))}
          {filteredCust.length === 0 && (
            <div className="p-8 text-center text-text-muted text-xs bg-bg-card dark:bg-slate-800 rounded-2xl">No customers matched search.</div>
          )}
        </div>

        {/* Scrollable Table (Desktop only) */}
        <div className="hidden lg:block overflow-x-auto w-full">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="theme-table-header-row text-[var(--text-muted)] uppercase font-semibold text-[10px] border-b border-[var(--border)]">
                <th className="py-3 px-5 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={filteredCust.length > 0 && selectedCustRows.size === filteredCust.length}
                    onChange={handleSelectAllCust}
                    className="accent-[var(--accent)] w-3.5 h-3.5"
                  />
                </th>
                <th className="py-3 px-3 whitespace-nowrap text-[var(--text-primary)]">Photo</th>
                <th onClick={() => handleSort('name', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'name' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('companyName', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Company</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'companyName' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('phone', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Phone</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'phone' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('location', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Location</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'location' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('ghanaCard', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Ghana Card</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'ghanaCard' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap text-[var(--text-primary)]">Orders</th>
                <th onClick={() => handleSort('registeredAt', customerSortField, setCustomerSortField, customerSortDir, setCustomerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden lg:table-cell text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Registered</span>
                    <span className="text-[9px] opacity-70">{customerSortField === 'registeredAt' ? (customerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-5 text-center whitespace-nowrap text-[var(--text-primary)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sortedCust.map(cust => (
                <tr key={cust.id} className="theme-table-row hover:bg-[var(--accent-light)] transition-colors group cursor-pointer text-[var(--text-primary)]" onClick={() => setSelectedCustomer(cust)}>
                  <td className="py-3.5 px-5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedCustRows.has(cust.id)}
                      onChange={() => handleSelectCustRow(cust.id)}
                      className="accent-[var(--accent)] w-3.5 h-3.5"
                    />
                  </td>
                  <td className="py-3.5 px-3">
                    {cust.photo ? (
                      <img src={cust.photo} alt={cust.name} className="w-8 h-8 rounded-full object-cover border border-[var(--border)]" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center border border-[var(--border)]">
                        <span className="text-xs font-bold text-[var(--accent)]">{cust.name[0]}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-sm">{cust.name}</td>
                  <td className="py-3.5 px-3 text-[var(--text-muted)] hidden sm:table-cell">{cust.companyName}</td>
                  <td className="py-3.5 px-3 text-[var(--text-muted)] font-mono">{cust.phone}</td>
                  <td className="py-3.5 px-3 text-[var(--text-muted)] hidden sm:table-cell">{cust.location}</td>
                  <td className="py-3.5 px-3 font-mono text-[10px] text-[var(--text-muted)] hidden md:table-cell">{cust.ghanaCard || '—'}</td>
                  <td className="py-3.5 px-3 text-center">
                    <span className="px-2.5 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-full text-[9px] font-bold">{customerOrders(cust).length}</span>
                  </td>
                  <td className="py-3.5 px-3 text-[var(--text-muted)] font-mono text-[10px] hidden lg:table-cell">{cust.registeredAt}</td>
                  <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveCustMenu(activeCustMenu === cust.id ? null : cust.id)}
                      className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] transition-colors select-none border border-[var(--border)]"
                    >
                      ···
                    </button>
                    {activeCustMenu === cust.id && (
                      <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col text-left">
                        <button onClick={() => setSelectedCustomer(cust)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">👤 View Profile</button>
                        <button onClick={() => handleEditCustomer(cust)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">✏ Edit Account</button>
                        <button onClick={() => handleDuplicateCustomer(cust)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">📋 Duplicate</button>
                        <button onClick={() => handleShareCustomer(cust)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">🔗 Share Link</button>
                        <div className="h-px bg-[var(--border)] my-1"></div>
                        <button onClick={() => handleDeleteCustomer(cust.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-left">🗑 Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
          <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredCust.length} of {localCustomers.length} client accounts</p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
            <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
            <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
          </div>
        </div>
      </div>

      {/* Active Sales Orders — Clickable */}
      <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] mt-6">
        {/* Toolbar */}
        <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Active Sales Orders Pipeline</h3>
            <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">{filteredOrders.length} bookings</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[var(--text-muted)] text-xs pointer-events-none">🔍</span>
              <input
                type="text"
                placeholder="Search bookings…"
                value={ordersSearch}
                onChange={e => setOrdersSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border border-[var(--border)] transition w-40 bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--accent)]"
              />
            </div>
            {/* Mode dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsOrdersFilterOpen(!isOrdersFilterOpen); }}
                className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)]"
              >
                <span>Mode: {ordersModeFilter === 'ALL' ? 'All' : ordersModeFilter}</span>
                <span className="text-[10px]">▼</span>
              </button>
              {isOrdersFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                  {(['ALL', 'CASH', 'CREDIT', 'ONLINE'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => { setOrdersModeFilter(st); setIsOrdersFilterOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
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

        {/* Mobile Card List */}
        <div className="lg:hidden space-y-3 p-4">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              onClick={() => setActiveMobileDetail({ type: 'order', data: order })}
              className="bg-[var(--bg-card)] rounded-2xl shadow-card p-4 border border-[var(--border)] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-sm shrink-0">{order.clientName[0]}</div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">{order.clientName}</h4>
                  <p className="text-xs text-[var(--text-muted)]">{order.productName || '—'}</p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">GHS {order.totalAmount.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(order.status)}`}>{order.status.replace(/_/g, ' ')}</span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </div>
            </div>
          ))}
          {filteredOrders.length === 0 && (
            <div className="p-8 text-center text-[var(--text-muted)] text-xs bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]">No orders matched search.</div>
          )}
        </div>

        {/* Scrollable table (Desktop only) */}
        <div className="hidden lg:block overflow-x-auto w-full">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="theme-table-header-row text-[var(--text-muted)] uppercase font-semibold text-[10px] border-b border-[var(--border)]">
                <th className="py-3 px-5 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={filteredOrders.length > 0 && selectedOrdersRows.size === filteredOrders.length}
                    onChange={handleSelectAllOrders}
                    className="accent-[var(--accent)] w-3.5 h-3.5"
                  />
                </th>
                <th onClick={() => handleSort('ticketNumber', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Ticket #</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'ticketNumber' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('id', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Order ID</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'id' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('clientName', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Client</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'clientName' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('productName', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Product</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'productName' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('destination', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Destination</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'destination' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('paymentMode', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Mode</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'paymentMode' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('totalAmount', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                  <div className="flex items-center justify-end gap-1">
                    <span>Amount</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'totalAmount' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('status', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'status' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th onClick={() => handleSort('createdAt', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden lg:table-cell text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <span>Submitted</span>
                    <span className="text-[9px] opacity-70">{ordersSortField === 'createdAt' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-5 text-center whitespace-nowrap text-[var(--text-primary)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sortedOrders.map(order => (
                <tr key={order.id} className="theme-table-row hover:bg-[var(--accent-light)] transition-colors group cursor-pointer text-[var(--text-primary)]" onClick={() => setSelectedOrder(order)}>
                  <td className="py-3 px-5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrdersRows.has(order.id)}
                      onChange={() => handleSelectOrdersRow(order.id)}
                      className="accent-[var(--accent)] w-3.5 h-3.5"
                    />
                  </td>
                  <td className="py-3.5 px-3 font-mono font-bold hidden sm:table-cell text-[var(--text-primary)]">{order.ticketNumber || '—'}</td>
                  <td className="py-3.5 px-3 font-mono text-[var(--text-muted)] hidden md:table-cell">{order.id}</td>
                  <td className="py-3.5 px-3 font-semibold text-sm">{order.clientName}</td>
                  <td className="py-3.5 px-3 text-[var(--text-secondary)]">{order.productName || '—'}</td>
                  <td className="py-3.5 px-3 text-[var(--text-muted)] hidden md:table-cell">{order.destination || '—'}</td>
                  <td className="py-3.5 px-3">
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${order.paymentMode === 'CREDIT' ? 'bg-amber-500/10 text-amber-500' : order.paymentMode === 'CASH' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>{order.paymentMode}</span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px] text-[var(--text-primary)]">GHS {order.totalAmount.toLocaleString()}</td>
                  <td className="py-3.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(order.status)}`}>{order.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-3.5 px-3 text-[var(--text-muted)] font-mono text-[10px] hidden lg:table-cell">{order.createdAt}</td>
                  <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveOrdersMenu(activeOrdersMenu === order.id ? null : order.id)}
                      className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] transition-colors select-none border border-[var(--border)]"
                    >
                      ···
                    </button>
                    {activeOrdersMenu === order.id && (
                      <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col text-left">
                        <button onClick={() => setSelectedOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">📋 View Order</button>
                        <button onClick={() => handleEditOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">✏ Edit Value</button>
                        <button onClick={() => handleDuplicateOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">📋 Duplicate</button>
                        <button onClick={() => handleShareOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">🔗 Share Link</button>
                        <div className="h-px bg-[var(--border)] my-1"></div>
                        <button onClick={() => handleDeleteOrder(order.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-left">🗑 Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
          <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredOrders.length} of {localOrders.length} bookings</p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
            <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
            <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
          </div>
        </div>
      </div>
      </div>
      </div>
    </>
  );
}
