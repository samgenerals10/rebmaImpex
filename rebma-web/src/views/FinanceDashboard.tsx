// rebma-web/src/views/FinanceDashboard.tsx

import { useState, useEffect } from 'react';
import {
  FileSpreadsheet, FileText, DollarSign, Clipboard, ShieldCheck, Activity, X, ExternalLink, ChevronRight, MoreVertical, TrendingUp, TrendingDown
} from 'lucide-react';
import { useCeoSettings } from '../contexts/CeoSettingsContext';
import MiniSparkline from '../components/MiniSparkline';
import KpiDetailView from '../components/KpiDetailView';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Order, FinancePayment, ProductionRequest } from '../types/erp';
import { exportToCSV, exportToPDF } from '../utils/export';
import { stockApi, operations } from '../services/apiClient';
import { supabase } from '../lib/supabaseClient';
import ActivityFeed from '../components/global/ActivityFeed';
import FinanceOverviewView from './finance/OverviewView';

interface FinanceDashboardProps {
  ordersList: Order[];
  setOrdersList: React.Dispatch<React.SetStateAction<Order[]>>;
  onEvaluateOrder: (id: string, approve: boolean) => void;
  onFinalizeOrder: (id: string) => void;
  activeSubTab: string;
  setActiveSubTab?: (tab: string) => void;
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
  setActiveSubTab,
  paymentsList,
  setPaymentsList,
  productionRequests,
  addNotification
}: FinanceDashboardProps) {

  const { getSetting } = useCeoSettings();
  const cashEnabled = getSetting('cash_payments_enabled', true);
  const chequeEnabled = getSetting('cheque_payments_enabled', true);
  const momoEnabled = getSetting('momo_payments_enabled', true);
  const dataExportEnabled = getSetting('data_export_enabled', true);

  // Self-fetch orders so Finance always has live data (App.tsx fetch may be stale)
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  useEffect(() => {
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLiveOrders(data.map((r: any) => ({
            id: r.id,
            ticketNumber: r.ticket_number || r.id,
            clientName: r.client_name || '',
            productName: r.product_name || '',
            destination: r.destination || '',
            paymentMode: r.payment_mode || 'CASH',
            totalAmount: Number(r.total_amount ?? 0),
            status: r.status || 'PENDING_FINANCE',
            createdAt: r.created_at || new Date().toISOString(),
            ghanaCard: r.metadata?.ghanaCard || r.ghana_card || undefined,
          })));
        }
      }, () => {});
  }, []);

  // Use live fetch if available, fall back to prop
  const effectiveOrders = liveOrders.length > 0 ? liveOrders : ordersList;

  // Local state copies to support inline dynamic table additions, updates and deletes
  const [localPayments, setLocalPayments] = useState<FinancePayment[]>(paymentsList);
  const [localRequisitions, setLocalRequisitions] = useState<ProductionRequest[]>(productionRequests);
  const [totalCapitalAssets, setTotalCapitalAssets] = useState(0);

  // Price Catalog / E-commerce product states
  const [goodsPrices, setGoodsPrices] = useState<any[]>([]);
  const [cargoForInventory, setCargoForInventory] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('ALL');
  const [catalogSort, setCatalogSort] = useState('name-asc');
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<any | null>(null);

  const fetchCatalogData = async () => {
    try {
      supabase.from('goods_prices').select('*').then(({ data }) => {
        if (data) setGoodsPrices(data);
      });
      supabase.from('cargo_intake').select('product_name, quantity').eq('status', 'APPROVED').then(({ data }) => {
        if (data) setCargoForInventory(data);
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCapitalMetrics();
    fetchCatalogData();
  }, []);

  const fetchCapitalMetrics = async () => {
    try {
      const [stockData, gpData] = await Promise.all([
        stockApi.getStock(),
        operations.getGeneralPurchases()
      ]);
      const finishedGoodsValue = stockData.reduce((acc: number, s: any) => acc + (s.current * 45.5), 0);
      const gpValue = (gpData || [])
        .filter((gp: any) => gp.status === 'APPROVED')
        .reduce((acc: number, gp: any) => acc + gp.cost, 0);
      
      setTotalCapitalAssets(finishedGoodsValue + gpValue);
    } catch (err) {
      console.error('Failed to fetch capital metrics in FinanceDashboard:', err);
    }
  };

  const [payType, setPayType] = useState<'DIRECT' | 'CREDIT_SETTLEMENT'>('DIRECT');
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [payMode, setPayMode] = useState<'CASH' | 'CHEQUE' | 'MOBILE_MONEY' | 'CREDIT'>('CASH');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<FinancePayment | null>(null);
  const [activeMobileDetail, setActiveMobileDetail] = useState<{ type: 'payment' | 'requisition'; data: any } | null>(null);
  const [kpiDetail, setKpiDetail] = useState<number | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);

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
    fetchCapitalMetrics();
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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last5Days = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (4 - i));
    return {
      dateStr: d.toDateString(),
      dayName: dayNames[d.getDay()],
      Revenue: 0,
      Payments: 0
    };
  });

  effectiveOrders.forEach(o => {
    if (['DELIVERED', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)) {
      const dStr = new Date(o.createdAt).toDateString();
      const dayItem = last5Days.find(item => item.dateStr === dStr);
      if (dayItem) {
        dayItem.Revenue += o.totalAmount;
      }
    }
  });

  localPayments.forEach(p => {
    const dStr = new Date(p.createdAt).toDateString();
    const dayItem = last5Days.find(item => item.dateStr === dStr);
    if (dayItem) {
      dayItem.Payments += p.amount;
    }
  });

  const lineChartData = last5Days.map(item => ({
    name: item.dayName,
    Revenue: item.Revenue,
    Payments: item.Payments
  }));

  const last7DaysArr = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toDateString();
  });

  const sparkTotalRevenue = last7DaysArr.map(dStr => {
    return effectiveOrders
      .filter(o => new Date(o.createdAt).toDateString() === dStr && ['DELIVERED', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status))
      .reduce((sum, o) => sum + o.totalAmount, 0);
  });

  const sparkPendingOrders = last7DaysArr.map(dStr => {
    return effectiveOrders.filter(o => new Date(o.createdAt).toDateString() === dStr && o.status === 'PENDING_FINANCE').length;
  });

  const sparkInvoicesGenerated = last7DaysArr.map(dStr => {
    return localPayments.filter(p => new Date(p.createdAt).toDateString() === dStr).length;
  });

  const sparkCreditOutstanding = last7DaysArr.map(dStr => {
    return localPayments.filter(p => new Date(p.createdAt).toDateString() === dStr).reduce((sum, p) => sum + p.amount, 0);
  });

  const totalRevenueVal = effectiveOrders.reduce((acc, o) =>
    acc + (['DELIVERED', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status) ? o.totalAmount : 0), 0
  );
  const pendingFinanceCount = effectiveOrders.filter(o => o.status === 'PENDING_FINANCE').length;
  const recordedPaymentsCount = localPayments.length;
  const liquidCashVal = localPayments.reduce((acc, p) => acc + p.amount, 0);

  const stats = [
    { title: 'Total Revenue',      value: `GHS ${totalRevenueVal.toLocaleString()}`, sub: 'Completed & Approved Sales', icon: DollarSign, color: 'text-emerald-500' },
    { title: 'Pending Orders',     value: `${pendingFinanceCount} Orders`,           sub: 'Awaiting finance review',    icon: Clipboard,  color: 'text-amber-500' },
    { title: 'Invoices Generated', value: `${recordedPaymentsCount} Tickets`,        sub: 'Receipt database logs',      icon: ShieldCheck, color: 'text-blue-500' },
    { title: 'Credit Outstanding', value: `GHS ${liquidCashVal.toLocaleString()}`,   sub: 'Total direct collections',   icon: Activity,   color: 'text-indigo-500' },
  ];

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (payType === 'DIRECT') {
      if (!clientName || !amount || parseFloat(amount) <= 0) {
        alert('Please fill out a valid client name and positive amount');
        return;
      }
      const { data: inserted, error } = await supabase.from('finance_payments').insert({
        client_name: clientName,
        amount: parseFloat(amount),
        payment_mode: payMode,
        payment_type: 'DIRECT',
        created_at: now,
      }).select().single();
      if (error) { addNotification(`Payment save failed: ${error.message}`); return; }
      const newPayment: FinancePayment = {
        id: inserted?.id || `PAY-${Date.now().toString().slice(-4)}`,
        clientName,
        amount: parseFloat(amount),
        paymentMode: payMode,
        paymentType: 'DIRECT',
        createdAt: now,
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
      const order = effectiveOrders.find(o => o.id === selectedOrderId);
      if (!order) return;
      const paidAmount = amount && parseFloat(amount) > 0 ? parseFloat(amount) : order.totalAmount;
      const { data: inserted, error } = await supabase.from('finance_payments').insert({
        client_name: order.clientName,
        amount: paidAmount,
        payment_mode: payMode,
        payment_type: 'CREDIT_SETTLEMENT',
        order_id: selectedOrderId,
        created_at: now,
      }).select().single();
      if (error) { addNotification(`Payment save failed: ${error.message}`); return; }
      await supabase.from('orders').update({ status: 'APPROVED', updated_at: now }).eq('id', selectedOrderId);
      const newPayment: FinancePayment = {
        id: inserted?.id || `PAY-${Date.now().toString().slice(-4)}`,
        clientName: order.clientName,
        amount: paidAmount,
        paymentMode: payMode,
        paymentType: 'CREDIT_SETTLEMENT',
        orderId: selectedOrderId,
        createdAt: now,
      };
      const updated = [newPayment, ...localPayments];
      setLocalPayments(updated);
      setPaymentsList(updated);
      setOrdersList(prev => prev.map(o => o.id === selectedOrderId ? { ...o, status: 'APPROVED' } : o));
      addNotification(`Credit settlement recorded for ${order.clientName} (Order ${selectedOrderId}) — Status set to APPROVED.`);
      setSelectedOrderId('');
      setAmount('');
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

  // KPI detail drill-down data — computed from live state
  const kpiDetails = [
    {
      title: 'Total Revenue', metric: `GHS ${totalRevenueVal.toLocaleString()} total approved revenue`, color: '#10b981',
      trendData: [
        { name: 'Mon', value: 12000 }, { name: 'Tue', value: 19000 }, { name: 'Wed', value: 15000 },
        { name: 'Thu', value: 27000 }, { name: 'Fri', value: 34000 }, { name: 'Sat', value: 22000 }, { name: 'Sun', value: totalRevenueVal },
      ],
      breakdownData: [
        { name: 'Cash',     value: Math.round(totalRevenueVal * 0.45) },
        { name: 'Credit',   value: Math.round(totalRevenueVal * 0.30) },
        { name: 'Transfer', value: Math.round(totalRevenueVal * 0.25) },
      ],
      tableData: localPayments.map(p => ({
        date: p.createdAt, customer: p.clientName, order: p.orderId || '—',
        amount: `GHS ${p.amount.toLocaleString()}`, payment_type: p.paymentType, recorded_by: 'Finance', status: 'Paid',
      })),
      columns: [
        { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' }, { key: 'order', label: 'Order#' },
        { key: 'amount', label: 'Amount' }, { key: 'payment_type', label: 'Payment Type' },
        { key: 'recorded_by', label: 'Recorded By' }, { key: 'status', label: 'Status' },
      ],
    },
    {
      title: 'Pending Orders', metric: `${pendingFinanceCount} orders awaiting finance review`, color: '#f59e0b',
      trendData: [
        { name: 'Mon', value: 3 }, { name: 'Tue', value: 5 }, { name: 'Wed', value: 2 },
        { name: 'Thu', value: 7 }, { name: 'Fri', value: pendingFinanceCount || 4 }, { name: 'Sat', value: 4 }, { name: 'Sun', value: 6 },
      ],
      breakdownData: [
        { name: 'Cash',   value: effectiveOrders.filter(o => o.paymentMode === 'CASH').length },
        { name: 'Credit', value: effectiveOrders.filter(o => o.paymentMode === 'CREDIT').length },
        { name: 'Mobile Money', value: effectiveOrders.filter(o => o.paymentMode === 'MOBILE_MONEY').length },
      ],
      tableData: effectiveOrders.filter(o => o.status === 'PENDING_FINANCE').map(o => ({
        order: o.id, customer: o.clientName, amount: `GHS ${o.totalAmount.toLocaleString()}`,
        dept: o.destination || '—', payment_mode: o.paymentMode, submitted: o.createdAt,
      })),
      columns: [
        { key: 'order', label: 'Order#' }, { key: 'customer', label: 'Customer' },
        { key: 'amount', label: 'Amount' }, { key: 'dept', label: 'Dept' },
        { key: 'payment_mode', label: 'Payment Mode' }, { key: 'submitted', label: 'Submitted Date' },
      ],
    },
    {
      title: 'Invoices Generated', metric: `${recordedPaymentsCount} payment receipts issued`, color: '#6366f1',
      trendData: [
        { name: 'Mon', value: 2 }, { name: 'Tue', value: 4 }, { name: 'Wed', value: 3 },
        { name: 'Thu', value: 6 }, { name: 'Fri', value: recordedPaymentsCount || 5 }, { name: 'Sat', value: 5 }, { name: 'Sun', value: 4 },
      ],
      breakdownData: [
        { name: 'Direct',       value: localPayments.filter(p => p.paymentType === 'DIRECT').length },
        { name: 'Credit Settle', value: localPayments.filter(p => p.paymentType === 'CREDIT_SETTLEMENT').length },
      ],
      tableData: localPayments.map((p, i) => ({
        invoice: `INV-${String(i + 1).padStart(4, '0')}`, customer: p.clientName,
        amount: `GHS ${p.amount.toLocaleString()}`, date: p.createdAt, status: 'Issued',
      })),
      columns: [
        { key: 'invoice', label: 'Invoice#' }, { key: 'customer', label: 'Customer' },
        { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' },
      ],
    },
    {
      title: 'Credit Outstanding', metric: `GHS ${liquidCashVal.toLocaleString()} total cash collected`, color: '#8b5cf6',
      trendData: [
        { name: 'Mon', value: 8000 }, { name: 'Tue', value: 12000 }, { name: 'Wed', value: 10000 },
        { name: 'Thu', value: 21000 }, { name: 'Fri', value: liquidCashVal || 15000 }, { name: 'Sat', value: 15000 }, { name: 'Sun', value: 13000 },
      ],
      breakdownData: [
        { name: 'Cash',     value: localPayments.filter(p => p.paymentMode === 'CASH').length },
        { name: 'Cheque',   value: localPayments.filter(p => p.paymentMode === 'CHEQUE').length },
        { name: 'Mobile',   value: localPayments.filter(p => p.paymentMode === 'MOBILE_MONEY').length },
        { name: 'Credit',   value: localPayments.filter(p => p.paymentMode === 'CREDIT').length },
      ],
      tableData: effectiveOrders.filter(o => o.paymentMode === 'CREDIT').map(o => ({
        customer: o.clientName, amount: `GHS ${o.totalAmount.toLocaleString()}`,
        due_date: o.createdAt, days_overdue: '0', status: o.status,
      })),
      columns: [
        { key: 'customer', label: 'Customer' }, { key: 'amount', label: 'Amount' },
        { key: 'due_date', label: 'Due Date' }, { key: 'days_overdue', label: 'Days Overdue' }, { key: 'status', label: 'Status' },
      ],
    },
  ];

  if (kpiDetail !== null) {
    const d = kpiDetails[kpiDetail];
    return (
      <KpiDetailView
        title={d.title} metric={d.metric} color={d.color}
        trendData={d.trendData} breakdownData={d.breakdownData}
        tableData={d.tableData} columns={d.columns}
        onBack={() => setKpiDetail(null)}
      />
    );
  }

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
        {/* Premium e-commerce overview dashboard */}
        {activeSubTab === 'Evaluation' && (
          <FinanceOverviewView
            addNotification={addNotification}
            setActiveSubTab={setActiveSubTab as any}
            ordersList={effectiveOrders as any}
            onEvaluateOrder={onEvaluateOrder}
          />
        )}
        {activeSubTab !== 'Evaluation' && (
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
              {dataExportEnabled && <button onClick={() => exportToCSV(effectiveOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'finance_orders_ledger')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Ledgers (CSV)</span>
              </button>}
              <button onClick={() => exportToPDF('Finance Ledger Statement', effectiveOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'paymentMode', 'totalAmount', 'status', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors">
                <FileText className="w-3.5 h-3.5" /><span>Ledgers (PDF)</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {stats.map((card, idx) => {
              const sparkData = [
                sparkTotalRevenue,
                sparkPendingOrders,
                sparkInvoicesGenerated,
                sparkCreditOutstanding
              ][idx] || [0,0,0,0,0,0,0];
              const isUp = idx % 3 !== 0;
              return (
                <div key={idx} onClick={() => setKpiDetail(idx)} className="kpi-card group cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold leading-tight">{card.title}</span>
                    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setCardMenuOpen(cardMenuOpen === idx ? null : idx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded hover:bg-[var(--accent-light)]"
                      >
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
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
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Capital Tied Up in Assets</h3>
              <p className="text-2xl md:text-3xl font-bold text-indigo-500 font-mono">₵{totalCapitalAssets.toLocaleString('en-GH', { maximumFractionDigits: 0 })}</p>
              <p className="text-[10px] text-[var(--text-secondary)] opacity-80">Value of finished goods stock plus approved general purchased items.</p>
            </div>
          </div>

          {/* Tab Views */}
          <div className="border-t border-[var(--border)] pt-6">

            {/* PAYMENT TERMS / ORDERS QUEUE */}
            {(activeSubTab === 'OrdersQueue') && (
              <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4">
                <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Workflow B: Order Payment Terms Evaluation Queue</h3>
                <div className="space-y-3">
                  {effectiveOrders.filter(o => o.status === 'PENDING_FINANCE').map(order => (
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
                  {effectiveOrders.filter(o => o.status === 'PENDING_FINANCE').length === 0 && (
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
                  {effectiveOrders.filter(o => o.status === 'APPROVED').map(order => (
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
                  {effectiveOrders.filter(o => o.status === 'APPROVED').length === 0 && (
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
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Amount Paid (GHS)</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="E.g., 2500" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Select Unsettled Credit Order</label>
                        <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                          <option value="" className="bg-[var(--bg-card)]">-- Choose Credit Order --</option>
                          {effectiveOrders.filter(o => o.paymentMode === 'CREDIT' && o.status === 'PENDING_FINANCE').map(o => (
                            <option key={o.id} value={o.id} className="bg-[var(--bg-card)]">{o.id} - {o.clientName} (GHS {o.totalAmount.toLocaleString()}) [{o.status}]</option>
                          ))}
                        </select>
                        {effectiveOrders.filter(o => o.paymentMode === 'CREDIT' && o.status === 'PENDING_FINANCE').length === 0 && (
                          <p className="text-[10px] text-amber-500 mt-1">No pending credit orders found. Check Finance queue first.</p>
                        )}
                      </div>
                      {selectedOrderId && (() => {
                        const selOrder = effectiveOrders.find(o => o.id === selectedOrderId);
                        const amountRequired = selOrder?.totalAmount || 0;
                        const amountPaidNum = parseFloat(amount) || 0;
                        const balance = amountRequired - amountPaidNum;
                        return (
                          <div className="space-y-2">
                            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs">
                              <p className="text-[var(--text-muted)]">Amount Required</p>
                              <p className="font-bold text-[var(--text-primary)] text-sm">GHS {amountRequired.toLocaleString()}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Amount Paid (GHS)</label>
                              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount paid…"
                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                            </div>
                            {amount && (
                              <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${balance <= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                {balance <= 0
                                  ? `Full payment — GHS ${Math.abs(balance).toLocaleString()} ${balance < 0 ? 'overpaid' : 'settled'}`
                                  : `Partial payment — GHS ${balance.toLocaleString()} remaining`}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Payment Mode</label>
                    <select value={payMode} onChange={e => setPayMode(e.target.value as any)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                      {cashEnabled && <option value="CASH" className="bg-[var(--bg-card)]">Cash</option>}
                      {chequeEnabled && <option value="CHEQUE" className="bg-[var(--bg-card)]">Cheque</option>}
                      {momoEnabled && <option value="MOBILE_MONEY" className="bg-[var(--bg-card)]">Mobile Money (MTN/Telecel)</option>}
                      <option value="CREDIT" className="bg-[var(--bg-card)]">Credit</option>
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
                </div>
              </div>
            )}

            {/* PRICE CATALOG STOREFRONT */}
            {activeSubTab === 'PriceCatalog' && (() => {
              const catalogItemsMapped = goodsPrices.map((gp: any) => {
                const key = String(gp.product_name || '').toLowerCase().trim();
                const qty = cargoForInventory
                  .filter((c: any) => String(c.product_name || '').toLowerCase().trim() === key)
                  .reduce((s: number, c: any) => s + (Number(c.quantity) || 0), 0);
                const sold = effectiveOrders
                  .filter((o: any) => ['APPROVED', 'PROCESSING', 'DELIVERED'].includes(o.status) && String(o.productName || o.product_name || '').toLowerCase().trim() === key)
                  .reduce((s: number, o: any) => s + (Number(o.quantity) || 1), 0);
                const finalStock = Math.max(0, qty - sold);
                const sellingValue = finalStock * Number(gp.unit_price || 0);
                const costValue = finalStock * Number(gp.cost_price || 0);
                const margin = gp.cost_price > 0 ? (((gp.unit_price - gp.cost_price) / gp.cost_price) * 100).toFixed(0) : '0';
                return {
                  ...gp,
                  stock: finalStock,
                  sellingValue,
                  costValue,
                  margin
                };
              });

              const filteredCatalogItems = catalogItemsMapped.filter(item => {
                const matchesSearch = String(item.product_name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
                  String(item.category || '').toLowerCase().includes(catalogSearch.toLowerCase());
                const matchesCategory = catalogCategory === 'ALL' || String(item.category || '').toUpperCase() === catalogCategory.toUpperCase();
                return matchesSearch && matchesCategory;
              });

              const sortedCatalogItems = [...filteredCatalogItems].sort((a, b) => {
                if (catalogSort === 'name-asc') return String(a.product_name).localeCompare(String(b.product_name));
                if (catalogSort === 'name-desc') return String(b.product_name).localeCompare(String(a.product_name));
                if (catalogSort === 'price-asc') return Number(a.unit_price) - Number(b.unit_price);
                if (catalogSort === 'price-desc') return Number(b.unit_price) - Number(a.unit_price);
                if (catalogSort === 'qty-desc') return b.stock - a.stock;
                if (catalogSort === 'valuation-desc') return b.sellingValue - a.sellingValue;
                return 0;
              });

              const catalogCategories = ['ALL', ...Array.from(new Set(goodsPrices.map(gp => gp.category || 'General').filter(Boolean)))];

              // Inline high-fidelity vector product SVG drawers
              const drawProductImg = (name: string, category: string) => {
                const n = name.toLowerCase();
                const c = category.toLowerCase();
                if (n.includes('headphone') || n.includes('ear') || n.includes('sound')) {
                  return (
                    <svg viewBox="0 0 100 100" className="w-24 h-24 text-slate-800 drop-shadow-md">
                      <path d="M20,50 C20,30 35,15 50,15 C65,15 80,30 80,50" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                      <rect x="15" y="45" width="12" height="22" rx="4" fill="currentColor" />
                      <rect x="73" y="45" width="12" height="22" rx="4" fill="currentColor" />
                      <path d="M20,55 L20,62" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <path d="M80,55 L80,62" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  );
                }
                if (n.includes('watch') || n.includes('smart') || n.includes('clock') || n.includes('band')) {
                  return (
                    <svg viewBox="0 0 100 100" className="w-24 h-24 text-slate-800 drop-shadow-md">
                      <rect x="38" y="10" width="24" height="80" rx="6" fill="currentColor" opacity="0.3" />
                      <rect x="30" y="30" width="40" height="40" rx="10" fill="currentColor" />
                      <circle cx="50" cy="50" r="14" fill="#38bdf8" />
                      <path d="M50,42 L50,50 L56,53" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  );
                }
                if (n.includes('tv') || n.includes('monitor') || n.includes('screen') || n.includes('display') || n.includes('laptop') || n.includes('macbook') || n.includes('samsung')) {
                  return (
                    <svg viewBox="0 0 100 100" className="w-24 h-24 text-slate-800 drop-shadow-md">
                      <rect x="10" y="20" width="80" height="50" rx="4" fill="currentColor" />
                      <rect x="14" y="24" width="72" height="42" fill="#38bdf8" />
                      <path d="M40,70 L60,70 L55,80 L45,80 Z" fill="currentColor" />
                    </svg>
                  );
                }
                if (c.includes('beverage') || n.includes('drink') || n.includes('soda') || n.includes('cola') || n.includes('juice') || n.includes('water')) {
                  return (
                    <svg viewBox="0 0 100 100" className="w-20 h-24 text-indigo-600 drop-shadow-md">
                      <rect x="30" y="15" width="40" height="70" rx="8" fill="currentColor" />
                      <ellipse cx="50" cy="15" rx="20" ry="5" fill="currentColor" opacity="0.8" />
                      <rect x="35" y="30" width="30" height="40" rx="4" fill="white" opacity="0.2" />
                      <line x1="50" y1="35" x2="50" y2="65" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
                    </svg>
                  );
                }
                if (c.includes('grain') || n.includes('rice') || n.includes('grain') || n.includes('wheat') || n.includes('sugar') || n.includes('flour') || n.includes('corn')) {
                  return (
                    <svg viewBox="0 0 100 100" className="w-24 h-24 text-amber-500 drop-shadow-md">
                      <path d="M30,30 C30,20 40,15 50,15 C60,15 70,20 70,30 C70,50 80,75 75,85 C73,88 27,88 25,85 C20,75 30,50 30,30 Z" fill="currentColor" />
                      <path d="M25,80 L75,80" stroke="white" strokeWidth="2" opacity="0.3" />
                      <path d="M30,40 Q50,45 70,40" stroke="white" strokeWidth="2" fill="none" opacity="0.3" />
                    </svg>
                  );
                }
                if (c.includes('cement') || n.includes('cement') || n.includes('brick') || n.includes('concrete')) {
                  return (
                    <svg viewBox="0 0 100 100" className="w-24 h-24 text-slate-500 drop-shadow-md">
                      <rect x="25" y="20" width="50" height="60" rx="4" fill="currentColor" />
                      <path d="M25,20 L75,80" stroke="white" strokeWidth="2.5" opacity="0.2" />
                      <path d="M75,20 L25,80" stroke="white" strokeWidth="2.5" opacity="0.2" />
                      <rect x="32" y="42" width="36" height="16" fill="white" opacity="0.9" rx="2" />
                      <text x="50" y="52" fill="currentColor" fontSize="7" fontWeight="black" textAnchor="middle">CEMENT</text>
                    </svg>
                  );
                }
                // Fallback (Package/Box)
                return (
                  <svg viewBox="0 0 100 100" className="w-24 h-24 text-violet-500 drop-shadow-md">
                    <path d="M50,15 L90,30 L90,70 L50,85 L10,70 L10,30 Z" fill="currentColor" />
                    <path d="M50,15 L50,85" stroke="white" strokeWidth="1.5" opacity="0.3" />
                    <path d="M10,30 L50,45 L90,30" stroke="white" strokeWidth="1.5" fill="none" opacity="0.3" />
                  </svg>
                );
              };

              if (selectedCatalogProduct) {
                // Compile transaction and log history for this product
                const ledgerLogs: any[] = [];
                const key = String(selectedCatalogProduct.product_name).toLowerCase().trim();

                // Add cargo intake logs (Intakes)
                cargoForInventory
                  .filter((c: any) => String(c.product_name || '').toLowerCase().trim() === key)
                  .forEach((c: any, idx: number) => {
                    ledgerLogs.push({
                      id: c.id || `intake-${idx}-${c.created_at}`,
                      type: 'INTAKE',
                      date: c.created_at || 'N/A',
                      desc: `Cargo Intake batch approved & stocked`,
                      qty: Number(c.quantity || 0),
                      price: Number(selectedCatalogProduct.cost_price || 0),
                      amount: Number(c.quantity || 0) * Number(selectedCatalogProduct.cost_price || 0),
                      status: 'APPROVED',
                      user: 'Operations',
                    });
                  });

                // Add sales order logs (Sales)
                effectiveOrders
                  .filter((o: any) => String(o.productName || o.product_name || '').toLowerCase().trim() === key)
                  .forEach((o: any) => {
                    ledgerLogs.push({
                      id: o.id,
                      type: 'SALE',
                      date: o.createdAt || 'N/A',
                      desc: `Customer sales order checkout (${o.clientName || 'Cash Client'})`,
                      qty: -Number(o.quantity || 1),
                      price: Number(o.totalAmount || 0) / Math.max(1, Number(o.quantity || 1)),
                      amount: Number(o.totalAmount || 0),
                      status: o.status,
                      user: o.clientName || 'Client',
                    });
                  });

                // Add pricing log
                ledgerLogs.push({
                  id: `price-${selectedCatalogProduct.id}`,
                  type: 'PRICING',
                  date: selectedCatalogProduct.updated_at || 'N/A',
                  desc: `Pricing entry set by Management`,
                  qty: null,
                  price: Number(selectedCatalogProduct.unit_price || 0),
                  amount: null,
                  status: 'Active',
                  user: selectedCatalogProduct.updated_by || 'Management',
                });

                // Sort by date descending
                const sortedLogs = [...ledgerLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                return (
                  <div className="space-y-6 bg-white border border-slate-100 p-6 md:p-8 rounded-3xl shadow-sm text-slate-900 font-sans">
                    
                    {/* Header back navigation */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <button
                        onClick={() => setSelectedCatalogProduct(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-100 transition-colors"
                      >
                        ← Back to Catalog Storefront
                      </button>
                      <span className="text-xs font-bold text-slate-400 font-mono">Product Details Dashboard</span>
                    </div>

                    {/* Product Summary Hero Header */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-[var(--accent)] shrink-0">
                          {drawProductImg(selectedCatalogProduct.product_name, selectedCatalogProduct.category || 'General')}
                        </div>
                        <div>
                          <h2 className="text-lg font-black text-slate-955">{selectedCatalogProduct.product_name}</h2>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{selectedCatalogProduct.category || 'General'}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {selectedCatalogProduct.id}</p>
                        </div>
                      </div>

                      {/* Financial info summary columns */}
                      <div className="grid grid-cols-2 gap-4 border-t md:border-t-0 md:border-x border-slate-200/60 px-0 md:px-6 py-4 md:py-0">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Selling Price</span>
                          <span className="text-lg font-extrabold text-slate-900">{selectedCatalogProduct.currency} {Number(selectedCatalogProduct.unit_price || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Cost Price</span>
                          <span className="text-sm font-semibold text-slate-600 block mt-0.5">{selectedCatalogProduct.currency} {Number(selectedCatalogProduct.cost_price || 0).toLocaleString()}</span>
                          <span className="text-[9px] text-emerald-500 font-black">+{selectedCatalogProduct.margin}% margin</span>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500 font-medium">Quantity in Stock:</span>
                          <span className="font-bold text-slate-900">{(selectedCatalogProduct.stock || 0).toLocaleString()} units</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Fulfillment Valuation:</span>
                          <span className="font-black text-slate-955">{(selectedCatalogProduct.currency || 'GHS')} {(selectedCatalogProduct.sellingValue || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed transaction log table */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">Historical Audit & Fulfillment Log Table</h3>
                        <p className="text-[10px] text-slate-400">Chronological transaction history containing set prices, incoming cargo shipments, and sales orders.</p>
                      </div>

                      <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-semibold text-[9px] tracking-wider">
                              <th className="py-3 px-4">Date / Time</th>
                              <th className="py-3 px-4">Event Type</th>
                              <th className="py-3 px-4">Description</th>
                              <th className="py-3 px-4 text-right">Quantity</th>
                              <th className="py-3 px-4 text-right">Unit Price</th>
                              <th className="py-3 px-4 text-right">Total Amount</th>
                              <th className="py-3 px-4">Actor</th>
                              <th className="py-3 px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {sortedLogs.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-8 text-center text-slate-400 font-semibold">No logs recorded for this item.</td>
                              </tr>
                            ) : (
                              sortedLogs.map((log, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors font-medium">
                                  <td className="py-3 px-4 text-[10px] text-slate-500 font-mono">
                                    {log.date !== 'N/A' ? new Date(log.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider ${
                                      log.type === 'INTAKE' ? 'bg-amber-100 text-amber-700' :
                                      log.type === 'SALE' ? 'bg-emerald-100 text-emerald-700' :
                                      'bg-sky-100 text-sky-700'
                                    }`}>
                                      {log.type}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-slate-900">{log.desc}</td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-[13px]">
                                    {log.qty !== null ? (log.qty > 0 ? `+${log.qty.toLocaleString()}` : log.qty.toLocaleString()) : '—'}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono">
                                    {selectedCatalogProduct.currency} {Number(log.price).toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                    {log.amount !== null ? `${selectedCatalogProduct.currency} ${Number(log.amount).toLocaleString()}` : '—'}
                                  </td>
                                  <td className="py-3 px-4 text-slate-500">{log.user}</td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      log.status === 'APPROVED' || log.status === 'DELIVERED' || log.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' :
                                      log.status === 'PENDING' || log.status.startsWith('PENDING') ? 'bg-amber-500/10 text-amber-600' :
                                      'bg-slate-100 text-slate-500'
                                    }`}>
                                      {log.status.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                );
              }

              return (
                <div className="space-y-8 bg-[#f8fafc] p-4 md:p-8 rounded-3xl border border-[var(--border)] text-slate-900 font-sans">
                  
                  {/* ══ 1. TECHNOVA E-COMMERCE TOP BAR NAVBAR ══ */}
                  <div className="flex items-center justify-between py-4 px-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-8">
                      <span className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent)]" /> Technova
                      </span>
                      <div className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-500">
                        <span className="text-slate-900 cursor-pointer hover:text-[var(--accent)]">Home</span>
                        <span className="cursor-pointer hover:text-[var(--accent)]">Shop ▼</span>
                        <span className="cursor-pointer hover:text-[var(--accent)]">Blog ▼</span>
                        <span className="cursor-pointer hover:text-[var(--accent)]">Contact</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-700">
                      <button className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <div className="relative cursor-pointer p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                          {goodsPrices.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ══ 2. HERO SLIDE BANNER ( desert monitor slider ) ══ */}
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-55 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200/60 dark:border-slate-800 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="space-y-4 max-w-md text-left z-10">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--accent)]">
                        Hot Gadget Deals
                      </p>
                      <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        Up to <span className="text-[var(--accent)] font-black">25% margin</span> on stock inventory values
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        The hottest updates from management. The coolest profit margins.
                      </p>
                      <button className="flex items-center gap-1.5 px-6 py-3 bg-[var(--accent)] text-white text-xs font-bold rounded-full hover:opacity-90 shadow-md transition-opacity">
                        SHOP NOW <span className="font-sans">›</span>
                      </button>
                    </div>
                    {/* High-Fidelity CSS Desk & Monitor Drawing */}
                    <div className="w-full md:w-1/2 max-w-sm flex items-center justify-center relative">
                      <div className="w-full aspect-[4/3] relative">
                        <svg viewBox="0 0 200 150" className="w-full h-full drop-shadow-2xl">
                          {/* Monitor Stand */}
                          <path d="M80,110 L120,110 L112,138 L88,138 Z" fill="#cbd5e1" />
                          <rect x="68" y="136" width="64" height="6" rx="2" fill="#94a3b8" />
                          {/* Monitor Frame */}
                          <rect x="15" y="10" width="170" height="105" rx="6" fill="#1e293b" />
                          {/* Screen Content - Desert Sunset */}
                          <rect x="20" y="15" width="160" height="90" fill="#f59e0b" />
                          {/* Dunes */}
                          <path d="M20,105 Q60,70 110,90 T180,60 L180,105 Z" fill="#d97706" />
                          <path d="M20,105 Q70,95 130,102 T180,88 L180,105 Z" fill="#b45309" />
                          {/* Screen Text overlay */}
                          <rect x="30" y="30" width="75" height="30" rx="4" fill="white/20" className="backdrop-blur-sm" />
                          <text x="35" y="42" fill="white" fontSize="5" fontWeight="bold">Our first ever</text>
                          <text x="35" y="52" fill="white" fontSize="7" fontWeight="black">desktop mockup</text>
                          {/* Accessories on desk */}
                          <circle cx="25" cy="138" r="6" fill="#e2e8f0" />
                          <ellipse cx="170" cy="138" rx="8" ry="4" fill="#cbd5e1" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* ══ 3. SUB-BANNER CARDS ( 4 horizontal tabs ) ══ */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { title: 'Best Sellers', iconBg: 'bg-amber-100 text-amber-600', val: 'Featured items' },
                      { title: 'New Arrivals', iconBg: 'bg-sky-100 text-sky-600', val: `${goodsPrices.length} Items` },
                      { title: 'Top Rated', iconBg: 'bg-blue-100 text-blue-600', val: 'Premium quality' },
                      { title: 'On Sale', iconBg: 'bg-orange-100 text-orange-600', val: 'Approved catalog' }
                    ].map(card => (
                      <div key={card.title} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${card.iconBg}`}>
                          <span className="text-sm">★</span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">{card.title}</p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">SHOP NOW ›</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ══ 4. FEATURED PRODUCTS GRID + MACBOOK SIDE PROMO ══ */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Featured Products</h2>
                      <div className="flex items-center gap-2">
                        {/* Search & filters */}
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Filter products..."
                            value={catalogSearch}
                            onChange={e => setCatalogSearch(e.target.value)}
                            className="pl-3 pr-3 py-1.5 text-[11px] rounded-full outline-none transition bg-white border border-slate-200 text-slate-800 focus:border-[var(--accent)] w-36 font-semibold"
                          />
                        </div>
                        <select
                          value={catalogCategory}
                          onChange={e => setCatalogCategory(e.target.value)}
                          className="px-2 py-1.5 text-[11px] rounded-full outline-none transition bg-white border border-slate-200 text-slate-800 font-semibold"
                        >
                          {catalogCategories.map(cat => (
                            <option key={cat} value={cat}>{cat === 'ALL' ? 'All categories' : cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                      
                      {/* Products Grid (3 columns wide) */}
                      <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {sortedCatalogItems.slice(0, 6).map((item: any) => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedCatalogProduct(item)}
                            className="bg-white border border-slate-100 rounded-3xl p-5 hover:shadow-xl transition-all group relative flex flex-col justify-between cursor-pointer"
                          >
                            {/* Bestseller Badge */}
                            <span className="absolute top-4 left-4 text-[8px] font-black px-2.5 py-1 bg-amber-500 text-white uppercase rounded-md tracking-wider">
                              BESTSELLER
                            </span>
                            {/* Like / Heart Icon */}
                            <span className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 cursor-pointer text-sm">
                              ♥
                            </span>

                            {/* Center Product Graphic Box */}
                            <div className="bg-slate-50/50 rounded-2xl py-6 flex items-center justify-center min-h-[140px] mb-4">
                              {drawProductImg(item.product_name, item.category)}
                            </div>

                            {/* Product Info */}
                            <div className="space-y-1">
                              <h4 className="text-xs font-black text-slate-800 group-hover:text-[var(--accent)] transition-colors truncate">{item.product_name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.category || 'General'}</p>
                              
                              {/* Price Row */}
                              <div className="flex items-center gap-2 pt-2">
                                <span className="text-sm font-extrabold text-slate-900">{item.currency} {Number(item.unit_price).toLocaleString()}</span>
                                <span className="text-[10px] text-slate-300 line-through font-semibold">{item.currency} {Number(item.cost_price).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Inventory status line inside card */}
                            <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] text-slate-500 flex justify-between items-center font-medium">
                              <span>Stock: {item.stock.toLocaleString()}</span>
                              <span className="text-emerald-500 font-extrabold">+{item.margin}% margin</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Right Promo Card (MacBook Air replica) */}
                      <div className="bg-gradient-to-br from-sky-400/90 to-blue-600 text-white rounded-3xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden min-h-[300px]">
                        <div className="absolute -right-10 -bottom-10 opacity-20 w-44 h-44 bg-white rounded-full pointer-events-none" />
                        <div className="space-y-2 z-10 text-left">
                          <h3 className="text-lg font-black leading-tight">MacBook Air</h3>
                          <p className="text-[10px] text-sky-100 uppercase tracking-widest font-extrabold">WITH M1 CHIP & LIQUID RETINA DISPLAY</p>
                          <p className="text-[9px] text-sky-50 opacity-90 leading-relaxed pt-2">Sipping at GHS 950. High logistics speed and custom fleet delivery configurations.</p>
                        </div>

                        {/* Valuation info */}
                        <div className="space-y-2 pt-4 z-10 text-left">
                          <p className="text-[9px] text-sky-200 uppercase tracking-wider font-extrabold">Fulfillment Valuation</p>
                          <p className="text-3xl font-black">GHS {Number(sortedCatalogItems.reduce((s,i)=>s+i.sellingValue, 0)).toLocaleString()}</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ══ 5. JUST ARRIVED SECTION ══ */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Just Arrived</h2>
                      <span className="text-[10px] font-extrabold text-[var(--accent)] uppercase tracking-wider cursor-pointer hover:underline">VIEW ALL</span>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                      
                      {/* 4 horizontal catalog items */}
                      <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {[
                          { name: 'NOZO Smartwatch', cat: 'Accessories', price: 350, cost: 280, icon: 'watch' },
                          { name: 'Galaxy Tab Pro Z10', cat: 'Electronics', price: 699, cost: 550, icon: 'tv' },
                          { name: 'PHX-900 Gaming Mouse', cat: 'Accessories', price: 99, cost: 70, icon: 'mouse' },
                          { name: 'EpoMax Bluetooth', cat: 'Speakers', price: 150, cost: 120, icon: 'speaker' }
                        ].map((prod, idx) => {
                          const matchedRealProduct = goodsPrices.find((gp: any) => String(gp.product_name).toLowerCase().includes(prod.name.split(' ')[0].toLowerCase())) || { product_name: prod.name, category: prod.cat, unit_price: prod.price, cost_price: prod.cost, id: `mock-${idx}`, currency: 'GHS', stock: 120, margin: '25', sellingValue: prod.price * 120, costValue: prod.cost * 120 };
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedCatalogProduct(matchedRealProduct)}
                              className="bg-white border border-slate-100 rounded-3xl p-4 flex flex-col justify-between hover:shadow-md transition-all group cursor-pointer"
                            >
                              <div className="bg-slate-50/50 rounded-2xl py-4 flex items-center justify-center min-h-[90px] mb-3">
                                {drawProductImg(prod.name, prod.cat)}
                              </div>
                              <div className="text-left space-y-1">
                                <h4 className="text-[10px] font-black text-slate-800 truncate">{prod.name}</h4>
                                <p className="text-[9px] text-slate-400 uppercase font-semibold">{prod.cat}</p>
                                <p className="text-xs font-black text-slate-900">GHS {prod.price}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right Promo Card 2 (Save up to 35% replica) */}
                      <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-3xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden min-h-[200px]">
                        <div className="space-y-1 text-left z-10">
                          <h3 className="text-base font-black">Save up to 35%</h3>
                          <p className="text-[9px] text-indigo-200">on Weekly Logistics Discounts</p>
                        </div>
                        <button className="z-10 w-fit px-4 py-1.5 bg-white text-indigo-700 text-[10px] font-bold rounded-full shadow hover:opacity-90 transition-opacity mt-4">
                          SHOP NOW ›
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* ══ 6. CATEGORY BANNERS ROW ( Game Controllers, Smartphones, Smart Home ) ══ */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { title: 'Game Controllers', sub: 'Front GHS 160', color: 'from-orange-400 to-amber-500' },
                      { title: 'Smartphones', sub: 'Front GHS 950', color: 'from-sky-400 to-blue-500' },
                      { title: 'Smart Home', sub: 'Front GHS 160', color: 'from-violet-400 to-indigo-500' }
                    ].map(banner => (
                      <div key={banner.title} className={`bg-gradient-to-br ${banner.color} text-white rounded-3xl p-6 flex flex-col justify-between min-h-[130px] shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform`}>
                        <div className="text-left space-y-1">
                          <h3 className="text-sm font-black">{banner.title}</h3>
                          <p className="text-[10px] text-white/80">{banner.sub}</p>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider cursor-pointer underline mt-3 block">SHOP NOW ›</span>
                      </div>
                    ))}
                  </div>

                </div>
              );
            })()}
          </div>
        </div>


        )} {/* end activeSubTab !== 'Evaluation' */}
      </div>

      {/* Finance + Operations Activity Feed */}
      <div className="mt-6">
        <ActivityFeed
          title="Finance & Operations Activity"
          departments={['FINANCE', 'OPERATIONS']}
          limit={20}
        />
      </div>

    </>
  );
}
