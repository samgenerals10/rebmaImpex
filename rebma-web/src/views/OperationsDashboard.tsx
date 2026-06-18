// rebma-web/src/views/OperationsDashboard.tsx

import { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet, FileText, Layers, Truck, AlertTriangle, CheckCircle,
  Image as ImageIcon, History, PackageCheck, TicketCheck, ChevronRight,
  MoreVertical, TrendingUp, TrendingDown, Camera, X, RefreshCw
} from 'lucide-react';
import MiniSparkline from '../components/MiniSparkline';
import KpiDetailView from '../components/KpiDetailView';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Order, IncomingGoods } from '../types/erp';
import { exportToCSV, exportToPDF } from '../utils/export';
import { supabase } from '../lib/supabaseClient';
import { stockApi } from '../services/apiClient';

interface OperationsDashboardProps {
  ordersList: Order[];
  incomingGoodsList: IncomingGoods[];
  onLogIntake: (data: Omit<IncomingGoods, 'id' | 'status'>) => void;
  onReleaseToDispatch: (id: string) => void;
  activeSubTab: string;
  addNotification: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
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
  addNotification,
  setActiveSubTab
}: OperationsDashboardProps) {

  // Local state copies of lists to support edit, delete, duplicate actions locally
  const [kpiDetail, setKpiDetail] = useState<number | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);
  const [localOrders, setLocalOrders] = useState<Order[]>(ordersList);
  const [localCargo, setLocalCargo] = useState<IncomingGoods[]>(incomingGoodsList);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [activeMobileDetail, setActiveMobileDetail] = useState<{
    type: 'order' | 'cargo';
    data: Order | IncomingGoods;
  } | null>(null);

  const [imagePreview, setImagePreview] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [goodsCode, setGoodsCode] = useState('');
  const [destination, setDestination] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [cameraPreview, setCameraPreview] = useState<string>('');
  const [docBase64, setDocBase64] = useState<string>('');
  const [docName, setDocName] = useState<string>('');

  // Web Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = async (mode = cameraFacingMode) => {
    setIsCameraActive(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setCameraError(err.message || "Webcam access is restricted by your browser permissions or environment.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  const toggleFacingMode = async () => {
    const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextMode);
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    await startCamera(nextMode);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCameraPreview(dataUrl);
        addNotification("Photo captured from live camera stream!");
      }
      stopCamera();
    }
  };

  const handleTakePhoto = async () => {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      await startCamera();
    } else {
      cameraInputRef.current?.click();
    }
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

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

  useEffect(() => {
    let active = true;
    const fetchLowStock = async () => {
      try {
        const stock = await stockApi.getStock();
        if (active) {
          const low = stock.filter(item => item.current === 0 || (item.capacity > 0 && item.current / item.capacity < 0.2));
          setLowStockItems(low);
        }
      } catch (err) {
        console.error('Failed to fetch low stock:', err);
      }
    };
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCameraPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setDocBase64(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const autoGoodsCode = () => `GC-${Date.now().toString().slice(-6)}`;

  const handleSubmitIntake = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    onLogIntake({
      productName: productName || 'Unspecified Product',
      productImage: imagePreview || cameraPreview || undefined,
      goodsCode: goodsCode || autoGoodsCode(),
      destination: destination || 'Accra Warehouse',
      country: target.country.value,
      company: target.company.value,
      quantity: parseInt(target.quantity.value),
      weight: parseFloat(target.weight.value),
      discrepancies: target.discrepancies.value || 'None',
      createdAt: new Date().toLocaleString(),
      metadata: {
        documentName: docName || null,
        documentData: docBase64 || null,
        cameraPhoto: cameraPreview || null
      }
    } as any);
    setImagePreview('');
    setCameraPreview('');
    setDocBase64('');
    setDocName('');
    setProductName('');
    setGoodsCode('');
    setDestination('');
    (e.target as HTMLFormElement).reset();
  };

  // ── Incoming goods from CEO supplier orders (via notifications) ──
  const [incomingSupplierOrders, setIncomingSupplierOrders] = useState<any[]>([]);
  useEffect(() => {
    const loadIncoming = async () => {
      try {
        const { data: notifs, error } = await supabase
          .from('supplier_order_notifications')
          .select('order_id, message, created_at')
          .eq('notified_department', 'OPERATIONS')
          .eq('read', false);
        if (!error && notifs && notifs.length > 0) {
          const orderIds = [...new Set(notifs.map((n: any) => n.order_id))];
          const { data: sOrders } = await supabase
            .from('supplier_orders')
            .select('id,order_number,supplier_name,supplier_country,products,expected_delivery_date,status,total_amount,currency')
            .in('id', orderIds);
          if (sOrders) {
            setIncomingSupplierOrders(sOrders.map((o: any) => ({
              ...o,
              message: notifs.find((n: any) => n.order_id === o.id)?.message || '',
            })));
          }
        }
      } catch { /* table may not exist yet — silently ignore */ }
    };
    loadIncoming();
  }, []);

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
    const newClient = window.prompt('Edit client name:', order.clientName);
    if (!newClient) return;
    const newDest = window.prompt('Edit destination:', order.destination || '');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ client_name: newClient, destination: newDest })
        .eq('id', order.id);
      if (error) throw error;
      setLocalOrders(prev => prev.map(o => o.id === order.id ? { ...o, clientName: newClient, destination: newDest || undefined } : o));
      addNotification(`Updated order ${order.id}`);
    } catch (err: any) {
      addNotification(`Error updating order: ${err.message}`);
    }
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
    if (!window.confirm(`Delete order entry ${id}?`)) return;
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setLocalOrders(prev => prev.filter(o => o.id !== id));
      addNotification(`Deleted order entry ${id}`);
    } catch (err: any) {
      addNotification(`Error deleting order: ${err.message}`);
    }
  };

  const handleEditCargo = async (cargo: IncomingGoods) => {
    const newName = window.prompt('Edit product name:', cargo.productName);
    if (!newName) return;
    const newCarrier = window.prompt('Edit shipping carrier:', cargo.company);
    if (!newCarrier) return;
    try {
      const { error } = await supabase
        .from('cargo_intake')
        .update({ product_name: newName, company: newCarrier })
        .eq('id', cargo.id);
      if (error) throw error;
      setLocalCargo(prev => prev.map(c => c.id === cargo.id ? { ...c, productName: newName, company: newCarrier } : c));
      addNotification(`Updated cargo intake details for CARGO-${cargo.id}`);
    } catch (err: any) {
      addNotification(`Error updating cargo: ${err.message}`);
    }
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
    if (!window.confirm(`Delete cargo intake record CARGO-${id}?`)) return;
    try {
      const { error } = await supabase
        .from('cargo_intake')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setLocalCargo(prev => prev.filter(c => c.id !== id));
      addNotification(`Deleted cargo record ${id}`);
    } catch (err: any) {
      addNotification(`Error deleting cargo record: ${err.message}`);
    }
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
    return (
      <KpiDetailView
        title={d.title}
        metric={d.metric}
        trendData={d.trendData}
        breakdownData={d.breakdownData}
        tableData={d.tableData}
        columns={d.columns}
        onBack={() => setKpiDetail(null)}
      />
    );
  }

  return (
    <>
      <div className="block">
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
              <button onClick={handleExportCargoCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity bg-transparent">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Cargo (CSV)</span>
              </button>
              <button onClick={handleExportCargoPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity bg-transparent">
                <FileText className="w-3.5 h-3.5" /><span>Cargo (PDF)</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={handleExportReleasesCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity bg-transparent">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Releases (CSV)</span>
              </button>
              <button onClick={handleExportReleasesPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-opacity bg-transparent">
                <FileText className="w-3.5 h-3.5" /><span>Releases (PDF)</span>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: notifications, sub-tab panels, approved orders, approved goods */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          
          {/* INCOMING GOODS FROM CEO SUPPLIER ORDERS */}
          {incomingSupplierOrders.length > 0 && (
            <div className="p-5 bg-[var(--bg-card)] rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-[var(--box-shadow)]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Incoming Goods Notifications</h3>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">{incomingSupplierOrders.length} pending</span>
              </div>
              <div className="space-y-3">
                {incomingSupplierOrders.map((o: any) => (
                  <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-indigo-400 transition-colors">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{o.order_number}</span>
                        <span className="text-xs text-[var(--text-secondary)] font-semibold">{o.supplier_name}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {Array.isArray(o.products) ? o.products.map((p: any) => `${p.product_name} (${p.quantity} ${p.unit})`).join(', ') : '—'}
                      </p>
                      {o.message && <p className="text-[11px] text-indigo-600 dark:text-indigo-400 italic">{o.message}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {o.expected_delivery_date && <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">ETA: {o.expected_delivery_date}</span>}
                      <button
                        onClick={() => addNotification(`Log Receipt opened for ${o.order_number}.`)}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 whitespace-nowrap cursor-pointer">
                        Log Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Sub-tab views */}
          <div>
            {/* PORT INGESTION FORM */}
            {activeSubTab === 'PortIngestion' && (
              <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
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

                  {/* Product Image Upload & Attachments */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Cargo Media & Attachments <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
                    <div className="flex flex-wrap gap-4 items-center">
                      {/* File Upload */}
                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 border border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-all"
                        >
                          <ImageIcon className="w-4 h-4" />
                          {imagePreview ? 'Change Image' : 'Upload Image'}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </div>

                      {/* Camera Capture */}
                      <div>
                        <button
                          type="button"
                          onClick={handleTakePhoto}
                          className="flex items-center gap-2 px-4 py-2 border border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-all"
                        >
                          <Camera className="w-4 h-4" />
                          {cameraPreview ? 'Retake Photo' : 'Take Photo'}
                        </button>
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleCameraChange}
                          className="hidden"
                        />
                      </div>

                      {/* Doc Upload */}
                      <div>
                        <button
                          type="button"
                          onClick={() => docInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 border border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-all"
                        >
                          <FileText className="w-4 h-4" />
                          {docName ? docName : 'Attach Document'}
                        </button>
                        <input
                          ref={docInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                          onChange={handleDocChange}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Previews Row */}
                    <div className="flex gap-4 flex-wrap mt-2">
                      {imagePreview && (
                        <div className="relative">
                          <p className="text-[9px] text-[var(--text-muted)] mb-1">Uploaded Image</p>
                          <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]" />
                          <button type="button" onClick={() => setImagePreview('')} className="absolute top-4 right-0.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                        </div>
                      )}

                      {cameraPreview && (
                        <div className="relative">
                          <p className="text-[9px] text-[var(--text-muted)] mb-1">Camera Photo</p>
                          <img src={cameraPreview} alt="Camera Preview" className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]" />
                          <button type="button" onClick={() => setCameraPreview('')} className="absolute top-4 right-0.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                        </div>
                      )}

                      {docName && (
                        <div className="relative p-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center gap-2">
                          <FileText className="w-6 h-6 text-emerald-500" />
                          <div className="text-[10px]">
                            <p className="font-semibold truncate max-w-[120px]">{docName}</p>
                            <p className="text-[var(--text-muted)]">Document Attached</p>
                          </div>
                          <button type="button" onClick={() => { setDocName(''); setDocBase64(''); }} className="w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
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
                  <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredCargo.length} of {localCargo.length} logs</p>
                  <div className="flex items-center gap-1">
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>‹</button>
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                    <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30" disabled>›</button>
                  </div>
                </div>
              </div>
            )}

            {/* Ops History logs */}
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

          {/* Approved Orders Section — always visible */}
          {approvedOrders.length > 0 && (
            <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
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
                        <tr key={order.id} className="theme-table-row hover:bg-[var(--accent-light)] transition-colors group cursor-pointer text-[var(--text-primary)]" onClick={() => setActiveMobileDetail({ type: 'order', data: order })}>
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
            </div>
          )}

          {/* Approved Goods Section — always visible */}
          {approvedGoods.length > 0 && (
            <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Approved Incoming Goods</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          
          {/* Quick Actions */}
          <div className="p-5 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Log Cargo Intake', tab: 'PortIngestion', icon: PackageCheck, color: 'var(--accent)' },
                { label: 'View Stock', tab: 'Stock', icon: Layers, color: '#8b5cf6' },
                { label: 'Discrepancy Reports', tab: 'OpsHistory', icon: AlertTriangle, color: '#f59e0b' },
                { label: 'Fulfillment Queue', tab: 'Releases', icon: Truck, color: '#10b981' },
              ].map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.tab}
                    onClick={() => setActiveSubTab?.(action.tab)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-all cursor-pointer text-center bg-transparent"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${action.color}18` }}>
                      <Icon className="w-5 h-5" style={{ color: action.color }} />
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-secondary)] leading-tight">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="p-5 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Low Stock Alerts</h3>
              </div>
              <button onClick={() => setActiveSubTab?.('Stock')} className="text-xs text-[var(--accent)] hover:underline font-semibold cursor-pointer bg-transparent border-none">View All →</button>
            </div>
            <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
              {lowStockItems.length > 0 ? (
                lowStockItems.map(item => {
                  const pct = item.capacity > 0 ? Math.round((item.current / item.capacity) * 100) : 0;
                  const isOut = item.current === 0;
                  return (
                    <div key={item.sku || item.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">{item.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono">{item.sku}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOut ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                          {isOut ? 'OUT OF STOCK' : `${pct}%`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isOut ? '#f43f5e' : '#f59e0b' }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                  <p className="font-semibold text-sm">All stock levels healthy</p>
                  <p className="text-[10px] mt-1">No low stock alerts detected.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Webcam Capture Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl overflow-hidden w-full max-w-md shadow-2xl flex flex-col animate-fade-in-up">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-[var(--accent)]" /> Live Camera Ingestion
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="p-1.5 hover:bg-[var(--accent-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer transition-colors"
                  title="Switch Camera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-1.5 hover:bg-[var(--accent-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {cameraError ? (
              <div className="p-6 text-center space-y-4 flex flex-col items-center justify-center min-h-[220px]">
                <AlertTriangle className="w-12 h-12 text-amber-500 animate-pulse" />
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">Webcam Stream Restricted</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-2 max-w-[260px] mx-auto leading-relaxed">
                    Live video is blocked by browser permissions, iframe sandboxing, or non-secure context settings.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      cameraInputRef.current?.click();
                      stopCamera();
                    }}
                    className="w-full py-2.5 bg-[var(--accent)] text-white text-xs font-bold rounded-xl shadow-md hover:opacity-95 cursor-pointer transition-opacity"
                  >
                    Use System Camera / Upload
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="w-full py-2 border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-2 border-white/20 pointer-events-none rounded-xl m-4 border-dashed" />
                </div>

                <div className="p-4 flex gap-3 justify-end bg-[var(--bg)]">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 border border-[var(--border)] text-xs font-semibold rounded-xl text-[var(--text-secondary)] hover:bg-[var(--accent-light)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl shadow-md hover:opacity-90 cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" /> Capture Image
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
      </div>
    </>
  );
}
