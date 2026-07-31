import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PendingApprovalsAlert from '../../components/global/PendingApprovalsAlert';
import ApprovalHistoryPanel from '../../components/global/ApprovalHistoryPanel';
import FinanceMaterialRequisitionsPanel from './MaterialRequisitionsPanel';
import ProductCatalogCard from '../../components/ProductCatalogCard';
import CountUp from '../../components/CountUp';
import {
  DollarSign, FileText, ClipboardCheck, BarChart2, CreditCard, Receipt,
  TrendingUp, TrendingDown, ArrowRight, RefreshCw, Tag,
  Clock, CheckCircle, AlertTriangle, Building2, Package,
  ShoppingCart, Wallet, Zap, Star, Activity, FileSpreadsheet, Share2, Printer, Search, ArrowUpRight, ArrowDownLeft, Eye, Trash2, Layers, X, History, ArrowLeft
} from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../utils/export';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts';

interface Props {
  addNotification?: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
  currentUser?: { fullName: string; department: string } | null;
  ordersList?: { id: string; clientName: string; totalAmount: number; status: string; paymentMode?: string; createdAt?: string; productName?: string; quantity?: number }[];
  onEvaluateOrder?: (id: string, approve: boolean) => void;
}

interface Bill { id: string; desc: string; amount: number; due: string; status: string; }
interface MonthlyRevenue { month: string; value: number; }
interface PaymentSlice { name: string; value: number; color: string; }
interface CashflowPoint { month: string; income: number; expense: number; }
interface RecentPrice { id: string; product_name: string; unit_price: number; cost_price: number; currency: string; updated_at: string; }

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const stockStatus = (current: number, capacity: number) => {
  if (current === 0) return { label: 'Out of Stock', bg: '#ffe4e6', color: '#9f1239' };
  if (capacity > 0 && current / capacity < 0.2) return { label: 'Low Stock', bg: '#fef3c7', color: '#92400e' };
  return { label: 'In Stock', bg: '#d1fae5', color: '#065f46' };
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: GHS {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</p>
      ))}
    </div>
  );
};

export default function FinanceOverviewView({ addNotification, setActiveSubTab, currentUser, ordersList = [], onEvaluateOrder }: Props) {
  const [cashflowTab, setCashflowTab] = useState<'income' | 'expense' | 'savings'>('income');
  const [earnPeriod, setEarnPeriod] = useState('6M');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [creditOutstanding, setCreditOutstanding] = useState(0);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [earningData, setEarningData] = useState<MonthlyRevenue[]>([]);
  const [cashflowData, setCashflowData] = useState<CashflowPoint[]>([]);
  const [paymentPie, setPaymentPie] = useState<PaymentSlice[]>([]);
  const [liveOrders, setLiveOrders] = useState<typeof ordersList>([]);
  const [walletCash, setWalletCash] = useState(0);
  const [walletMomo, setWalletMomo] = useState(0);
  const [walletCheque, setWalletCheque] = useState(0);
  const [walletTotal, setWalletTotal] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [goodsPrices, setGoodsPrices] = useState<any[]>([]);
  const [cargoForInventory, setCargoForInventory] = useState<any[]>([]);
  const [recentPrices, setRecentPrices] = useState<RecentPrice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // New stock and drill-down states
  const [stock, setStock] = useState<any[]>([]);
  const [stockLedger, setStockLedger] = useState<any[]>([]);
  const [approvedCargo, setApprovedCargo] = useState<any[]>([]);
  const [activeDrillDown, setActiveDrillDown] = useState<string | null>(null);
  const [drillDownTab, setDrillDownTab] = useState<'raw' | 'finished'>('raw');
  const [drillDownSubTab, setDrillDownSubTab] = useState<'a' | 'b'>('a');
  const [drillDownSearch, setDrillDownSearch] = useState('');
  const [selectedLedgerProduct, setSelectedLedgerProduct] = useState<any | null>(null);
  const [cargoDiscrepancies, setCargoDiscrepancies] = useState<any[]>([]);

  const fetchAllData = async () => {
    setIsRefreshing(true);

    // Fetch stock live
    supabase.from('stock').select('*').then(({ data }) => {
      if (data) setStock(data);
    }, () => {});

    // Fetch stock ledger live
    supabase.from('stock_ledger').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setStockLedger(data);
    }, () => {});

    // Fetch cargo intake live
    supabase.from('cargo_intake').select('*').eq('status', 'APPROVED').then(({ data }) => {
      if (data) {
        setApprovedCargo((data as any[]).map((r: any) => ({
          id: String(r.id),
          productName: r.description || r.product_name || r.productName || 'Unknown',
          goodsCode: r.request_id || r.goods_code || String(r.id).slice(0, 8).toUpperCase(),
          quantity: Number(r.quantity ?? 0),
          unit: r.unit || 'units',
          weight: Number(r.weight_kg ?? r.weight ?? 0),
          supplier: r.supplier_name || r.company || '—',
          portOfOrigin: r.port_of_origin || r.country || '—',
          destination: r.destination || 'Accra Warehouse',
          approvedBy: r.approved_by || r.updated_by || '—',
          approvedAt: r.updated_at || r.created_at || '',
        })));
      }
    }, () => {});

    // Orders live fetch
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500).then(({ data }) => {
      if (!data) return;
      const mapped = (data as any[]).map(r => ({
        id: r.id, clientName: r.client_name || '', productName: r.product_name || '',
        totalAmount: Number(r.total_amount || 0), status: r.status || 'PENDING_FINANCE',
        paymentMode: r.payment_mode || 'CASH', createdAt: r.created_at || '',
        quantity: Number(r.quantity || 1)
      }));
      setLiveOrders(mapped as any);
    }, () => {});

    // Payments / wallets
    supabase.from('finance_payments').select('amount, payment_mode').then(({ data }) => {
      if (!data) return;
      let total = 0, cash = 0, momo = 0, cheque = 0;
      for (const p of data as any[]) {
        const amt = Number(p.amount || 0);
        total += amt;
        const m = (p.payment_mode || '').toUpperCase().replace(/[\s_-]/g, '');
        if (m === 'CASH') cash += amt;
        else if (m === 'MOBILEMONEY' || m === 'MOMO') momo += amt;
        else if (m === 'CHEQUE' || m === 'CHECK') cheque += amt;
      }
      setWalletTotal(total); setWalletCash(cash); setWalletMomo(momo); setWalletCheque(cheque);
    }, () => {});

    supabase.from('finance_expenses').select('amount').eq('status', 'Approved').then(({ data }) => {
      if (data) setTotalExpenses((data as any[]).reduce((s, e) => s + Number(e.amount || 0), 0));
    }, () => {});

    supabase.from('goods_prices').select('product_name, unit_price, cost_price, currency, product_image').then(({ data }) => {
      if (data) setGoodsPrices(data as any[]);
    }, () => {});

    // Recently priced catalog items (newest first)
    supabase.from('goods_prices').select('id, product_name, unit_price, cost_price, currency, updated_at')
      .order('updated_at', { ascending: false }).limit(6).then(({ data }) => {
        if (data) setRecentPrices(data as RecentPrice[]);
      }, () => {});

    supabase.from('cargo_intake').select('product_name, quantity').eq('status', 'APPROVED').then(({ data }) => {
      if (data) setCargoForInventory(data as any[]);
    }, () => {});

    supabase.from('cargo_intake')
      .select('id, goods_code, product_name, company, quantity, unit_price, discrepancies, is_fault_or_damaged, status')
      .eq('status', 'APPROVED')
      .eq('is_fault_or_damaged', true)
      .then(({ data }) => {
        if (data) {
          const parsed = data.map((c: any) => {
            let originalQty = c.quantity || 0;
            let damagedCount = 0;
            let unitCost = Number(c.unit_price || 0);
            let costLoss = 0;
            let sellingPriceVal = 0;
            let notes = c.discrepancies || '';

            try {
              if (c.discrepancies && c.discrepancies.trim().startsWith('{')) {
                const parsedJson = JSON.parse(c.discrepancies);
                originalQty = parsedJson.originalQty ?? originalQty;
                damagedCount = parsedJson.damagedCount ?? 0;
                unitCost = parsedJson.unitCost ?? unitCost;
                costLoss = parsedJson.costLoss ?? (damagedCount * unitCost);
                sellingPriceVal = parsedJson.sellingPrice ?? 0;
                notes = parsedJson.notes ?? '';
              } else if (c.discrepancies && c.discrepancies !== 'None') {
                const dmgMatch = c.discrepancies.match(/Confirmed:\s*(\d+)/i);
                if (dmgMatch) {
                  damagedCount = parseInt(dmgMatch[1], 10);
                  costLoss = damagedCount * unitCost;
                }
              }
            } catch (err) {
              console.error('Error parsing discrepancies JSON:', err);
            }

            return {
              id: c.id,
              goodsCode: c.goods_code || c.id,
              productName: c.product_name || 'Unknown',
              company: c.company || 'N/A',
              originalQty,
              damagedCount,
              unitCost,
              costLoss,
              sellingPrice: sellingPriceVal,
              notes
            };
          }).filter((d: any) => d.damagedCount > 0);
          setCargoDiscrepancies(parsed);
        }
      }, () => {});

    try {
      const { data: bills } = await supabase.from('finance_expenses')
        .select('id, description, amount, due_date, status')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true }).limit(5);
      if (bills) {
        setUpcomingBills(bills.map((b: any) => ({
          id: b.id, desc: b.description, amount: b.amount, due: b.due_date,
          status: new Date(b.due_date) < new Date() ? 'Overdue' : b.status === 'PENDING' ? 'Due Soon' : 'Scheduled',
        })));
      }

      const { data: orders } = await supabase.from('orders').select('total_amount, created_at').in('status', ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY']);
      const { data: payments } = await supabase.from('finance_payments').select('amount, created_at');
      const { data: expenses } = await supabase.from('finance_expenses').select('amount, created_at');

      const monthKey = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString('en-GB', { month: 'short' }); };
      const nMonths = earnPeriod === '3M' ? 3 : earnPeriod === '12M' ? 12 : 6;
      const last = Array.from({ length: nMonths }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - (nMonths - 1 - i));
        return d.toLocaleDateString('en-GB', { month: 'short' });
      });

      const revenueMap: Record<string, number> = {};
      const paymentMap: Record<string, number> = {};
      const expenseMap: Record<string, number> = {};
      for (const o of (orders || []) as any[]) { const k = monthKey(o.created_at); revenueMap[k] = (revenueMap[k] || 0) + Number(o.total_amount || 0); }
      for (const p of (payments || []) as any[]) { const k = monthKey(p.created_at); paymentMap[k] = (paymentMap[k] || 0) + Number(p.amount || 0); }
      for (const e of (expenses || []) as any[]) { const k = monthKey(e.created_at); expenseMap[k] = (expenseMap[k] || 0) + Number(e.amount || 0); }

      const earning = last.map(k => ({ month: k, value: (paymentMap[k] || 0) + (revenueMap[k] || 0) }));
      setEarningData(earning);
      setCashflowData(earning.map(p => ({ month: p.month, income: p.value, expense: expenseMap[p.month] || 0 })));
    } catch { /* silent */ }

    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchAllData();

    // Subscribe to real-time changes
    const channel = supabase.channel('finance-overview-realtime-' + Math.random().toString(36).substring(7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_payments' }, () => {
        fetchAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_expenses' }, () => {
        fetchAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => {
        fetchAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const effective = liveOrders.length > 0 ? liveOrders : ordersList;
    const rev = effective.reduce((s, o) => s + (['DELIVERED', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status) ? o.totalAmount : 0), 0);
    setTotalRevenue(rev || 0);
    setPendingCount(effective.filter(o => o.status === 'PENDING_FINANCE').length || 0);
    setInvoiceCount(effective.filter(o => ['APPROVED', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status)).length || 0);
    setCreditOutstanding(effective.filter(o => o.paymentMode === 'CREDIT').reduce((s, o) => s + o.totalAmount, 0) || 0);

    const total = effective.length || 1;
    const modeGroups: Record<string, number> = {};
    for (const o of effective) { modeGroups[o.paymentMode || 'CASH'] = (modeGroups[o.paymentMode || 'CASH'] || 0) + 1; }
    const modeColors: Record<string, string> = { CASH: '#10b981', CHEQUE: '#3b82f6', MOBILE_MONEY: '#f59e0b', CREDIT: '#ef4444' };
    const modeLabels: Record<string, string> = { CASH: 'Cash', CHEQUE: 'Cheque', MOBILE_MONEY: 'Mobile Money', CREDIT: 'Credit' };
    setPaymentPie(Object.entries(modeGroups).map(([k, v]) => ({ name: modeLabels[k] || k, value: Math.round((v / total) * 100), color: modeColors[k] || '#94a3b8' })));
  }, [liveOrders, ordersList]);

  const firstName = currentUser?.fullName?.split(' ')[0] || 'Finance';
  const effective = liveOrders.length > 0 ? liveOrders : ordersList;
  const pendingOrders = effective.filter(o => o.status === 'PENDING_FINANCE');

  // Helper to categorize raw materials vs finished products
  const isRawMaterial = (productName: string) => {
    if (!productName) return true;
    const nameLower = productName.toLowerCase().trim();
    
    // Check if item is explicitly set as INCOMING_GOODS in stock
    const stockItem = stock.find(s => s.product_name.toLowerCase().trim() === nameLower);
    if (stockItem) {
      return stockItem.category === 'INCOMING_GOODS';
    }
    
    // Check goods_prices category
    const gp = goodsPrices.find(g => g.product_name.toLowerCase().trim() === nameLower);
    if (gp) {
      return gp.category === 'INCOMING_GOODS' || gp.category === 'RAW_MATERIALS';
    }
    
    // Check approvedCargo
    const isCargo = approvedCargo.some(c => c.productName.toLowerCase().trim() === nameLower);
    if (isCargo) return true;
    
    // Default to raw material
    return true;
  };

  const getPricesForProduct = (name: string) => {
    const gp = goodsPrices.find(g => g.product_name.toLowerCase().trim() === name.toLowerCase().trim());
    return {
      unitPrice: Number(gp?.unit_price || 0),
      costPrice: Number(gp?.cost_price || 0),
      currency: gp?.currency || 'GHS'
    };
  };

  // Helper to extract line items for an order, supporting line item metadata
  const getOrderLineItems = (o: any) => {
    const items: Array<{ productName: string; quantity: number; amount: number }> = [];
    if (o.metadata?.items && Array.isArray(o.metadata.items) && o.metadata.items.length > 0) {
      for (const item of o.metadata.items) {
        items.push({
          productName: item.productName || item.product_name || '',
          quantity: Number(item.quantity || 1),
          amount: Number(item.lineTotal || item.line_total || item.amount || 0)
        });
      }
    } else {
      items.push({
        productName: o.productName || o.product_name || 'Unknown Item',
        quantity: Number(o.quantity || 1),
        amount: Number(o.totalAmount || o.total_amount || 0)
      });
    }
    return items;
  };

  // 1. Total Revenue & 2. Total Items Sold
  const clearedOrders = effective.filter(o => ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(o.status));
  
  // Extract all line items from cleared orders
  const allClearedLineItems: Array<{ productName: string; quantity: number; amount: number }> = [];
  for (const o of clearedOrders) {
    allClearedLineItems.push(...getOrderLineItems(o));
  }

  let rawRev = 0;
  let finRev = 0;
  let rawSoldQty = 0;
  let finSoldQty = 0;

  for (const line of allClearedLineItems) {
    const isRaw = isRawMaterial(line.productName);
    if (isRaw) {
      rawRev += line.amount;
      rawSoldQty += line.quantity;
    } else {
      finRev += line.amount;
      finSoldQty += line.quantity;
    }
  }

  const calculatedTotalRevenue = rawRev + finRev;
  const totalSoldQty = rawSoldQty + finSoldQty;

  // 3. Unsold stock remaining value (selling price valuation)
  const rawRemainingValue = stock.filter(s => s.category === 'INCOMING_GOODS').reduce((sum, s) => {
    const p = getPricesForProduct(s.product_name);
    return sum + (Number(s.quantity || s.current || 0) * p.unitPrice);
  }, 0);
  const finRemainingValue = stock.filter(s => s.category !== 'INCOMING_GOODS').reduce((sum, s) => {
    const p = getPricesForProduct(s.product_name);
    return sum + (Number(s.quantity || s.current || 0) * p.unitPrice);
  }, 0);
  const totalRemainingValue = rawRemainingValue + finRemainingValue;

  // 4. Overall quantity of goods in stock
  const rawStockQty = stock.filter(s => s.category === 'INCOMING_GOODS').reduce((sum, s) => sum + Number(s.quantity || s.current || 0), 0);
  const finStockQty = stock.filter(s => s.category !== 'INCOMING_GOODS').reduce((sum, s) => sum + Number(s.quantity || s.current || 0), 0);
  const totalStockQty = rawStockQty + finStockQty;

  // 5. Overall remaining goods count (distinct products in stock with quantity > 0)
  const rawRemainingGoodsCount = stock.filter(s => s.category === 'INCOMING_GOODS' && Number(s.quantity || s.current || 0) > 0).length;
  const finRemainingGoodsCount = stock.filter(s => s.category !== 'INCOMING_GOODS' && Number(s.quantity || s.current || 0) > 0).length;
  const totalRemainingGoodsCount = rawRemainingGoodsCount + finRemainingGoodsCount;

  // Compute inventory valuation
  const inventoryItems = goodsPrices.map((gp: any) => {
    const key = String(gp.product_name || '').toLowerCase().trim();
    const qty = stock.filter((s: any) => String(s.product_name || '').toLowerCase().trim() === key).reduce((sum: number, s: any) => sum + (Number(s.quantity || s.current || 0)), 0);
    // Match per line-item (metadata.items), not the order's flattened product_name —
    // multi-item orders join names as "Flour Nice, Milk Powder, ..." which never
    // equals a single product key, silently zeroing revenue for every product.
    const clearedOrders = (effective as any[]).filter(o => ['APPROVED','PROCESSING','DELIVERED','OUT_FOR_DELIVERY'].includes(o.status));
    let soldRevenue = 0;
    for (const o of clearedOrders) {
      const items = o.metadata?.items;
      if (Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          if (String(it.productName || it.product_name || '').toLowerCase().trim() === key) {
            soldRevenue += Number(it.lineTotal || it.line_total || it.amount || 0);
          }
        }
      } else if (String(o.productName || o.product_name || '').toLowerCase().trim() === key) {
        soldRevenue += Number(o.totalAmount || o.total_amount || 0);
      }
    }
    // Actual quantity sold — real stock_ledger deductions, not order line-item estimates
    const soldQty = stockLedger.filter(l => l.movement_type === 'REMOVE' && String(l.product_name || '').toLowerCase().trim() === key)
      .reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    return { name: gp.product_name, unitPrice: Number(gp.unit_price || 0), costPrice: Number(gp.cost_price || 0), currency: gp.currency || 'GHS', qty, sellingValue: Number(gp.unit_price || 0) * qty, costValue: Number(gp.cost_price || 0) * qty, soldRevenue, soldQty, image: gp.product_image || '' };
  });
  const totalSell = inventoryItems.reduce((s, i) => s + i.sellingValue, 0);
  const totalCost = inventoryItems.reduce((s, i) => s + i.costValue, 0);
  const totalRevEarned = inventoryItems.reduce((s, i) => s + i.soldRevenue, 0);

  const netBalance = walletTotal - totalExpenses;

  const kpiCards = [
    {
      label: 'Total Revenue', value: calculatedTotalRevenue, prefix: 'GHS ', suffix: '',
      title: `GHS ${calculatedTotalRevenue.toLocaleString()}`,
      sub: 'Approved & delivered sales', icon: DollarSign, clickId: 'revenue',
      color: '#10b981', bg: 'from-emerald-500/10 to-emerald-500/5',
      change: '+8.2%', up: true,
    },
    {
      label: 'Total Items Sold', value: totalSoldQty, prefix: '', suffix: ' units',
      title: `${totalSoldQty.toLocaleString()} units`,
      sub: 'Items sold from cleared orders', icon: ShoppingCart, clickId: 'sold',
      color: '#3b82f6', bg: 'from-blue-500/10 to-blue-500/5',
      change: 'Active', up: true,
    },
    {
      label: 'Remaining Sales Value', value: totalRemainingValue, prefix: 'GHS ', suffix: '',
      title: `GHS ${totalRemainingValue.toLocaleString()}`,
      sub: 'Unsold stock remaining value', icon: TrendingUp, clickId: 'remaining',
      color: '#f59e0b', bg: 'from-amber-500/10 to-amber-500/5',
      change: 'In Stock', up: true,
    },
    {
      label: 'Overall Goods in Stock', value: totalStockQty, prefix: '', suffix: ' units',
      title: `${totalStockQty.toLocaleString()} units`,
      sub: 'Total physical goods count', icon: Package, clickId: 'overall_qty',
      color: '#8b5cf6', bg: 'from-violet-500/10 to-violet-500/5',
      change: 'Updated', up: true,
    },
    {
      label: 'Overall Remaining Goods', value: totalRemainingGoodsCount, prefix: '', suffix: ' Items',
      title: `${totalRemainingGoodsCount} Items`,
      sub: 'Count of active distinct SKUs', icon: Activity, clickId: 'overall_rem',
      color: '#ec4899', bg: 'from-pink-500/10 to-pink-500/5',
      change: 'Active', up: true,
    },
  ];
  // Helper calculations for Drill-downs using the same grouped cleared line items
  const rawRevOrdersGroup = Array.from(new Set(allClearedLineItems.filter(li => isRawMaterial(li.productName)).map(li => li.productName.trim()))).map(name => {
    const itemsForProduct = allClearedLineItems.filter(li => li.productName.toLowerCase().trim() === name.toLowerCase().trim());
    const totalQty = itemsForProduct.reduce((sum, li) => sum + li.quantity, 0);
    const totalRevenue = itemsForProduct.reduce((sum, li) => sum + li.amount, 0);
    const prices = getPricesForProduct(name);
    return { name, unitPrice: prices.unitPrice, totalQty, totalRevenue };
  });

  const finRevOrdersGroup = Array.from(new Set(allClearedLineItems.filter(li => !isRawMaterial(li.productName)).map(li => li.productName.trim()))).map(name => {
    const itemsForProduct = allClearedLineItems.filter(li => li.productName.toLowerCase().trim() === name.toLowerCase().trim());
    const totalQty = itemsForProduct.reduce((sum, li) => sum + li.quantity, 0);
    const totalRevenue = itemsForProduct.reduce((sum, li) => sum + li.amount, 0);
    const prices = getPricesForProduct(name);
    return { name, unitPrice: prices.unitPrice, totalQty, totalRevenue };
  });

  const rawRemainingGroup = stock.filter(s => s.category === 'INCOMING_GOODS').map(s => {
    const name = s.product_name;
    const prices = getPricesForProduct(name);
    const qty = Number(s.quantity || s.current || 0);
    return {
      name,
      qty,
      unitPrice: prices.unitPrice,
      costPrice: prices.costPrice,
      sellingVal: qty * prices.unitPrice,
      costVal: qty * prices.costPrice
    };
  });

  const finRemainingGroup = stock.filter(s => s.category !== 'INCOMING_GOODS').map(s => {
    const name = s.product_name;
    const prices = getPricesForProduct(name);
    const qty = Number(s.quantity || s.current || 0);
    return {
      name,
      qty,
      unitPrice: prices.unitPrice,
      costPrice: prices.costPrice,
      sellingVal: qty * prices.unitPrice,
      costVal: qty * prices.costPrice
    };
  });

  const rawCargoLotsDetail = approvedCargo.map(c => {
    const name = c.productName;
    const currentStockItem = stock.find(s => s.product_name.toLowerCase().trim() === name.toLowerCase().trim());
    const totalStockQty = Number(currentStockItem?.quantity || 0);
    return {
      id: c.goodsCode || c.id,
      name,
      qtyReceived: c.quantity,
      weight: c.weight,
      supplier: c.supplier,
      approvedAt: c.approvedAt,
      remainingQty: totalStockQty
    };
  });

  const rawStockSummary = stock.filter(s => s.category === 'INCOMING_GOODS').map(s => {
    const qty = Number(s.quantity || s.current || 0);
    const status = stockStatus(qty, Number(s.maximum_level || 1000));
    return {
      name: s.product_name,
      code: s.product_code || s.id.slice(0, 8).toUpperCase(),
      category: s.category,
      unit: s.unit || 'units',
      status,
      qty
    };
  });

  const finLedgerData = stockLedger.filter(l => !isRawMaterial(l.product_name || '')).slice(0, 100).map(l => ({
    id: l.id,
    date: l.created_at,
    name: l.product_name,
    type: l.movement_type,
    qty: Number(l.quantity || 0),
    notes: l.notes || '',
    performedBy: l.performed_by || 'System'
  }));

  const finStockSummary = stock.filter(s => s.category !== 'INCOMING_GOODS').map(s => {
    const qty = Number(s.quantity || s.current || 0);
    const status = stockStatus(qty, Number(s.maximum_level || 1000));
    return {
      name: s.product_name,
      code: s.product_code || s.id.slice(0, 8).toUpperCase(),
      category: s.category,
      unit: s.unit || 'units',
      status,
      qty
    };
  });

  const getDrillDownData = () => {
    let baseData: any[] = [];
    if (activeDrillDown === 'revenue') {
      baseData = drillDownTab === 'raw' ? rawRevOrdersGroup : finRevOrdersGroup;
    } else if (activeDrillDown === 'sold') {
      baseData = drillDownTab === 'raw' ? rawRevOrdersGroup : finRevOrdersGroup;
    } else if (activeDrillDown === 'remaining') {
      baseData = drillDownTab === 'raw' ? rawRemainingGroup : finRemainingGroup;
    } else if (activeDrillDown === 'overall_qty') {
      if (drillDownTab === 'raw') {
        baseData = drillDownSubTab === 'a' ? rawCargoLotsDetail : rawStockSummary;
      } else {
        baseData = drillDownSubTab === 'a' ? finLedgerData : finStockSummary;
      }
    } else if (activeDrillDown === 'overall_rem') {
      baseData = (drillDownTab === 'raw' ? rawStockSummary : finStockSummary).filter(x => x.qty > 0);
    }
    
    if (!drillDownSearch) return baseData;
    const q = drillDownSearch.toLowerCase().trim();
    return baseData.filter(item => 
      String(item.name || item.product_name || item.itemName || '').toLowerCase().includes(q) ||
      String(item.id || item.code || '').toLowerCase().includes(q) ||
      String(item.supplier || '').toLowerCase().includes(q)
    );
  };

  const getDrillDownHeaders = () => {
    if (activeDrillDown === 'revenue') {
      return ['name', 'unitPrice', 'totalQty', 'totalRevenue'];
    }
    if (activeDrillDown === 'sold') {
      return ['name', 'totalQty', 'totalRevenue'];
    }
    if (activeDrillDown === 'remaining') {
      return ['name', 'qty', 'unitPrice', 'sellingVal', 'costVal'];
    }
    if (activeDrillDown === 'overall_qty') {
      if (drillDownTab === 'raw') {
        return drillDownSubTab === 'a' 
          ? ['id', 'name', 'qtyReceived', 'weight', 'supplier', 'approvedAt', 'remainingQty']
          : ['name', 'code', 'category', 'unit', 'qty'];
      } else {
        return drillDownSubTab === 'a'
          ? ['date', 'name', 'type', 'qty', 'notes', 'performedBy']
          : ['name', 'code', 'category', 'unit', 'qty'];
      }
    }
    if (activeDrillDown === 'overall_rem') {
      return ['name', 'code', 'category', 'unit', 'qty'];
    }
    return [];
  };

  const renderDrillDownTable = () => {
    const data = getDrillDownData();
    const headers = getDrillDownHeaders();
    if (data.length === 0) {
      return <div className="p-8 text-center text-xs text-[var(--text-muted)]">No items found matching the filter criteria.</div>;
    }
    
    return (
      <table className="w-full text-xs text-left">
        <thead className="bg-[var(--bg-input)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold text-[10px]">
          <tr>
            {headers.map(h => (
              <th key={h} className="px-4 py-3">{h.replace(/([A-Z])/g, ' $1').trim()}</th>
            ))}
            <th className="px-4 py-3 text-right">Statement & History</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
          {data.map((item, idx) => (
            <tr key={idx} className="hover:bg-[var(--accent-light)] transition-all">
              {headers.map(col => {
                const val = item[col];
                let displayed = String(val ?? '—');
                if (['unitPrice', 'totalRevenue', 'sellingVal', 'costVal', 'costPrice'].includes(col)) {
                  displayed = `GHS ${Number(val || 0).toLocaleString()}`;
                } else if (['qty', 'qtyReceived', 'totalQty', 'remainingQty'].includes(col)) {
                  displayed = Number(val || 0).toLocaleString();
                } else if (col === 'approvedAt' || col === 'date') {
                  displayed = val ? new Date(val).toLocaleDateString('en-GB') : '—';
                }
                
                return (
                  <td key={col} className={`px-4 py-3 font-medium ${col === 'name' || col === 'id' || col === 'code' ? 'font-semibold' : ''}`}>
                    {col === 'status' && typeof val === 'object' ? (
                      <span className="px-2 py-0.5 rounded-full font-bold text-[9px]" style={{ background: val.bg, color: val.color }}>
                        {val.label}
                      </span>
                    ) : displayed}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => setSelectedLedgerProduct(item)}
                  className="p-1 rounded-lg hover:bg-[var(--accent-light)] hover:text-[var(--accent)] text-[var(--text-secondary)] transition-all inline-flex items-center gap-1 cursor-pointer border border-[var(--border)]"
                  title="View statement and complete transaction history"
                >
                  <History size={13} className="shrink-0 text-[var(--accent)]" />
                  <span className="text-[10px] font-semibold">Statement</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto text-[var(--text-primary)]">

      {/* ══ HERO BANNER ══ */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 80% 50%, var(--accent) 0%, transparent 60%)' }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">
                Finance E-Commerce Portal
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{timeGreeting()}, {firstName} 👋</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { fetchAllData(); addNotification?.('Dashboard refreshed'); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
        {/* Quick Action Pills */}
        <div className="relative z-10 flex items-center gap-2 flex-wrap mt-4">
          <button
            onClick={() => setActiveSubTab?.('OrdersQueue')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <ClipboardCheck size={12} /> Approvals
            {pendingOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/25 text-[10px] font-extrabold">{pendingOrders.length}</span>
            )}
          </button>
          {[
            { label: 'Record Payment', tab: 'RecordPayment', icon: DollarSign },
            { label: 'Orders Queue', tab: 'OrdersQueue', icon: ClipboardCheck },
            { label: 'Invoices', tab: 'Invoices', icon: FileText },
            { label: 'Credit Mgmt', tab: 'CreditMgmt', icon: CreditCard },
            { label: 'New Items', tab: 'PriceCatalog', icon: Tag },
            { label: 'Reports', tab: 'FinReports', icon: BarChart2 },
            { label: 'Petty Cash', tab: 'PettyCash', icon: Receipt },
          ].map(({ label, tab, icon: Icon }) => (
            <button key={tab} onClick={() => setActiveSubTab?.(tab)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-all">
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending approvals alert */}
      <PendingApprovalsAlert department="FINANCE" onNavigate={setActiveSubTab} addNotification={addNotification} />

      <FinanceMaterialRequisitionsPanel addNotification={addNotification} currentUser={currentUser} />
      <ApprovalHistoryPanel department="FINANCE" />

      {/* ══ KPI CARDS ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 font-sans">
        {kpiCards.map(({ label, value, prefix, suffix, title, sub, icon: Icon, clickId, color, change, up }) => {
          const isActive = activeDrillDown === clickId;
          return (
            <div
              key={label}
              onClick={() => {
                setActiveDrillDown(isActive ? null : clickId);
                setDrillDownTab('raw');
                setDrillDownSubTab('a');
                setDrillDownSearch('');
              }}
              className={`bg-[var(--bg-card)] border rounded-2xl p-5 cursor-pointer hover:shadow-lg transition-all group ${
                isActive ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20 scale-[1.02]' : 'border-[var(--border)]'
              }`}
            >
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                  <Icon size={17} style={{ color }} />
                </div>
                <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${up ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                  {up ? <TrendingUp size={9} /> : <AlertTriangle size={9} />} {change}
                </span>
              </div>
              <span className="text-sm sm:text-base lg:text-lg xl:text-xl font-extrabold text-[var(--text-primary)] leading-tight truncate w-full block mb-1" title={title}>
                <CountUp value={value} prefix={prefix} suffix={suffix} />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">{label}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{sub}</p>
            </div>
          );
        })}
      </div>

      {/* ══ DRILL DOWN DETAILED REPORT ══ */}
      {activeDrillDown && !selectedLedgerProduct && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-xl animate-fade-in space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[var(--border)]">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] capitalize">
                {activeDrillDown.replace('_', ' ')} Details
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Detailed live breakdown for audit, statement generation and reporting.
              </p>
            </div>
            
            {/* Search + Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:flex-initial">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search item..."
                  value={drillDownSearch}
                  onChange={e => setDrillDownSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] w-full md:w-48"
                />
              </div>

              <button
                onClick={() => {
                  const dataToExport = getDrillDownData();
                  const headers = getDrillDownHeaders();
                  exportToCSV(dataToExport, headers, `${activeDrillDown}_drilldown`);
                  addNotification?.('CSV report downloaded');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-all cursor-pointer"
              >
                <FileSpreadsheet size={13} /> Export CSV
              </button>

              <button
                onClick={() => {
                  const dataToExport = getDrillDownData();
                  const headers = getDrillDownHeaders();
                  exportToPDF(`${activeDrillDown.toUpperCase().replace('_', ' ')} Detailed Statement`, dataToExport, headers);
                  addNotification?.('PDF statement printed');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-all cursor-pointer"
              >
                <Printer size={13} /> PDF Report
              </button>

              <button
                onClick={() => {
                  const dataToExport = getDrillDownData();
                  const summary = `REBMA Impex - ${activeDrillDown} Details:\n` + dataToExport.slice(0, 5).map(item => `- ${item.name || item.product_name || item.itemName || ''}: ${item.qty || item.quantity || item.totalQty || ''}`).join('\n');
                  navigator.clipboard.writeText(summary).then(() => {
                    addNotification?.('Statement summary link copied');
                  }).catch(() => alert(summary));
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-all cursor-pointer"
              >
                <Share2 size={13} /> Share
              </button>

              <button
                onClick={() => setActiveDrillDown(null)}
                className="px-3 py-1.5 rounded-xl border border-red-500/20 text-red-500 text-xs hover:bg-red-500/15 transition-all cursor-pointer font-bold"
              >
                Close
              </button>
            </div>
          </div>

          {/* Drill-down main tabs */}
          <div className="flex border-b border-[var(--border)] mb-4">
            <button
              onClick={() => { setDrillDownTab('raw'); setDrillDownSubTab('a'); }}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                drillDownTab === 'raw' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)]'
              }`}
            >
              Raw Materials (Cargo Goods)
            </button>
            <button
              onClick={() => { setDrillDownTab('finished'); setDrillDownSubTab('a'); }}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                drillDownTab === 'finished' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)]'
              }`}
            >
              Finished Products (Company Produce)
            </button>
          </div>

          {/* Sub-tabs for Overall Quantity card */}
          {activeDrillDown === 'overall_qty' && (
            <div className="flex gap-2 mb-4 bg-[var(--bg-input)] p-1 rounded-xl w-fit">
              <button
                onClick={() => setDrillDownSubTab('a')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  drillDownSubTab === 'a' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'
                }`}
              >
                {drillDownTab === 'raw' ? 'By Cargo Lots (Lots In/Remaining)' : 'Production Ledger (History)'}
              </button>
              <button
                onClick={() => setDrillDownSubTab('b')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  drillDownSubTab === 'b' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'
                }`}
              >
                Product Stock Summary
              </button>
            </div>
          )}

          {/* Data Tables */}
          <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
            {renderDrillDownTable()}
          </div>
        </div>
      )}

      {/* ══ LEDGER STATEMENT PAGE ══ */}
      {selectedLedgerProduct && (() => {
        const productName = selectedLedgerProduct.name || selectedLedgerProduct.productName || selectedLedgerProduct.itemName || '';
        const currentPrices = getPricesForProduct(productName);
        
        // Filter ledger entries for this specific product and deduplicate to avoid double-rendering/double-counting
        const rawEntries = stockLedger.filter(l => (l.product_name || '').toLowerCase().trim() === productName.toLowerCase().trim());
        const seenRefs = new Set();
        const seenIds = new Set();
        const seenKeys = new Set();
        const entries: any[] = [];
        for (const e of rawEntries) {
          if (!e) continue;
          if (e.id && seenIds.has(e.id)) continue;
          if (e.id) seenIds.add(e.id);

          const ref = e.reference || e.ref || '';
          const isCargoApprove = ref.toLowerCase().includes('cargo approved') || ref.toLowerCase().includes('cargo intake id');
          const isOrderApprove = ref.toLowerCase().includes('order approved') || ref.toLowerCase().includes('order finalized') || ref.toLowerCase().includes('order dispatched') || ref.toLowerCase().includes('tkt-');

          if (isCargoApprove || isOrderApprove) {
            const normalizedRef = ref.toLowerCase().trim();
            if (seenRefs.has(normalizedRef)) continue;
            seenRefs.add(normalizedRef);
          }

          // Deduplicate by movement type, quantity, notes, and day of date to catch duplicate logs with different random IDs
          const dateVal = e.created_at || e.date || '';
          let dayKey = '';
          if (dateVal) {
            try {
              const d = new Date(dateVal);
              dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            } catch (err) {
              dayKey = dateVal.slice(0, 10);
            }
          }
          const notesText = (e.notes || '').toLowerCase().trim();
          const dupKey = `${e.movement_type || e.movementType}_${e.quantity}_${notesText}_${dayKey}`;
          if (seenKeys.has(dupKey)) continue;
          seenKeys.add(dupKey);

          entries.push(e);
        }
        
        const totalOut = entries.filter(e => e.movement_type === 'REMOVE').reduce((s, e) => s + Number(e.quantity || 0), 0);
        // The `stock` table is the authoritative "what's actually on hand right
        // now" figure — the raw ledger ADD sum below isn't, because cargo
        // batches that were later deleted (fully consumed, or cleared in a
        // reset) leave their historical ADD rows behind with nothing to
        // reverse them. Falling back to totalIn-totalOut only when there's no
        // stock row keeps a product with zero real stock reading as 0, not
        // silently re-deriving from ??? that fallback (`||` treats 0 as
        // missing, `??` doesn't).
        const rawTotalIn = entries.filter(e => e.movement_type === 'ADD').reduce((s, e) => s + Number(e.quantity || 0), 0);
        const netQty = Number(stock.find(s => s.product_name.toLowerCase().trim() === productName.toLowerCase().trim())?.quantity ?? (rawTotalIn - totalOut));
        // Derived so the three headline numbers always reconcile (IN - OUT =
        // Remaining) instead of "Total Received" showing every unit this
        // product has ever received across its whole history — including
        // batches that no longer exist — while Remaining reflects only what's
        // real today. The full historical log below is untouched.
        const totalIn = netQty + totalOut;

        return (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl animate-fade-in overflow-hidden font-sans">

              {/* Header */}
              <div className="bg-gradient-to-r from-[var(--accent)] to-[#0298d0] p-6 text-white shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <button onClick={() => setSelectedLedgerProduct(null)} className="flex items-center gap-1 text-[10px] font-bold text-white/80 hover:text-white mb-2 cursor-pointer">
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest bg-white/25 px-2 py-0.5 rounded-full">
                      Ledger statement & Audit report
                    </span>
                    <h2 className="font-extrabold text-xl mt-1.5">{productName}</h2>
                    <p className="text-white/80 text-xs mt-1">Full statement of stocks, purchases, releases, and movement history</p>
                  </div>
                  <button onClick={() => setSelectedLedgerProduct(null)} className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer text-white shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats Summary Area */}
              <div className="p-6 bg-[var(--bg-input)] border-b border-[var(--border)] shrink-0 grid grid-cols-3 gap-4">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[var(--accent)] mb-1">
                    <ArrowDownLeft size={13} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Total Received (IN)</span>
                  </div>
                  <p className="text-lg font-extrabold text-[var(--text-primary)] font-mono"><CountUp value={totalIn} /></p>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
                    <ArrowUpRight size={13} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Total Released (OUT)</span>
                  </div>
                  <p className="text-lg font-extrabold text-[var(--text-primary)] font-mono"><CountUp value={totalOut} /></p>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-emerald-500 mb-1">
                    <Layers size={13} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Remaining Stock</span>
                  </div>
                  <p className="text-lg font-extrabold text-emerald-500 font-mono"><CountUp value={Number(netQty)} /></p>
                </div>
              </div>

              {/* Actions Area */}
              <div className="px-6 py-3 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--bg-card)] flex-wrap gap-2">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                  Statement Logs ({entries.length} records)
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      exportToCSV(
                        entries.map(e => ({ Date: e.created_at, Product: e.product_name, Movement: e.movement_type, Quantity: e.quantity, Reference: e.reference, Notes: e.notes, PerformedBy: e.performed_by })),
                        ['Date', 'Product', 'Movement', 'Quantity', 'Reference', 'Notes', 'PerformedBy'],
                        `${productName}_ledger_statement`
                      );
                      addNotification?.('Ledger statement CSV downloaded');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-all cursor-pointer"
                  >
                    <FileSpreadsheet size={12} /> CSV
                  </button>

                  <button
                    onClick={() => {
                      exportToPDF(
                        `${productName} Ledger Statement & Stock Movements`,
                        entries.map(e => ({ Date: new Date(e.created_at).toLocaleString(), Movement: e.movement_type, Quantity: Number(e.quantity).toLocaleString(), Reference: e.reference || '—', Notes: e.notes || '—', PerformedBy: e.performed_by || 'System' })),
                        ['Date', 'Movement', 'Quantity', 'Reference', 'Notes', 'PerformedBy']
                      );
                      addNotification?.('Ledger statement PDF printed');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-all cursor-pointer"
                  >
                    <Printer size={12} /> PDF
                  </button>

                  <button
                    onClick={() => {
                      const msg = `REBMA Impex Statement: Product: ${productName} | Qty In: ${totalIn} | Qty Out: ${totalOut} | Net Stock: ${netQty} | Total valuation: GHS ${(netQty * currentPrices.unitPrice).toLocaleString()}`;
                      navigator.clipboard.writeText(msg).then(() => {
                        addNotification?.('Statement link copied to clipboard');
                      });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-all cursor-pointer"
                  >
                    <Share2 size={12} /> Share
                  </button>
                </div>
              </div>

              {/* Table Logs */}
              <div className="p-6 min-h-[250px]">
                {entries.length === 0 ? (
                  <div className="text-center text-xs text-[var(--text-muted)] py-12">No movement logs found for this product.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] uppercase font-semibold text-[9px] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Movement</th>
                        <th className="px-3 py-2.5 text-right">Quantity</th>
                        <th className="px-3 py-2.5">Reference</th>
                        <th className="px-3 py-2.5">Notes</th>
                        <th className="px-3 py-2.5">Performed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                      {entries.map(e => (
                        <tr key={e.id} className="hover:bg-[var(--accent-light)]">
                          <td className="px-3 py-2 whitespace-nowrap font-mono">{new Date(e.created_at).toLocaleDateString('en-GB')} {new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-3 py-2 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wide ${
                              e.movement_type === 'ADD' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
                            }`}>
                              {e.movement_type}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right font-bold font-mono ${e.movement_type === 'ADD' ? 'text-blue-500' : 'text-red-500'}`}>
                            {e.movement_type === 'ADD' ? '+' : '-'}{Number(e.quantity).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-medium truncate max-w-[120px]" title={e.reference}>{e.reference || '—'}</td>
                          <td className="px-3 py-2 truncate max-w-[180px]" title={e.notes}>{e.notes || '—'}</td>
                          <td className="px-3 py-2 font-semibold">{e.performed_by || 'System'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
        </div>
        );
      })()}

      {/* Products Available to Sell */}
      {inventoryItems.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)] mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <CheckCircle size={15} className="text-emerald-500" /> Products Available to Sell
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {inventoryItems.length} product{inventoryItems.length !== 1 ? 's' : ''} priced by Management
              </p>
            </div>
            <button onClick={() => setActiveSubTab?.('PriceCatalog')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Manage Prices →</button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2.5">
            {inventoryItems.map((item: any) => (
              <ProductCatalogCard key={item.name} item={item} onSelect={() => setActiveSubTab?.('PriceCatalog')} />
            ))}
          </div>
        </div>
      )}

      {/* ══ GOODS INVENTORY + NEWLY PRICED CATALOG ══ */}
      {inventoryItems.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Inventory Valuation */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={16} className="text-[var(--accent)]" />
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Goods Inventory Value</h3>
                <p className="text-xs text-[var(--text-muted)]">Approved cargo × current prices</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Stock Cost Value', value: totalCost, prefix: 'GHS ', suffix: '', decimals: 0, color: 'text-amber-600', bg: 'bg-amber-500/10' },
                { label: 'Stock Selling Value', value: totalSell, prefix: 'GHS ', suffix: '', decimals: 0, color: 'text-sky-600', bg: 'bg-sky-500/10' },
                { label: 'Revenue Earned', value: totalRevEarned, prefix: 'GHS ', suffix: '', decimals: 0, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                { label: 'Gross Margin', value: totalCost > 0 ? ((totalSell - totalCost) / totalCost) * 100 : null, prefix: '', suffix: '%', decimals: 1, color: 'text-violet-600', bg: 'bg-violet-500/10' },
              ].map(({ label, value, prefix, suffix, decimals, color, bg }) => (
                <div key={label} className={`rounded-xl p-3 ${bg}`}>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-wide mb-1">{label}</p>
                  <p className={`text-lg font-extrabold ${color}`}><CountUp value={value} prefix={prefix} suffix={suffix} decimals={decimals} /></p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Product', 'Qty', 'Cost', 'Selling', 'Margin'].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-[9px] text-[var(--text-muted)] uppercase font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {inventoryItems.map((item: any) => {
                    const margin = item.costPrice > 0 ? (((item.unitPrice - item.costPrice) / item.costPrice) * 100).toFixed(0) : '—';
                    return (
                      <tr key={item.name} className="hover:bg-[var(--accent-light)]">
                        <td className="px-2 py-2 font-semibold text-[var(--text-primary)] truncate max-w-[100px]">{item.name}</td>
                        <td className="px-2 py-2 text-[var(--text-secondary)]">{item.qty.toLocaleString()}</td>
                        <td className="px-2 py-2 text-amber-600">{item.currency} {item.costPrice.toLocaleString()}</td>
                        <td className="px-2 py-2 text-sky-600 font-semibold">{item.currency} {item.unitPrice.toLocaleString()}</td>
                        <td className="px-2 py-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${Number(margin) > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}>
                            {margin !== '—' ? `${margin}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Newly Priced Catalog Items */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag size={15} className="text-[var(--accent)]" />
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">Newly Priced Items</h3>
                  <p className="text-xs text-[var(--text-muted)]">Recent catalog updates from Management</p>
                </div>
              </div>
              <button onClick={() => setActiveSubTab?.('PriceCatalog')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                Full Catalog <ArrowRight size={11} />
              </button>
            </div>
            {recentPrices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                <Package size={28} className="opacity-30 mb-2" />
                <p className="text-xs">No products priced yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPrices.map((item, i) => {
                  const margin = item.cost_price > 0 ? (((item.unit_price - item.cost_price) / item.cost_price) * 100).toFixed(1) : null;
                  const isNew = i === 0;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-input)] hover:bg-[var(--accent-light)] transition-colors group">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-light)' }}>
                        <Tag size={15} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{item.product_name}</p>
                          {isNew && (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white uppercase tracking-wide shrink-0">New</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-[var(--text-primary)]">{item.currency} <CountUp value={item.unit_price} /></p>
                        {margin && (
                          <span className={`text-[9px] font-bold ${Number(margin) > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {Number(margin) > 0 ? '↑' : '↓'} {margin}% margin
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ CHARTS ROW ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Earning Overview — 2/3 width */}
        <div className="xl:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Earning Overview</h3>
              <p className="text-xs text-[var(--text-muted)]">Revenue & payment flow trend</p>
            </div>
            <div className="flex items-center gap-1">
              {(['3M', '6M', '12M'] as const).map(p => (
                <button key={p} onClick={() => setEarnPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${earnPeriod === p ? 'text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'}`}
                  style={earnPeriod === p ? { background: 'var(--accent)' } : {}}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[var(--text-primary)] mb-4">GHS <CountUp value={totalRevenue} /></p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningData}>
                <defs>
                  <linearGradient id="earnFin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Revenue" stroke="var(--accent)" strokeWidth={2.5} fill="url(#earnFin)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Breakdown — 1/3 width */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] mb-1">Payment Methods</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">Breakdown by sales orders</p>
          </div>
          {paymentPie.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)]">
              <Activity size={28} className="opacity-30 mb-2" />
              <p className="text-xs">No orders yet</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div style={{ width: 110, height: 110 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentPie} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={52} strokeWidth={0}>
                        {paymentPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-1.5">
                {paymentPie.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-xs text-[var(--text-secondary)]">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-[var(--text-primary)]"><CountUp value={item.value} suffix="%" /></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ COMPANY ACCOUNTS / WALLETS ══ */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Company Accounts</h3>
          <button onClick={() => setActiveSubTab?.('Wallets')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            View All <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Total Payments Received', num: `Cash: GHS ${walletCash.toLocaleString()} · MoMo: GHS ${walletMomo.toLocaleString()}`, balanceValue: walletTotal, trend: 'Live from payment records', color: 'var(--accent)', tab: 'Wallets' },
            { name: 'Expenses Paid', num: 'Approved expense records', balanceValue: totalExpenses, trend: 'Approved only', color: '#6366f1', tab: 'Expenses' },
            { name: 'Net Balance', num: `In: GHS ${walletTotal.toLocaleString()} · Out: GHS ${totalExpenses.toLocaleString()}`, balanceValue: Math.abs(netBalance), trend: netBalance >= 0 ? 'Surplus ↑' : 'Deficit ↓', color: netBalance >= 0 ? '#10b981' : '#ef4444', tab: 'Transactions' },
          ].map(acc => (
            <div key={acc.name} className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${acc.color}CC, ${acc.color})` }}>
              <p className="text-xs text-white/70 mb-1">{acc.name}</p>
              <p className="text-[10px] text-white/60 mb-3 font-mono">{acc.num}</p>
              <p className="text-2xl font-extrabold">GHS <CountUp value={acc.balanceValue} /></p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-white/70">{acc.trend}</span>
                <button onClick={() => setActiveSubTab?.(acc.tab)} className="text-xs text-white/80 hover:text-white flex items-center gap-1">Details <ArrowRight size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ CASH FLOW + UPCOMING BILLS ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-3">Cash Flow</h3>
          <div className="flex items-center gap-2 mb-4">
            {(['income', 'expense', 'savings'] as const).map(t => (
              <button key={t} onClick={() => setCashflowTab(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${cashflowTab === t ? 'text-white' : 'text-[var(--text-secondary)] bg-[var(--bg-input)]'}`}
                style={cashflowTab === t ? { background: 'var(--accent)' } : {}}>
                {t}
              </button>
            ))}
          </div>
          <p className="text-2xl font-extrabold text-[var(--text-primary)] mb-4">
            GHS <CountUp value={
              cashflowTab === 'income'
                ? cashflowData.reduce((s, d) => s + d.income, 0)
                : cashflowTab === 'expense'
                ? cashflowData.reduce((s, d) => s + d.expense, 0)
                : cashflowData.reduce((s, d) => s + d.income - d.expense, 0)
            } />
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowData}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={cashflowTab === 'income' ? 'income' : 'expense'} name={cashflowTab} fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Upcoming & Overdue Payments</h3>
            <button onClick={() => setActiveSubTab?.('Expenses')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ArrowRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingBills.length === 0 && (
              <div className="flex flex-col items-center py-8 text-[var(--text-muted)]">
                <CheckCircle size={28} className="opacity-30 mb-2" />
                <p className="text-xs">No upcoming bills scheduled</p>
              </div>
            )}
            {upcomingBills.map((bill, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${bill.status === 'Overdue' ? 'bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900' : 'bg-[var(--bg-input)]'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bill.status === 'Overdue' ? 'bg-red-100' : bill.status === 'Due Soon' ? 'bg-yellow-100' : 'bg-[var(--accent-light)]'}`}>
                  <Receipt size={14} className={bill.status === 'Overdue' ? 'text-red-500' : bill.status === 'Due Soon' ? 'text-yellow-500' : ''} style={bill.status === 'Scheduled' ? { color: 'var(--accent)' } : {}} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{bill.desc}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Due: {bill.due}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[var(--text-primary)]">GHS <CountUp value={Number(bill.amount)} /></p>
                  <span className={`text-[9px] font-bold ${bill.status === 'Overdue' ? 'text-red-500' : bill.status === 'Due Soon' ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`}>{bill.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ PENDING ORDERS QUEUE ══ */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-[var(--accent)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">Orders Awaiting Review</h3>
            {pendingOrders.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">{pendingOrders.length} pending</span>
            )}
          </div>
          <button onClick={() => setActiveSubTab?.('OrdersQueue')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            View All Orders <ArrowRight size={12} />
          </button>
        </div>
        {pendingOrders.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
            <CheckCircle size={32} className="opacity-30 mb-2" />
            <p className="text-sm font-semibold">All orders cleared 🎉</p>
            <p className="text-xs mt-0.5">No pending orders awaiting finance review</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingOrders.slice(0, 6).map(order => (
              <div key={order.id} className="flex items-center gap-4 p-4 bg-[var(--bg-input)] rounded-xl hover:bg-[var(--accent-light)] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <ShoppingCart size={15} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{order.clientName}</p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">{order.id} · {order.paymentMode || 'CASH'}</p>
                </div>
                <p className="text-sm font-extrabold text-[var(--text-primary)] shrink-0">GHS <CountUp value={order.totalAmount} /></p>
                <button
                  onClick={() => setActiveSubTab?.('OrdersQueue')}
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90 shrink-0 transition-opacity"
                  style={{ background: 'var(--accent)' }}
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ INVOICE STATUS + CREDIT MANAGEMENT ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Invoice Status */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Invoice Status</h3>
          {(() => {
            const realTotal = effective.length;
            if (realTotal === 0) return (
              <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-xs">
                <p>No orders yet</p>
              </div>
            );
            const paid = effective.filter(o => ['DELIVERED', 'APPROVED', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
            const pending = effective.filter(o => o.status.startsWith('PENDING')).length;
            const rejected = realTotal - paid - pending;
            const invData = [
              { name: 'Cleared', value: Math.round((paid / realTotal) * 100), color: '#10b981' },
              { name: 'Pending', value: Math.round((pending / realTotal) * 100), color: '#f59e0b' },
              { name: 'Other', value: Math.max(0, Math.round((rejected / realTotal) * 100)), color: '#ef4444' },
            ].filter(d => d.value > 0);
            return (
              <div className="flex items-center gap-6">
                <div className="relative" style={{ width: 120, height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={invData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={56} strokeWidth={0}>
                        {invData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-lg font-extrabold text-[var(--text-primary)]"><CountUp value={invoiceCount} /></p>
                    <p className="text-[9px] text-[var(--text-muted)]">Total</p>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {invData.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-xs text-[var(--text-secondary)]">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--text-primary)]"><CountUp value={item.value} suffix="%" /></span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Credit Management */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Credit Management</h3>
            <button onClick={() => setActiveSubTab?.('CreditMgmt')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ArrowRight size={12} />
            </button>
          </div>
          {(() => {
            const creditOrders = effective.filter(o => o.paymentMode === 'CREDIT');
            const totalExtended = creditOrders.reduce((s, o) => s + o.totalAmount, 0);
            const collected = creditOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0);
            const outstanding = totalExtended - collected;
            const pct = totalExtended > 0 ? Math.round((collected / totalExtended) * 100) : 0;
            return (
              <>
                {[
                  { label: 'Total Extended', value: totalExtended, color: 'text-[var(--text-primary)]' },
                  { label: 'Total Collected', value: collected, color: 'text-emerald-500' },
                  { label: 'Outstanding', value: outstanding, color: 'text-rose-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs text-[var(--text-muted)]">{label}</span>
                    <span className={`text-sm font-bold ${color}`}>GHS <CountUp value={value} /></span>
                  </div>
                ))}
                <div className="mt-3 h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{pct}% collected</p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Cargo Discrepancy Statement */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500 animate-pulse" /> Cargo Discrepancy Statement
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Logs of confirmed inventory damages, write-offs, and resulting financial losses at cost</p>
          </div>
          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold">
            Total Damages: <CountUp value={cargoDiscrepancies.reduce((s, d) => s + d.damagedCount, 0)} /> units
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-input)]">
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Cargo ID</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Product Name</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Supplier</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-center">Original Qty</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-center">Damaged Qty</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-right">Unit Cost (GHS)</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-right">Financial Loss (GHS)</th>
                <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Description / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {cargoDiscrepancies.map(d => (
                <tr key={d.id} className="hover:bg-red-500/5">
                  <td className="py-3 px-3 font-mono text-[10px] text-[var(--text-secondary)]">{d.id.slice(0, 8).toUpperCase()}</td>
                  <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{d.productName}</td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{d.company}</td>
                  <td className="py-3 px-3 text-center text-[var(--text-secondary)]">{d.originalQty}</td>
                  <td className="py-3 px-3 text-center text-red-500 font-bold">{d.damagedCount}</td>
                  <td className="py-3 px-3 text-right text-[var(--text-secondary)]">{d.unitCost.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-red-650 font-extrabold">GHS {d.costLoss.toLocaleString()}</td>
                  <td className="py-3 px-3 text-[var(--text-muted)] max-w-xs truncate" title={d.notes}>{d.notes}</td>
                </tr>
              ))}
              {cargoDiscrepancies.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">
                    No approved cargo discrepancies or damages logged.
                  </td>
                </tr>
              )}
            </tbody>
            {cargoDiscrepancies.length > 0 && (
              <tfoot>
                <tr className="bg-red-500/10 border-t border-[var(--border)] font-bold">
                  <td colSpan={6} className="py-2.5 px-3 text-[var(--text-primary)]">Total Loss (At Cost)</td>
                  <td className="py-2.5 px-3 text-right text-red-600">
                    GHS <CountUp value={cargoDiscrepancies.reduce((s, d) => s + d.costLoss, 0)} />
                  </td>
                  <td className="py-2.5 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
