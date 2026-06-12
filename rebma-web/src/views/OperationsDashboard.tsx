// rebma-web/src/views/OperationsDashboard.tsx

import { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet, FileText, Layers, Truck, AlertTriangle, CheckCircle,
  Image as ImageIcon, History, PackageCheck, TicketCheck, ChevronRight,
  MoreVertical, TrendingUp, TrendingDown
} from 'lucide-react';
import MiniSparkline from '../components/MiniSparkline';
import KpiDetailView from '../components/KpiDetailView';
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
  const [kpiDetail, setKpiDetail] = useState<number | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);
  const [localOrders, setLocalOrders] = useState<Order[]>(ordersList);
  const [localCargo, setLocalCargo] = useState<IncomingGoods[]>(incomingGoodsList);
  const [activeMobileDetail, setActiveMobileDetail] = useState<{
    type: 'order' | 'cargo';
    data: Order | IncomingGoods;
  } | null>(null);

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

  const kpiDetails = [
    { title: 'Total Cargo Weight', metric: 'Tons', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Steel',value:120}, {name:'Cement',value:85}, {name:'Other',value:45}], tableData: [{ref:'ING-01', product:'Steel Rods', weight:'25t', status:'Cleared'}, {ref:'ING-02', product:'Cement', weight:'18t', status:'Pending'}], columns: [{key:'ref',label:'Ref'}, {key:'product',label:'Product'}, {key:'weight',label:'Weight'}, {key:'status',label:'Status'}] },
    { title: 'Awaiting Release', metric: 'Items', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Ready',value:14}, {name:'Pending',value:7}, {name:'Held',value:3}], tableData: [{id:'STK-01', item:'Shea Butter', qty:200, status:'Pending Release'}, {id:'STK-02', item:'Palm Oil', qty:150, status:'Ready'}], columns: [{key:'id',label:'ID'}, {key:'item',label:'Item'}, {key:'qty',label:'Qty'}, {key:'status',label:'Status'}] },
    { title: 'Awaiting Pricing', metric: 'Items', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Priced',value:22}, {name:'Unpriced',value:9}, {name:'Reviewed',value:5}], tableData: [{code:'GDS-01', name:'Groundnut Oil', unit:'50L'}, {code:'GDS-02', name:'Cocoa Butter', unit:'25kg'}], columns: [{key:'code',label:'Code'}, {key:'name',label:'Product'}, {key:'unit',label:'Unit'}] },
    { title: 'Discrepancy Notes', metric: 'Flags', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Resolved',value:18}, {name:'Open',value:4}, {name:'Escalated',value:2}], tableData: [{id:'DIS-01', item:'Steel Rods', issue:'Short weight', status:'Open'}, {id:'DIS-02', item:'PVC Pipes', issue:'Damaged batch', status:'Resolved'}], columns: [{key:'id',label:'ID'}, {key:'item',label:'Item'}, {key:'issue',label:'Issue'}, {key:'status',label:'Status'}] }
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
    return map[status] || 'bg-slate-500/10 text-text-muted';
  };

  // Row Action Handlers
  const handleEditOrder = async (order: Order) => {
    const newClient = await prompt('Edit client name:', order.clientName);
    if (!newClient) return;
    const newDest = await prompt('Edit destination:', order.destination || '');
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

  const handleDeleteOrder = async (id: string) => {
    if (!await confirm(`Delete order entry ${id}?`)) return;
    setLocalOrders(prev => prev.filter(o => o.id !== id));
    addNotification(`Deleted order entry ${id}`);
  };

  const handleEditCargo = async (cargo: IncomingGoods) => {
    const newName = await prompt('Edit product name:', cargo.productName);
    if (!newName) return;
    const newCarrier = await prompt('Edit shipping carrier:', cargo.company);
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

  const handleDeleteCargo = async (id: string) => {
    if (!await confirm(`Delete cargo intake record CARGO-${id}?`)) return;
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

        {activeMobileDetail.type === 'order' ? (() => {
          const order = activeMobileDetail.data as Order;
          return (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-bg-card dark:bg-slate-850 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
                  {order.clientName[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary dark:text-slate-200">{order.clientName}</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{order.id}</p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-[9px] font-bold uppercase tracking-wider">{order.productName || 'Unnamed Product'}</span>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Ticket Number</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200 font-mono">{order.ticketNumber || '—'}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Destination</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{order.destination || '—'}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Amount</span>
                  <span className="font-semibold font-mono text-text-primary dark:text-slate-200">GHS {order.totalAmount.toLocaleString()}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Status</span>
                  <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${statusBadge(order.status)}`}>{order.status.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { handleEditOrder(order); setActiveMobileDetail(null); }}
                  className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-700 cursor-pointer text-text-primary dark:text-slate-200"
                >
                  Edit Details
                </button>
                {order.status === 'PROCESSING' && (
                  <button 
                    onClick={() => { onReleaseToDispatch(order.id); setActiveMobileDetail(null); }}
                    className="py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold text-white text-center cursor-pointer shadow"
                  >
                    Release & Load
                  </button>
                )}
              </div>
            </div>
          );
        })() : (() => {
          const cargo = activeMobileDetail.data as IncomingGoods;
          return (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                {cargo.productImage ? (
                  <img src={cargo.productImage} alt={cargo.productName} className="w-16 h-16 object-cover rounded-full border border-custom shadow-card" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex items-center justify-center font-bold text-xl">
                    {cargo.productName ? cargo.productName[0] : 'C'}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-text-primary dark:text-slate-200">{cargo.productName || 'Unnamed Cargo'}</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">CARGO-{cargo.id}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Goods Code</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200 font-mono">{cargo.goodsCode || '—'}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Country of Origin</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{cargo.country}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Carrier (Company)</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{cargo.company}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Quantity</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{cargo.quantity} units</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Weight</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200 font-mono">{cargo.weight}T</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Discrepancies</span>
                  <span className="font-semibold text-rose-500">{cargo.discrepancies}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Destination</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{cargo.destination || '—'}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Status</span>
                  <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${statusBadge(cargo.status)}`}>{cargo.status.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { handleEditCargo(cargo); setActiveMobileDetail(null); }}
                  className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-700 cursor-pointer text-text-primary dark:text-slate-200"
                >
                  Edit Ingest
                </button>
                <button 
                  onClick={() => { handleDeleteCargo(cargo.id); setActiveMobileDetail(null); }}
                  className="py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
                >
                  Delete Cargo
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }


  if (kpiDetail !== null) {
    const d = kpiDetails[kpiDetail];
    return <KpiDetailView title={d.title} metric={d.metric} trendData={d.trendData} breakdownData={d.breakdownData} tableData={d.tableData} columns={d.columns} onBack={() => setKpiDetail(null)} />;
  }
  return (
    <>
      {/* ══ MOBILE LAYOUT (< lg) ══ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Operations</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Port intakes & release queue</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(localCargo, ['id', 'productName', 'weight', 'status'], 'operations_cargo')} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card" title="Export CSV">
              <FileSpreadsheet className="w-4 h-4 text-text-secondary" />
            </button>
            <button onClick={() => exportToPDF('Operations Report', localCargo, ['id', 'productName', 'weight', 'status'])} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card" title="Export PDF">
              <FileText className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Physical Gradient Card */}
        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Total Ingested Weight</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{totalTons.toFixed(1)} Tons</h2>
              <p className="text-[10px] text-white/70 mt-1">{localCargo.length} Batches Logged</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">•••• •••• •••• 9811</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">Port Intakes & Releases</p>
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
            { label: 'Awaiting Release', value: `${pendingReleaseCount}`, sub: 'Shipments ready', bg: '#eff6ff', color: '#3b82f6', icon: Truck },
            { label: 'Pricing Pending', value: `${pendingMgmtApprovalCount}`, sub: 'Batches pending', bg: '#fef3c7', color: '#d97706', icon: CheckCircle },
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

        {/* Logged Cargo Section */}
        <div>
          <p className="mobile-section-label">Logged Cargo Intake</p>
          <div className="space-y-2">
            {localCargo.slice(0, 5).map(c => (
              <div key={c.id} onClick={() => setActiveMobileDetail({ type: 'cargo', data: c })} className="mobile-data-row cursor-pointer">
                <div className="mobile-data-row-icon bg-bg-page text-text-secondary">
                  <Layers className="w-5 h-5 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{c.productName}</p>
                  <p className="text-[10px] text-text-muted truncate">{c.company} • {c.weight}T • {c.country}</p>
                </div>
                <span className={`mobile-status-pill ${
                  c.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                  c.status === 'PENDING_MANAGEMENT_APPROVAL' ? 'bg-amber-50 text-amber-700' :
                  'bg-bg-input text-text-secondary'
                }`}>{c.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Approved Orders List */}
        <div>
          <p className="mobile-section-label">Awaiting Release / Loading</p>
          <div className="space-y-2">
            {approvedOrders.slice(0, 5).map(o => (
              <div key={o.id} onClick={() => setActiveMobileDetail({ type: 'order', data: o })} className="mobile-data-row cursor-pointer">
                <div className="mobile-data-row-icon bg-blue-50 text-blue-600">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{o.clientName}</p>
                  <p className="text-[10px] text-text-muted truncate">{o.productName} • GHS {o.totalAmount.toLocaleString()}</p>
                </div>
                <span className={`mobile-status-pill ${
                  o.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700' :
                  o.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' :
                  'bg-bg-input text-text-secondary'
                }`}>{o.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ DESKTOP LAYOUT (lg+) ══ */}
      <div className="hidden lg:block">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Operations Control Terminal</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">Register port inventory intakes, monitor logged cargo, and process warehouse releases.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          {activeSubTab === 'LoggedCargo' ? (
            <>
              <button onClick={handleExportCargoCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Cargo (CSV)</span>
              </button>
              <button onClick={handleExportCargoPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity">
                <FileText className="w-3.5 h-3.5" /><span>Cargo (PDF)</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={handleExportReleasesCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Releases (CSV)</span>
              </button>
              <button onClick={handleExportReleasesPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity">
                <FileText className="w-3.5 h-3.5" /><span>Releases (PDF)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} onClick={() => setKpiDetail(idx)} className="kpi-card group cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold leading-tight">{card.title}</span>
                <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setCardMenuOpen(cardMenuOpen === idx ? null : idx)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded hover:bg-[var(--accent-light)]">
                    <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                  {cardMenuOpen === idx && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                      <button onClick={() => { setKpiDetail(idx); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">View Details</button>
                      <button onClick={() => { const d = kpiDetails[idx]; exportToCSV(d.tableData, d.columns.map(c => c.key), d.title.replace(/\s/g,'_').toLowerCase()); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export CSV</button>
                      <button onClick={() => { const d = kpiDetails[idx]; exportToPDF(d.title, d.tableData, d.columns.map(c => c.label)); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export PDF</button>
                      <button onClick={() => { setCardMenuOpen(null); addNotification(`${stats[idx].title} refreshed.`); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Refresh</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between mt-2 gap-2">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-none">{card.value}</h3>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5">{card.sub}</p>
                </div>
                <MiniSparkline width={60} height={36} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)]">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Cargo Inflow vs Release Velocity</h3>
          <p className="text-xs text-[var(--text-muted)]">Ingestion tonnage vs cargo shipments cleared weekly.</p>
        </div>
        <div className="h-48 md:h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="Ingested" stroke="var(--accent)" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Released" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Approved Orders Section — always visible */}
      {approvedOrders.length > 0 && (
        <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] mt-6">
          {/* Toolbar */}
          <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
            <div className="flex items-center gap-2">
              <TicketCheck className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Approved Orders (with Ticket Numbers)</h3>
              <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">{filteredOrders.length} orders</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex items-center w-full sm:w-auto">
                <span className="absolute left-3 text-[var(--text-muted)] text-xs pointer-events-none">🔍</span>
                <input
                  type="text"
                  placeholder="Search orders…"
                  value={ordersSearch}
                  onChange={e => setOrdersSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border border-[var(--border)] transition w-full sm:w-40 bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--accent)]"
                />
              </div>
              {/* Status dropdown */}
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsOrdersFilterOpen(!isOrdersFilterOpen); }}
                  className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto"
                >
                  <span>Status: {ordersStatusFilter === 'ALL' ? 'All' : ordersStatusFilter.replace(/_/g, ' ')}</span>
                  <span className="text-[10px]">▼</span>
                </button>
                {isOrdersFilterOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col text-left">
                    {(['ALL', 'PROCESSING', 'APPROVED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => { setOrdersStatusFilter(st); setIsOrdersFilterOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                      >
                        <span className={`w-2 h-2 rounded-full ${st === 'APPROVED' || st === 'DELIVERED' ? 'bg-emerald-500' : st === 'PROCESSING' ? 'bg-indigo-500' : 'bg-slate-450'}`} />
                        {st === 'ALL' ? 'All Status' : st.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable table / Mobile Card List */}
          <div>
            {/* Mobile Card List */}
            <div className="lg:hidden space-y-3 p-4">
              {sortedOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => setActiveMobileDetail({ type: 'order', data: order })}
                  className="bg-[var(--bg-card)] rounded-2xl shadow-card p-4 border border-[var(--border)] flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-base shrink-0">
                      {order.clientName[0]}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">{order.clientName}</h4>
                      <p className="text-xs text-[var(--text-secondary)] font-semibold">{order.productName || '—'}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">{order.ticketNumber || order.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusBadge(order.status)}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                </div>
              ))}
              {filteredOrders.length === 0 && (
                <div className="p-8 text-center text-[var(--text-muted)] text-xs bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]">No orders found.</div>
              )}
            </div>

            {/* Desktop Table View */}
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
                  <th onClick={() => handleSort('ticketNumber', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                    <div className="flex items-center gap-1">
                      <span>Ticket #</span>
                      <span className="text-[9px] opacity-70">{ordersSortField === 'ticketNumber' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th onClick={() => handleSort('id', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell text-[var(--text-primary)]">
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
                  <th onClick={() => handleSort('productName', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell text-[var(--text-primary)]">
                    <div className="flex items-center gap-1">
                      <span>Product</span>
                      <span className="text-[9px] opacity-70">{ordersSortField === 'productName' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th onClick={() => handleSort('destination', ordersSortField, setOrdersSortField, ordersSortDir, setOrdersSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden lg:table-cell text-[var(--text-primary)]">
                    <div className="flex items-center gap-1">
                      <span>Destination</span>
                      <span className="text-[9px] opacity-70">{ordersSortField === 'destination' ? (ordersSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
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
                  <th className="py-3 px-5 text-center whitespace-nowrap text-[var(--text-primary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sortedOrders.map(order => (
                  <tr key={order.id} className="theme-table-row hover:bg-[var(--accent-light)] transition-colors group cursor-pointer text-[var(--text-primary)]">
                    <td className="py-3 px-5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedOrdersRows.has(order.id)}
                        onChange={() => handleSelectOrdersRow(order.id)}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-emerald-500">{order.ticketNumber || '—'}</td>
                    <td className="py-3.5 px-3 font-mono font-semibold hidden sm:table-cell text-[var(--text-primary)]">{order.id}</td>
                    <td className="py-3.5 px-3 font-semibold text-[13px]">{order.clientName}</td>
                    <td className="py-3.5 px-3 text-[var(--text-muted)] hidden md:table-cell">{order.productName || '—'}</td>
                    <td className="py-3.5 px-3 text-[var(--text-muted)] hidden lg:table-cell">{order.destination || '—'}</td>
                    <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px] text-[var(--text-primary)]">GHS {order.totalAmount.toLocaleString()}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${statusBadge(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveOrdersMenu(activeOrdersMenu === order.id ? null : order.id)}
                        className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] transition-colors select-none border border-[var(--border)]"
                      >
                        ···
                      </button>
                      {activeOrdersMenu === order.id && (
                        <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col text-left">
                          <button onClick={() => handleEditOrder(order)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">✏ Edit Details</button>
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
        </div>

          {/* Footer */}
          <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
            <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredOrders.length} of {approvedOrders.length} shipments</p>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
              <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
              <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
            </div>
          </div>
        </div>
      )}

      {/* Approved Goods Section — always visible */}
      {approvedGoods.length > 0 && (
        <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-3 mt-6">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Approved Incoming Goods</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedGoods.map(item => (
              <div key={item.id} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2 text-[var(--text-primary)]">
                {item.productImage && (
                  <img src={item.productImage} alt={item.productName} className="w-full h-24 object-cover rounded-lg border border-[var(--border)]" />
                )}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">{item.productName || 'Unnamed Product'}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Code: <code>{item.goodsCode || item.id}</code></p>
                  </div>
                  <span className="px-2 py-0.5 rounded font-bold text-[9px] bg-emerald-500/10 text-emerald-500">APPROVED</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">From: <strong className="text-[var(--text-primary)]">{item.country}</strong> via {item.company}</p>
                <p className="text-[10px] text-[var(--text-muted)]">Destination: <strong className="text-[var(--text-primary)]">{item.destination || 'Accra Warehouse'}</strong></p>
                <p className="text-[10px] text-[var(--text-muted)]">Qty: <strong className="text-[var(--text-primary)]">{item.quantity}</strong> | Weight: <strong className="text-[var(--text-primary)]">{item.weight}T</strong> | Unit: <strong className="text-[var(--text-primary)]">GHS {item.unitPrice || '—'}</strong></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab-based views */}
      <div className="border-t border-[var(--border)] pt-6">

        {/* PORT INGESTION FORM */}
        {activeSubTab === 'PortIngestion' && (
          <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4 max-w-3xl">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Workflow A: Log Incoming Port Cargo</h3>
            <form onSubmit={handleSubmitIntake} className="space-y-4">
              {/* Product Name & Goods Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Product / Goods Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    required
                    placeholder="E.g., Palm Oil Barrels"
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Goods Code <span className="text-[var(--text-muted)] font-normal">(auto-generated if empty)</span></label>
                  <input
                    type="text"
                    value={goodsCode}
                    onChange={e => setGoodsCode(e.target.value)}
                    placeholder={`E.g., ${autoGoodsCode()}`}
                    className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Product Image <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-all"
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
                      <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]" />
                      <button type="button" onClick={() => setImagePreview('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Delivery Destination <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  required
                  placeholder="E.g., Accra Main Warehouse, Tema Port Depot"
                  className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* Country & Company */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Country of Origin <span className="text-rose-500">*</span></label>
                  <input type="text" name="country" required placeholder="E.g., Germany" className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Shipping Company <span className="text-rose-500">*</span></label>
                  <input type="text" name="company" required placeholder="E.g., COSCO, Maersk" className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none" />
                </div>
              </div>

              {/* Quantity & Weight */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Total Quantity <span className="text-rose-500">*</span></label>
                  <input type="number" name="quantity" required placeholder="E.g., 350" className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Weight (Metric Tons) <span className="text-rose-500">*</span></label>
                  <input type="number" step="0.1" name="weight" required placeholder="E.g., 12.5" className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none" />
                </div>
              </div>

              {/* Date/Time auto-display */}
              <div className="p-3 bg-[var(--accent-light)] border border-[var(--border)] rounded-xl text-xs text-[var(--accent)] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-[var(--accent)]" />
                <span><strong>Date & Time</strong> will be auto-generated on submission: <strong>{new Date().toLocaleString()}</strong></span>
              </div>

              {/* Discrepancy Notes */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Discrepancy Notes / Faults</label>
                <input type="text" name="discrepancies" placeholder="Optional: E.g., 2 boxes damaged, missing tags" className="w-full px-3 py-2 bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl text-xs focus:outline-none" />
              </div>

              <button type="submit" className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-opacity">
                Submit Cargo Logs
              </button>
            </form>
          </div>
        )}

        {/* FULFILLMENT RELEASES */}
        {activeSubTab === 'Releases' && (
          <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Fulfillment Releasing Queue</h3>
            <div className="divide-y divide-[var(--border)]">
              {localOrders.filter(o => o.status === 'PROCESSING').map(order => (
                <div key={order.id} className="py-4 flex items-center justify-between">
                  <div className="text-[var(--text-primary)]">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[var(--text-primary)]">Order: {order.id}</p>
                      {order.ticketNumber && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Client: <strong>{order.clientName}</strong> | Product: <strong>{order.productName || 'N/A'}</strong></p>
                    <p className="text-[10px] text-[var(--text-muted)]">Destination: <strong>{order.destination || '—'}</strong> | Value: <strong>GHS {order.totalAmount.toLocaleString()}</strong></p>
                    <p className="text-[10px] text-emerald-500 font-semibold mt-1">Invoice Generated. Release Authorized.</p>
                  </div>
                  <div>
                    <button
                      onClick={() => onReleaseToDispatch(order.id)}
                      className="px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-xs font-bold cursor-pointer transition-opacity shadow"
                    >
                      Release & Load Truck
                    </button>
                  </div>
                </div>
              ))}
              {localOrders.filter(o => o.status === 'PROCESSING').length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">No orders pending release from warehouse floor.</p>
              )}
            </div>
          </div>
        )}

        {/* INTAKE RECORDS LOG */}
        {activeSubTab === 'LoggedCargo' && (
          <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Operations Intake Logging Records</h3>
                <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">{filteredCargo.length} records</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex items-center w-full sm:w-auto">
                  <span className="absolute left-3 text-[var(--text-muted)] text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search cargo…"
                    value={cargoSearch}
                    onChange={e => setCargoSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border border-[var(--border)] transition w-full sm:w-40 bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--accent)]"
                  />
                </div>
                {/* Status dropdown */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsCargoFilterOpen(!isCargoFilterOpen); }}
                    className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto"
                  >
                    <span>Status: {cargoStatusFilter === 'ALL' ? 'All' : cargoStatusFilter.replace(/_/g, ' ')}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isCargoFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col text-left">
                      {(['ALL', 'PENDING_MANAGEMENT_APPROVAL', 'APPROVED', 'REJECTED'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setCargoStatusFilter(st); setIsCargoFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'APPROVED' ? 'bg-emerald-500' : st === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                          {st === 'ALL' ? 'All Status' : st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable table / Mobile Card List */}
            <div>
              {/* Mobile Card List */}
              <div className="lg:hidden space-y-3 p-4">
                {sortedCargo.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => setActiveMobileDetail({ type: 'cargo', data: item })}
                    className="bg-[var(--bg-card)] rounded-2xl shadow-card p-4 border border-[var(--border)] flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-10 h-10 object-cover rounded-lg border border-[var(--border)] shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-base shrink-0">
                          {item.productName ? item.productName[0] : 'C'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">{item.productName || 'Unnamed'}</h4>
                        <p className="text-xs text-[var(--text-secondary)] font-semibold">{item.company}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">CARGO-{item.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusBadge(item.status)}`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </div>
                ))}
                {filteredCargo.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)] text-xs bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]">No cargo records found.</div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto w-full">
                <table className="w-full text-left text-xs">
                <thead>
                  <tr className="theme-table-header-row text-[var(--text-muted)] uppercase font-semibold text-[10px] border-b border-[var(--border)]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredCargo.length > 0 && selectedCargoRows.size === filteredCargo.length}
                        onChange={handleSelectAllCargo}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </th>
                    <th className="py-3 px-2 whitespace-nowrap hidden sm:table-cell text-[var(--text-primary)]">Image</th>
                    <th onClick={() => handleSort('id', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Cargo ID</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'id' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('productName', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Product</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'productName' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('createdAt', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden lg:table-cell text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Timestamp</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'createdAt' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('country', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Origin</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'country' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('company', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Carrier</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'company' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('destination', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden lg:table-cell text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Destination</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'destination' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('quantity', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center justify-end gap-1">
                        <span>Qty</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'quantity' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('weight', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center justify-end gap-1">
                        <span>Weight</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'weight' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('discrepancies', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell text-[var(--text-primary)]">
                      <div className="flex items-center gap-1">
                        <span>Discrepancies</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'discrepancies' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('status', cargoSortField, setCargoSortField, cargoSortDir, setCargoSortDir)} className="py-3 px-2 text-center whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <span className="text-[9px] opacity-70">{cargoSortField === 'status' ? (cargoSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap text-[var(--text-primary)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedCargo.map(item => (
                    <tr key={item.id} className="theme-table-row hover:bg-[var(--accent-light)] transition-colors group cursor-pointer text-[var(--text-primary)]" onClick={() => setActiveMobileDetail({ type: 'cargo', data: item })}>
                      <td className="py-3 px-5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedCargoRows.has(item.id)}
                          onChange={() => handleSelectCargoRow(item.id)}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3 px-2 hidden sm:table-cell text-[var(--text-primary)]">
                        {item.productImage ? (
                          <img src={item.productImage} alt={item.productName} className="w-10 h-10 object-cover rounded-lg border border-[var(--border)]" />
                        ) : (
                          <div className="w-10 h-10 bg-[var(--accent-light)] rounded-lg flex items-center justify-center border border-[var(--border)]">
                             <ImageIcon className="w-4 h-4 text-[var(--accent)]" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <p className="font-mono font-bold text-[var(--text-primary)]">CARGO-{item.id}</p>
                        {item.goodsCode && <p className="text-[9px] text-[var(--text-muted)]">{item.goodsCode}</p>}
                      </td>
                      <td className="py-3 px-2 font-medium text-[13px]">{item.productName || '—'}</td>
                      <td className="py-3 px-2 text-[var(--text-muted)] font-mono text-[10px] whitespace-nowrap hidden lg:table-cell">{item.createdAt || 'N/A'}</td>
                      <td className="py-3 px-2 font-semibold text-[13px] hidden md:table-cell">{item.country}</td>
                      <td className="py-3 px-2 text-[var(--text-muted)] hidden md:table-cell">{item.company}</td>
                      <td className="py-3 px-2 text-[var(--text-muted)] hidden lg:table-cell">{item.destination || '—'}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-[13px]">{item.quantity} u.</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-[13px]">{item.weight}T</td>
                      <td className="py-3 px-2 text-rose-500 font-semibold hidden sm:table-cell">{item.discrepancies}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2.5 py-0.5 rounded font-bold text-[9px] ${statusBadge(item.status)}`}>
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveCargoMenu(activeCargoMenu === item.id ? null : item.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] transition-colors select-none border border-[var(--border)]"
                        >
                          ···
                        </button>
                        {activeCargoMenu === item.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col text-left">
                            <button onClick={() => handleEditCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">✏ Edit Ingest</button>
                            <button onClick={() => handleDuplicateCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">📋 Duplicate</button>
                            <button onClick={() => handleShareCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">🔗 Share Link</button>
                            <div className="h-px bg-[var(--border)] my-1"></div>
                            <button onClick={() => handleDeleteCargo(item.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-left">🗑 Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredCargo.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-6 text-center text-[var(--text-muted)]">No cargo intake logs found matching criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
            <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredCargo.length} of {localCargo.length} records</p>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
              <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
              <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {activeSubTab === 'OpsHistory' && (
        <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
          {/* Toolbar */}
          <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Operations Activity History</h3>
              <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">{filteredHistory.length} logs</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex items-center w-full sm:w-auto">
                <span className="absolute left-3 text-[var(--text-muted)] text-xs pointer-events-none">🔍</span>
                <input
                  type="text"
                  placeholder="Search history…"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border border-[var(--border)] transition w-full sm:w-40 bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--accent)]"
                />
              </div>
              {/* Status dropdown */}
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsHistoryFilterOpen(!isHistoryFilterOpen); }}
                  className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto"
                >
                  <span>Status: {historyStatusFilter === 'ALL' ? 'All' : historyStatusFilter.replace(/_/g, ' ')}</span>
                  <span className="text-[10px]">▼</span>
                </button>
                {isHistoryFilterOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col text-left">
                    {(['ALL', 'PENDING_MANAGEMENT_APPROVAL', 'APPROVED', 'REJECTED'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => { setHistoryStatusFilter(st); setIsHistoryFilterOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                      >
                        <span className={`w-2 h-2 rounded-full ${st === 'APPROVED' ? 'bg-emerald-500' : st === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        {st === 'ALL' ? 'All History' : st.replace(/_/g, ' ')}
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
                  <th className="py-3 px-5 whitespace-nowrap text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={filteredHistory.length > 0 && selectedHistoryRows.size === filteredHistory.length}
                      onChange={handleSelectAllHistory}
                      className="accent-[var(--accent)] w-3.5 h-3.5"
                    />
                  </th>
                  <th onClick={() => handleSort('goodsCode', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                    <div className="flex items-center gap-1">
                      <span>Goods Code</span>
                      <span className="text-[9px] opacity-70">{historySortField === 'goodsCode' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th onClick={() => handleSort('productName', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                    <div className="flex items-center gap-1">
                      <span>Product</span>
                      <span className="text-[9px] opacity-70">{historySortField === 'productName' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th onClick={() => handleSort('country', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell text-[var(--text-primary)]">
                    <div className="flex items-center gap-1">
                      <span>Origin</span>
                      <span className="text-[9px] opacity-70">{historySortField === 'country' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th onClick={() => handleSort('destination', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden lg:table-cell text-[var(--text-primary)]">
                    <div className="flex items-center gap-1">
                      <span>Destination</span>
                      <span className="text-[9px] opacity-70">{historySortField === 'destination' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th onClick={() => handleSort('createdAt', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell text-[var(--text-primary)]">
                    <div className="flex items-center gap-1">
                      <span>Logged At</span>
                      <span className="text-[9px] opacity-70">{historySortField === 'createdAt' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th onClick={() => handleSort('status', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      <span className="text-[9px] opacity-70">{historySortField === 'status' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th onClick={() => handleSort('unitPrice', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none text-[var(--text-primary)]">
                    <div className="flex items-center justify-end gap-1">
                      <span>Unit Price</span>
                      <span className="text-[9px] opacity-70">{historySortField === 'unitPrice' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>
                  <th className="py-3 px-5 text-center whitespace-nowrap text-[var(--text-primary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sortedHistory.map(item => (
                  <tr key={item.id} className="theme-table-row hover:bg-[var(--accent-light)] transition-colors group cursor-pointer text-[var(--text-primary)]" onClick={() => setActiveMobileDetail({ type: 'cargo', data: item })}>
                    <td className="py-3.5 px-5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedHistoryRows.has(item.id)}
                        onChange={() => handleSelectHistoryRow(item.id)}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-[var(--text-primary)]">{item.goodsCode || `CARGO-${item.id}`}</td>
                    <td className="py-3.5 px-3 font-medium text-[13px]">{item.productName || '—'}</td>
                    <td className="py-3.5 px-3 text-[var(--text-muted)] hidden md:table-cell">{item.country} / {item.company}</td>
                    <td className="py-3.5 px-3 text-[var(--text-muted)] hidden lg:table-cell">{item.destination || '—'}</td>
                    <td className="py-3.5 px-3 text-[var(--text-muted)] font-mono text-[10px] hidden sm:table-cell">{item.createdAt || 'N/A'}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${statusBadge(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-[13px] text-[var(--text-primary)]">{item.unitPrice ? `GHS ${item.unitPrice}` : '—'}</td>
                    <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveHistoryMenu(activeHistoryMenu === item.id ? null : item.id)}
                        className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] rounded-lg text-[var(--text-secondary)] transition-colors select-none border border-[var(--border)]"
                      >
                        ···
                      </button>
                      {activeHistoryMenu === item.id && (
                        <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col text-left">
                          <button onClick={() => handleDuplicateCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">📋 Duplicate Log</button>
                          <button onClick={() => handleShareCargo(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left">🔗 Share Link</button>
                          <div className="h-px bg-[var(--border)] my-1"></div>
                          <button onClick={() => handleDeleteCargo(item.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-left">🗑 Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
            <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredHistory.length} of {localCargo.length} logs</p>
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
