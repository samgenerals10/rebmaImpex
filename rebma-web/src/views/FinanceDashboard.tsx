// rebma-web/src/views/FinanceDashboard.tsx

import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, FileText, DollarSign, Clipboard, ShieldCheck, Activity, X, ExternalLink, ChevronRight
} from 'lucide-react';
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
      <div className="lg:hidden bg-slate-50 dark:bg-slate-900 min-h-screen p-4 pb-24 space-y-6 animate-fade-in-up text-slate-800 dark:text-slate-200">
        {/* Header with Back button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveMobileDetail(null)}
            className="px-3 py-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-350 cursor-pointer shadow-sm"
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
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl shrink-0">
                  GHS
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{pay.clientName}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{pay.id}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Receipt #</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{pay.id}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Type</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pay.paymentType === 'DIRECT' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {pay.paymentType === 'DIRECT' ? 'Direct' : 'Credit Settle'}
                  </span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Payment Mode</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{pay.paymentMode.replace('_', ' ')}</span>
                </div>
                {pay.orderId && (
                  <div className="py-3 flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Settled Order</span>
                    <span className="font-mono font-semibold text-blue-400">{pay.orderId}</span>
                  </div>
                )}
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Amount</span>
                  <span className="font-bold text-emerald-500 font-mono">GHS {pay.amount.toLocaleString()}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Date</span>
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
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Edit Receipt
                  </button>
                  <button 
                    onClick={() => { handleDuplicatePayment(pay); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
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
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
                  REQ
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Requisition Log</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{req.id}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Requisition ID</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200 font-mono">{req.id}</span>
                </div>
                <div className="py-3 flex justify-between items-start text-xs">
                  <span className="text-slate-400 font-medium pt-0.5">Materials</span>
                  <div className="flex flex-col items-end gap-1 font-semibold text-slate-800 dark:text-slate-200">
                    {req.items.map((it, idx) => (
                      <span key={idx}>{it.materialName} ({it.quantity})</span>
                    ))}
                  </div>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Total Units</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    req.status === 'TICKETS_ISSUED' || req.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-450' :
                    req.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-450' :
                    'bg-amber-500/10 text-amber-450'
                  }`}>{req.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{req.createdAt || 'N/A'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { handleDuplicateRequisition(req); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Duplicate Log
                  </button>
                  <button 
                    onClick={() => { handleShareRequisition(req); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
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
    <div className="space-y-6">
      {/* Ticket Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setSelectedTicket(null)}>
          <div className="bg-[var(--bg-card)] border-0 sm:border border-custom rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-md overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                <p className="text-2xl font-bold font-mono">GHS {selectedTicket.amount.toLocaleString()}</p>
                <span className="px-3 py-1 bg-emerald-500/15 text-emerald-400 rounded-full text-xs font-bold mt-1 inline-block">PAID</span>
              </div>
              
              <div className="border border-dashed border-custom rounded-xl divide-y divide-dashed divide-custom">
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-400">Receipt #</span>
                  <span className="font-mono font-bold">{selectedTicket.id}</span>
                </div>
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-400">Client</span>
                  <span className="font-bold">{selectedTicket.clientName}</span>
                </div>
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-400">Payment Type</span>
                  <span className="font-bold">{selectedTicket.paymentType === 'DIRECT' ? 'Direct Receipt' : 'Credit Settlement'}</span>
                </div>
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-400">Payment Mode</span>
                  <span className="font-bold">{selectedTicket.paymentMode.replace('_', ' ')}</span>
                </div>
                {selectedTicket.orderId && (
                  <div className="flex justify-between items-center p-3 text-xs">
                    <span className="text-slate-400">Settled Order</span>
                    <span className="font-mono font-bold text-blue-400">{selectedTicket.orderId}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-slate-400">Date & Time</span>
                  <span className="text-slate-400 font-mono">{selectedTicket.createdAt}</span>
                </div>
              </div>

              <button onClick={() => printTicket(selectedTicket)} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors">
                <FileText className="w-4 h-4" /> Print / Export PDF Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Finance Ledgers</h1>
          <p className="text-xs sm:text-sm text-muted">Clear cash invoice payments, verify credit requests, and issue receipt tickets.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button onClick={() => exportToCSV(ordersList, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'finance_orders_ledger')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Ledgers (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Finance Ledger Statement', ordersList, ['id', 'ticketNumber', 'clientName', 'productName', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
            <FileText className="w-3.5 h-3.5" /><span>Ledgers (PDF)</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          const isProminent = idx < 2;
          return (
            <div key={idx} className="p-4 md:p-6 app-card flex items-center justify-between hover:scale-102 transition-all duration-300">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">{card.title}</span>
                <h3 className={`font-bold mt-1 ${isProminent ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}>{card.value}</h3>
                <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
              </div>
              <div className={`p-3 md:p-4 bg-slate-100 rounded-2xl ${card.color} bg-accent-light`}>
                <Icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-4 md:p-6 app-card">
        <h3 className="text-base md:text-lg font-bold">Finance Revenue & Cash Collection Performance</h3>
        <p className="text-xs text-muted">Weekly revenue flow vs daily liquid payments collection.</p>
        <div className="h-48 md:h-60 mt-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <div className="p-4 md:p-6 app-card space-y-3">
          <h3 className="text-sm font-bold">Overall Goods Produced by Production</h3>
          <p className="text-2xl md:text-3xl font-bold text-blue-600 font-mono">{totalGoodsProduced} <span className="text-xs md:text-base text-slate-400 font-normal font-sans">Batches</span></p>
          <p className="text-[10px] text-slate-400">Requisitions with TICKETS_ISSUED or COMPLETED status from Production floor.</p>
        </div>
        <div className="p-4 md:p-6 app-card space-y-3">
          <h3 className="text-sm font-bold">Overall Goods in Warehouse</h3>
          <p className="text-2xl md:text-3xl font-bold text-emerald-600 font-mono">{totalWarehouseItems.toLocaleString()} <span className="text-xs md:text-base text-slate-400 font-normal font-sans">Units</span></p>
          <p className="text-[10px] text-slate-400">Total approved and released production units currently in warehouse stock.</p>
        </div>
      </div>

      {/* Tab Views */}
      <div className="border-t border-custom pt-6">

        {/* PAYMENT TERMS */}
        {activeSubTab === 'Evaluation' && (
          <div className="p-4 md:p-6 app-card space-y-4">
            <h3 className="text-base md:text-lg font-bold">Workflow B: Order Payment Terms Evaluation Queue</h3>
            <div className="space-y-3">
              {ordersList.filter(o => o.status === 'PENDING_FINANCE').map(order => (
                <div key={order.id} className="p-4 bg-slate-100/50 dark:bg-slate-800/20 border border-custom rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold">{order.clientName}</p>
                        <span className="text-[10px] font-mono text-slate-400">({order.id})</span>
                        {order.ticketNumber && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Payment Mode: <strong>{order.paymentMode}</strong> | Amount: <strong>GHS {order.totalAmount.toLocaleString()}</strong></p>
                      {order.productName && <p className="text-[10px] text-slate-400">Product: {order.productName}</p>}
                      {order.destination && <p className="text-[10px] text-slate-400">Destination: {order.destination}</p>}
                      {order.ghanaCard && <p className="text-[10px] text-slate-400 font-mono">Ghana Card: <code>{order.ghanaCard}</code></p>}
                      <p className="text-[10px] text-slate-400 font-mono">Submitted: {order.createdAt}</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end shrink-0">
                      <button onClick={() => onEvaluateOrder(order.id, true)} className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors shadow">Clear Terms</button>
                      <button onClick={() => onEvaluateOrder(order.id, false)} className="flex-1 sm:flex-none px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-500/20 transition-colors">Deny</button>
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
          <div className="p-4 md:p-6 app-card space-y-4">
            <h3 className="text-base md:text-lg font-bold">Invoice Inception Portal</h3>
            <div className="space-y-3">
              {ordersList.filter(o => o.status === 'APPROVED').map(order => (
                <div key={order.id} className="p-4 bg-slate-100/50 dark:bg-slate-800/20 border border-custom rounded-xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold">{order.clientName}</p>
                        {order.ticketNumber && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">Order ID: <code>{order.id}</code></p>
                      {order.productName && <p className="text-[10px] text-slate-400">Product: <strong>{order.productName}</strong></p>}
                      {order.destination && <p className="text-[10px] text-slate-400">Ship to: <strong>{order.destination}</strong></p>}
                      <p className="text-[10px] text-slate-400">Mode: <strong>{order.paymentMode}</strong></p>
                      <p className="text-sm font-bold text-emerald-400 mt-1 font-mono">Invoice Amount: GHS {order.totalAmount.toLocaleString()}</p>
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
                <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPayType('DIRECT')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${payType === 'DIRECT' ? 'bg-white dark:bg-slate-700 shadow text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  >Direct Payment</button>
                  <button
                    type="button"
                    onClick={() => setPayType('CREDIT_SETTLEMENT')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${payType === 'CREDIT_SETTLEMENT' ? 'bg-white dark:bg-slate-700 shadow text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
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
                    <p className="text-[10px] text-amber-500 mt-1">No pending credit orders found. Check Finance queue first.</p>
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

              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow">
                Record Payment & Generate Ticket
              </button>
            </form>
          </div>
        )}

        {/* RECEIPTS & TICKETS — clickable table */}
        {activeSubTab === 'Tickets' && (
          <div className="theme-table-wrapper">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold">Historical Receipts & Tickets Database</h3>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredPayments.length} logs</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex items-center w-full sm:w-auto">
                  <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search receipt/order…"
                    value={paymentsSearch}
                    onChange={e => setPaymentsSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-full sm:w-40"
                  />
                </div>
                {/* Type dropdown */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsPaymentsFilterOpen(!isPaymentsFilterOpen); }}
                    className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom w-full sm:w-auto"
                  >
                    <span>Type: {paymentsTypeFilter === 'ALL' ? 'All' : paymentsTypeFilter.replace(/_/g, ' ')}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isPaymentsFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'DIRECT', 'CREDIT_SETTLEMENT'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setPaymentsTypeFilter(st); setIsPaymentsFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'DIRECT' ? 'bg-blue-400' : st === 'CREDIT_SETTLEMENT' ? 'bg-purple-400' : 'bg-slate-400'}`} />
                          {st === 'ALL' ? 'All Types' : st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Export */}
                <button onClick={() => exportToCSV(filteredPayments, ['id', 'clientName', 'amount', 'paymentMode', 'paymentType', 'orderId', 'createdAt'], 'receipts_database')} className="flex items-center justify-center gap-1 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom w-full sm:w-auto">
                  <span>⬇</span> Export
                </button>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="lg:hidden space-y-3 p-4">
              {sortedPayments.map(pay => (
                <div 
                  key={pay.id} 
                  onClick={() => setActiveMobileDetail({ type: 'payment', data: pay })}
                  className="bg-white dark:bg-slate-850 rounded-2xl shadow-sm p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                      ₵
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{pay.clientName}</h4>
                      <p className="text-xs text-slate-400 font-semibold">{pay.paymentType === 'DIRECT' ? 'Direct' : 'Credit Settlement'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{pay.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-500 font-mono">GHS {pay.amount.toLocaleString()}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
              {filteredPayments.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-850 rounded-2xl">No receipts found.</div>
              )}
            </div>

            {/* Scrollable table (Desktop only) */}
            <div className="hidden lg:block overflow-x-auto w-full">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="theme-table-header-row text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredPayments.length > 0 && selectedPaymentsRows.size === filteredPayments.length}
                        onChange={handleSelectAllPayments}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('id', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Receipt #</span>
                        <span className="text-[9px] opacity-70">{paymentsSortField === 'id' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('clientName', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Client</span>
                        <span className="text-[9px] opacity-70">{paymentsSortField === 'clientName' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('paymentType', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Type</span>
                        <span className="text-[9px] opacity-70">{paymentsSortField === 'paymentType' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('paymentMode', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Mode</span>
                        <span className="text-[9px] opacity-70">{paymentsSortField === 'paymentMode' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('orderId', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Settled Order</span>
                        <span className="text-[9px] opacity-70">{paymentsSortField === 'orderId' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('amount', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center justify-end gap-1">
                        <span>Amount</span>
                        <span className="text-[9px] opacity-70">{paymentsSortField === 'amount' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('createdAt', paymentsSortField, setPaymentsSortField, paymentsSortDir, setPaymentsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        <span className="text-[9px] opacity-70">{paymentsSortField === 'createdAt' ? (paymentsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-custom">
                  {sortedPayments.map(pay => (
                    <tr
                      key={pay.id}
                      className="theme-table-row group cursor-pointer"
                      onClick={() => setSelectedTicket(pay)}
                    >
                      <td className="py-3.5 px-5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedPaymentsRows.has(pay.id)}
                          onChange={() => handleSelectPaymentsRow(pay.id)}
                          className="accent-blue-600 w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-blue-400">{pay.id}</td>
                      <td className="py-3.5 px-3 font-semibold text-[13px]">{pay.clientName}</td>
                      <td className="py-3.5 px-3 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pay.paymentType === 'DIRECT' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                          {pay.paymentType === 'DIRECT' ? 'Direct' : 'Credit Settle'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 hidden md:table-cell">{pay.paymentMode.replace('_', ' ')}</td>
                      <td className="py-3.5 px-3 font-mono text-slate-400 hidden lg:table-cell">{pay.orderId || '—'}</td>
                      <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px] text-emerald-400">GHS {pay.amount.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-slate-400 font-mono text-[10px] hidden sm:table-cell">{pay.createdAt}</td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActivePaymentsMenu(activePaymentsMenu === pay.id ? null : pay.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                        >
                          ···
                        </button>
                        {activePaymentsMenu === pay.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => setSelectedTicket(pay)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🎫 View Ticket</button>
                            <button onClick={() => handleEditPayment(pay)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">✏ Edit Receipt</button>
                            <button onClick={() => handleDuplicatePayment(pay)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate</button>
                            <button onClick={() => handleSharePayment(pay)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                            <button onClick={() => handleDeletePayment(pay.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete</button>
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
              <p className="text-xs text-slate-400 font-mono">Showing {filteredPayments.length} of {localPayments.length} tickets</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
              </div>
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
            <p className="text-xs text-muted">Use the form below to submit payment intake requests directly from Google Forms.</p>
            <div className="rounded-xl overflow-hidden border border-custom" style={{ height: '600px' }}>
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
          <div className="theme-table-wrapper">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Warehouse History — Production Output</h3>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredWarehouse.length} entries</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex items-center w-full sm:w-auto">
                  <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search warehouse logs…"
                    value={warehouseSearch}
                    onChange={e => setWarehouseSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-full sm:w-40"
                  />
                </div>
                {/* Status Dropdown */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsWarehouseFilterOpen(!isWarehouseFilterOpen); }}
                    className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom w-full sm:w-auto"
                  >
                    <span>Status: {warehouseStatusFilter === 'ALL' ? 'All' : warehouseStatusFilter}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isWarehouseFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'COMPLETED', 'TICKETS_ISSUED', 'APPROVED'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setWarehouseStatusFilter(st); setIsWarehouseFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'COMPLETED' || st === 'TICKETS_ISSUED' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                          {st === 'ALL' ? 'All Status' : st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="lg:hidden space-y-3 p-4">
              {sortedWarehouse.map(req => (
                <div 
                  key={req.id} 
                  onClick={() => setActiveMobileDetail({ type: 'requisition', data: req })}
                  className="bg-white dark:bg-slate-850 rounded-2xl shadow-sm p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                      Req
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{req.id}</h4>
                      <p className="text-xs text-slate-400 font-semibold truncate max-w-[150px]">
                        {req.items.map(it => it.materialName).join(', ')}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()} units</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      req.status === 'TICKETS_ISSUED' || req.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-450' :
                      req.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-450' :
                      'bg-amber-500/10 text-amber-450'
                    }`}>{req.status.replace(/_/g, ' ')}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
              {filteredWarehouse.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-850 rounded-2xl">No warehouse requisitions found.</div>
              )}
            </div>

            {/* Scrollable table (Desktop only) */}
            <div className="hidden lg:block overflow-x-auto w-full">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="theme-table-header-row text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredWarehouse.length > 0 && selectedWarehouseRows.size === filteredWarehouse.length}
                        onChange={handleSelectAllWarehouse}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('id', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Requisition ID</span>
                        <span className="text-[9px] opacity-70">{warehouseSortField === 'id' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('materialName', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Materials</span>
                        <span className="text-[9px] opacity-70">{warehouseSortField === 'materialName' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('quantity', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Units</span>
                        <span className="text-[9px] opacity-70">{warehouseSortField === 'quantity' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('status', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <span className="text-[9px] opacity-70">{warehouseSortField === 'status' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('createdAt', warehouseSortField, setWarehouseSortField, warehouseSortDir, setWarehouseSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        <span className="text-[9px] opacity-70">{warehouseSortField === 'createdAt' ? (warehouseSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-custom">
                  {sortedWarehouse.map(req => (
                    <tr key={req.id} className="theme-table-row group">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedWarehouseRows.has(req.id)}
                          onChange={() => handleSelectWarehouseRow(req.id)}
                          className="accent-blue-600 w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold">{req.id}</td>
                      <td className="py-3.5 px-3 text-slate-350">
                        {req.items.map((it, idx) => (
                          <span key={idx} className="mr-2 font-medium bg-slate-100/5 dark:bg-slate-800/40 border border-custom px-1.5 py-0.5 rounded text-[11px]">{it.materialName} ({it.quantity})</span>
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
                      <td className="py-3.5 px-3 text-slate-400 font-mono text-[10px] hidden sm:table-cell">{req.createdAt || 'N/A'}</td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveWarehouseMenu(activeWarehouseMenu === req.id ? null : req.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                        >
                          ···
                        </button>
                        {activeWarehouseMenu === req.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleDuplicateRequisition(req)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate Log</button>
                            <button onClick={() => handleShareRequisition(req)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                            <button onClick={() => handleDeleteRequisition(req.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete Log</button>
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
              <p className="text-xs text-slate-400 font-mono">Showing {filteredWarehouse.length} of {localRequisitions.length} logs</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
