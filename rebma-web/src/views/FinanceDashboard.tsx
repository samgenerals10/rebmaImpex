// rebma-web/src/views/FinanceDashboard.tsx

import React, { useState } from 'react';
import { 
  FileSpreadsheet, FileText, DollarSign, Clipboard, ShieldCheck, Activity, X, ExternalLink
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import type { Order, FinancePayment, ProductionRequest } from '../types/erp';
import { exportToCSV, exportToPDF } from '../utils/export';

interface FinanceDashboardProps {
  ordersList: Order[];
  setOrdersList: React.Dispatch<React.SetStateAction<Order[]>>;
  onEvaluateOrder: (id: string, approve: boolean) => void;
  onFinalizeOrder: (id: string) => void;
  activeSubTab: string;
  paymentsList: FinancePayment[];
  setPaymentsList: React.Dispatch<React.SetStateAction<FinancePayment[]>>;
  productionRequests: ProductionRequest[];
  addNotification: (msg: string) => void;
}

export default function FinanceDashboard({
  ordersList,
  setOrdersList,
  onEvaluateOrder,
  onFinalizeOrder,
  activeSubTab = 'Evaluation',
  paymentsList,
  setPaymentsList,
  productionRequests,
  addNotification
}: FinanceDashboardProps) {

  const [payType, setPayType] = useState<'DIRECT' | 'CREDIT_SETTLEMENT'>('DIRECT');
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [payMode, setPayMode] = useState<'CASH' | 'CHEQUE' | 'MOBILE_MONEY' | 'BANK_TRANSFER'>('CASH');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<FinancePayment | null>(null);

  const lineChartData = [
    { name: 'Mon', Revenue: 12000, Payments: 8000 },
    { name: 'Tue', Revenue: 19000, Payments: 12000 },
    { name: 'Wed', Revenue: 15000, Payments: 10000 },
    { name: 'Thu', Revenue: 27000, Payments: 21000 },
    { name: 'Fri', Revenue: 34000, Payments: 15000 },
  ];

  const totalRevenueVal = ordersList.reduce((acc, o) =>
    acc + (['DELIVERED', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status) ? o.totalAmount : 0), 0
  );
  const pendingFinanceCount = ordersList.filter(o => o.status === 'PENDING_FINANCE').length;
  const recordedPaymentsCount = paymentsList.length;
  const liquidCashVal = paymentsList.reduce((acc, p) => acc + p.amount, 0);

  const stats = [
    { title: 'Total Revenue', value: `GHS ${totalRevenueVal.toLocaleString()}`, sub: 'Completed & Approved Sales', icon: DollarSign, color: 'text-emerald-500' },
    { title: 'Pending Finance', value: `${pendingFinanceCount} Orders`, sub: 'Awaiting terms check', icon: Clipboard, color: 'text-amber-500' },
    { title: 'Recorded Payments', value: `${recordedPaymentsCount} Tickets`, sub: 'Receipt database logs', icon: ShieldCheck, color: 'text-blue-500' },
    { title: 'Liquid Cash Inflow', value: `GHS ${liquidCashVal.toLocaleString()}`, sub: 'Total direct collections', icon: Activity, color: 'text-indigo-500' },
  ];

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payType === 'DIRECT') {
      if (!clientName || !amount || parseFloat(amount) <= 0) {
        alert('Please fill out a valid client name and positive amount');
        return;
      }
      const newPayment: FinancePayment = {
        id: `PAY-${Date.now().toString().slice(-4)}`,
        clientName,
        amount: parseFloat(amount),
        paymentMode: payMode,
        paymentType: 'DIRECT',
        createdAt: new Date().toLocaleString()
      };
      setPaymentsList(prev => [newPayment, ...prev]);
      addNotification(`Recorded direct payment of GHS ${parseFloat(amount).toLocaleString()} from ${clientName}.`);
      setClientName('');
      setAmount('');
    } else {
      if (!selectedOrderId) {
        alert('Please select a credit order to settle');
        return;
      }
      const order = ordersList.find(o => o.id === selectedOrderId);
      if (!order) return;
      const newPayment: FinancePayment = {
        id: `PAY-${Date.now().toString().slice(-4)}`,
        clientName: order.clientName,
        amount: order.totalAmount,
        paymentMode: payMode,
        paymentType: 'CREDIT_SETTLEMENT',
        orderId: selectedOrderId,
        createdAt: new Date().toLocaleString()
      };
      setPaymentsList(prev => [newPayment, ...prev]);
      setOrdersList(prev => prev.map(o => o.id === selectedOrderId ? { ...o, status: 'APPROVED' } : o));
      addNotification(`Credit settlement recorded for ${order.clientName} (Order ${selectedOrderId}) — Status set to APPROVED.`);
      setSelectedOrderId('');
    }
  };

  const printTicket = (pay: FinancePayment) => {
    exportToPDF(`Receipt Ticket ${pay.id}`, [pay], ['id', 'clientName', 'amount', 'paymentMode', 'paymentType', 'orderId', 'createdAt']);
  };

  const totalGoodsProduced = productionRequests.filter(r => r.status === 'TICKETS_ISSUED' || r.status === 'COMPLETED').length;
  const totalWarehouseItems = productionRequests.reduce((acc, r) => acc + (r.producedGoods || r.items.reduce((s, i) => s + i.quantity, 0)), 0);

  return (
    <div className="space-y-6">
      {/* Ticket Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Receipt header */}
            <div className="bg-gradient-to-r from-[#064e29] to-[#0298d0] p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-bold text-lg">REBMA IMPEX GHANA LTD</h2>
                  <p className="text-white/70 text-xs mt-1">Official Payment Receipt</p>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">GHS {selectedTicket.amount.toLocaleString()}</p>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold mt-1 inline-block">PAID</span>
              </div>
              
              <div className="border border-dashed border-slate-200 rounded-xl divide-y divide-dashed divide-slate-200">
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-500">Receipt #</span>
                  <span className="font-mono font-bold">{selectedTicket.id}</span>
                </div>
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-500">Client</span>
                  <span className="font-bold">{selectedTicket.clientName}</span>
                </div>
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-500">Payment Type</span>
                  <span className="font-bold">{selectedTicket.paymentType === 'DIRECT' ? 'Direct Receipt' : 'Credit Settlement'}</span>
                </div>
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-500">Payment Mode</span>
                  <span className="font-bold">{selectedTicket.paymentMode.replace('_', ' ')}</span>
                </div>
                {selectedTicket.orderId && (
                  <div className="flex justify-between items-center p-3 text-xs">
                    <span className="text-slate-500">Settled Order</span>
                    <span className="font-mono font-bold text-blue-600">{selectedTicket.orderId}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-500">Date & Time</span>
                  <span className="text-slate-600">{selectedTicket.createdAt}</span>
                </div>
              </div>

              <button onClick={() => printTicket(selectedTicket)} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> Print / Export PDF Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Ledgers</h1>
          <p className="text-sm text-slate-500 text-muted">Clear cash invoice payments, verify credit requests, and issue receipt tickets.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(ordersList, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'finance_orders_ledger')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Export Ledgers (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Finance Ledger Statement', ordersList, ['id', 'ticketNumber', 'clientName', 'productName', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileText className="w-3.5 h-3.5" /><span>Export Ledgers (PDF)</span>
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
        <h3 className="text-lg font-bold">Finance Revenue & Cash Collection Performance</h3>
        <p className="text-xs text-slate-500 text-muted">Weekly revenue flow vs daily liquid payments collection.</p>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Payments" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Production & Warehouse Summary — always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 app-card space-y-3">
          <h3 className="text-sm font-bold text-slate-700">Overall Goods Produced by Production</h3>
          <p className="text-3xl font-bold text-blue-600">{totalGoodsProduced} <span className="text-base text-slate-400 font-normal">Batches</span></p>
          <p className="text-[10px] text-slate-400">Requisitions with TICKETS_ISSUED or COMPLETED status from Production floor.</p>
        </div>
        <div className="p-6 app-card space-y-3">
          <h3 className="text-sm font-bold text-slate-700">Overall Goods in Warehouse</h3>
          <p className="text-3xl font-bold text-emerald-600">{totalWarehouseItems.toLocaleString()} <span className="text-base text-slate-400 font-normal">Units</span></p>
          <p className="text-[10px] text-slate-400">Total approved and released production units currently in warehouse stock.</p>
        </div>
      </div>

      {/* Tab Views */}
      <div className="border-t border-slate-100 pt-6">

        {/* PAYMENT TERMS */}
        {activeSubTab === 'Evaluation' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Workflow B: Order Payment Terms Evaluation Queue</h3>
            <div className="space-y-3">
              {ordersList.filter(o => o.status === 'PENDING_FINANCE').map(order => (
                <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-800">{order.clientName}</p>
                        <span className="text-[10px] font-mono text-slate-400">({order.id})</span>
                        {order.ticketNumber && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Payment Mode: <strong>{order.paymentMode}</strong> | Amount: <strong>GHS {order.totalAmount.toLocaleString()}</strong></p>
                      {order.productName && <p className="text-[10px] text-slate-400">Product: {order.productName}</p>}
                      {order.destination && <p className="text-[10px] text-slate-400">Destination: {order.destination}</p>}
                      {order.ghanaCard && <p className="text-[10px] text-slate-400">Ghana Card: <code>{order.ghanaCard}</code></p>}
                      <p className="text-[10px] text-slate-400">Submitted: {order.createdAt}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => onEvaluateOrder(order.id, true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700">Clear Terms</button>
                      <button onClick={() => onEvaluateOrder(order.id, false)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-200">Deny</button>
                    </div>
                  </div>
                </div>
              ))}
              {ordersList.filter(o => o.status === 'PENDING_FINANCE').length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No order payment checks pending clearance.</p>
              )}
            </div>
          </div>
        )}

        {/* INVOICE PORTAL */}
        {activeSubTab === 'Invoices' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Invoice Inception Portal</h3>
            <div className="space-y-3">
              {ordersList.filter(o => o.status === 'APPROVED').map(order => (
                <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-800">{order.clientName}</p>
                        {order.ticketNumber && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">Order ID: <code>{order.id}</code></p>
                      {order.productName && <p className="text-[10px] text-slate-500">Product: <strong>{order.productName}</strong></p>}
                      {order.destination && <p className="text-[10px] text-slate-500">Ship to: <strong>{order.destination}</strong></p>}
                      <p className="text-[10px] text-slate-500">Mode: <strong>{order.paymentMode}</strong></p>
                      <p className="text-sm font-bold text-emerald-600 mt-1">Invoice Amount: GHS {order.totalAmount.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => onFinalizeOrder(order.id)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shrink-0"
                    >
                      Generate PDF Invoice
                    </button>
                  </div>
                </div>
              ))}
              {ordersList.filter(o => o.status === 'APPROVED').length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No approved order invoices pending.</p>
              )}
            </div>
          </div>
        )}

        {/* RECORD INBOUND PAYMENT */}
        {activeSubTab === 'RecordPayment' && (
          <div className="p-6 app-card space-y-4 max-w-xl">
            <h3 className="text-lg font-bold">Record Inbound Payments & Settle Credit</h3>
            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              {/* Payment Type Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Type</label>
                <div className="flex gap-0 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPayType('DIRECT')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${payType === 'DIRECT' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >Direct Payment</button>
                  <button
                    type="button"
                    onClick={() => setPayType('CREDIT_SETTLEMENT')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${payType === 'CREDIT_SETTLEMENT' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >Credit Settlement</button>
                </div>
              </div>

              {payType === 'DIRECT' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client Customer Name</label>
                    <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="E.g., Kumasi Foods Distributor" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Amount (GHS)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="E.g., 2500" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Select Unsettled Credit Order</label>
                  <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500">
                    <option value="">-- Choose Credit Order --</option>
                    {ordersList.filter(o => o.paymentMode === 'CREDIT' && o.status === 'PENDING_FINANCE').map(o => (
                      <option key={o.id} value={o.id}>{o.id} - {o.clientName} (GHS {o.totalAmount.toLocaleString()}) [{o.status}]</option>
                    ))}
                  </select>
                  {ordersList.filter(o => o.paymentMode === 'CREDIT' && o.status === 'PENDING_FINANCE').length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">No pending credit orders found. Check Finance queue first.</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value as any)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500">
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="MOBILE_MONEY">Mobile Money (MTN/Telecel)</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                Record Payment & Generate Ticket
              </button>
            </form>
          </div>
        )}

        {/* RECEIPTS & TICKETS — clickable table */}
        {activeSubTab === 'Tickets' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Historical Receipts & Tickets Database</h3>
              <div className="flex gap-2">
                <button onClick={() => exportToCSV(paymentsList, ['id', 'clientName', 'amount', 'paymentMode', 'paymentType', 'orderId', 'createdAt'], 'receipts_database')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
                  <FileSpreadsheet className="w-3.5 h-3.5" /><span>Export CSV</span>
                </button>
                <button onClick={() => exportToPDF('Historical Receipts & Tickets', paymentsList, ['id', 'clientName', 'amount', 'paymentMode', 'paymentType', 'orderId', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
                  <FileText className="w-3.5 h-3.5" /><span>Export PDF</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400">Click any row to view the full receipt/ticket.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Settled Order</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentsList.map(pay => (
                    <tr
                      key={pay.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedTicket(pay)}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">{pay.id}</td>
                      <td className="py-3 px-3 font-medium">{pay.clientName}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pay.paymentType === 'DIRECT' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                          {pay.paymentType === 'DIRECT' ? 'Direct' : 'Credit Settle'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{pay.paymentMode.replace('_', ' ')}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{pay.orderId || '—'}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">GHS {pay.amount.toLocaleString()}</td>
                      <td className="py-3 px-3 text-slate-400 text-[10px]">{pay.createdAt}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedTicket(pay); }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-semibold cursor-pointer"
                        >View Ticket</button>
                      </td>
                    </tr>
                  ))}
                  {paymentsList.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-slate-400">No payment tickets recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GOOGLE FORMS EMBED */}
        {activeSubTab === 'IntakeForm' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-bold">Finance Intake Form</h3>
            </div>
            <p className="text-xs text-slate-500 text-muted">Use the form below to submit payment intake requests directly from Google Forms.</p>
            <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '600px' }}>
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSdQmock-rebma-finance-form/viewform?embedded=true"
                width="100%"
                height="100%"
                frameBorder="0"
                marginHeight={0}
                marginWidth={0}
                title="Finance Intake Form"
              >
                Loading Google Form…
              </iframe>
            </div>
            <p className="text-[10px] text-slate-400 text-center">Replace the URL above with your actual Google Forms link in production.</p>
          </div>
        )}

        {/* WAREHOUSE HISTORY */}
        {activeSubTab === 'WarehouseHistory' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Warehouse History — Production Output</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Requisition ID</th>
                    <th className="py-2.5 px-3">Materials</th>
                    <th className="py-2.5 px-3 text-right">Total Units</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{req.id}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {req.items.map((it, idx) => (
                          <span key={idx} className="mr-2">{it.materialName} ({it.quantity})</span>
                        ))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          req.status === 'TICKETS_ISSUED' || req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>{req.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{req.createdAt || 'N/A'}</td>
                    </tr>
                  ))}
                  {productionRequests.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">No production records in warehouse.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
