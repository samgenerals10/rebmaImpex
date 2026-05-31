// rebma-web/src/views/OperationsDashboard.tsx

import { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Layers, 
  Truck, 
  AlertTriangle, 
  CheckCircle,
  Image as ImageIcon,
  History,
  PackageCheck,
  TicketCheck
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Order, IncomingGoods } from '../types/erp';
import { exportToCSV, exportToPDF } from '../utils/export';

interface OperationsDashboardProps {
  ordersList: Order[];
  incomingGoodsList: IncomingGoods[];
  onLogIntake: (data: Omit<IncomingGoods, 'id' | 'status'>) => void;
  onReleaseToDispatch: (id: string) => void;
  activeSubTab: string;
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

export default function OperationsDashboard({
  ordersList,
  incomingGoodsList,
  onLogIntake,
  onReleaseToDispatch,
  activeSubTab = 'PortIngestion',
  addNotification
}: OperationsDashboardProps) {

  // Local state copies of lists to support edit, delete, duplicate actions locally
  const [localOrders, setLocalOrders] = useState<Order[]>(ordersList);
  const [localCargo, setLocalCargo] = useState<IncomingGoods[]>(incomingGoodsList);

  const [imagePreview, setImagePreview] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [goodsCode, setGoodsCode] = useState('');
  const [destination, setDestination] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table interactive states: Approved Orders
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('ALL');
  const [isOrdersFilterOpen, setIsOrdersFilterOpen] = useState(false);
  const [selectedOrdersRows, setSelectedOrdersRows] = useState<Set<string>>(new Set());
  const [activeOrdersMenu, setActiveOrdersMenu] = useState<string | null>(null);

  // Table interactive states: Logged Cargo Intake
  const [cargoSearch, setCargoSearch] = useState('');
  const [cargoStatusFilter, setCargoStatusFilter] = useState('ALL');
  const [isCargoFilterOpen, setIsCargoFilterOpen] = useState(false);
  const [selectedCargoRows, setSelectedCargoRows] = useState<Set<string>>(new Set());
  const [activeCargoMenu, setActiveCargoMenu] = useState<string | null>(null);

  // Table interactive states: Operations Activity History
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<Set<string>>(new Set());
  const [activeHistoryMenu, setActiveHistoryMenu] = useState<string | null>(null);

  // Sorting states for Orders
  const [ordersSortField, setOrdersSortField] = useState<string>('');
  const [ordersSortDir, setOrdersSortDir] = useState<'asc' | 'desc'>('asc');

  // Sorting states for Cargo
  const [cargoSortField, setCargoSortField] = useState<string>('');
  const [cargoSortDir, setCargoSortDir] = useState<'asc' | 'desc'>('asc');

  // Sorting states for History
  const [historySortField, setHistorySortField] = useState<string>('');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('asc');

  // Sync props to local states
  useEffect(() => {
    setLocalOrders(ordersList);
  }, [ordersList]);

  useEffect(() => {
    setLocalCargo(incomingGoodsList);
  }, [incomingGoodsList]);

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveOrdersMenu(null);
      setActiveCargoMenu(null);
      setActiveHistoryMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const lineChartData = [
    { name: 'Mon', Ingested: 120, Released: 90 },
    { name: 'Tue', Ingested: 240, Released: 150 },
    { name: 'Wed', Ingested: 180, Released: 160 },
    { name: 'Thu', Ingested: 300, Released: 220 },
    { name: 'Fri', Ingested: 210, Released: 180 },
  ];

  const totalTons = localCargo.reduce((acc, item) => acc + item.weight, 0);
  const pendingReleaseCount = localOrders.filter(o => o.status === 'PROCESSING').length;
  const pendingMgmtApprovalCount = localCargo.filter(item => item.status === 'PENDING_MANAGEMENT_APPROVAL').length;
  const discrepancyCount = localCargo.filter(item => item.discrepancies !== 'None' && item.discrepancies !== '').length;

  const approvedOrders = localOrders.filter(o => ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status));
  const approvedGoods = localCargo.filter(i => i.status === 'APPROVED');

  const stats = [
    { title: 'Total Cargo Weight', value: `${totalTons.toFixed(1)} Tons`, sub: 'Accumulated cargo intake', icon: Layers, color: 'text-blue-500' },
    { title: 'Awaiting Release', value: `${pendingReleaseCount} Shipments`, sub: 'Queue ready to load', icon: Truck, color: 'text-emerald-500' },
    { title: 'Awaiting Pricing', value: `${pendingMgmtApprovalCount} Batches`, sub: 'Pending manager approval', icon: CheckCircle, color: 'text-amber-500' },
    { title: 'Discrepancy Notes', value: `${discrepancyCount} Flagged`, sub: 'Faults or damaged boxes', icon: AlertTriangle, color: 'text-rose-500' }
  ];

  const handleExportReleasesCSV = () => {
    const processingOrders = localOrders.filter(o => o.status === 'PROCESSING');
    exportToCSV(processingOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status'], 'operations_release_queue');
  };
  const handleExportReleasesPDF = () => {
    const processingOrders = localOrders.filter(o => o.status === 'PROCESSING');
    exportToPDF('Warehouse Fulfillment Releases Queue', processingOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status']);
  };
  const handleExportCargoCSV = () => {
    exportToCSV(localCargo, ['id', 'goodsCode', 'productName', 'country', 'company', 'quantity', 'weight', 'destination', 'discrepancies', 'status', 'unitPrice', 'createdAt'], 'logged_cargo_records');
  };
  const handleExportCargoPDF = () => {
    exportToPDF('Logged Port Ingested Cargo', localCargo, ['id', 'goodsCode', 'productName', 'country', 'company', 'quantity', 'weight', 'destination', 'discrepancies', 'status', 'unitPrice', 'createdAt']);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const autoGoodsCode = () => `GC-${Date.now().toString().slice(-6)}`;

  const handleSubmitIntake = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    onLogIntake({
      productName: productName || 'Unspecified Product',
      productImage: imagePreview || undefined,
      goodsCode: goodsCode || autoGoodsCode(),
      destination: destination || 'Accra Warehouse',
      country: target.country.value,
      company: target.company.value,
      quantity: parseInt(target.quantity.value),
      weight: parseFloat(target.weight.value),
      discrepancies: target.discrepancies.value || 'None',
      createdAt: new Date().toLocaleString()
    });
    setImagePreview('');
    setProductName('');
    setGoodsCode('');
    setDestination('');
    (e.target as HTMLFormElement).reset();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'APPROVED': 'bg-emerald-500/10 text-emerald-400',
      'REJECTED': 'bg-rose-500/10 text-rose-400',
      'PENDING_MANAGEMENT_APPROVAL': 'bg-amber-500/10 text-amber-400',
      'PROCESSING': 'bg-indigo-500/10 text-indigo-400',
      'DELIVERED': 'bg-emerald-500/10 text-emerald-400',
      'OUT_FOR_DELIVERY': 'bg-blue-500/10 text-blue-400',
    };
    return map[status] || 'bg-slate-500/10 text-slate-400';
  };

  // Row Action Handlers
  const handleEditOrder = (order: Order) => {
    const newClient = prompt('Edit client name:', order.clientName);
    if (!newClient) return;
    const newDest = prompt('Edit destination:', order.destination || '');
    setLocalOrders(prev => prev.map(o => o.id === order.id ? { ...o, clientName: newClient, destination: newDest || undefined } : o));
    addNotification(`Updated order ${order.id}`);
  };

  const handleDuplicateOrder = (order: Order) => {
    const duplicated: Order = {
      ...order,
      id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
      ticketNumber: `TKT-${Math.floor(10000 + Math.random() * 90000)}`,
      createdAt: new Date().toLocaleString()
    };
    setLocalOrders(prev => [duplicated, ...prev]);
    addNotification(`Duplicated order ${order.id} as ${duplicated.id}`);
  };

  const handleShareOrder = (order: Order) => {
    const shareText = `Rebma Sales Order: ${order.id} - Ticket: ${order.ticketNumber} - Client: ${order.clientName} - Amt: GHS ${order.totalAmount}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied link details for order ${order.id} to clipboard!`);
    }).catch(() => alert(shareText));
  };

  const handleDeleteOrder = (id: string) => {
    if (!confirm(`Delete order entry ${id}?`)) return;
    setLocalOrders(prev => prev.filter(o => o.id !== id));
    addNotification(`Deleted order entry ${id}`);
  };

  const handleEditCargo = (cargo: IncomingGoods) => {
    const newName = prompt('Edit product name:', cargo.productName);
    if (!newName) return;
    const newCarrier = prompt('Edit shipping carrier:', cargo.company);
    if (!newCarrier) return;
    setLocalCargo(prev => prev.map(c => c.id === cargo.id ? { ...c, productName: newName, company: newCarrier } : c));
    addNotification(`Updated cargo intake details for CARGO-${cargo.id}`);
  };

  const handleDuplicateCargo = (cargo: IncomingGoods) => {
    const duplicated: IncomingGoods = {
      ...cargo,
      id: `${Math.floor(100 + Math.random() * 900)}`,
      goodsCode: `GC-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: new Date().toLocaleString()
    };
    setLocalCargo(prev => [duplicated, ...prev]);
    addNotification(`Duplicated cargo record CARGO-${cargo.id}`);
  };

  const handleShareCargo = (cargo: IncomingGoods) => {
    const shareText = `Rebma Cargo Record: GC-${cargo.goodsCode} - ${cargo.productName} - Qty: ${cargo.quantity} - Origin: ${cargo.country}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied cargo link details to clipboard!`);
    }).catch(() => alert(shareText));
  };

  const handleDeleteCargo = (id: string) => {
    if (!confirm(`Delete cargo intake record CARGO-${id}?`)) return;
    setLocalCargo(prev => prev.filter(c => c.id !== id));
    addNotification(`Deleted cargo record ${id}`);
  };

  // Row selection checkboxes
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

  const handleSelectAllCargo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCargoRows(new Set(filteredCargo.map(c => c.id)));
    } else {
      setSelectedCargoRows(new Set());
    }
  };

  const handleSelectCargoRow = (id: string) => {
    const updated = new Set(selectedCargoRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedCargoRows(updated);
  };

  const handleSelectAllHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedHistoryRows(new Set(filteredHistory.map(h => h.id)));
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
  const filteredOrders = approvedOrders.filter(o => {
    const matchesSearch = o.clientName.toLowerCase().includes(ordersSearch.toLowerCase()) ||
                          o.id.toLowerCase().includes(ordersSearch.toLowerCase()) ||
                          (o.ticketNumber && o.ticketNumber.toLowerCase().includes(ordersSearch.toLowerCase()));
    const matchesStatus = ordersStatusFilter === 'ALL' || o.status === ordersStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCargo = localCargo.filter(c => {
    const matchesSearch = (c.productName || '').toLowerCase().includes(cargoSearch.toLowerCase()) ||
                          c.company.toLowerCase().includes(cargoSearch.toLowerCase()) ||
                          c.id.toLowerCase().includes(cargoSearch.toLowerCase());
    const matchesStatus = cargoStatusFilter === 'ALL' || c.status === cargoStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredHistory = localCargo.filter(h => {
    const matchesSearch = (h.productName || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                          (h.goodsCode && h.goodsCode.toLowerCase().includes(historySearch.toLowerCase()));
    const matchesStatus = historyStatusFilter === 'ALL' || h.status === historyStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (!ordersSortField) return 0;
    const aVal = a[ordersSortField as keyof Order];
    const bVal = b[ordersSortField as keyof Order];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return ordersSortDir === 'asc' ? comp : -comp;
  });

  const sortedCargo = [...filteredCargo].sort((a, b) => {
    if (!cargoSortField) return 0;
    const aVal = a[cargoSortField as keyof IncomingGoods];
    const bVal = b[cargoSortField as keyof IncomingGoods];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return cargoSortDir === 'asc' ? comp : -comp;
  });

  const sortedHistory = !historySortField ? [...filteredHistory].reverse() : [...filteredHistory].sort((a, b) => {
    if (!historySortField) return 0;
    const aVal = a[historySortField as keyof IncomingGoods];
    const bVal = b[historySortField as keyof IncomingGoods];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return historySortDir === 'asc' ? comp : -comp;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operations Control Terminal</h1>
          <p className="text-sm text-muted">Register port inventory intakes, monitor logged cargo, and process warehouse releases.</p>
        </div>
        <div className="flex gap-2">
          {activeSubTab === 'LoggedCargo' ? (
            <>
              <button onClick={handleExportCargoCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Cargo (CSV)</span>
              </button>
              <button onClick={handleExportCargoPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
                <FileText className="w-3.5 h-3.5" /><span>Cargo (PDF)</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={handleExportReleasesCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Releases (CSV)</span>
              </button>
              <button onClick={handleExportReleasesPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
                <FileText className="w-3.5 h-3.5" /><span>Releases (PDF)</span>
              </button>
            </>
          )}
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
              <div className={`p-4 bg-slate-100 rounded-2xl ${card.color} bg-accent-light`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-6 app-card">
        <div>
          <h3 className="text-lg font-bold">Cargo Inflow vs Release Velocity</h3>
          <p className="text-xs text-muted">Ingestion tonnage vs cargo shipments cleared weekly.</p>
        </div>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="Ingested" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Released" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Approved Orders Section — always visible */}
      {approvedOrders.length > 0 && (
        <div className="theme-table-wrapper">
          {/* Toolbar */}
          <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <TicketCheck className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-bold">Approved Orders (with Ticket Numbers)</h3>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredOrders.length} orders</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
                <input
                  type="text"
                  placeholder="Search orders…"
                  value={ordersSearch}
                  onChange={e => setOrdersSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-40"
                />
              </div>
              {/* Status dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsOrdersFilterOpen(!isOrdersFilterOpen); }}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom"
                >
                  <span>Status: {ordersStatusFilter === 'ALL' ? 'All' : ordersStatusFilter.replace(/_/g, ' ')}</span>
                  <span className="text-[10px]">▼</span>
                </button>
                {isOrdersFilterOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                    {(['ALL', 'PROCESSING', 'APPROVED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => { setOrdersStatusFilter(st); setIsOrdersFilterOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                      >
                        <span className={`w-2 h-2 rounded-full ${st === 'APPROVED' || st === 'DELIVERED' ? 'bg-emerald-400' : st === 'PROCESSING' ? 'bg-indigo-400' : 'bg-slate-400'}`} />
                        {st === 'ALL' ? 'All Status' : st.replace(/_/g, ' ')}
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
                  <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-custom">
                {sortedOrders.map(order => (
                  <tr key={order.id} className="theme-table-row group">
                    <td className="py-3.5 px-5">
                      <input
                        type="checkbox"
                        checked={selectedOrdersRows.has(order.id)}
                        onChange={() => handleSelectOrdersRow(order.id)}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-emerald-400">{order.ticketNumber || '—'}</td>
                    <td className="py-3.5 px-3 font-mono font-semibold">{order.id}</td>
                    <td className="py-3.5 px-3 font-semibold text-[13px]">{order.clientName}</td>
                    <td className="py-3.5 px-3 text-slate-400">{order.productName || '—'}</td>
                    <td className="py-3.5 px-3 text-slate-400">{order.destination || '—'}</td>
                    <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px]">GHS {order.totalAmount.toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${statusBadge(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveOrdersMenu(activeOrdersMenu === order.id ? null : order.id)}
                        className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                      >
                        ···
                      </button>
                      {activeOrdersMenu === order.id && (
                        <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                          <button onClick={() => handleEditOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">✏ Edit Details</button>
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

          {/* Footer */}
          <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
            <p className="text-xs text-slate-400 font-mono">Showing {filteredOrders.length} of {approvedOrders.length} shipments</p>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
              <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
              <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
            </div>
          </div>
        </div>
      )}

      {/* Approved Goods Section — always visible */}
      {approvedGoods.length > 0 && (
        <div className="p-6 app-card space-y-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold">Approved Incoming Goods</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedGoods.map(item => (
              <div key={item.id} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                {item.productImage && (
                  <img src={item.productImage} alt={item.productName} className="w-full h-24 object-cover rounded-lg" />
                )}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold">{item.productName || 'Unnamed Product'}</p>
                    <p className="text-[10px] text-slate-400">Code: <code>{item.goodsCode || item.id}</code></p>
                  </div>
                  <span className="px-2 py-0.5 rounded font-bold text-[9px] bg-emerald-500/10 text-emerald-400">APPROVED</span>
                </div>
                <p className="text-[10px] text-slate-400">From: <strong>{item.country}</strong> via {item.company}</p>
                <p className="text-[10px] text-slate-400">Destination: <strong>{item.destination || 'Accra Warehouse'}</strong></p>
                <p className="text-[10px] text-slate-400">Qty: <strong>{item.quantity}</strong> | Weight: <strong>{item.weight}T</strong> | Unit: <strong>GHS {item.unitPrice || '—'}</strong></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab-based views */}
      <div className="border-t border-custom pt-6">

        {/* PORT INGESTION FORM */}
        {activeSubTab === 'PortIngestion' && (
          <div className="p-6 app-card space-y-4 max-w-3xl">
            <h3 className="text-lg font-bold">Workflow A: Log Incoming Port Cargo</h3>
            <form onSubmit={handleSubmitIntake} className="space-y-4">
              {/* Product Name & Goods Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product / Goods Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    required
                    placeholder="E.g., Palm Oil Barrels"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Goods Code <span className="text-slate-400 font-normal">(auto-generated if empty)</span></label>
                  <input
                    type="text"
                    value={goodsCode}
                    onChange={e => setGoodsCode(e.target.value)}
                    placeholder={`E.g., ${autoGoodsCode()}`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product Image <span className="text-slate-400 font-normal">(optional)</span></label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-350 hover:border-blue-400 rounded-xl text-xs text-slate-400 hover:text-blue-500 cursor-pointer transition-all"
                  >
                    <ImageIcon className="w-4 h-4" />
                    {imagePreview ? 'Change Image' : 'Upload Product Image'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {imagePreview && (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-custom" />
                      <button type="button" onClick={() => setImagePreview('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Delivery Destination <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  required
                  placeholder="E.g., Accra Main Warehouse, Tema Port Depot"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Country & Company */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Country of Origin <span className="text-rose-500">*</span></label>
                  <input type="text" name="country" required placeholder="E.g., Germany" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Shipping Company <span className="text-rose-500">*</span></label>
                  <input type="text" name="company" required placeholder="E.g., COSCO, Maersk" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Quantity & Weight */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Total Quantity <span className="text-rose-500">*</span></label>
                  <input type="number" name="quantity" required placeholder="E.g., 350" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Weight (Metric Tons) <span className="text-rose-500">*</span></label>
                  <input type="number" step="0.1" name="weight" required placeholder="E.g., 12.5" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Date/Time auto-display */}
              <div className="p-3 bg-blue-500/10 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span><strong>Date & Time</strong> will be auto-generated on submission: <strong>{new Date().toLocaleString()}</strong></span>
              </div>

              {/* Discrepancy Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Discrepancy Notes / Faults</label>
                <input type="text" name="discrepancies" placeholder="Optional: E.g., 2 boxes damaged, missing tags" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
              </div>

              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all">
                Submit Cargo Logs
              </button>
            </form>
          </div>
        )}

        {/* FULFILLMENT RELEASES */}
        {activeSubTab === 'Releases' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Fulfillment Releasing Queue</h3>
            <div className="divide-y divide-custom">
              {localOrders.filter(o => o.status === 'PROCESSING').map(order => (
                <div key={order.id} className="py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold">Order: {order.id}</p>
                      {order.ticketNumber && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Client: <strong>{order.clientName}</strong> | Product: <strong>{order.productName || 'N/A'}</strong></p>
                    <p className="text-[10px] text-slate-400">Destination: <strong>{order.destination || '—'}</strong> | Value: <strong>GHS {order.totalAmount.toLocaleString()}</strong></p>
                    <p className="text-[10px] text-emerald-400 font-semibold mt-1">Invoice Generated. Release Authorized.</p>
                  </div>
                  <div>
                    <button
                      onClick={() => onReleaseToDispatch(order.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow"
                    >
                      Release & Load Truck
                    </button>
                  </div>
                </div>
              ))}
              {localOrders.filter(o => o.status === 'PROCESSING').length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No orders pending release from warehouse floor.</p>
              )}
            </div>
          </div>
        )}

        {/* INTAKE RECORDS LOG */}
        {activeSubTab === 'LoggedCargo' && (
          <div className="theme-table-wrapper">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Operations Intake Logging Records</h3>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredCargo.length} records</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search cargo…"
                    value={cargoSearch}
                    onChange={e => setCargoSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-40"
                  />
                </div>
                {/* Status dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsCargoFilterOpen(!isCargoFilterOpen); }}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom"
                  >
                    <span>Status: {cargoStatusFilter === 'ALL' ? 'All' : cargoStatusFilter.replace(/_/g, ' ')}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isCargoFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'PENDING_MANAGEMENT_APPROVAL', 'APPROVED', 'REJECTED'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setCargoStatusFilter(st); setIsCargoFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'APPROVED' ? 'bg-emerald-400' : st === 'REJECTED' ? 'bg-rose-450' : 'bg-amber-400'}`} />
                          {st === 'ALL' ? 'All Status' : st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="theme-table-header-row text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredCargo.length > 0 && selectedCargoRows.size === filteredCargo.length}
                        onChange={handleSelectAllCargo}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                    </th>
                    <th className="py-3 px-2 whitespace-nowrap">Image</th>
                    <th onClick={() => handleSort('id', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Cargo ID / Code</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'id' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('productName', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Product</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'productName' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('createdAt', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Timestamp</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'createdAt' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('country', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Origin</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'country' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('company', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Carrier</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'company' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('destination', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Destination</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'destination' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('quantity', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 text-right whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center justify-end gap-1">
                        <span>Qty</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'quantity' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('weight', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 text-right whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center justify-end gap-1">
                        <span>Weight</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'weight' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('discrepancies', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Discrepancies</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'discrepancies' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('status', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'status' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-custom">
                  {sortedCargo.map(item => (
                    <tr key={item.id} className="theme-table-row group">
                      <td className="py-3 px-5">
                        <input
                          type="checkbox"
                          checked={selectedCargoRows.has(item.id)}
                          onChange={() => handleSelectCargoRow(item.id)}
                          className="accent-blue-600 w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3 px-2">
                        {item.productImage ? (
                          <img src={item.productImage} alt={item.productName} className="w-10 h-10 object-cover rounded-lg border border-custom" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100/10 rounded-lg flex items-center justify-center border border-custom">
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <p className="font-mono font-bold">CARGO-{item.id}</p>
                        {item.goodsCode && <p className="text-[9px] text-slate-400">{item.goodsCode}</p>}
                      </td>
                      <td className="py-3 px-2 font-medium text-[13px]">{item.productName || '—'}</td>
                      <td className="py-3 px-2 text-slate-400 font-mono text-[10px] whitespace-nowrap">{item.createdAt || 'N/A'}</td>
                      <td className="py-3 px-2 font-semibold text-[13px]">{item.country}</td>
                      <td className="py-3 px-2 text-slate-400">{item.company}</td>
                      <td className="py-3 px-2 text-slate-400">{item.destination || '—'}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-[13px]">{item.quantity} u.</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-[13px]">{item.weight}T</td>
                      <td className="py-3 px-2 text-rose-500 font-semibold">{item.discrepancies}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2.5 py-0.5 rounded font-bold text-[9px] ${statusBadge(item.status)}`}>
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveCargoMenu(activeCargoMenu === item.id ? null : item.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                        >
                          ···
                        </button>
                        {activeCargoMenu === item.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleEditCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">✏ Edit Ingest</button>
                            <button onClick={() => handleDuplicateCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate</button>
                            <button onClick={() => handleShareCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                            <button onClick={() => handleDeleteCargo(item.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredCargo.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-6 text-center text-slate-400">No cargo intake logs found matching criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
              <p className="text-xs text-slate-400 font-mono">Showing {filteredCargo.length} of {localCargo.length} records</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeSubTab === 'OpsHistory' && (
          <div className="theme-table-wrapper">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold">Operations Activity History</h3>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredHistory.length} logs</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search history…"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-40"
                  />
                </div>
                {/* Status dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsHistoryFilterOpen(!isHistoryFilterOpen); }}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom"
                  >
                    <span>Status: {historyStatusFilter === 'ALL' ? 'All' : historyStatusFilter.replace(/_/g, ' ')}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isHistoryFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'PENDING_MANAGEMENT_APPROVAL', 'APPROVED', 'REJECTED'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setHistoryStatusFilter(st); setIsHistoryFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'APPROVED' ? 'bg-emerald-400' : st === 'REJECTED' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                          {st === 'ALL' ? 'All History' : st.replace(/_/g, ' ')}
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
                        checked={filteredHistory.length > 0 && selectedHistoryRows.size === filteredHistory.length}
                        onChange={handleSelectAllHistory}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('goodsCode', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Goods Code</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'goodsCode' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('productName', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Product</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'productName' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('country', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Origin</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'country' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('destination', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Destination</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'destination' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('createdAt', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Logged At</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'createdAt' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('status', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'status' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('unitPrice', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none">
                      <div className="flex items-center justify-end gap-1">
                        <span>Unit Price</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'unitPrice' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-custom">
                  {sortedHistory.map(item => (
                    <tr key={item.id} className="theme-table-row group">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedHistoryRows.has(item.id)}
                          onChange={() => handleSelectHistoryRow(item.id)}
                          className="accent-blue-600 w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold">{item.goodsCode || `CARGO-${item.id}`}</td>
                      <td className="py-3.5 px-3 font-medium text-[13px]">{item.productName || '—'}</td>
                      <td className="py-3.5 px-3 text-slate-400">{item.country} / {item.company}</td>
                      <td className="py-3.5 px-3 text-slate-400">{item.destination || '—'}</td>
                      <td className="py-3.5 px-3 text-slate-400 font-mono text-[10px]">{item.createdAt || 'N/A'}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${statusBadge(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-[13px]">{item.unitPrice ? `GHS ${item.unitPrice}` : '—'}</td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveHistoryMenu(activeHistoryMenu === item.id ? null : item.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                        >
                          ···
                        </button>
                        {activeHistoryMenu === item.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleDuplicateCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate Log</button>
                            <button onClick={() => handleShareCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                            <button onClick={() => handleDeleteCargo(item.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete Log</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
              <p className="text-xs text-slate-400 font-mono">Showing {filteredHistory.length} of {localCargo.length} logs</p>
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
