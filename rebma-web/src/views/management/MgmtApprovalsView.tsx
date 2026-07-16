import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Search, Filter,
  MoreVertical, ArrowLeft, Package, CreditCard,
  UserPlus, FileText, Tag, RefreshCw, Download, Eye, ShoppingCart, Wallet
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import InvoiceLineItems from '../../components/InvoiceLineItems';
import MaterialRequisitionsPanel from './MaterialRequisitionsPanel';
import ApprovalHistoryPanel from '../../components/global/ApprovalHistoryPanel';

interface ApprovalItem {
  id: string;
  requestId: string;
  type: 'Cargo Intake' | 'Credit Order' | 'Staff Registration' | 'Price Review' | 'Production Request' | 'General Purchase' | 'Float Request';
  description: string;
  department: string;
  amount: number | null;
  date: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedBy: string;
  notes?: string;
  raw?: Record<string, unknown>;
}

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  'Cargo Intake': 'bg-blue-100 text-blue-700',
  'Credit Order': 'bg-purple-100 text-purple-700',
  'Staff Registration': 'bg-green-100 text-green-700',
  'Price Review': 'bg-pink-100 text-pink-700',
  'Production Request': 'bg-cyan-100 text-cyan-700',
  'General Purchase': 'bg-amber-100 text-amber-700',
  'Float Request': 'bg-teal-100 text-teal-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: 'text-red-500',
  Medium: 'text-yellow-500',
  Low: 'text-green-500',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  'Cargo Intake': Package,
  'Credit Order': CreditCard,
  'Staff Registration': UserPlus,
  'Price Review': Tag,
  'Production Request': ShoppingCart,
  'General Purchase': ShoppingCart,
  'Float Request': Wallet,
};

const TABS = ['All', 'Cargo Intake', 'Credit Order', 'Staff Registration', 'Production Request', 'General Purchase', 'Float Request'] as const;

export default function MgmtApprovalsView({ addNotification, currentUser }: Props) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('All');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<'approve' | 'reject' | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [notifyOps, setNotifyOps] = useState(true);
  const [notifyCeo, setNotifyCeo] = useState(true);
  const [todayApproved, setTodayApproved] = useState(0);
  const [todayRejected, setTodayRejected] = useState(0);
  const [confirmedDamages, setConfirmedDamages] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadApprovals();
  }, []);

  async function loadApprovals() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from('global_audit_history')
      .select('action')
      .eq('department', 'MANAGEMENT')
      .gte('timestamp', `${today}T00:00:00.000Z`)
      .lte('timestamp', `${today}T23:59:59.999Z`)
      .then(({ data }) => {
        const rows = data || [];
        setTodayApproved(rows.filter((r: any) => String(r.action).startsWith('APPROVE')).length);
        setTodayRejected(rows.filter((r: any) => String(r.action).startsWith('REJECT')).length);
      }, () => {});
    try {
      const [
        { data: cargoData },
        { data: ordersData },
        { data: profilesData },
        { data: productionData },
        { data: purchasesData },
        { data: floatData },
      ] = await Promise.all([
        supabase.from('cargo_intake').select('*').eq('status', 'PENDING_MANAGEMENT_APPROVAL').order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('*').eq('status', 'PENDING_MANAGEMENT').order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('*').eq('status', 'PENDING_APPROVAL').order('created_at', { ascending: false }).limit(50),
        supabase.from('production_requests').select('*').eq('status', 'PENDING_MANAGEMENT').order('created_at', { ascending: false }).limit(50).then(r => r, () => ({ data: [] })),
        supabase.from('general_purchases').select('*').eq('status', 'PENDING_MANAGEMENT_APPROVAL').order('created_at', { ascending: false }).limit(50).then(r => r, () => ({ data: [] })),
        supabase.from('float_requests').select('*').eq('status', 'PENDING_MANAGEMENT').order('created_at', { ascending: false }).limit(50).then(r => r, () => ({ data: [] })),
      ]);

      const mappedCargo: ApprovalItem[] = (cargoData || []).map((row: any) => {
        const baseDesc = `${row.product_name || 'Goods'} — ${row.qty_received || row.quantity || 0} ${row.goods_type || 'units'} from ${row.company || 'supplier'}`;
        const description = row.discrepancies && row.discrepancies.trim() !== ''
          ? `${baseDesc} (Discrepancy: ${row.discrepancies})`
          : baseDesc;
        return {
          id: row.id,
          requestId: `CARGO-${row.id.slice(-6).toUpperCase()}`,
          type: 'Cargo Intake' as const,
          description,
          department: 'OPERATIONS',
          amount: row.unit_price ? Number(row.unit_price) * (row.qty_received || row.quantity || 0) : null,
          date: row.created_at?.slice(0, 10) || '',
          priority: 'High' as const,
          status: 'Pending' as ApprovalItem['status'],
          submittedBy: row.company || 'Operations',
          raw: row,
        };
      });

      const mappedOrders: ApprovalItem[] = (ordersData || []).map((row: any) => ({
        id: row.id,
        requestId: `ORD-${row.id.slice(-6).toUpperCase()}`,
        type: 'Credit Order' as const,
        description: `${row.payment_mode === 'CREDIT' ? 'Credit order' : `${row.payment_mode || 'Cash'} order`} for ${row.client_name} — GHS ${Number(row.total_amount || 0).toLocaleString()}`,
        department: 'MARKETING',
        amount: Number(row.total_amount || 0),
        date: row.created_at?.slice(0, 10) || '',
        priority: 'High' as const,
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.client_name || 'Marketing',
        raw: row,
      }));

      const mappedProfiles: ApprovalItem[] = (profilesData || []).map((row: any) => ({
        id: row.id,
        requestId: `REG-${row.id.slice(-6).toUpperCase()}`,
        type: 'Staff Registration' as const,
        description: `Teammate signup: ${row.full_name || 'Employee'} (${row.role || row.department || 'Staff'})`,
        department: 'HR',
        amount: null,
        date: row.created_at?.slice(0, 10) || '',
        priority: 'Medium' as const,
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.full_name || 'HR Department',
        raw: row,
      }));

      const mappedProduction: ApprovalItem[] = (productionData || []).map((row: any) => ({
        id: row.id,
        requestId: `PROD-${row.id.slice(-6).toUpperCase()}`,
        type: 'Production Request' as const,
        description: `${row.product_name || row.productName || 'Product'} — ${row.quantity || 0} ${row.unit || 'units'}`,
        department: 'PRODUCTION',
        amount: null,
        date: row.created_at?.slice(0, 10) || '',
        priority: (row.priority === 'HIGH' || row.priority === 'High' ? 'High' : row.priority === 'LOW' || row.priority === 'Low' ? 'Low' : 'Medium') as ApprovalItem['priority'],
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.requested_by || 'Production',
        raw: row,
      }));

      const mappedPurchases: ApprovalItem[] = (purchasesData || []).map((row: any) => ({
        id: row.id,
        requestId: `PURCH-${row.id.slice(-6).toUpperCase()}`,
        type: 'General Purchase' as const,
        description: `${row.item_name || row.itemName || 'Item'} — ${row.quantity || 0} units`,
        department: row.department || 'OPERATIONS',
        amount: row.cost ? Number(row.cost) : null,
        date: row.created_at?.slice(0, 10) || '',
        priority: 'Medium' as const,
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.requested_by || row.department || 'Staff',
        raw: row,
      }));

      const mappedFloat: ApprovalItem[] = (floatData || []).map((row: any) => ({
        id: row.id,
        requestId: `FLOAT-${row.id.slice(-6).toUpperCase()}`,
        type: 'Float Request' as const,
        description: `Float replenishment: GHS ${Number(row.amount || 0).toLocaleString()} — ${row.reason || 'No reason given'}`,
        department: row.department || 'FINANCE',
        amount: Number(row.amount || 0),
        date: row.created_at?.slice(0, 10) || '',
        priority: 'High' as const,
        status: 'Pending' as ApprovalItem['status'],
        submittedBy: row.requested_by || 'Finance',
        raw: row,
      }));

      setItems([...mappedCargo, ...mappedOrders, ...mappedProfiles, ...mappedProduction, ...mappedPurchases, ...mappedFloat]);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter(item => {
    const matchTab = activeTab === 'All' || item.type === activeTab;
    const matchStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchSearch = !search || item.description.toLowerCase().includes(search.toLowerCase()) || item.requestId.toLowerCase().includes(search.toLowerCase()) || item.department.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchStatus && matchSearch;
  });

  const counts = {
    total: items.length,
    pending: items.filter(i => i.status === 'Pending').length,
    approved: items.filter(i => i.status === 'Approved').length,
    rejected: items.filter(i => i.status === 'Rejected').length,
  };

  const selectedItem = items.find(i => i.id === selected);

  function handleAction(id: string, action: 'approve' | 'reject') {
    setSelected(id);
    setShowModal(action);
    setModalNote('');
    setSellingPrice('');

    const item = items.find(i => i.id === id);
    if (item && item.type === 'Cargo Intake') {
      let defaultDamages = 0;
      const discText = String(item.raw?.discrepancies || '');
      if (discText && discText.trim() !== '') {
        const matches = discText.match(/\d+/g);
        if (matches) {
          defaultDamages = matches.reduce((sum, val) => sum + parseInt(val, 10), 0);
        }
      }
      setConfirmedDamages(defaultDamages);
      setCostPerUnit(Number(item.raw?.unit_price || 0));
    }
  }

  async function confirmAction() {
    if (!selectedItem || !showModal || submitting) return;
    setSubmitting(true);
    const action = showModal;

    try {
      if (selectedItem.type === 'Cargo Intake' && selectedItem.raw) {
        const newDbStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        const rawId = String(selectedItem.raw.id);
        const cargoRow = selectedItem.raw as Record<string, any>;
        const incomingQty = Number(cargoRow.quantity || cargoRow.qty_received || 0);
        const finalQtyToAdd = Math.max(0, incomingQty - confirmedDamages);
        const discrepancyCost = confirmedDamages * costPerUnit;
        const sellingPriceVal = sellingPrice ? parseFloat(sellingPrice) : 0;
        const rawDiscrepancies = String(cargoRow.discrepancies || '');

        let finalDiscrepancyNotes = rawDiscrepancies;
        if (confirmedDamages > 0) {
          const discrepancyJson = {
            originalQty: incomingQty,
            damagedCount: confirmedDamages,
            unitCost: costPerUnit,
            costLoss: discrepancyCost,
            sellingPrice: sellingPriceVal,
            notes: rawDiscrepancies && rawDiscrepancies !== 'None' ? rawDiscrepancies : 'Damaged goods write-off'
          };
          finalDiscrepancyNotes = JSON.stringify(discrepancyJson);
        }

        await supabase.from('cargo_intake').update({ 
          status: newDbStatus,
          quantity: action === 'approve' ? finalQtyToAdd : incomingQty,
          discrepancies: finalDiscrepancyNotes,
          unit_price: costPerUnit,
          is_fault_or_damaged: confirmedDamages > 0
        }).eq('id', rawId);

        if (action === 'approve') {
          // Auto-populate stock table from approved cargo
          const productName = String(cargoRow.product_name || 'Unknown Product');
          const productCode = String(cargoRow.goods_code || rawId.slice(0, 8).toUpperCase());
          const unit = String(cargoRow.goods_type || cargoRow.unit || 'units');
          const now = new Date().toISOString();

          const { data: existingStock } = await supabase.from('stock').select('id, quantity').eq('product_name', productName).maybeSingle().then(r => r, () => ({ data: null, error: null }));
          if (existingStock) {
            await supabase.from('stock').update({ quantity: (Number(existingStock.quantity) || 0) + finalQtyToAdd, last_updated: now }).eq('id', existingStock.id);
          } else {
            const { error: stockErr } = await supabase.from('stock').upsert([{ product_name: productName, product_code: productCode, category: 'INCOMING_GOODS', quantity: finalQtyToAdd, maximum_level: finalQtyToAdd * 2 || 1000, minimum_level: Math.round(finalQtyToAdd * 0.1) || 50, unit, last_updated: now }], { onConflict: 'product_name' });
            if (stockErr) addNotification?.(`Stock table update failed: ${stockErr.message}. Please run the SQL migrations in supabase_schema.sql.`);
          }
          
          await supabase.from('stock_ledger').insert({ 
            product_name: productName, 
            movement_type: 'ADD', 
            quantity: finalQtyToAdd, 
            reference: `Cargo approved: ${selectedItem.requestId}`, 
            notes: `${selectedItem.description}${confirmedDamages > 0 ? ` (${confirmedDamages} units damaged/lost)` : ''}`, 
            created_at: now 
          });

          if (discrepancyCost > 0) {
            await supabase.from('finance_expenses').insert([{
              category: 'Damaged Goods',
              description: `Loss from damaged goods in Cargo Intake ${selectedItem.requestId} (${productName}: ${confirmedDamages} units)`,
              amount: discrepancyCost,
              date: now.slice(0, 10),
              status: 'Approved',
              submitted_by: 'Management (Auto-generated)',
              notes: `Auto-generated from Cargo Intake approval. Discrepancy details: ${selectedItem.description}`
            }]);
          }

          if (notifyOps) {
            await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Management: ${selectedItem.description}`, notified_department: 'OPERATIONS', read: false }]);
          }
          if (notifyCeo) {
            await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Management: ${selectedItem.description}`, notified_department: 'CEO', read: false }]);
          }
          if (sellingPrice) {
            await supabase.from('goods_prices').upsert([{ product_name: productName, unit_price: parseFloat(sellingPrice) }], { onConflict: 'product_name' });
          }
          await supabase.from('supplier_order_notifications').insert([{ message: `Cargo intake APPROVED by Management: ${selectedItem.description}`, notified_department: 'FINANCE', read: false }]);
          await supabase.from('supplier_order_notifications').insert([{ message: `New stock approved: ${selectedItem.description}. Update pricing in Marketing.`, notified_department: 'MARKETING', read: false }]);
        }
      }

      if (selectedItem.type === 'Credit Order') {
        const paymentMode = String(selectedItem.raw?.payment_mode || 'CASH');
        const isCreditPayment = paymentMode === 'CREDIT';
        const newDbStatus = action === 'approve' ? (isCreditPayment ? 'PENDING_FINANCE' : 'APPROVED') : 'REJECTED';
        await supabase.from('orders').update({ status: newDbStatus }).eq('id', selectedItem.id);

        if (action === 'approve') {
          if (isCreditPayment) {
            await supabase.from('supplier_order_notifications').insert([{ message: `Credit order approved by Management — now awaiting Finance processing: ${selectedItem.description}`, notified_department: 'FINANCE', read: false }]);
            await supabase.from('supplier_order_notifications').insert([{ message: `Your credit order has been approved by Management and sent to Finance: ${selectedItem.description}`, notified_department: 'MARKETING', read: false }]);
          } else {
            // CASH/CHEQUE/MOMO orders bypass Finance — create delivery log for Dispatch directly
            const now = new Date().toISOString();
            await supabase.from('delivery_logs').insert([{
              order_id: selectedItem.id,
              customer_name: String(selectedItem.raw?.client_name || selectedItem.submittedBy || ''),
              delivery_address: String(selectedItem.raw?.delivery_address || selectedItem.raw?.client_name || ''),
              status: 'PENDING_ASSIGNMENT',
              timestamp: now,
            }]);
            await supabase.from('supplier_order_notifications').insert([{ message: `${paymentMode} order approved by Management — ready for dispatch: ${selectedItem.description}`, notified_department: 'DISPATCH', read: false }]);
            await supabase.from('supplier_order_notifications').insert([{ message: `${paymentMode} order approved — Operations is preparing goods: ${selectedItem.description}`, notified_department: 'MARKETING', read: false }]);
            await supabase.from('supplier_order_notifications').insert([{ message: `Approved ${paymentMode} order ready for fulfillment: ${selectedItem.description}`, notified_department: 'OPERATIONS', read: false }]);
          }
        } else {
          await supabase.from('supplier_order_notifications').insert([{ message: `Order REJECTED by Management: ${selectedItem.description}${modalNote ? ` — ${modalNote}` : ''}`, notified_department: 'MARKETING', read: false }]);
        }
      }

      if (selectedItem.type === 'Staff Registration') {
        const newDbStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED';
        await supabase.from('profiles').update({ status: newDbStatus }).eq('id', selectedItem.id);

        if (action === 'approve') {
          await supabase.from('supplier_order_notifications').insert([{ message: `Staff registration APPROVED: ${selectedItem.description}`, notified_department: 'HR', read: false }]);
        }
      }

      if (selectedItem.type === 'Production Request' && selectedItem.raw) {
        if (action === 'approve') {
          // Same automated pipeline as a Marketing sales order approval: move
          // straight to a fulfillment ticket (no separate manual release step)
          // and add the repackaged/produced quantity to stock, mirroring the
          // in-house-production stock ADD used for approved cargo intake.
          await supabase.from('production_requests').update({ status: 'TICKETS_ISSUED' }).eq('id', selectedItem.id);

          const req: any = selectedItem.raw;
          const productName: string = req.product_name || req.productName || '';
          const qty = Number(req.quantity) || 0;
          const now = new Date().toISOString();

          await supabase.from('fulfillment_tickets').insert({
            production_request_id: selectedItem.id,
            type: 'PRODUCTION_RELEASE',
            details: { productName, quantity: qty, unit: req.unit, purpose: req.purpose },
            status: 'PENDING',
            created_at: now,
            updated_at: now,
          });

          if (productName && qty > 0) {
            const { data: existingStock } = await supabase.from('stock').select('id, quantity').ilike('product_name', productName).limit(1);
            if (existingStock && existingStock.length > 0) {
              await supabase.from('stock').update({ quantity: (existingStock[0].quantity || 0) + qty, last_updated: now }).eq('id', existingStock[0].id);
            } else {
              await supabase.from('stock').insert({ product_name: productName, quantity: qty, unit: req.unit || 'units', last_updated: now });
            }
            await supabase.from('stock_ledger').insert({ product_name: productName, movement_type: 'ADD', quantity: qty, reference: `Production Request Approved: ${selectedItem.requestId}`, created_at: now });
          }

          await supabase.from('supplier_order_notifications').insert([{ message: `Production request APPROVED by Management — ready for pickup/repackaging: ${selectedItem.description}`, notified_department: 'PRODUCTION', read: false }]);
          await supabase.from('supplier_order_notifications').insert([{ message: `Production release ready for warehouse handling: ${selectedItem.description}`, notified_department: 'OPERATIONS', read: false }]);
        } else {
          await supabase.from('production_requests').update({ status: 'REJECTED' }).eq('id', selectedItem.id);
        }
      }

      if (selectedItem.type === 'General Purchase' && selectedItem.raw) {
        const newDbStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        await supabase.from('general_purchases').update({ status: newDbStatus }).eq('id', selectedItem.id);

        if (action === 'approve') {
          await supabase.from('supplier_order_notifications').insert([{ message: `General purchase APPROVED by Management: ${selectedItem.description}`, notified_department: action === 'approve' ? (String(selectedItem.raw.department || 'OPERATIONS')) : 'OPERATIONS', read: false }]);
        }
      }

      if (selectedItem.type === 'Float Request' && selectedItem.raw) {
        const req: any = selectedItem.raw;
        const now = new Date().toISOString();

        if (action === 'approve') {
          await supabase.from('float_requests').update({ status: 'APPROVED', approved_by: currentUser?.fullName || 'Management', updated_at: now }).eq('id', selectedItem.id);

          // Same automated-pipeline principle used elsewhere: the float
          // actually lands the moment Management approves it, not on a
          // separate manual Finance step.
          const { data: latestEntry } = await supabase.from('finance_petty_cash').select('balance_after').order('created_at', { ascending: false }).limit(1);
          const currentBalance = Number(latestEntry?.[0]?.balance_after) || 0;
          const amount = Number(req.amount) || 0;
          await supabase.from('finance_petty_cash').insert({
            date: now.slice(0, 10),
            description: `Replenishment approved by Management: ${req.reason || 'Float top-up'}`,
            amount,
            disbursed_to: 'Petty Cash Float',
            category: 'Replenishment',
            type: 'replenishment',
            balance_after: currentBalance + amount,
            created_at: now,
          });

          await supabase.from('supplier_order_notifications').insert([{ message: `Float replenishment APPROVED by Management: GHS ${amount.toLocaleString()} added to petty cash.`, notified_department: 'FINANCE', read: false }]);
        } else {
          await supabase.from('float_requests').update({ status: 'REJECTED', rejection_reason: modalNote || null, updated_at: now }).eq('id', selectedItem.id);
          await supabase.from('supplier_order_notifications').insert([{ message: `Float replenishment REJECTED by Management: ${selectedItem.description}${modalNote ? ` — ${modalNote}` : ''}`, notified_department: 'FINANCE', read: false }]);
        }
      }

      await supabase.from('global_audit_history').insert([{
        department: 'MANAGEMENT',
        action: `${action.toUpperCase()}: ${selectedItem.requestId} — ${selectedItem.description}${modalNote ? ` | Note: ${modalNote}` : ''}`,
        performed_by: currentUser?.fullName || 'Management',
      }]);

      addNotification?.(`${selectedItem.requestId} ${action === 'approve' ? 'Approved' : 'Rejected'}${modalNote ? ` — "${modalNote}"` : ''}`);
    } catch (e) {
      console.error(e);
      addNotification?.('Action execution failed.');
    } finally {
      setSubmitting(false);
    }

    setShowModal(null);
    setSelected(null);
    loadApprovals();
  }

  const handleExport = () => {
    exportToCSV(
      filtered.map(i => ({ ID: i.requestId, Type: i.type, Description: i.description, Department: i.department, Amount: i.amount ?? '', Date: i.date, Priority: i.priority, Status: i.status, SubmittedBy: i.submittedBy })),
      ['ID', 'Type', 'Description', 'Department', 'Amount', 'Date', 'Priority', 'Status', 'SubmittedBy'],
      'approvals_queue'
    );
  };

  if (selectedItem && !showModal) {
    const Icon = TYPE_ICONS[selectedItem.type] || FileText;
    return (
      <div className="p-4 md:p-6 space-y-5">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Approvals Queue
        </button>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                <Icon size={24} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedItem.requestId}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[selectedItem.type]}`}>{selectedItem.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedItem.status]}`}>{selectedItem.status}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{selectedItem.description}</p>
              </div>
            </div>
            {selectedItem.status === 'Pending' && (
              <div className="flex items-center gap-2">
                <button onClick={() => handleAction(selectedItem.id, 'reject')} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"><XCircle size={14} className="inline mr-1" />Reject</button>
                <button onClick={() => handleAction(selectedItem.id, 'approve')} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}><CheckCircle size={14} className="inline mr-1" />Approve</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Department', value: selectedItem.department },
              { label: 'Submitted By', value: selectedItem.submittedBy },
              { label: 'Date', value: selectedItem.date },
              { label: 'Priority', value: selectedItem.priority },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--bg-input)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className={`text-sm font-semibold ${label === 'Priority' ? PRIORITY_COLORS[value] : 'text-[var(--text-primary)]'}`}>{value}</p>
              </div>
            ))}
          </div>

          {selectedItem.amount !== null && (
            <div className="bg-[var(--bg-input)] rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Transaction Amount</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>GHS {(Number(selectedItem.amount ?? 0)).toLocaleString()}</p>
            </div>
          )}

          {selectedItem.type === 'Credit Order' && selectedItem.raw && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Order Items breakdown</p>
              <InvoiceLineItems order={selectedItem.raw as any} />
            </div>
          )}

          {selectedItem.notes && (
            <div className="bg-[var(--bg-input)] rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-2">Notes</p>
              <p className="text-sm text-[var(--text-primary)]">{selectedItem.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Approvals Queue</h1>
          <p className="text-sm text-[var(--text-secondary)]">Review and action all pending requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadApprovals} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <MaterialRequisitionsPanel addNotification={addNotification} currentUser={currentUser} />

      {/* Summary Cards */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Pending', value: counts.total, icon: FileText, color: 'var(--accent)', filter: 'Pending' },
          { label: 'Awaiting Action', value: counts.pending, icon: Clock, color: '#f59e0b', filter: 'Pending' },
          { label: 'Approved Today', value: todayApproved, icon: CheckCircle, color: '#10b981', filter: 'Approved' },
          { label: 'Rejected Today', value: todayRejected, icon: XCircle, color: '#ef4444', filter: 'Rejected' },
        ].map(({ label, value, icon: Icon, color, filter }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(filter)}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 text-left hover:border-[var(--accent)] transition-colors cursor-pointer w-full"
            style={statusFilter === filter ? { borderColor: color, boxShadow: `0 0 0 2px ${color}30` } : {}}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === tab ? 'text-white' : 'text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-input)]'}`}
            style={activeTab === tab ? { background: 'var(--accent)' } : {}}
          >
            {tab}
            {tab !== 'All' && (
              <span className="ml-1.5 text-xs opacity-70">({items.filter(i => i.type === tab).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Status Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ID, description, department..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)]"
          >
            <Filter size={14} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-[var(--text-secondary)] text-sm focus:outline-none cursor-pointer"
            >
              {['All', 'Pending', 'Approved', 'Rejected'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        {loading ? (
          <div className="p-10 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-6 bg-[var(--bg-input)] rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 gap-2 text-[var(--text-muted)]">
            <CheckCircle size={32} className="opacity-30" />
            <p className="text-sm">No pending approvals — you're all caught up.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-input)]">
                  {['Request ID', 'Type', 'Description', 'Department', 'Amount', 'Date', 'Priority', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(item => {
                  const Icon = TYPE_ICONS[item.type] || FileText;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--accent-light)] transition-colors cursor-pointer group"
                      onClick={() => setSelected(item.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">{item.requestId}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap w-fit ${TYPE_COLORS[item.type]}`}>
                          <Icon size={11} />{item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] max-w-[200px]">
                        <p className="truncate font-medium">{item.description}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{item.department}</td>
                      <td className="px-4 py-3 font-bold text-[var(--text-primary)] whitespace-nowrap">
                        {item.amount !== null ? `GHS ${(Number(item.amount ?? 0)).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{item.date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-semibold text-xs ${PRIORITY_COLORS[item.priority]}`}>● {item.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSelected(item.id)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)]" title="View"><Eye size={14} style={{ color: 'var(--accent)' }} /></button>
                          {item.status === 'Pending' && <>
                            <button onClick={() => handleAction(item.id, 'approve')} className="p-1.5 rounded-lg hover:bg-green-100" title="Approve"><CheckCircle size={14} className="text-green-500" /></button>
                            <button onClick={() => handleAction(item.id, 'reject')} className="p-1.5 rounded-lg hover:bg-red-100" title="Reject"><XCircle size={14} className="text-red-500" /></button>
                          </>}
                          <div className="relative">
                            <button onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                            {menuOpen === item.id && (
                              <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]" onClick={() => setMenuOpen(null)}>
                                <button onClick={() => setSelected(item.id)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Details</button>
                                {item.status === 'Pending' && <>
                                  <button onClick={() => handleAction(item.id, 'approve')} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-[var(--bg-input)]">Approve</button>
                                  <button onClick={() => handleAction(item.id, 'reject')} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-[var(--bg-input)]">Reject</button>
                                </>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ApprovalHistoryPanel department="MANAGEMENT" />

      {/* Action Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4 shrink-0">
              {showModal === 'approve' && <CheckCircle size={20} className="text-green-500" />}
              {showModal === 'reject' && <XCircle size={20} className="text-red-500" />}
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {showModal === 'approve' ? 'Approve' : 'Reject'}: {selectedItem.requestId}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 mb-4 min-h-0 space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">{selectedItem.description}</p>

              {showModal === 'approve' && selectedItem.type === 'Cargo Intake' && (
                <div className="space-y-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-[var(--bg-input)] rounded-xl px-4 py-2.5 flex items-center gap-3">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Cargo In</span>
                      <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                        {Number((selectedItem.raw as any)?.quantity || (selectedItem.raw as any)?.qty_received || 0).toLocaleString()} units
                      </span>
                    </div>
                  </div>

                  {/* Discrepancy section — always shown for cargo intakes so damaged qty can always be set */}
                  <div className="mt-2 border-t border-[var(--border)] pt-3 space-y-3">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Quantity Verification</p>

                    {/* Quantity summary */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[var(--bg-input)] rounded-xl p-2.5 text-center">
                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Total Received</span>
                        <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                          {Number((selectedItem.raw as any)?.quantity || (selectedItem.raw as any)?.qty_received || 0).toLocaleString()}
                        </span>
                        <span className="text-[8px] text-[var(--text-muted)] block mt-0.5">units</span>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] font-bold text-rose-700 uppercase tracking-wider block mb-1">Confirmed Damaged</span>
                        <span className="text-xs font-bold text-rose-700 font-mono">
                          {confirmedDamages.toLocaleString()}
                        </span>
                        <span className="text-[8px] text-rose-600 block mt-0.5">excluded</span>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Net to Stock</span>
                        <span className="text-xs font-bold text-emerald-700 font-mono">
                          {Math.max(0, Number((selectedItem.raw as any)?.quantity || (selectedItem.raw as any)?.qty_received || 0) - confirmedDamages).toLocaleString()}
                        </span>
                        <span className="text-[8px] text-emerald-600 block mt-0.5">approved qty</span>
                      </div>
                    </div>

                    {/* Warning alert if discrepancy is present */}
                    {(selectedItem.raw as any)?.discrepancies && String((selectedItem.raw as any).discrepancies).trim() && (
                      <div className="p-3 bg-amber-500/15 border border-amber-500/25 text-amber-700 rounded-xl text-xs flex items-center gap-2">
                        <span className="shrink-0">⚠️</span>
                        <span>Discrepancy reported: <strong>{String((selectedItem.raw as any).discrepancies)}</strong></span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Confirmed Damaged Units</label>
                        <input
                          type="number"
                          value={confirmedDamages}
                          onChange={e => setConfirmedDamages(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="0"
                          min={0}
                          max={Number((selectedItem.raw as any)?.quantity || (selectedItem.raw as any)?.qty_received || 0)}
                          className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-rose-500"
                        />
                        <p className="text-[9px] text-[var(--text-muted)] mt-1">These units are excluded from stock</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Damage Cost (per unit)</label>
                        <input
                          type="number"
                          value={costPerUnit}
                          onChange={e => setCostPerUnit(Number(e.target.value))}
                          placeholder="Unit cost"
                          className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        />
                        <p className="text-[9px] text-[var(--text-muted)] mt-1">Used to log the financial loss</p>
                      </div>
                    </div>

                    {confirmedDamages > 0 && (
                      <div className="text-[10px] text-[var(--text-muted)] leading-normal bg-rose-500/5 border border-rose-500/10 rounded-xl px-3 py-2">
                        The <strong className="text-rose-600 font-mono">{confirmedDamages.toLocaleString()}</strong> damaged units will be recorded as a system loss of{' '}
                        <strong className="text-rose-600 font-mono">GHS {(confirmedDamages * costPerUnit).toLocaleString()}</strong>{' '}
                        and will <strong>NOT</strong> be added to inventory.
                      </div>
                    )}
                  </div>

                  <div className="mt-2 border-t border-[var(--border)] pt-2">
                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Selling Price (GHS) — optional</label>
                    <input
                      type="number"
                      value={sellingPrice}
                      onChange={e => setSellingPrice(e.target.value)}
                      placeholder="Enter selling price per unit"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div className="space-y-2 border-t border-[var(--border)] pt-2">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Notify departments:</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                        <input type="checkbox" checked={notifyOps} onChange={e => setNotifyOps(e.target.checked)} className="rounded" />
                        Operations
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                        <input type="checkbox" checked={notifyCeo} onChange={e => setNotifyCeo(e.target.checked)} className="rounded" />
                        CEO
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {showModal === 'approve' && selectedItem.type === 'Credit Order' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                  Approving will move this order to <strong>Finance</strong> for payment processing.
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                  {showModal === 'approve' ? 'Additional notes (optional)' : 'Reason for rejection *'}
                </label>
                <textarea
                  value={modalNote}
                  onChange={e => setModalNote(e.target.value)}
                  rows={3}
                  placeholder={showModal === 'approve' ? 'Any notes for this approval...' : 'Explain why this is being rejected...'}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-3 border-t border-[var(--border)] shrink-0">
              <button disabled={submitting} onClick={() => setShowModal(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)] disabled:opacity-50">Cancel</button>
              <button
                disabled={submitting}
                onClick={confirmAction}
                className={`px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50 ${showModal === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {submitting ? 'Processing...' : (showModal === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
