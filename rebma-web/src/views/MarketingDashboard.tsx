// rebma-web/src/views/MarketingDashboard.tsx

import React, { useState, useRef } from 'react';
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

export default function MarketingDashboard({
  ordersList,
  onCreateOrder,
  customersList,
  onRegisterCustomer,
  addNotification
}: MarketingDashboardProps) {

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

  const lineChartData = [
    { name: 'Mon', Sales: 3, Leads: 8 },
    { name: 'Tue', Sales: 5, Leads: 12 },
    { name: 'Wed', Sales: 2, Leads: 15 },
    { name: 'Thu', Sales: 8, Leads: 10 },
    { name: 'Fri', Sales: 6, Leads: 14 },
  ];

  const totalOrdersCount = ordersList.length;
  const totalCustomersCount = customersList.length;
  const completedDealsCount = ordersList.filter(o => o.status === 'DELIVERED').length;
  const pipelineValue = ordersList.reduce((acc, o) => acc + o.totalAmount, 0);

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
    onCreateOrder({
      clientName: orderClient,
      productName: orderProduct,
      destination: orderDestination,
      paymentMode: orderPayMode,
      totalAmount: parseFloat(orderAmount),
      ghanaCard: orderPayMode === 'CREDIT' ? orderGhanaCard : undefined,
      ticketNumber: ticketNum,
      createdAt: new Date().toLocaleString()
    });
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
    onRegisterCustomer({
      name: custName,
      companyName: custCompany || custName,
      phone: custPhone,
      location: custLocation,
      email: custEmail,
      ghanaCard: custGhanaCard,
      photo: custPhoto || undefined,
      registeredAt: new Date().toLocaleString()
    });
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
      DELIVERED: 'bg-emerald-100 text-emerald-800',
      PROCESSING: 'bg-indigo-100 text-indigo-800',
      PENDING_MANAGEMENT: 'bg-purple-100 text-purple-800',
      REJECTED: 'bg-red-100 text-red-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      PENDING_FINANCE: 'bg-amber-100 text-amber-800',
    };
    return m[status] || 'bg-slate-100 text-slate-700';
  };

  const customerOrders = (cust: Customer) => ordersList.filter(o => o.clientName === cust.name);

  return (
    <div className="space-y-6">

      {/* ── ORDER MODAL ── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowOrderModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-white text-lg">Create Client Sales Order</h2>
                <p className="text-white/70 text-xs mt-0.5">Fill all required fields to book a new sales order</p>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client Customer <span className="text-rose-500">*</span></label>
                <select value={orderClient} onChange={e => setOrderClient(e.target.value)} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                  <option value="">-- Select a registered customer --</option>
                  {customersList.map(c => <option key={c.id} value={c.name}>{c.name} ({c.companyName})</option>)}
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
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-amber-800">Credit Order — Ghana Card Required</p>
                  <input type="text" value={orderGhanaCard} onChange={e => setOrderGhanaCard(e.target.value)} required placeholder="E.g., GHA-1234567-8" className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs focus:outline-none focus:border-amber-500" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Order Amount (GHS) <span className="text-rose-500">*</span></label>
                <input type="number" value={orderAmount} onChange={e => setOrderAmount(e.target.value)} required placeholder="35000" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow">Submit Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REGISTER CUSTOMER MODAL ── */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCustomerModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-white text-lg">Register New Customer</h2>
                <p className="text-white/70 text-xs mt-0.5">Add a new client to the customer directory</p>
              </div>
              <button onClick={() => setShowCustomerModal(false)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitCustomer} className="p-6 space-y-4">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {custPhoto ? (
                    <img src={custPhoto} alt="Customer" className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <button type="button" onClick={() => photoRef.current?.click()} className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center cursor-pointer text-[10px]">+</button>
                  <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Customer Photo <span className="text-slate-400 font-normal">(optional)</span></p>
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
                <button type="button" onClick={() => setShowCustomerModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow">Add to Directory</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CUSTOMER PROFILE MODAL ── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-5">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-white text-lg">Customer Profile</h2>
                <button onClick={() => setSelectedCustomer(null)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Profile header */}
              <div className="flex items-center gap-4">
                {selectedCustomer.photo ? (
                  <img src={selectedCustomer.photo} alt={selectedCustomer.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-7 h-7 text-blue-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-800">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-500">{selectedCustomer.companyName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Registered: {selectedCustomer.registeredAt}</p>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-semibold">Phone</p>
                  <p className="font-medium mt-0.5">{selectedCustomer.phone}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-semibold">Location</p>
                  <p className="font-medium mt-0.5">{selectedCustomer.location || '—'}</p>
                </div>
                {selectedCustomer.email && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-slate-400 text-[10px] uppercase font-semibold">Email</p>
                    <p className="font-medium mt-0.5">{selectedCustomer.email}</p>
                  </div>
                )}
                {selectedCustomer.ghanaCard && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-slate-400 text-[10px] uppercase font-semibold">Ghana Card</p>
                    <p className="font-mono font-medium mt-0.5">{selectedCustomer.ghanaCard}</p>
                  </div>
                )}
              </div>

              {/* Order history */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-indigo-500" />
                  <p className="text-xs font-bold text-slate-700">Order History ({customerOrders(selectedCustomer).length})</p>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {customerOrders(selectedCustomer).length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-3">No orders found for this customer.</p>
                  )}
                  {customerOrders(selectedCustomer).map(o => (
                    <div key={o.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-[10px]">
                      <span className="font-mono text-slate-600">{o.id}</span>
                      <span className="text-slate-500">{o.productName || '—'}</span>
                      <span className="font-bold">GHS {o.totalAmount.toLocaleString()}</span>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-white">Order Details</h2>
                <p className="text-white/70 text-xs mt-0.5">{selectedOrder.id}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              {selectedOrder.ticketNumber && (
                <div className="text-center">
                  <span className="px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">🎫 Ticket: {selectedOrder.ticketNumber}</span>
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
                <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">{label}</span>
                  <span className="font-medium text-slate-700">{value}</span>
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
          <p className="text-sm text-slate-500 text-muted">Create client sales orders, register customers, and inspect history logs.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowOrderModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-all">
            <Clipboard className="w-3.5 h-3.5" /> Create Order
          </button>
          <button onClick={() => setShowCustomerModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-all">
            <UserPlus className="w-3.5 h-3.5" /> Register Customer
          </button>
          <button onClick={() => exportToCSV(ordersList, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'marketing_orders')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportToPDF('Sales Orders Ledger', ordersList, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-6 app-card flex items-center justify-between hover:scale-102 transition-all">
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
        <p className="text-xs text-slate-500 text-muted">Weekly lead pipeline velocity vs sales order bookings.</p>
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
      <div className="p-6 app-card space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold">Customer Directory</h3>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => exportToCSV(customersList, ['id', 'name', 'phone', 'location', 'companyName', 'ghanaCard', 'email', 'registeredAt'], 'customers')} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"><FileSpreadsheet className="w-3.5 h-3.5" /></button>
            <button onClick={() => exportToPDF('Customer Directory', customersList, ['id', 'name', 'phone', 'location', 'companyName', 'ghanaCard', 'email', 'registeredAt'])} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"><FileText className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <p className="text-xs text-slate-400">Click on any customer row to view their full profile and order history.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                <th className="py-2.5 px-3">Photo</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Ghana Card</th>
                <th className="py-2.5 px-3">Orders</th>
                <th className="py-2.5 px-3">Registered</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customersList.map(cust => (
                <tr key={cust.id} onClick={() => setSelectedCustomer(cust)} className="hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="py-2.5 px-3">
                    {cust.photo ? (
                      <img src={cust.photo} alt={cust.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">{cust.name[0]}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{cust.name}</td>
                  <td className="py-2.5 px-3 text-slate-500">{cust.companyName}</td>
                  <td className="py-2.5 px-3 text-slate-500">{cust.phone}</td>
                  <td className="py-2.5 px-3 text-slate-400">{cust.location}</td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">{cust.ghanaCard || '—'}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">{customerOrders(cust).length}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-[10px]">{cust.registeredAt}</td>
                  <td className="py-2.5 px-3"><ChevronRight className="w-4 h-4 text-slate-300" /></td>
                </tr>
              ))}
              {customersList.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-slate-400">No registered customers logged. Click "Register Customer" to add.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Sales Orders — Clickable */}
      <div className="p-6 app-card space-y-4">
        <h3 className="text-lg font-bold">Active Sales Orders</h3>
        <p className="text-xs text-slate-400">Click any order row to view full details.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                <th className="py-2.5 px-3">Ticket #</th>
                <th className="py-2.5 px-3">Order ID</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Destination</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordersList.map(order => (
                <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="py-3 px-3 font-mono text-emerald-600 font-bold">{order.ticketNumber || '—'}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{order.id}</td>
                  <td className="py-3 px-3 font-medium">{order.clientName}</td>
                  <td className="py-3 px-3 text-slate-500">{order.productName || '—'}</td>
                  <td className="py-3 px-3 text-slate-400">{order.destination || '—'}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${order.paymentMode === 'CREDIT' ? 'bg-amber-100 text-amber-800' : order.paymentMode === 'CASH' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{order.paymentMode}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold">GHS {order.totalAmount.toLocaleString()}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(order.status)}`}>{order.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[10px]">{order.createdAt}</td>
                </tr>
              ))}
              {ordersList.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-slate-400">No orders yet. Create one using the button above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
