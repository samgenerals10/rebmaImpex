// rebma-web/src/views/ManagementDashboard.tsx

import React, { useState } from 'react';
import type { IncomingGoods, Order, Customer, GoodsPrice, AuditEntry } from '../types/erp';
import { FileSpreadsheet, FileText, Clipboard, Activity, ShieldCheck, DollarSign, History, Tag, User, ChevronDown, ChevronUp } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';

interface ManagementDashboardProps {
  incomingGoodsList: IncomingGoods[];
  ordersList: Order[];
  customersList: Customer[];
  auditLog: AuditEntry[];
  goodsPrices: GoodsPrice[];
  onApproveIntake: (id: string, approve: boolean, price?: number) => void;
  onApproveCredit: (id: string, approve: boolean) => void;
  onSetPrice: (price: Omit<GoodsPrice, 'id'>) => void;
  activeSubTab: string;
  currentUser: { fullName: string; department: string } | null;
}

export default function ManagementDashboard({
  incomingGoodsList,
  ordersList,
  customersList,
  auditLog,
  goodsPrices,
  onApproveIntake,
  onApproveCredit,
  onSetPrice,
  activeSubTab = 'CargoApproval',
  currentUser
}: ManagementDashboardProps) {

  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState({ productName: '', category: 'INCOMING_GOODS' as GoodsPrice['category'], unitPrice: '', currency: 'GHS' as 'GHS' | 'USD' });

  const lineChartData = [
    { name: 'Mon', Approved: 8, Rejected: 1 },
    { name: 'Tue', Approved: 12, Rejected: 0 },
    { name: 'Wed', Approved: 15, Rejected: 2 },
    { name: 'Thu', Approved: 10, Rejected: 1 },
    { name: 'Fri', Approved: 18, Rejected: 3 },
  ];

  const pendingCargoCount = incomingGoodsList.filter(i => i.status === 'PENDING_MANAGEMENT_APPROVAL').length;
  const pendingCreditCount = ordersList.filter(o => o.status === 'PENDING_MANAGEMENT').length;
  const approvedOrdersCount = ordersList.filter(o => ['APPROVED', 'DELIVERED', 'PROCESSING'].includes(o.status)).length;
  const totalApprovedValue = ordersList
    .filter(o => ['APPROVED', 'DELIVERED', 'PROCESSING'].includes(o.status))
    .reduce((acc, o) => acc + o.totalAmount, 0);

  const stats = [
    { title: 'Cargo Awaiting Price', value: `${pendingCargoCount} Batches`, sub: 'Incoming port cargo queue', icon: Clipboard, color: 'text-blue-500' },
    { title: 'Credit Audits Pending', value: `${pendingCreditCount} Orders`, sub: 'Awaiting limit check-offs', icon: Activity, color: 'text-amber-500' },
    { title: 'Authorized Orders', value: `${approvedOrdersCount} Cleared`, sub: 'Sales orders verified', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'Net Authorized Value', value: `GHS ${totalApprovedValue.toLocaleString()}`, sub: 'Approved credit limit funds', icon: DollarSign, color: 'text-indigo-500' }
  ];

  const getCustomerForOrder = (order: Order): Customer | undefined =>
    customersList.find(c => c.name === order.clientName);

  const handleSetPriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceForm.productName || !priceForm.unitPrice) return;
    onSetPrice({
      productName: priceForm.productName,
      category: priceForm.category,
      unitPrice: parseFloat(priceForm.unitPrice),
      currency: priceForm.currency,
      setBy: currentUser?.fullName || 'Management',
      setAt: new Date().toLocaleString()
    });
    setPriceForm({ productName: '', category: 'INCOMING_GOODS', unitPrice: '', currency: 'GHS' });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'APPROVED': 'bg-emerald-100 text-emerald-800',
      'REJECTED': 'bg-rose-100 text-rose-800',
      'PENDING_MANAGEMENT_APPROVAL': 'bg-amber-100 text-amber-800',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Management Control Approvals</h1>
          <p className="text-sm text-slate-500 text-muted">Set pricing, authorize credits, and manage cargo approvals.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(incomingGoodsList, ['id', 'goodsCode', 'productName', 'country', 'company', 'quantity', 'weight', 'destination', 'discrepancies', 'status', 'unitPrice'], 'incoming_port_cargo_audit')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Cargo (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Incoming Port Cargo Audit', incomingGoodsList, ['id', 'goodsCode', 'productName', 'country', 'company', 'quantity', 'weight', 'destination', 'discrepancies', 'status', 'unitPrice'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileText className="w-3.5 h-3.5" /><span>Cargo (PDF)</span>
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
              <div className={`p-4 bg-slate-100 rounded-2xl ${card.color} bg-accent-light`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-6 app-card">
        <h3 className="text-lg font-bold">Management Decision & Approval Velocity</h3>
        <p className="text-xs text-slate-500 text-muted">Weekly authorized credentials vs rejected logs.</p>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="Approved" stroke="#10b981" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Rejected" stroke="#f43f5e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab Content */}
      <div className="border-t border-slate-100 pt-6 space-y-6">

        {/* PORT CARGO APPROVAL */}
        {activeSubTab === 'CargoApproval' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Workflow A: Port Cargo Approval Queue</h3>
            <p className="text-xs text-slate-500 text-muted">Inspect logged intakes, set unit prices, and approve or reject cargo batches.</p>
            <div className="space-y-4">
              {incomingGoodsList.filter(i => i.status === 'PENDING_MANAGEMENT_APPROVAL').map(item => (
                <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-4">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="w-20 h-20 object-cover rounded-lg border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-slate-400">No Image</span>
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">{item.productName || 'Unnamed Product'}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[9px]">Awaiting Pricing</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Code: <code className="bg-slate-100 px-1 rounded">{item.goodsCode || `CARGO-${item.id}`}</code></p>
                      <p className="text-[10px] text-slate-500">Origin: <strong>{item.country}</strong> via <strong>{item.company}</strong></p>
                      <p className="text-[10px] text-slate-500">Destination: <strong>{item.destination || 'Accra Warehouse'}</strong></p>
                      <div className="flex gap-4 text-[10px] text-slate-500">
                        <span>Qty: <strong>{item.quantity} units</strong></span>
                        <span>Weight: <strong>{item.weight}T</strong></span>
                        <span>Logged: <strong>{item.createdAt || 'N/A'}</strong></span>
                      </div>
                      {item.discrepancies && item.discrepancies !== 'None' && (
                        <p className="text-[10px] text-rose-600 font-semibold">⚠ Faults: {item.discrepancies}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">GHS</span>
                      <input
                        type="number"
                        placeholder="Set Unit Price"
                        id={`price-input-${item.id}`}
                        className="w-full pl-12 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const val = parseFloat((document.getElementById(`price-input-${item.id}`) as HTMLInputElement).value);
                        if (isNaN(val)) return alert('Enter a unit price');
                        onApproveIntake(item.id, true, val);
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700"
                    >Approve & Price</button>
                    <button
                      onClick={() => onApproveIntake(item.id, false)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-200"
                    >Reject</button>
                  </div>
                </div>
              ))}
              {incomingGoodsList.filter(i => i.status === 'PENDING_MANAGEMENT_APPROVAL').length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No cargo awaiting management pricing reviews.</p>
              )}
            </div>
          </div>
        )}

        {/* CREDIT APPROVAL */}
        {activeSubTab === 'CreditApproval' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Workflow B: Credit Order Approvals</h3>
                <p className="text-xs text-slate-500 text-muted">Review orders with CREDIT terms — full customer details and history shown.</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => exportToCSV(ordersList.filter(o => o.status === 'PENDING_MANAGEMENT'), ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'credit_approvals_ledger')} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"><FileSpreadsheet className="w-3.5 h-3.5" /></button>
                <button onClick={() => exportToPDF('Credit Approvals Ledger', ordersList.filter(o => o.status === 'PENDING_MANAGEMENT'), ['id', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"><FileText className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="space-y-4">
              {ordersList.filter(o => o.status === 'PENDING_MANAGEMENT').map(order => {
                const cust = getCustomerForOrder(order);
                const isExpanded = expandedCreditId === order.id;
                return (
                  <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{order.clientName}</p>
                        <p className="text-[10px] text-slate-500">Order: <code>{order.id}</code>{order.ticketNumber && <span className="ml-2 text-emerald-600 font-bold">🎫 {order.ticketNumber}</span>}</p>
                        <p className="text-[10px] text-slate-500">Product: <strong>{order.productName || '—'}</strong> | Destination: <strong>{order.destination || '—'}</strong></p>
                        <p className="text-[10px] text-slate-500">Amount: <strong className="text-slate-800">GHS {order.totalAmount.toLocaleString()}</strong> | Mode: <strong>{order.paymentMode}</strong> | Submitted: {order.createdAt}</p>
                        {order.ghanaCard && <p className="text-[10px] text-slate-500">Ghana Card: <code className="bg-slate-100 px-1 rounded">{order.ghanaCard}</code></p>}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex gap-2">
                          <button onClick={() => onApproveCredit(order.id, true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700">Authorize Credit</button>
                          <button onClick={() => onApproveCredit(order.id, false)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-200">Block</button>
                        </div>
                        <button
                          onClick={() => setExpandedCreditId(isExpanded ? null : order.id)}
                          className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? 'Hide' : 'View'} Customer Details
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 pt-3 space-y-3">
                        {cust ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Customer Profile Card */}
                            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                              <div className="flex items-center gap-3">
                                {cust.photo ? (
                                  <img src={cust.photo} alt={cust.name} className="w-12 h-12 rounded-full object-cover border-2 border-blue-200" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                    <User className="w-6 h-6 text-blue-500" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{cust.name}</p>
                                  <p className="text-[10px] text-slate-500">{cust.companyName}</p>
                                </div>
                              </div>
                              <div className="text-[10px] text-slate-600 space-y-1">
                                <p>📍 {cust.location}</p>
                                <p>📞 {cust.phone}</p>
                                {cust.email && <p>✉ {cust.email}</p>}
                                {cust.ghanaCard && <p>🪪 Ghana Card: <code className="bg-slate-100 px-1 rounded">{cust.ghanaCard}</code></p>}
                                <p>📅 Registered: {cust.registeredAt}</p>
                              </div>
                            </div>

                            {/* Credit History */}
                            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                              <p className="text-xs font-bold text-slate-700">Credit History</p>
                              {cust.creditHistory && cust.creditHistory.length > 0 ? (
                                <div className="space-y-1">
                                  {cust.creditHistory.map((h, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[10px] text-slate-600 border-b border-slate-100 py-1">
                                      <span><code>{h.orderId}</code> — {h.date}</span>
                                      <span className="font-bold">GHS {h.amount.toLocaleString()}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${h.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{h.status}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400">No previous credit history.</p>
                              )}

                              {/* Order history count */}
                              <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                                <p className="text-[10px] text-slate-600 font-semibold">
                                  Total Orders: <strong>{ordersList.filter(o => o.clientName === cust.name).length}</strong>
                                </p>
                                <p className="text-[10px] text-slate-600">
                                  Delivered: <strong>{ordersList.filter(o => o.clientName === cust.name && o.status === 'DELIVERED').length}</strong>
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                            Customer profile not found in directory. Order submitted under name: <strong>{order.clientName}</strong>.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {ordersList.filter(o => o.status === 'PENDING_MANAGEMENT').length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No credit limit audits pending.</p>
              )}
            </div>
          </div>
        )}

        {/* GLOBAL AUDIT LEDGER */}
        {activeSubTab === 'Ledger' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold">Global Audit Ledger</h3>
            </div>
            <p className="text-xs text-slate-500 text-muted">All cross-department actions are logged here in real-time.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Performed By</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...auditLog].reverse().map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap text-[10px]">{entry.timestamp}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[9px] font-bold">{entry.department}</span>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{entry.performedBy}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{entry.action}</td>
                      <td className="py-2.5 px-3 text-slate-500">{entry.details}</td>
                    </tr>
                  ))}
                  {auditLog.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">No audit entries recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SET PRICES */}
        {activeSubTab === 'SetPrices' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Set Price Form */}
            <div className="p-6 app-card space-y-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold">Set Goods Prices</h3>
              </div>
              <p className="text-xs text-slate-500 text-muted">Define unit prices for new, incoming, or old goods categories.</p>
              <form onSubmit={handleSetPriceSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product / Goods Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={priceForm.productName}
                    onChange={e => setPriceForm(p => ({ ...p, productName: e.target.value }))}
                    required
                    placeholder="E.g., Palm Oil Barrel"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Goods Category</label>
                  <select
                    value={priceForm.category}
                    onChange={e => setPriceForm(p => ({ ...p, category: e.target.value as GoodsPrice['category'] }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="NEW_GOODS">New Goods</option>
                    <option value="INCOMING_GOODS">Incoming Goods (Port)</option>
                    <option value="OLD_GOODS">Old / Existing Stock</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Unit Price <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceForm.unitPrice}
                      onChange={e => setPriceForm(p => ({ ...p, unitPrice: e.target.value }))}
                      required
                      placeholder="E.g., 125.50"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Currency</label>
                    <select
                      value={priceForm.currency}
                      onChange={e => setPriceForm(p => ({ ...p, currency: e.target.value as 'GHS' | 'USD' }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="GHS">GHS (Ghana Cedis)</option>
                      <option value="USD">USD (US Dollar)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                  Set Price Catalog Entry
                </button>
              </form>
            </div>

            {/* Price Catalog */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">Current Price Catalog</h3>
              <div className="space-y-2">
                {goodsPrices.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No prices set yet.</p>
                )}
                {goodsPrices.map((gp, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{gp.productName}</p>
                      <p className="text-[10px] text-slate-500">{gp.category.replace(/_/g, ' ')} · Set by {gp.setBy}</p>
                      <p className="text-[10px] text-slate-400">{gp.setAt}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 text-sm">{gp.currency} {gp.unitPrice.toLocaleString()}</p>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        gp.category === 'NEW_GOODS' ? 'bg-blue-100 text-blue-800' :
                        gp.category === 'INCOMING_GOODS' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>{gp.category.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => exportToCSV(goodsPrices, ['productName', 'category', 'unitPrice', 'currency', 'setBy', 'setAt'], 'goods_price_catalog')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 w-full justify-center">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export Price Catalog (CSV)
              </button>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeSubTab === 'MgmtHistory' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold">Management Decision History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Order / Cargo ID</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Client / Product</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Decision</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Decided cargo */}
                  {incomingGoodsList.filter(i => i.status !== 'PENDING_MANAGEMENT_APPROVAL').map(item => (
                    <tr key={`cargo-${item.id}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono">{item.goodsCode || `CARGO-${item.id}`}</td>
                      <td className="py-2.5 px-3"><span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">CARGO</span></td>
                      <td className="py-2.5 px-3">{item.productName || item.company} / {item.country}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{item.unitPrice ? `GHS ${item.unitPrice}/u` : '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{item.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{item.createdAt || '—'}</td>
                    </tr>
                  ))}
                  {/* Decided credit orders */}
                  {ordersList.filter(o => !['PENDING_FINANCE', 'PENDING_MANAGEMENT'].includes(o.status)).map(order => (
                    <tr key={`order-${order.id}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono">{order.id}</td>
                      <td className="py-2.5 px-3"><span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-[9px] font-bold">ORDER</span></td>
                      <td className="py-2.5 px-3">{order.clientName}</td>
                      <td className="py-2.5 px-3 text-right font-bold">GHS {order.totalAmount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${['APPROVED', 'DELIVERED', 'PROCESSING'].includes(order.status) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{order.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{order.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
