// rebma-web/src/views/ManagementDashboard.tsx

import { useState, useEffect } from 'react';
import type { IncomingGoods, Order, Customer, GoodsPrice, AuditEntry } from '../types/erp';
import { FileSpreadsheet, FileText, Clipboard, Activity, ShieldCheck, DollarSign, History, Tag, User, ChevronDown, ChevronUp } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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

  // Local state copy of incomingGoods, orders, audit log to enable row-specific client-side actions
  const [localGoods, setLocalGoods] = useState<IncomingGoods[]>(incomingGoodsList);
  const [localOrders, setLocalOrders] = useState<Order[]>(ordersList);
  const [localLedger, setLocalLedger] = useState<AuditEntry[]>(auditLog);

  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState({ productName: '', category: 'INCOMING_GOODS' as GoodsPrice['category'], unitPrice: '', currency: 'GHS' as 'GHS' | 'USD' });

  // Table interactive states: Global Audit Ledger
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerDeptFilter, setLedgerDeptFilter] = useState('ALL');
  const [isLedgerFilterOpen, setIsLedgerFilterOpen] = useState(false);
  const [selectedLedgerRows, setSelectedLedgerRows] = useState<Set<string>>(new Set());
  const [activeLedgerMenu, setActiveLedgerMenu] = useState<string | null>(null);

  // Table interactive states: Management Decision History
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL');
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<Set<string>>(new Set());
  const [activeHistoryMenu, setActiveHistoryMenu] = useState<string | null>(null);

  // Sorting states for Global Ledger
  const [ledgerSortField, setLedgerSortField] = useState<string>('');
  const [ledgerSortDir, setLedgerSortDir] = useState<'asc' | 'desc'>('asc');

  // Sorting states for Decision History
  const [historySortField, setHistorySortField] = useState<string>('');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('asc');

  // Sync props to local states
  useEffect(() => {
    setLocalGoods(incomingGoodsList);
  }, [incomingGoodsList]);

  useEffect(() => {
    setLocalOrders(ordersList);
  }, [ordersList]);

  useEffect(() => {
    setLocalLedger(auditLog);
  }, [auditLog]);

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveLedgerMenu(null);
      setActiveHistoryMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const lineChartData = [
    { name: 'Mon', Approved: 8, Rejected: 1 },
    { name: 'Tue', Approved: 12, Rejected: 0 },
    { name: 'Wed', Approved: 15, Rejected: 2 },
    { name: 'Thu', Approved: 10, Rejected: 1 },
    { name: 'Fri', Approved: 18, Rejected: 3 },
  ];

  const pendingCargoCount = localGoods.filter(i => i.status === 'PENDING_MANAGEMENT_APPROVAL').length;
  const pendingCreditCount = localOrders.filter(o => o.status === 'PENDING_MANAGEMENT').length;
  const approvedOrdersCount = localOrders.filter(o => ['APPROVED', 'DELIVERED', 'PROCESSING'].includes(o.status)).length;
  const totalApprovedValue = localOrders
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
      'APPROVED': 'bg-emerald-500/10 text-emerald-400',
      'DELIVERED': 'bg-emerald-500/10 text-emerald-400',
      'PROCESSING': 'bg-blue-500/10 text-blue-400',
      'OUT_FOR_DELIVERY': 'bg-indigo-500/10 text-indigo-400',
      'REJECTED': 'bg-rose-500/10 text-rose-400',
      'PENDING_MANAGEMENT_APPROVAL': 'bg-amber-500/10 text-amber-400',
      'PENDING_FINANCE': 'bg-sky-500/10 text-sky-400',
      'PENDING_MANAGEMENT': 'bg-amber-500/10 text-amber-400',
    };
    return map[status] || 'bg-slate-500/10 text-slate-400';
  };

  // Row Action Handlers: Ledger
  const handleDuplicateLedger = (entry: AuditEntry) => {
    const duplicated: AuditEntry = {
      ...entry,
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleString()
    };
    setLocalLedger(prev => [duplicated, ...prev]);
  };

  const handleShareLedger = (entry: AuditEntry) => {
    const shareText = `Audit Entry [${entry.timestamp}] Dept: ${entry.department} - Performed by ${entry.performedBy}: ${entry.action} - ${entry.details}`;
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Copied audit ledger detail to clipboard!');
    }).catch(() => alert(shareText));
  };

  const handleDeleteLedger = async (id: string) => {
    if (!await confirm('Delete this audit log entry?')) return;
    setLocalLedger(prev => prev.filter(l => l.id !== id));
  };

  // Row Action Handlers: Decision History
  const handleEditHistory = async (item: any, isCargo: boolean) => {
    if (isCargo) {
      const newPrice = await prompt('Edit price catalog unit price:', item.unitPrice ? item.unitPrice.toString() : '');
      if (!newPrice || isNaN(parseFloat(newPrice))) return;
      setLocalGoods(prev => prev.map(g => g.id === item.id ? { ...g, unitPrice: parseFloat(newPrice) } : g));
    } else {
      const newAmt = await prompt('Edit order amount:', item.totalAmount.toString());
      if (!newAmt || isNaN(parseFloat(newAmt))) return;
      setLocalOrders(prev => prev.map(o => o.id === item.id ? { ...o, totalAmount: parseFloat(newAmt) } : o));
    }
  };

  const handleDuplicateHistory = (item: any, isCargo: boolean) => {
    if (isCargo) {
      const duplicated: IncomingGoods = {
        ...item,
        id: `${Math.floor(100 + Math.random() * 900)}`,
        goodsCode: `GC-${Math.floor(100000 + Math.random() * 900000)}`
      };
      setLocalGoods(prev => [duplicated, ...prev]);
    } else {
      const duplicated: Order = {
        ...item,
        id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
        ticketNumber: `TKT-${Math.floor(10000 + Math.random() * 90000)}`
      };
      setLocalOrders(prev => [duplicated, ...prev]);
    }
  };

  const handleShareHistory = (item: any, isCargo: boolean) => {
    const shareText = isCargo ?
      `Cargo Log: ${item.productName || item.company} - Price: GHS ${item.unitPrice || 0}/u` :
      `Order Log: ${item.clientName} - Amt: GHS ${item.totalAmount} - Status: ${item.status}`;
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Copied sharing details to clipboard!');
    }).catch(() => alert(shareText));
  };

  const handleDeleteHistory = async (id: string, isCargo: boolean) => {
    if (!await confirm('Are you sure you want to delete this decision history record?')) return;
    if (isCargo) {
      setLocalGoods(prev => prev.filter(g => g.id !== id));
    } else {
      setLocalOrders(prev => prev.filter(o => o.id !== id));
    }
  };

  // Row Selection Checkboxes
  const handleSelectAllLedger = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLedgerRows(new Set(filteredLedger.map(l => l.id)));
    } else {
      setSelectedLedgerRows(new Set());
    }
  };

  const handleSelectLedgerRow = (id: string) => {
    const updated = new Set(selectedLedgerRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedLedgerRows(updated);
  };

  const handleSelectAllHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedHistoryRows(new Set(combinedHistory.map(h => h.id)));
    } else {
      setSelectedHistoryRows(new Set());
    }
  };

  const handleSelectHistoryRow = (id: string) => {
    const updated = new Set(selectedHistoryRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedHistoryRows(updated);
  };

  // Filters
  const filteredLedger = localLedger.filter(l => {
    const matchesSearch = l.performedBy.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                          l.details.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                          l.action.toLowerCase().includes(ledgerSearch.toLowerCase());
    const matchesDept = ledgerDeptFilter === 'ALL' || l.department === ledgerDeptFilter;
    return matchesSearch && matchesDept;
  });

  const flatHistoryCargo = localGoods.filter(i => i.status !== 'PENDING_MANAGEMENT_APPROVAL').map(g => ({
    id: g.id,
    displayId: g.goodsCode || `CARGO-${g.id}`,
    type: 'CARGO',
    clientProduct: g.productName || g.company,
    origin: g.country,
    amount: g.unitPrice ? `GHS ${g.unitPrice}/u` : '—',
    amountVal: g.unitPrice || 0,
    status: g.status,
    date: g.createdAt || '—',
    originalItem: g
  }));

  const flatHistoryOrders = localOrders.filter(o => !['PENDING_FINANCE', 'PENDING_MANAGEMENT'].includes(o.status)).map(o => ({
    id: o.id,
    displayId: o.id,
    type: 'ORDER',
    clientProduct: o.clientName,
    origin: 'Sales Order Portal',
    amount: `GHS ${o.totalAmount.toLocaleString()}`,
    amountVal: o.totalAmount,
    status: o.status,
    date: o.createdAt,
    originalItem: o
  }));

  const combinedHistory = [...flatHistoryCargo, ...flatHistoryOrders].filter(h => {
    const matchesSearch = h.displayId.toLowerCase().includes(historySearch.toLowerCase()) ||
                          h.clientProduct.toLowerCase().includes(historySearch.toLowerCase());
    const matchesType = historyTypeFilter === 'ALL' || h.type === historyTypeFilter;
    return matchesSearch && matchesType;
  });

  const sortedLedger = [...filteredLedger].sort((a, b) => {
    if (!ledgerSortField) return 0;
    const aVal = a[ledgerSortField as keyof AuditEntry];
    const bVal = b[ledgerSortField as keyof AuditEntry];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return ledgerSortDir === 'asc' ? comp : -comp;
  });

  const sortedHistory = !historySortField ? [...combinedHistory].reverse() : [...combinedHistory].sort((a, b) => {
    if (!historySortField) return 0;
    let aVal: any;
    let bVal: any;
    if (historySortField === 'id') {
      aVal = a.displayId;
      bVal = b.displayId;
    } else if (historySortField === 'clientProduct') {
      aVal = a.clientProduct;
      bVal = b.clientProduct;
    } else if (historySortField === 'type') {
      aVal = a.type;
      bVal = b.type;
    } else if (historySortField === 'amount') {
      aVal = a.amountVal;
      bVal = b.amountVal;
    } else if (historySortField === 'status') {
      aVal = a.status;
      bVal = b.status;
    } else if (historySortField === 'date') {
      aVal = a.date;
      bVal = b.date;
    }
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return historySortDir === 'asc' ? comp : -comp;
  });

  return (
    <>
      {/* ══ MOBILE LAYOUT (< lg) ══ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Management</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Cargo approvals & credit control</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(localGoods, ['id', 'goodsName', 'quantity', 'portName', 'status'], 'cargo_list')} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm"><FileSpreadsheet className="w-4 h-4 text-slate-500" /></button>
            <button onClick={() => exportToPDF('Management Report', localGoods, ['id', 'goodsName', 'quantity', 'status'])} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm"><FileText className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>

        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #312e81 0%, #0f172a 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Cargo Awaiting Approval</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{pendingCargoCount} Batches</h2>
              <p className="text-[10px] text-white/70 mt-1">{pendingCreditCount} Credit Audits Pending</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">{approvedOrdersCount} Orders Authorized</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">GHS {totalApprovedValue.toLocaleString()} Approved</p>
            </div>
            <div className="mobile-card-circles"><div className="mobile-card-circle-1" /><div className="mobile-card-circle-2" /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Authorized', value: `${approvedOrdersCount}`, sub: 'Orders cleared', bg: '#f0fdf4', color: '#16a34a', icon: ShieldCheck },
            { label: 'Net Value', value: `GHS ${(totalApprovedValue/1000).toFixed(0)}k`, sub: 'Approved funds', bg: '#eef2ff', color: '#6366f1', icon: DollarSign },
          ].map((s, i) => { const Icon = s.icon; return (
            <div key={i} className="mobile-stat-card">
              <div className="mobile-stat-icon" style={{ background: s.bg }}><Icon className="w-5 h-5" style={{ color: s.color }} /></div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{s.label}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{s.value}</p>
                <p className="text-[9px] text-slate-400">{s.sub}</p>
              </div>
            </div>
          ); })}
        </div>

        <div>
          <p className="mobile-section-label">Incoming Cargo Queue</p>
          <div className="space-y-2">
            {localGoods.slice(0, 6).map(g => (
              <div key={g.id} className="mobile-data-row">
                <div className="mobile-data-row-icon" style={{ background: g.status === 'APPROVED' ? '#f0fdf4' : g.status === 'PENDING_MANAGEMENT_APPROVAL' ? '#fefce8' : '#fff7ed', color: g.status === 'APPROVED' ? '#16a34a' : '#d97706' }}>
                  <Clipboard className="w-5 h-5" style={{ color: g.status === 'APPROVED' ? '#16a34a' : '#d97706' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{g.productName || 'Unnamed Cargo'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{g.quantity} units • {g.country}</p>
                </div>
                <span className={`mobile-status-pill ${g.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : g.status === 'PENDING_MANAGEMENT_APPROVAL' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {g.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ DESKTOP LAYOUT (lg+) — UNCHANGED ══ */}
      <div className="hidden lg:block">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Management Control Approvals</h1>
          <p className="text-xs sm:text-sm text-muted">Set pricing, authorize credits, and manage cargo approvals.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => exportToCSV(localGoods, ['id', 'goodsCode', 'productName', 'country', 'company', 'quantity', 'weight', 'destination', 'discrepancies', 'status', 'unitPrice'], 'incoming_port_cargo_audit')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Cargo (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Incoming Port Cargo Audit', localGoods, ['id', 'goodsCode', 'productName', 'country', 'company', 'quantity', 'weight', 'destination', 'discrepancies', 'status', 'unitPrice'])} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] hover:opacity-90 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity">
            <FileText className="w-3.5 h-3.5" /><span>Cargo (PDF)</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border-b-[3px] border-[var(--accent)] flex items-center justify-between hover:scale-102 transition-all duration-300">
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
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Management Decision & Approval Velocity</h3>
        <p className="text-xs text-[var(--text-muted)]">Weekly authorized credentials vs rejected logs.</p>
        <div className="h-[200px] sm:h-60 lg:h-[300px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="Approved" stroke="var(--accent)" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Rejected" stroke="#f43f5e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab Content */}
      <div className="border-t border-[var(--border)] pt-6 space-y-6">

        {/* PORT CARGO APPROVAL */}
        {activeSubTab === 'CargoApproval' && (
          <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Workflow A: Port Cargo Approval Queue</h3>
            <p className="text-xs text-[var(--text-muted)]">Inspect logged intakes, set unit prices, and approve or reject cargo batches.</p>
            <div className="space-y-4">
              {localGoods.filter(i => i.status === 'PENDING_MANAGEMENT_APPROVAL').map(item => (
                <div key={item.id} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="w-20 h-20 object-cover rounded-lg border border-[var(--border)] shrink-0 w-full sm:w-20" />
                    ) : (
                      <div className="w-full sm:w-20 h-20 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-[var(--text-muted)]">No Image</span>
                      </div>
                    )}
                    <div className="flex-1 space-y-1 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{item.productName || 'Unnamed Product'}</span>
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded font-bold text-[9px] shrink-0">Awaiting Pricing</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">Code: <code className="bg-[var(--bg-card)] px-1 rounded border border-[var(--border)] text-[var(--text-primary)]">{item.goodsCode || `CARGO-${item.id}`}</code></p>
                      <p className="text-[10px] text-[var(--text-muted)]">Origin: <strong>{item.country}</strong> via <strong>{item.company}</strong></p>
                      <p className="text-[10px] text-[var(--text-muted)]">Destination: <strong>{item.destination || 'Accra Warehouse'}</strong></p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)] font-mono">
                        <span>Qty: <strong>{item.quantity} units</strong></span>
                        <span>Weight: <strong>{item.weight}T</strong></span>
                        <span>Logged: <strong>{item.createdAt || 'N/A'}</strong></span>
                      </div>
                      {item.discrepancies && item.discrepancies !== 'None' && (
                        <p className="text-[10px] text-rose-500 font-semibold">⚠ Faults: {item.discrepancies}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 w-full">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] text-xs font-bold">GHS</span>
                      <input
                        type="number"
                        placeholder="Set Unit Price"
                        id={`price-input-${item.id}`}
                        className="w-full pl-12 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const val = parseFloat((document.getElementById(`price-input-${item.id}`) as HTMLInputElement).value);
                          if (isNaN(val)) return alert('Enter a unit price');
                          onApproveIntake(item.id, true, val);
                        }}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity shadow text-center"
                      >Approve & Price</button>
                      <button
                        onClick={() => onApproveIntake(item.id, false)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-100 transition-colors"
                      >Reject</button>
                    </div>
                  </div>
                </div>
              ))}
              {localGoods.filter(i => i.status === 'PENDING_MANAGEMENT_APPROVAL').length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">No cargo awaiting management pricing reviews.</p>
              )}
            </div>
          </div>
        )}

        {/* CREDIT APPROVAL */}
        {activeSubTab === 'CreditApproval' && (
          <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Workflow B: Credit Order Approvals</h3>
                <p className="text-xs text-[var(--text-muted)]">Review orders with CREDIT terms — full customer details and history shown.</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => exportToCSV(localOrders.filter(o => o.status === 'PENDING_MANAGEMENT'), ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'credit_approvals_ledger')} className="p-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded cursor-pointer border border-[var(--border)] transition-opacity"><FileSpreadsheet className="w-3.5 h-3.5" /></button>
                <button onClick={() => exportToPDF('Credit Approvals Ledger', localOrders.filter(o => o.status === 'PENDING_MANAGEMENT'), ['id', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="p-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded cursor-pointer border border-[var(--border)] transition-opacity"><FileText className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="space-y-4">
              {localOrders.filter(o => o.status === 'PENDING_MANAGEMENT').map(order => {
                const cust = getCustomerForOrder(order);
                const isExpanded = expandedCreditId === order.id;
                return (
                  <div key={order.id} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{order.clientName}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">Order: <code className="bg-[var(--bg-card)] px-1 rounded border border-[var(--border)] text-[var(--text-primary)]">{order.id}</code>{order.ticketNumber && <span className="ml-2 text-emerald-600 font-bold">🎫 {order.ticketNumber}</span>}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">Product: <strong>{order.productName || '—'}</strong> | Destination: <strong>{order.destination || '—'}</strong></p>
                        <p className="text-[10px] text-[var(--text-muted)]">Amount: <strong className="text-[var(--text-primary)]">GHS {order.totalAmount.toLocaleString()}</strong> | Mode: <strong>{order.paymentMode}</strong> | Submitted: {order.createdAt}</p>
                        {order.ghanaCard && <p className="text-[10px] text-[var(--text-muted)] font-mono">Ghana Card: <code className="bg-[var(--bg-card)] px-1 rounded border border-[var(--border)] text-[var(--text-primary)]">{order.ghanaCard}</code></p>}
                      </div>
                      <div className="flex flex-col gap-2 items-start sm:items-end w-full sm:w-auto shrink-0">
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button onClick={() => onApproveCredit(order.id, true)} className="flex-1 sm:flex-none px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity shadow text-center">Authorize Credit</button>
                          <button onClick={() => onApproveCredit(order.id, false)} className="flex-1 sm:flex-none px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-100 transition-colors text-center">Block</button>
                        </div>
                        <button
                          onClick={() => setExpandedCreditId(isExpanded ? null : order.id)}
                          className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline cursor-pointer transition-all"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? 'Hide' : 'View'} Customer Details
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[var(--border)] pt-3 space-y-3">
                        {cust ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Customer Profile Card */}
                            <div className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl space-y-2">
                              <div className="flex items-center gap-3">
                                {cust.photo ? (
                                  <img src={cust.photo} alt={cust.name} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--accent)]" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-[var(--accent-light)] flex items-center justify-center border border-[var(--border)]">
                                    <User className="w-6 h-6 text-[var(--accent)]" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-bold text-[var(--text-primary)]">{cust.name}</p>
                                  <p className="text-[10px] text-[var(--text-muted)]">{cust.companyName}</p>
                                </div>
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] space-y-1">
                                <p>📍 {cust.location}</p>
                                <p>📞 {cust.phone}</p>
                                {cust.email && <p>✉ {cust.email}</p>}
                                {cust.ghanaCard && <p>🪪 Ghana Card: <code className="bg-[var(--bg)] px-1 rounded border border-[var(--border)] text-[var(--text-primary)]">{cust.ghanaCard}</code></p>}
                                <p>📅 Registered: {cust.registeredAt}</p>
                              </div>
                            </div>

                            {/* Credit History */}
                            <div className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl space-y-2">
                              <p className="text-xs font-bold text-[var(--text-muted)]">Credit History</p>
                              {cust.creditHistory && cust.creditHistory.length > 0 ? (
                                <div className="space-y-1">
                                  {cust.creditHistory.map((h, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[10px] text-[var(--text-muted)] border-b border-[var(--border)] py-1">
                                      <span><code>{h.orderId}</code> — {h.date}</span>
                                      <span className="font-bold text-[var(--text-primary)]">GHS {h.amount.toLocaleString()}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${h.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>{h.status}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-[var(--text-muted)]">No previous credit history.</p>
                              )}

                              {/* Order history count */}
                              <div className="mt-2 p-2 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                <p className="text-[10px] text-[var(--text-muted)] font-semibold">
                                  Total Orders: <strong className="text-[var(--text-primary)]">{localOrders.filter(o => o.clientName === cust.name).length}</strong>
                                </p>
                                <p className="text-[10px] text-[var(--text-muted)]">
                                  Delivered: <strong className="text-[var(--text-primary)]">{localOrders.filter(o => o.clientName === cust.name && o.status === 'DELIVERED').length}</strong>
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
              {localOrders.filter(o => o.status === 'PENDING_MANAGEMENT').length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">No credit limit audits pending.</p>
              )}
            </div>
          </div>
        )}

        {/* GLOBAL AUDIT LEDGER */}
        {activeSubTab === 'Ledger' && (
          <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-center gap-2">
                <Clipboard className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Global Audit Ledger</h3>
                <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">{filteredLedger.length} entries</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[var(--text-muted)] text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search ledger…"
                    value={ledgerSearch}
                    onChange={e => setLedgerSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border border-[var(--border)] transition w-40 bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--accent)]"
                  />
                </div>
                {/* Dept Filter */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsLedgerFilterOpen(!isLedgerFilterOpen); }}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)]"
                  >
                    <span>Dept: {ledgerDeptFilter === 'ALL' ? 'All' : ledgerDeptFilter}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isLedgerFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col max-h-48 overflow-y-auto">
                      {(['ALL', 'CEO', 'MANAGEMENT', 'OPERATIONS', 'PRODUCTION', 'FINANCE', 'DISPATCH', 'HR', 'MARKETING'] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => { setLedgerDeptFilter(d); setIsLedgerFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                          {d === 'ALL' ? 'All Depts' : d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="theme-table-header-row text-[var(--text-muted)] uppercase font-semibold text-[10px] border-b border-[var(--border)]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredLedger.length > 0 && selectedLedgerRows.size === filteredLedger.length}
                        onChange={handleSelectAllLedger}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('timestamp', ledgerSortField, setLedgerSortField, ledgerSortDir, setLedgerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Timestamp</span>
                        <span className="text-[9px] opacity-70">{ledgerSortField === 'timestamp' ? (ledgerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('department', ledgerSortField, setLedgerSortField, ledgerSortDir, setLedgerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Department</span>
                        <span className="text-[9px] opacity-70">{ledgerSortField === 'department' ? (ledgerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('performedBy', ledgerSortField, setLedgerSortField, ledgerSortDir, setLedgerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Performed By</span>
                        <span className="text-[9px] opacity-70">{ledgerSortField === 'performedBy' ? (ledgerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('action', ledgerSortField, setLedgerSortField, ledgerSortDir, setLedgerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Action</span>
                        <span className="text-[9px] opacity-70">{ledgerSortField === 'action' ? (ledgerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('details', ledgerSortField, setLedgerSortField, ledgerSortDir, setLedgerSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Details</span>
                        <span className="text-[9px] opacity-70">{ledgerSortField === 'details' ? (ledgerSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap text-[var(--text-primary)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedLedger.map(entry => (
                    <tr key={entry.id} className="theme-table-row hover:bg-[var(--accent-light)] transition-colors group">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedLedgerRows.has(entry.id)}
                          onChange={() => handleSelectLedgerRow(entry.id)}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 text-[var(--text-muted)] whitespace-nowrap font-mono text-[10px] hidden md:table-cell">{entry.timestamp}</td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-full text-[9px] font-bold">{entry.department}</span>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[13px] text-[var(--text-primary)] hidden sm:table-cell">{entry.performedBy}</td>
                      <td className="py-3.5 px-3 font-bold text-[var(--text-primary)]">{entry.action}</td>
                      <td className="py-3.5 px-3 text-[var(--text-muted)]">{entry.details}</td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveLedgerMenu(activeLedgerMenu === entry.id ? null : entry.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] transition-colors select-none border border-[var(--border)]"
                        >
                          ···
                        </button>
                        {activeLedgerMenu === entry.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleDuplicateLedger(entry)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">📋 Duplicate Log</button>
                            <button onClick={() => handleShareLedger(entry)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">🔗 Share Details</button>
                            <div className="h-px bg-[var(--border)] my-1"></div>
                            <button onClick={() => handleDeleteLedger(entry.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-left">🗑 Delete Log</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredLedger.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[var(--text-muted)]">No audit ledger records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
              <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredLedger.length} of {localLedger.length} events</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
              </div>
            </div>
          </div>
        )}

        {/* SET PRICES */}
        {activeSubTab === 'SetPrices' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Set Price Form */}
            <div className="p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Set Goods Prices</h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-2">Define unit prices for new, incoming, or old goods categories.</p>
              <form onSubmit={handleSetPriceSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Product / Goods Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={priceForm.productName}
                    onChange={e => setPriceForm(p => ({ ...p, productName: e.target.value }))}
                    required
                    placeholder="E.g., Palm Oil Barrel"
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Goods Category</label>
                  <select
                    value={priceForm.category}
                    onChange={e => setPriceForm(p => ({ ...p, category: e.target.value as GoodsPrice['category'] }))}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                  >
                    <option value="NEW_GOODS">New Goods</option>
                    <option value="INCOMING_GOODS">Incoming Goods (Port)</option>
                    <option value="OLD_GOODS">Old / Existing Stock</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Unit Price <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceForm.unitPrice}
                      onChange={e => setPriceForm(p => ({ ...p, unitPrice: e.target.value }))}
                      required
                      placeholder="E.g., 125.50"
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Currency</label>
                    <select
                      value={priceForm.currency}
                      onChange={e => setPriceForm(p => ({ ...p, currency: e.target.value as 'GHS' | 'USD' }))}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                    >
                      <option value="GHS">GHS (Ghana Cedis)</option>
                      <option value="USD">USD (US Dollar)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-opacity shadow">
                  Set Price Catalog Entry
                </button>
              </form>
            </div>

            {/* Price Catalog */}
            <div className="p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Current Price Catalog</h3>
              <div className="space-y-2">
                {goodsPrices.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-6">No prices set yet.</p>
                )}
                {goodsPrices.map((gp, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{gp.productName}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{gp.category.replace(/_/g, ' ')} · Set by {gp.setBy}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">{gp.setAt}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[var(--accent)] text-sm font-mono">{gp.currency} {gp.unitPrice.toLocaleString()}</p>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        gp.category === 'NEW_GOODS' ? 'bg-[var(--accent-light)] text-[var(--accent)]' :
                        gp.category === 'INCOMING_GOODS' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>{gp.category.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => exportToCSV(goodsPrices, ['productName', 'category', 'unitPrice', 'currency', 'setBy', 'setAt'], 'goods_price_catalog')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] w-full justify-center transition-opacity">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export Price Catalog (CSV)
              </button>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeSubTab === 'MgmtHistory' && (
          <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Management Decision History</h3>
                <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">{combinedHistory.length} logs</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[var(--text-muted)] text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search history…"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border border-[var(--border)] transition w-40 bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--accent)]"
                  />
                </div>
                {/* Type Filter dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsHistoryFilterOpen(!isHistoryFilterOpen); }}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)]"
                  >
                    <span>Type: {historyTypeFilter === 'ALL' ? 'All' : historyTypeFilter}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isHistoryFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'CARGO', 'ORDER'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { setHistoryTypeFilter(t); setIsHistoryFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                          {t === 'ALL' ? 'All Records' : t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left font-sans">
                <thead>
                  <tr className="theme-table-header-row text-[var(--text-muted)] uppercase font-semibold text-[10px] border-b border-[var(--border)]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={combinedHistory.length > 0 && selectedHistoryRows.size === combinedHistory.length}
                        onChange={handleSelectAllHistory}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('id', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Order / Cargo ID</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'id' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('type', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Type</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'type' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('clientProduct', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Client / Product</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'clientProduct' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('amount', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center justify-end gap-1">
                        <span>Amount</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'amount' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('status', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center justify-center gap-1">
                        <span>Decision</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'status' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('date', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'date' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap text-[var(--text-primary)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedHistory.map(item => (
                    <tr key={`${item.type}-${item.id}`} className="theme-table-row hover:bg-[var(--accent-light)] transition-colors group">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedHistoryRows.has(item.id)}
                          onChange={() => handleSelectHistoryRow(item.id)}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-[var(--text-primary)]">{item.displayId}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          item.type === 'CARGO' ? 'bg-[var(--accent-light)] text-[var(--accent)]' : 'bg-purple-500/10 text-purple-600'
                        }`}>{item.type}</span>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-[13px] text-[var(--text-primary)]">{item.clientProduct} {item.origin !== 'Sales Order Portal' && <span className="text-[10px] text-[var(--text-muted)] font-normal font-sans">({item.origin})</span>}</td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-[13px] text-emerald-600">{item.amount}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${statusBadge(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-3.5 px-3 text-[var(--text-muted)] font-mono text-[10px] whitespace-nowrap">{item.date}</td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveHistoryMenu(activeHistoryMenu === item.id ? null : item.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] transition-colors select-none border border-[var(--border)]"
                        >
                          ···
                        </button>
                        {activeHistoryMenu === item.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleEditHistory(item.originalItem, item.type === 'CARGO')} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">✏ Edit Item</button>
                            <button onClick={() => handleDuplicateHistory(item.originalItem, item.type === 'CARGO')} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">📋 Duplicate</button>
                            <button onClick={() => handleShareHistory(item.originalItem, item.type === 'CARGO')} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">🔗 Share Link</button>
                            <div className="h-px bg-[var(--border)] my-1"></div>
                            <button onClick={() => handleDeleteHistory(item.id, item.type === 'CARGO')} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-left">🗑 Delete Log</button>
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
              <p className="text-xs text-[var(--text-muted)] font-mono">Showing {combinedHistory.length} history entries</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
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
