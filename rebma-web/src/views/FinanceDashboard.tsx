// rebma-web/src/views/FinanceDashboard.tsx

import { useState, useEffect } from 'react';
import {
  FileSpreadsheet, FileText, DollarSign, Clipboard, ShieldCheck, Activity, X, ExternalLink, ChevronRight, MoreVertical, TrendingUp, TrendingDown
} from 'lucide-react';
import MiniSparkline from '../components/MiniSparkline';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
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

  // Local state copies to support inline dynamic table additions, updates and deletes
  const [localPayments, setLocalPayments] = useState<FinancePayment[]>(paymentsList);
  const [localRequisitions, setLocalRequisitions] = useState<ProductionRequest[]>(productionRequests);

  const [payType, setPayType] = useState<'DIRECT' | 'CREDIT_SETTLEMENT'>('DIRECT');
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [payMode, setPayMode] = useState<'CASH' | 'CHEQUE' | 'MOBILE_MONEY' | 'BANK_TRANSFER'>('CASH');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<FinancePayment | null>(null);
  const [activeMobileDetail, setActiveMobileDetail] = useState<{ type: 'payment' | 'requisition'; data: any } | null>(null);

  // Table interactive states: Receipts & Tickets Database
  const [paymentsSearch, setPaymentsSearch] = useState('');
  const [paymentsTypeFilter, setPaymentsTypeFilter] = useState('ALL');
  const [isPaymentsFilterOpen, setIsPaymentsFilterOpen] = useState(false);
  const [selectedPaymentsRows, setSelectedPaymentsRows] = useState<Set<string>>(new Set());
  const [activePaymentsMenu, setActivePaymentsMenu] = useState<string | null>(null);

  // Table interactive states: Warehouse History
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseStatusFilter, setWarehouseStatusFilter] = useState('ALL');
  const [isWarehouseFilterOpen, setIsWarehouseFilterOpen] = useState(false);
  const [selectedWarehouseRows, setSelectedWarehouseRows] = useState<Set<string>>(new Set());
  const [activeWarehouseMenu, setActiveWarehouseMenu] = useState<string | null>(null);

  // Sorting states for Payments
  const [paymentsSortField, setPaymentsSortField] = useState<string>('');
  const [paymentsSortDir, setPaymentsSortDir] = useState<'asc' | 'desc'>('asc');

  // Sorting states for Warehouse (Requisitions)
  const [warehouseSortField, setWarehouseSortField] = useState<string>('');
  const [warehouseSortDir, setWarehouseSortDir] = useState<'asc' | 'desc'>('asc');

  // Sync props to local states
  useEffect(() => {
    setLocalPayments(paymentsList);
  }, [paymentsList]);

  useEffect(() => {
    setLocalRequisitions(productionRequests);
  }, [productionRequests]);

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActivePaymentsMenu(null);
      setActiveWarehouseMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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
  const recordedPaymentsCount = localPayments.length;
  const liquidCashVal = localPayments.reduce((acc, p) => acc + p.amount, 0);

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
      const updated = [newPayment, ...localPayments];
      setLocalPayments(updated);
      setPaymentsList(updated);
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
      const updated = [newPayment, ...localPayments];
      setLocalPayments(updated);
      setPaymentsList(updated);
      setOrdersList(prev => prev.map(o => o.id === selectedOrderId ? { ...o, status: 'APPROVED' } : o));
      addNotification(`Credit settlement recorded for ${order.clientName} (Order ${selectedOrderId}) — Status set to APPROVED.`);
      setSelectedOrderId('');
    }
  };

  const printTicket = (pay: FinancePayment) => {
    exportToPDF(`Receipt Ticket ${pay.id}`, [pay], ['id', 'clientName', 'amount', 'paymentMode', 'paymentType', 'orderId', 'createdAt']);
  };

  const totalGoodsProduced = localRequisitions.filter(r => r.status === 'TICKETS_ISSUED' || r.status === 'COMPLETED').length;
  const totalWarehouseItems = localRequisitions.reduce((acc, r) => acc + (r.producedGoods || r.items.reduce((s, i) => s + i.quantity, 0)), 0);

  // Receipts / Tickets Actions
  const handleEditPayment = async (pay: FinancePayment) => {
    const newName = await prompt('Edit client name:', pay.clientName);
    if (!newName) return;
    const newAmt = await prompt('Edit payment amount (GHS):', pay.amount.toString());
    if (!newAmt || isNaN(parseFloat(newAmt))) return;

    const updated = localPayments.map(p => p.id === pay.id ? { ...p, clientName: newName, amount: parseFloat(newAmt) } : p);
    setLocalPayments(updated);
    setPaymentsList(updated);
    addNotification(`Updated receipt record ${pay.id}`);
  };

  const handleDuplicatePayment = (pay: FinancePayment) => {
    const duplicated: FinancePayment = {
      ...pay,
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toLocaleString()
    };
    const updated = [duplicated, ...localPayments];
    setLocalPayments(updated);
    setPaymentsList(updated);
    addNotification(`Duplicated receipt ticket ${pay.id} as ${duplicated.id}`);
  };

  const handleSharePayment = (pay: FinancePayment) => {
    const shareText = `Rebma Receipt: ID: ${pay.id} - Client: ${pay.clientName} - Amt: GHS ${pay.amount} - Mode: ${pay.paymentMode}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied receipt sharing link to clipboard!`);
    }).catch(() => alert(shareText));
  };

  const handleDeletePayment = async (id: string) => {
    if (!await confirm(`Delete payment ticket entry ${id}?`)) return;
    const updated = localPayments.filter(p => p.id !== id);
    setLocalPayments(updated);
    setPaymentsList(updated);
    addNotification(`Deleted payment record ${id}`);
  };

  // Warehouse Production Actions
  const handleDuplicateRequisition = (req: ProductionRequest) => {
    const duplicated: ProductionRequest = {
      ...req,
      id: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toLocaleString()
    };
    setLocalRequisitions(prev => [duplicated, ...prev]);
    addNotification(`Duplicated warehouse production entry ${req.id}`);
  };

  const handleShareRequisition = (req: ProductionRequest) => {
    const shareText = `Rebma Warehouse Stock Inflow: Req ID: ${req.id} - Status: ${req.status} - Qty: ${req.items.reduce((s, i) => s + i.quantity, 0)}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification('Copied sharing info to clipboard!');
    }).catch(() => alert(shareText));
  };

  const handleDeleteRequisition = async (id: string) => {
    if (!await confirm(`Delete warehouse production record ${id}?`)) return;
    setLocalRequisitions(prev => prev.filter(r => r.id !== id));
    addNotification(`Deleted warehouse history entry ${id}`);
  };

  // Row Selection Checkboxes
  const handleSelectAllPayments = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedPaymentsRows(new Set(filteredPayments.map(p => p.id)));
    } else {
      setSelectedPaymentsRows(new Set());
    }
  };

  const handleSelectPaymentsRow = (id: string) => {
    const updated = new Set(selectedPaymentsRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedPaymentsRows(updated);
  };

  const handleSelectAllWarehouse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedWarehouseRows(new Set(filteredWarehouse.map(r => r.id)));
    } else {
      setSelectedWarehouseRows(new Set());
    }
  };

  const handleSelectWarehouseRow = (id: string) => {
    const updated = new Set(selectedWarehouseRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedWarehouseRows(updated);
  };

  // Filters
  const filteredPayments = localPayments.filter(p => {
    const matchesSearch = p.clientName.toLowerCase().includes(paymentsSearch.toLowerCase()) ||
                          p.id.toLowerCase().includes(paymentsSearch.toLowerCase()) ||
                          (p.orderId && p.orderId.toLowerCase().includes(paymentsSearch.toLowerCase()));
    const matchesType = paymentsTypeFilter === 'ALL' || p.paymentType === paymentsTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredWarehouse = localRequisitions.filter(r => {
    const matchesSearch = r.id.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
                          r.items.some(i => i.materialName.toLowerCase().includes(warehouseSearch.toLowerCase()));
    const matchesStatus = warehouseStatusFilter === 'ALL' || r.status === warehouseStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (!paymentsSortField) return 0;
    const aVal = a[paymentsSortField as keyof FinancePayment];
    const bVal = b[paymentsSortField as keyof FinancePayment];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return paymentsSortDir === 'asc' ? comp : -comp;
  });

  const sortedWarehouse = !warehouseSortField ? [...filteredWarehouse].reverse() : [...filteredWarehouse].sort((a, b) => {
    if (!warehouseSortField) return 0;
    let aVal: any;
    let bVal: any;
    if (warehouseSortField === 'id') {
      aVal = a.id;
      bVal = b.id;
    } else if (warehouseSortField === 'createdAt') {
      aVal = a.createdAt || '';
      bVal = b.createdAt || '';
    } else if (warehouseSortField === 'status') {
      aVal = a.status;
      bVal = b.status;
    } else if (warehouseSortField === 'materialName') {
      aVal = a.items[0]?.materialName || '';
      bVal = b.items[0]?.materialName || '';
    } else if (warehouseSortField === 'quantity') {
      aVal = a.items.reduce((s, i) => s + i.quantity, 0);
      bVal = b.items.reduce((s, i) => s + i.quantity, 0);
    }
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return warehouseSortDir === 'asc' ? comp : -comp;
  });

  if (activeMobileDetail) {
    return (
      <div className="lg:hidden bg-bg-card min-h-screen p-4 pb-24 space-y-6 animate-fade-in-up text-text-primary">
        {/* Header with Back button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveMobileDetail(null)}
            className="px-3 py-1.5 bg-bg-card dark:bg-slate-850 border border-[var(--border)] dark:border-slate-800 rounded-full text-xs font-bold text-text-secondary dark:text-slate-350 cursor-pointer shadow-card"
          >
            ← Back
          </button>
          <h2 className="text-sm font-bold">Record Details</h2>
        </div>

        {activeMobileDetail.type === 'payment' ? (() => {
          const pay = activeMobileDetail.data as FinancePayment;
          return (
            <div className="space-y-6">
              {/* Info Header */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl shrink-0">
                  GHS
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary dark:text-slate-200">{pay.clientName}</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{pay.id}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Receipt #</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200 font-mono">{pay.id}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Type</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pay.paymentType === 'DIRECT' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {pay.paymentType === 'DIRECT' ? 'Direct' : 'Credit Settle'}
                  </span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Payment Mode</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{pay.paymentMode.replace('_', ' ')}</span>
                </div>
                {pay.orderId && (
                  <div className="py-3 flex justify-between items-center text-xs">
                    <span className="text-text-muted font-medium">Settled Order</span>
                    <span className="font-mono font-semibold text-blue-400">{pay.orderId}</span>
                  </div>
                )}
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Amount</span>
                  <span className="font-bold text-emerald-500 font-mono">GHS {pay.amount.toLocaleString()}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Date</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200">{pay.createdAt}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button 
                  onClick={() => { setSelectedTicket(pay); }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-750 rounded-xl text-xs font-bold text-white text-center cursor-pointer shadow"
                >
                  View / Export Ticket PDF
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { handleEditPayment(pay); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Edit Receipt
                  </button>
                  <button 
                    onClick={() => { handleDuplicatePayment(pay); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Duplicate
                  </button>
                </div>
                <button 
                  onClick={() => { handleDeletePayment(pay.id); setActiveMobileDetail(null); }}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
                >
                  Delete Ticket
                </button>
              </div>
            </div>
          );
        })() : (() => {
          const req = activeMobileDetail.data as ProductionRequest;
          return (
            <div className="space-y-6">
              {/* Info Header */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
                  REQ
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary dark:text-slate-200">Requisition Log</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{req.id}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Requisition ID</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200 font-mono">{req.id}</span>
                </div>
                <div className="py-3 flex justify-between items-start text-xs">
                  <span className="text-text-muted font-medium pt-0.5">Materials</span>
                  <div className="flex flex-col items-end gap-1 font-semibold text-text-primary dark:text-slate-200">
                    {req.items.map((it, idx) => (
                      <span key={idx}>{it.materialName} ({it.quantity})</span>
                    ))}
                  </div>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Total Units</span>
                  <span className="font-bold text-text-primary dark:text-slate-200 font-mono">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    req.status === 'TICKETS_ISSUED' || req.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-450' :
                    req.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-450' :
                    'bg-amber-500/10 text-amber-450'
                  }`}>{req.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Date</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200 font-mono">{req.createdAt || 'N/A'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { handleDuplicateRequisition(req); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Duplicate Log
                  </button>
                  <button 
                    onClick={() => { handleShareRequisition(req); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Share Link
                  </button>
                </div>
                <button 
                  onClick={() => { handleDeleteRequisition(req.id); setActiveMobileDetail(null); }}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
                >
                  Delete Requisition
                </button>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Finance</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Revenue tracking & payments</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(localPayments, ['id', 'clientName', 'amount', 'paymentMethod', 'createdAt'], 'payments')} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card"><FileSpreadsheet className="w-4 h-4 text-text-secondary" /></button>
            <button onClick={() => exportToPDF('Finance Report', localPayments, ['id', 'clientName', 'amount'])} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card"><FileText className="w-4 h-4 text-text-secondary" /></button>
          </div>
        </div>

        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #064e29 0%, #0f172a 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Total Revenue</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">GHS {totalRevenueVal.toLocaleString()}</h2>
              <p className="text-[10px] text-white/70 mt-1">{pendingFinanceCount} Orders Pending Review</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">{recordedPaymentsCount} Payment Receipts</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">GHS {liquidCashVal.toLocaleString()} Liquid Cash</p>
            </div>
            <div className="mobile-card-circles"><div className="mobile-card-circle-1" /><div className="mobile-card-circle-2" /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Payments', value: `${recordedPaymentsCount}`, sub: 'Receipts logged', bg: '#eff6ff', color: '#3b82f6', icon: ShieldCheck },
            { label: 'Cash Inflow', value: `GHS ${(liquidCashVal/1000).toFixed(0)}k`, sub: 'Direct collections', bg: '#f0fdf4', color: '#16a34a', icon: Activity },
          ].map((s, i) => { const Icon = s.icon; return (
            <div key={i} className="mobile-stat-card">
              <div className="mobile-stat-icon" style={{ background: s.bg }}><Icon className="w-5 h-5" style={{ color: s.color }} /></div>
              <div className="min-w-0">
                <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider">{s.label}</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{s.value}</p>
                <p className="text-[9px] text-text-muted">{s.sub}</p>
              </div>
            </div>
          ); })}
        </div>

        <div>
          <p className="mobile-section-label">Recent Payments</p>
          <div className="space-y-2">
            {localPayments.slice(0, 5).map(pay => (
              <div key={pay.id} onClick={() => setActiveMobileDetail({ type: 'payment', data: pay })} className="mobile-data-row cursor-pointer">
                <div className="mobile-data-row-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <DollarSign className="w-5 h-5" style={{ color: '#16a34a' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{pay.clientName}</p>
                  <p className="text-[10px] text-text-muted truncate">GHS {pay.amount.toLocaleString()} • {pay.paymentMode}</p>
                </div>
                <span className="mobile-status-pill bg-emerald-50 text-emerald-700">Paid</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ DESKTOP LAYOUT (lg+) — UNCHANGED ══ */}
      <div className="hidden lg:block">
        <div className="space-y-6">
          {/* Ticket Modal */}
          {selectedTicket && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setSelectedTicket(null)}>
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-md overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Receipt header */}
                <div className="bg-gradient-to-r from-[var(--accent)] to-[#0298d0] p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-bold text-lg">REBMA IMPEX GHANA LTD</h2>
                      <p className="text-white/70 text-xs mt-1">Official Payment Receipt</p>
                    </div>
                    <button onClick={() => setSelectedTicket(null)} className="p-1.5 hover:bg-bg-card/10 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="p-6 space-y-4 text-[var(--text-primary)]">
                  <div className="text-center">
                    <p className="text-2xl font-bold font-mono">GHS {selectedTicket.amount.toLocaleString()}</p>
                    <span className="px-3 py-1 bg-emerald-500/15 text-emerald-450 rounded-full text-xs font-bold mt-1 inline-block">PAID</span>
                  </div>
                  
                  <div className="border border-dashed border-[var(--border)] rounded-xl divide-y divide-dashed divide-[var(--border)] bg-[var(--bg)]">
                    <div className="flex justify-between items-center p-3 text-xs">
                      <span className="text-[var(--text-secondary)]">Receipt #</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">{selectedTicket.id}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 text-xs">
                      <span className="text-[var(--text-secondary)]">Client</span>
                      <span className="font-bold text-[var(--text-primary)]">{selectedTicket.clientName}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 text-xs">
                      <span className="text-[var(--text-secondary)]">Payment Type</span>
                      <span className="font-bold text-[var(--text-primary)]">{selectedTicket.paymentType === 'DIRECT' ? 'Direct Receipt' : 'Credit Settlement'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 text-xs">
                      <span className="text-[var(--text-secondary)]">Payment Mode</span>
                      <span className="font-bold text-[var(--text-primary)]">{selectedTicket.paymentMode.replace('_', ' ')}</span>
                    </div>
                    {selectedTicket.orderId && (
                      <div className="flex justify-between items-center p-3 text-xs">
                        <span className="text-[var(--text-secondary)]">Settled Order</span>
                        <span className="font-mono font-bold text-[var(--accent)]">{selectedTicket.orderId}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-3 text-xs">
                      <span className="text-[var(--text-secondary)]">Date & Time</span>
                      <span className="text-[var(--text-secondary)] font-mono">{selectedTicket.createdAt}</span>
                    </div>
                  </div>

                  <button onClick={() => printTicket(selectedTicket)} className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2 transition-opacity">
                    <FileText className="w-4 h-4" /> Print / Export PDF Ticket
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[var(--text-primary)]">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Finance Ledgers</h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] opacity-80">Clear cash invoice payments, verify credit requests, and issue receipt tickets.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button onClick={() => exportToCSV(ordersList, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'finance_orders_ledger')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Ledgers (CSV)</span>
              </button>
              <button onClick={() => exportToPDF('Finance Ledger Statement', ordersList, ['id', 'ticketNumber', 'clientName', 'productName', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors">
                <FileText className="w-3.5 h-3.5" /><span>Ledgers (PDF)</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {stats.map((card, idx) => {
              const sparkData = [[30,45,35,60,40,70,55],[20,35,25,50,30,55,45],[40,55,38,62,44,68,52],[15,25,20,35,25,40,30]][idx] || [40,50,45,60,55,65,50];
              const isUp = idx % 3 !== 0;
              return (
                <div key={idx} className="kpi-card group">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold leading-tight">{card.title}</span>
                    <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                  </div>
                  <div className="flex items-end justify-between mt-2 gap-2">
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-none">{card.value}</h3>
                      <p className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1.5 ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {card.sub}
                      </p>
                    </div>
                    <MiniSparkline data={sparkData} color={isUp ? 'var(--accent)' : '#f43f5e'} width={60} height={36} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
            <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Finance Revenue & Cash Collection Performance</h3>
            <p className="text-xs text-[var(--text-muted)]">Weekly revenue flow vs daily liquid payments collection.</p>
            <div className="h-48 md:h-60 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  <Line type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="Payments" stroke="var(--accent)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Production & Warehouse Summary — always visible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Overall Goods Produced by Production</h3>
              <p className="text-2xl md:text-3xl font-bold text-[var(--accent)] font-mono">{totalGoodsProduced} <span className="text-xs md:text-base text-[var(--text-secondary)] font-normal font-sans">Batches</span></p>
              <p className="text-[10px] text-[var(--text-secondary)] opacity-80">Requisitions with TICKETS_ISSUED or COMPLETED status from Production floor.</p>
            </div>
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Overall Goods in Warehouse</h3>
              <p className="text-2xl md:text-3xl font-bold text-emerald-500 font-mono">{totalWarehouseItems.toLocaleString()} <span className="text-xs md:text-base text-[var(--text-secondary)] font-normal font-sans">Units</span></p>
              <p className="text-[10px] text-[var(--text-secondary)] opacity-80">Total approved and released production units currently in warehouse stock.</p>
            </div>
          </div>

          {/* Tab Views */}
          <div className="border-t border-[var(--border)] pt-6">

            {/* PAYMENT TERMS */}
            {activeSubTab === 'Evaluation' && (
              <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4">
                <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Workflow B: Order Payment Terms Evaluation Queue</h3>
                <div className="space-y-3">
                  {ordersList.filter(o => o.status === 'PENDING_FINANCE').map(order => (
                    <div key={order.id} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap text-[var(--text-primary)]">
                            <p className="text-xs font-bold">{order.clientName}</p>
                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">({order.id})</span>
                            {order.ticketNumber && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-450 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Payment Mode: <strong className="text-[var(--text-primary)]">{order.paymentMode}</strong> | Amount: <strong className="text-[var(--text-primary)]">GHS {order.totalAmount.toLocaleString()}</strong></p>
                          {order.productName && <p className="text-[10px] text-[var(--text-secondary)]">Product: {order.productName}</p>}
                          {order.destination && <p className="text-[10px] text-[var(--text-secondary)]">Destination: {order.destination}</p>}
                          {order.ghanaCard && <p className="text-[10px] text-[var(--text-secondary)] font-mono">Ghana Card: <code>{order.ghanaCard}</code></p>}
                          <p className="text-[10px] text-[var(--text-secondary)] font-mono">Submitted: {order.createdAt}</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto justify-end shrink-0">
                          <button onClick={() => onEvaluateOrder(order.id, true)} className="flex-1 sm:flex-none px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow">Clear Terms</button>
                          <button onClick={() => onEvaluateOrder(order.id, false)} className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-500/15 text-rose-500 rounded-lg text-xs font-bold cursor-pointer hover:bg-rose-500/25 transition-all">Deny</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {ordersList.filter(o => o.status === 'PENDING_FINANCE').length === 0 && (
                    <p className="text-xs text-[var(--text-secondary)] text-center py-6">No order payment checks pending clearance.</p>
                  )}
                </div>
              </div>
            )}

            {/* INVOICE PORTAL */}
            {activeSubTab === 'Invoices' && (
              <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4">
                <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Invoice Inception Portal</h3>
                <div className="space-y-3">
                  {ordersList.filter(o => o.status === 'APPROVED').map(order => (
                    <div key={order.id} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-[var(--text-primary)]">{order.clientName}</p>
                            {order.ticketNumber && (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-450 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>
                            )}
                          </div>
                          <p className="text-[10px] text-[var(--text-secondary)] font-mono">Order ID: <code>{order.id}</code></p>
                          {order.productName && <p className="text-[10px] text-[var(--text-secondary)]">Product: <strong className="text-[var(--text-primary)]">{order.productName}</strong></p>}
                          {order.destination && <p className="text-[10px] text-[var(--text-secondary)]">Ship to: <strong className="text-[var(--text-primary)]">{order.destination}</strong></p>}
                          <p className="text-[10px] text-[var(--text-secondary)]">Mode: <strong className="text-[var(--text-primary)]">{order.paymentMode}</strong></p>
                          <p className="text-sm font-bold text-emerald-500 mt-1 font-mono">Invoice Amount: GHS {order.totalAmount.toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => onFinalizeOrder(order.id)}
                          className="w-full sm:w-auto px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0 shadow text-center"
                        >
                          Generate PDF Invoice
                        </button>
                      </div>
                    </div>
                  ))}
                  {ordersList.filter(o => o.status === 'APPROVED').length === 0 && (
                    <p className="text-xs text-[var(--text-secondary)] text-center py-6">No approved order invoices pending.</p>
                  )}
                </div>
              </div>
            )}

            {/* RECORD INBOUND PAYMENT */}
            {activeSubTab === 'RecordPayment' && (
              <div className="p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 max-w-xl">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Record Inbound Payments & Settle Credit</h3>
                <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-[var(--text-primary)]">
                  {/* Payment Type Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Payment Type</label>
                    <div className="flex gap-0 bg-[var(--bg)] p-1 rounded-xl border border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setPayType('DIRECT')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${payType === 'DIRECT' ? 'bg-[var(--bg-card)] shadow text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                      >Direct Payment</button>
                      <button
                        type="button"
                        onClick={() => setPayType('CREDIT_SETTLEMENT')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${payType === 'CREDIT_SETTLEMENT' ? 'bg-[var(--bg-card)] shadow text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                      >Credit Settlement</button>
                    </div>
                  </div>

                  {payType === 'DIRECT' ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Client Customer Name</label>
                        <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="E.g., Kumasi Foods Distributor" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Amount (GHS)</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="E.g., 2500" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Select Unsettled Credit Order</label>
                      <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                        <option value="" className="bg-[var(--bg-card)]">-- Choose Credit Order --</option>
                        {ordersList.filter(o => o.paymentMode === 'CREDIT' && o.status === 'PENDING_FINANCE').map(o => (
                          <option key={o.id} value={o.id} className="bg-[var(--bg-card)]">{o.id} - {o.clientName} (GHS {o.totalAmount.toLocaleString()}) [{o.status}]</option>
                        ))}
                      </select>
                      {ordersList.filter(o => o.paymentMode === 'CREDIT' && o.status === 'PENDING_FINANCE').length === 0 && (
                        <p className="text-[10px] text-amber-500 mt-1">No pending credit orders found. Check Finance queue first.</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Payment Mode</label>
                    <select value={payMode} onChange={e => setPayMode(e.target.value as any)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                      <option value="CASH" className="bg-[var(--bg-card)]">Cash</option>
                      <option value="CHEQUE" className="bg-[var(--bg-card)]">Cheque</option>
                      <option value="MOBILE_MONEY" className="bg-[var(--bg-card)]">Mobile Money (MTN/Telecel)</option>
                      <option value="BANK_TRANSFER" className="bg-[var(--bg-card)]">Bank Transfer</option>
                    </select>
                  </div>

                  <button type="submit" className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow">
                    Record Payment & Generate Ticket
                  </button>
                </form>
              </div>
            )}

            {/* RECEIPTS & TICKETS — clickable table */}
            {activeSubTab === 'Tickets' && (
              <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
                {/* Toolbar */}
                <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
                    <h3 className="text-sm font-bold">Historical Receipts & Tickets Database</h3>
                    <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border)] px-2 py-0.5 rounded-full">{filteredPayments.length} logs</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative flex items-center w-full sm:w-auto">
                      <span className="absolute left-3 text-[var(--text-secondary)] text-xs pointer-events-none">🔍</span>
                      <input
                        type="text"
                        placeholder="Search receipt/order…"
                        value={paymentsSearch}
                        onChange={e => setPaymentsSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-full sm:w-40 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)]"
                      />
                    </div>
                    {/* Type dropdown */}
                    <div className="relative w-full sm:w-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsPaymentsFilterOpen(!isPaymentsFilterOpen); }}
                        className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto font-semibold"
                      >
                        <span>Type: {paymentsTypeFilter === 'ALL' ? 'All' : paymentsTypeFilter.replace(/_/g, ' ')}</span>
                        <span className="text-[10px]">▼</span>
                      </button>
                      {isPaymentsFilterOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                          {(['ALL', 'DIRECT', 'CREDIT_SETTLEMENT'] as const).map(st => (
                            <button
                              key={st}
                              onClick={() => { setPaymentsTypeFilter(st); setIsPaymentsFilterOpen(false); }}
                              className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                            >
                              <span className={`w-2 h-2 rounded-full ${st === 'DIRECT' ? 'bg-blue-400' : st === 'CREDIT_SETTLEMENT' ? 'bg-purple-400' : 'bg-text-muted'}`} />
                              {st === 'ALL' ? 'All Types' : st.replace(/_/g, ' ')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Export */}
                    <button onClick={() => exportToCSV(filteredPayments, ['id', 'clientName', 'amount', 'paymentMode', 'paymentType', 'orderId', 'createdAt'], 'receipts_database')} className="flex items-center justify-center gap-1 text-xs text-[var(--text-primary)] bg-[var(--bg)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto font-semibold">
                      <span>⬇</span> Export
                    </button>
                  </div>
                </div>

                {/* Mobile Card List (Keep hidden on desktop) */}
                <div className="lg:hidden space-y-3 p-4">
                  {sortedPayments.map(pay => (
                    <div 
                      key={pay.id} 
                      onClick={() => setActiveMobileDetail({ type: 'payment', data: pay })}
                      className="bg-bg-card dark:bg-slate-850 rounded-2xl shadow-card p-4 border border-[var(--border)] dark:border-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                          ₵
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary dark:text-slate-200">{pay.clientName}</h4>
                          <p className="text-xs text-text-muted font-semibold">{pay.paymentType === 'DIRECT' ? 'Direct' : 'Credit Settlement'}</p>
                          <p className="text-[10px] text-text-muted mt-0.5 font-mono">{pay.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-500 font-mono">GHS {pay.amount.toLocaleString()}</span>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </div>
                  ))}
                  {filteredPayments.length === 0 && (
                    <div className="p-8 text-center text-text-muted text-xs bg-bg-card dark:bg-slate-850 rounded-2xl">No receipts found.</div>
                  )}
                </div>

                {/* Scrollable table (Desktop only) */}
                <div className="hidden lg:block overflow-x-auto w-full">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="theme-table-header-row text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border)] bg-[var(--bg)]">
                        <th className="py-3 px-5 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={filteredPayments.length > 0 && selectedPaymentsRows.size === filteredPayments.length}
                            onChange={handleSelectAllPayments}
                            className="accent-[var(--accent)] w-3.5 h-3.5"
                          />
                        </th>
                        <th onClick={() => handleSort('id', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                          <div className="flex items-center gap-1">
                            <span>Receipt #</span>
                            <span className="text-[9px] opacity-70">{paymentsSortField === 'id' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('clientName', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                          <div className="flex items-center gap-1">
                            <span>Client</span>
                            <span className="text-[9px] opacity-70">{paymentsSortField === 'clientName' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('paymentType', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                          <div className="flex items-center gap-1">
                            <span>Type</span>
                            <span className="text-[9px] opacity-70">{paymentsSortField === 'paymentType' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('paymentMode', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <span>Mode</span>
                            <span className="text-[9px] opacity-70">{paymentsSortField === 'paymentMode' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('orderId', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            <span>Settled Order</span>
                            <span className="text-[9px] opacity-70">{paymentsSortField === 'orderId' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('amount', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                          <div className="flex items-center justify-end gap-1">
                            <span>Amount</span>
                            <span className="text-[9px] opacity-70">{paymentsSortField === 'amount' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('createdAt', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                          <div className="flex items-center gap-1">
                            <span>Date</span>
                            <span className="text-[9px] opacity-70">{paymentsSortField === 'createdAt' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {sortedPayments.map(pay => (
                        <tr
                          key={pay.id}
                          className="theme-table-row border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors text-[var(--text-primary)] group cursor-pointer"
                          onClick={() => setSelectedTicket(pay)}
                        >
                          <td className="py-3.5 px-5" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedPaymentsRows.has(pay.id)}
                              onChange={() => handleSelectPaymentsRow(pay.id)}
                              className="accent-[var(--accent)] w-3.5 h-3.5"
                            />
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-[var(--accent)]">{pay.id}</td>
                          <td className="py-3.5 px-3 font-semibold text-[13px]">{pay.clientName}</td>
                          <td className="py-3.5 px-3 hidden sm:table-cell">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pay.paymentType === 'DIRECT' ? 'bg-blue-500/10 text-blue-450' : 'bg-purple-500/10 text-purple-450'}`}>
                              {pay.paymentType === 'DIRECT' ? 'Direct' : 'Credit Settle'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-[var(--text-secondary)] hidden md:table-cell">{pay.paymentMode.replace('_', ' ')}</td>
                          <td className="py-3.5 px-3 font-mono text-[var(--text-secondary)] hidden lg:table-cell">{pay.orderId || '—'}</td>
                          <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px] text-emerald-500">GHS {pay.amount.toLocaleString()}</td>
                          <td className="py-3.5 px-3 text-[var(--text-secondary)] font-mono text-[10px] hidden sm:table-cell">{pay.createdAt}</td>
                          <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setActivePaymentsMenu(activePaymentsMenu === pay.id ? null : pay.id)}
                              className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] border border-[var(--border)] transition-colors select-none"
                            >
                              ···
                            </button>
                            {activePaymentsMenu === pay.id && (
                              <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col text-[var(--text-primary)]">
                                <button onClick={() => setSelectedTicket(pay)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left font-semibold">🎫 View Ticket</button>
                                <button onClick={() => handleEditPayment(pay)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left font-semibold">✏ Edit Receipt</button>
                                <button onClick={() => handleDuplicatePayment(pay)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left font-semibold">📋 Duplicate</button>
                                <button onClick={() => handleSharePayment(pay)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left font-semibold">🔗 Share Link</button>
                                <div className="h-px bg-[var(--border)] my-1"></div>
                                <button onClick={() => handleDeletePayment(pay.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left font-semibold">🗑 Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]">
                  <p className="text-xs text-[var(--text-secondary)] font-mono">Showing {filteredPayments.length} of {localPayments.length} tickets</p>
                  <div className="flex items-center gap-1">
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
                  </div>
                </div>
              </div>
            )}

            {/* GOOGLE FORMS EMBED */}
            {activeSubTab === 'IntakeForm' && (
              <div className="p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4">
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  <ExternalLink className="w-5 h-5 text-[var(--accent)]" />
                  <h3 className="text-lg font-bold">Finance Intake Form</h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">Use the form below to submit payment intake requests directly from Google Forms.</p>
                <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: '600px' }}>
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
                <p className="text-[10px] text-[var(--text-secondary)] text-center">Replace the URL above with your actual Google Forms link in production.</p>
              </div>
            )}

            {/* WAREHOUSE HISTORY */}
            {activeSubTab === 'WarehouseHistory' && (
              <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
                {/* Toolbar */}
                <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">Warehouse History — Production Output</h3>
                    <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border)] px-2 py-0.5 rounded-full">{filteredWarehouse.length} entries</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative flex items-center w-full sm:w-auto">
                      <span className="absolute left-3 text-[var(--text-secondary)] text-xs pointer-events-none">🔍</span>
                      <input
                        type="text"
                        placeholder="Search warehouse logs…"
                        value={warehouseSearch}
                        onChange={e => setWarehouseSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-full sm:w-40 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)]"
                      />
                    </div>
                    {/* Status Dropdown */}
                    <div className="relative w-full sm:w-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsWarehouseFilterOpen(!isWarehouseFilterOpen); }}
                        className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto font-semibold"
                      >
                        <span>Status: {warehouseStatusFilter === 'ALL' ? 'All' : warehouseStatusFilter}</span>
                        <span className="text-[10px]">▼</span>
                      </button>
                      {isWarehouseFilterOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                          {(['ALL', 'COMPLETED', 'TICKETS_ISSUED', 'APPROVED'] as const).map(st => (
                            <button
                              key={st}
                              onClick={() => { setWarehouseStatusFilter(st); setIsWarehouseFilterOpen(false); }}
                              className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                            >
                              <span className={`w-2 h-2 rounded-full ${st === 'COMPLETED' || st === 'TICKETS_ISSUED' ? 'bg-emerald-450' : 'bg-blue-450'}`} />
                              {st === 'ALL' ? 'All Status' : st}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Card List (Keep hidden on desktop) */}
                <div className="lg:hidden space-y-3 p-4">
                  {sortedWarehouse.map(req => (
                    <div 
                      key={req.id} 
                      onClick={() => setActiveMobileDetail({ type: 'requisition', data: req })}
                      className="bg-bg-card dark:bg-slate-850 rounded-2xl shadow-card p-4 border border-[var(--border)] dark:border-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                          Req
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary dark:text-slate-200">{req.id}</h4>
                          <p className="text-xs text-text-muted font-semibold truncate max-w-[150px]">
                            {req.items.map(it => it.materialName).join(', ')}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5 font-mono">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()} units</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          req.status === 'TICKETS_ISSUED' || req.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-450' :
                          req.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-450' :
                          'bg-amber-500/10 text-amber-450'
                        }`}>{req.status.replace(/_/g, ' ')}</span>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </div>
                  ))}
                  {filteredWarehouse.length === 0 && (
                    <div className="p-8 text-center text-text-muted text-xs bg-bg-card dark:bg-slate-855 rounded-2xl">No warehouse requisitions found.</div>
                  )}
                </div>

                {/* Scrollable table (Desktop only) */}
                <div className="hidden lg:block overflow-x-auto w-full">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="theme-table-header-row text-[var(--text-secondary)] uppercase font-semibold text-[10px] border-b border-[var(--border)] bg-[var(--bg)]">
                        <th className="py-3 px-5 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={filteredWarehouse.length > 0 && selectedWarehouseRows.size === filteredWarehouse.length}
                            onChange={handleSelectAllWarehouse}
                            className="accent-[var(--accent)] w-3.5 h-3.5"
                          />
                        </th>
                        <th onClick={() => handleSort('id', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                          <div className="flex items-center gap-1">
                            <span>Requisition ID</span>
                            <span className="text-[9px] opacity-70">{warehouseSortField === 'id' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('materialName', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                          <div className="flex items-center gap-1">
                            <span>Materials</span>
                            <span className="text-[9px] opacity-70">{warehouseSortField === 'materialName' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('quantity', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                          <div className="flex items-center justify-end gap-1">
                            <span>Total Units</span>
                            <span className="text-[9px] opacity-70">{warehouseSortField === 'quantity' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('status', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                          <div className="flex items-center justify-center gap-1">
                            <span>Status</span>
                            <span className="text-[9px] opacity-70">{warehouseSortField === 'status' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th onClick={() => handleSort('createdAt', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                          <div className="flex items-center gap-1">
                            <span>Date</span>
                            <span className="text-[9px] opacity-70">{warehouseSortField === 'createdAt' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </div>
                        </th>
                        <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {sortedWarehouse.map(req => (
                        <tr key={req.id} className="theme-table-row border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors text-[var(--text-primary)] group">
                          <td className="py-3.5 px-5">
                            <input
                              type="checkbox"
                              checked={selectedWarehouseRows.has(req.id)}
                              onChange={() => handleSelectWarehouseRow(req.id)}
                              className="accent-[var(--accent)] w-3.5 h-3.5"
                            />
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold">{req.id}</td>
                          <td className="py-3.5 px-3 text-[var(--text-secondary)]">
                            {req.items.map((it, idx) => (
                              <span key={idx} className="mr-2 font-medium bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] px-1.5 py-0.5 rounded text-[11px]">{it.materialName} ({it.quantity})</span>
                            ))}
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px]">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              req.status === 'TICKETS_ISSUED' || req.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-450' :
                              req.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-450' :
                              'bg-amber-500/10 text-amber-450'
                            }`}>{req.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="py-3.5 px-3 text-[var(--text-secondary)] font-mono text-[10px] hidden sm:table-cell">{req.createdAt || 'N/A'}</td>
                          <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setActiveWarehouseMenu(activeWarehouseMenu === req.id ? null : req.id)}
                              className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] border border-[var(--border)] transition-colors select-none"
                            >
                              ···
                            </button>
                            {activeWarehouseMenu === req.id && (
                              <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col text-[var(--text-primary)]">
                                <button onClick={() => handleDuplicateRequisition(req)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left font-semibold">📋 Duplicate Log</button>
                                <button onClick={() => handleShareRequisition(req)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left font-semibold">🔗 Share Link</button>
                                <div className="h-px bg-[var(--border)] my-1"></div>
                                <button onClick={() => handleDeleteRequisition(req.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left font-semibold">🗑 Delete Log</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]">
                  <p className="text-xs text-[var(--text-secondary)] font-mono">Showing {filteredWarehouse.length} of {localRequisitions.length} logs</p>
                  <div className="flex items-center gap-1">
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
