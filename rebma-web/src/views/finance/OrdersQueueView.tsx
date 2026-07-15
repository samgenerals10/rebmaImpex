import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Search, Download, CheckCircle, XCircle, Eye, MoreVertical,
  ArrowLeft, Package, Clock, DollarSign, CreditCard, Smartphone,
  FileText, Camera, Upload, RefreshCw
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import type { Order } from '../../types/erp';
import InvoiceLineItems, { getProductSummary, getProductSummaryWithQty } from '../../components/InvoiceLineItems';

interface Props {
  addNotification?: (msg: string) => void;
  ordersList?: Order[];
  setOrdersList?: React.Dispatch<React.SetStateAction<Order[]>>;
  onEvaluateOrder?: (id: string, approve: boolean) => void;
  currentUser?: { fullName: string; department: string } | null;
}


const MODE_COLORS: Record<string, string> = {
  CASH: 'bg-green-100 text-green-700',
  CHEQUE: 'bg-blue-100 text-blue-700',
  MOBILE_MONEY: 'bg-yellow-100 text-yellow-700',
  CREDIT: 'bg-purple-100 text-purple-700',
  BANK_TRANSFER: 'bg-indigo-100 text-indigo-700',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_FINANCE: 'bg-yellow-100 text-yellow-700',
  PENDING_MANAGEMENT: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
};

type PaymentMode = 'CASH' | 'CHEQUE' | 'MOBILE_MONEY' | 'CREDIT';

interface PaymentForm {
  [key: string]: string;
  // cash
  amountReceived: string;
  dateReceived: string;
  receiptNumber: string;
  notes: string;
  // cheque
  chequeNumber: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  chequeDate: string;
  expectedClearing: string;
  // momo
  network: string;
  momoNumber: string;
  momoAccountName: string;
  transactionId: string;
  // credit
  ghanaCardNumber: string;
  dueDate: string;
  paymentTerms: string;
  creditAmount: string;
}

const EMPTY_FORM: PaymentForm = {
  amountReceived: '', dateReceived: '', receiptNumber: `RCT-${Date.now().toString().slice(-6)}`, notes: '',
  chequeNumber: '', bankName: '', accountName: '', accountNumber: '', branch: '', chequeDate: '', expectedClearing: '',
  network: 'MTN', momoNumber: '', momoAccountName: '', transactionId: '',
  ghanaCardNumber: '', dueDate: '', paymentTerms: 'Net 30', creditAmount: '',
};

function mapRow(r: any): Order {
  return {
    id: String(r.id || ''),
    ticketNumber: r.ticket_number || r.ticketNumber || r.id,
    clientName: r.client_name || r.clientName || '',
    productName: r.product_name || r.productName || '',
    destination: r.destination || '',
    paymentMode: r.payment_mode || r.paymentMode || 'CASH',
    totalAmount: Number(r.total_amount ?? r.totalAmount ?? 0),
    status: r.status || 'PENDING_FINANCE',
    createdAt: r.created_at || r.createdAt || '',
    products: r.product_name || r.productName || r.products || '',
    submittedBy: r.created_by || r.submittedBy || '',
    quantity: Number(r.quantity ?? 0),
    metadata: r.metadata || null,
  };
}

export default function FinanceOrdersQueueView({ addNotification, ordersList: propOrders, setOrdersList, onEvaluateOrder, currentUser }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(!propOrders || propOrders.length === 0);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [payForm, setPayForm] = useState<PaymentForm>({ ...EMPTY_FORM });
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isPartPayment, setIsPartPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selected) {
      setPayForm({
        ...EMPTY_FORM,
        amountReceived: String(selected.totalAmount),
        creditAmount: String(selected.totalAmount),
        receiptNumber: `RCT-${Date.now().toString().slice(-6)}`,
        dateReceived: new Date().toISOString().slice(0, 10),
      });
      setIsPartPayment(false);
    } else {
      setPayForm({ ...EMPTY_FORM });
      setIsPartPayment(false);
    }
  }, [selected]);

  useEffect(() => {
    if (propOrders && propOrders.length > 0) {
      setAllOrders(propOrders);
      setOrders(propOrders.filter(o => o.status === 'PENDING_FINANCE'));
      return;
    }
    const load = async () => {
      setLoadingOrders(true);
      try {
        const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
        const rows = (data ?? []).map(mapRow);
        setAllOrders(rows);
        setOrders(rows);
      } catch {
        setAllOrders([]);
        setOrders([]);
      }
      setLoadingOrders(false);
    };
    load();
  }, [propOrders]);

  const displayOrders = (propOrders && propOrders.length > 0 ? propOrders : allOrders);

  const filtered = displayOrders.filter(o => {
    const matchSearch = !search || (o.clientName || '').toLowerCase().includes(search.toLowerCase()) || (o.id || '').toLowerCase().includes(search.toLowerCase());
    const matchMode = modeFilter === 'All' || o.paymentMode === modeFilter;
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchMode && matchStatus;
  });

  const pending = displayOrders.filter(o => o.status === 'PENDING_FINANCE' || o.status === 'PENDING_MANAGEMENT');
  const approved = displayOrders.filter(o => ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status));
  const delivered = displayOrders.filter(o => o.status === 'DELIVERED');
  const rejected = displayOrders.filter(o => o.status === 'REJECTED');
  const pendingValue = pending.reduce((s, o) => s + o.totalAmount, 0);
  const approvedValue = approved.reduce((s, o) => s + o.totalAmount, 0);
  const deliveredValue = delivered.reduce((s, o) => s + o.totalAmount, 0);

  async function approveOrder(order: Order, updatedStatus: Order['status'] = 'APPROVED') {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updateLocal = (prev: Order[]) => prev.map(o => o.id === order.id ? { ...o, status: updatedStatus } : o);
      setAllOrders(updateLocal);
      setOrdersList?.(prev => prev.map(o => o.id === order.id ? { ...o, status: updatedStatus } : o));
      onEvaluateOrder?.(order.id, true);

      // Get current user for audit trail
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || '';
      const performedBy = currentUser?.fullName || 'Finance';
      const now = new Date().toISOString();

      await supabase.from('orders').update({ status: updatedStatus }).eq('id', order.id);
      await supabase.from('delivery_logs').insert([{
        order_id: order.id,
        customer_name: order.clientName,
        delivery_address: order.destination || order.clientName,
        status: 'PENDING_ASSIGNMENT',
        created_at: now,
      }]);
      await supabase.from('supplier_order_notifications').insert([
        { message: `Finance approved order ${order.ticketNumber || order.id} for ${order.clientName}. Please prepare goods for dispatch.`, notified_department: 'OPERATIONS', read: false },
        { message: `Your order ${order.ticketNumber || order.id} has been approved by Finance. Operations is preparing your goods.`, notified_department: 'MARKETING', read: false },
        { message: `Order ${order.ticketNumber || order.id} for ${order.clientName} is ready for delivery assignment.`, notified_department: 'DISPATCH', read: false },
      ]);
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Order ${order.ticketNumber || order.id} APPROVED for ${order.clientName} — GHS ${(Number(order.totalAmount ?? 0)).toLocaleString()}`, performed_by: performedBy, timestamp: now }]);

      addNotification?.(`Order ${order.ticketNumber || order.id} approved. Invoice generated. Operations notified.`);
      setSelected(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  async function rejectOrder(id: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updateLocal = (prev: Order[]) => prev.map(o => o.id === id ? { ...o, status: 'REJECTED' as const } : o);
      setAllOrders(updateLocal);
      setOrdersList?.(prev => prev.map(o => o.id === id ? { ...o, status: 'REJECTED' as const } : o));
      onEvaluateOrder?.(id, false);

      await supabase.from('orders').update({ status: 'REJECTED', reject_reason: rejectReason }).eq('id', id);
      await supabase.from('supplier_order_notifications').insert([{ message: `Order ${id} rejected by Finance. Reason: ${rejectReason}`, notified_department: 'MARKETING', read: false }]);
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Order ${id} REJECTED. Reason: ${rejectReason}`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);

      addNotification?.(`Order ${id} rejected.`);
      setRejectModal(null);
      setRejectReason('');
      setSelected(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  async function savePaymentAndApprove(order: Order) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const paymentRecord = {
        order_id: order.id,
        client_name: order.clientName,
        amount: Number(payForm.amountReceived || order.totalAmount),
        payment_mode: order.paymentMode,
        payment_type: isPartPayment ? 'Part Payment' : 'Full Payment',
        cheque_number: payForm.chequeNumber || null,
        bank_name: payForm.bankName || null,
        momo_number: payForm.momoNumber || null,
        transaction_id: payForm.transactionId || null,
        ghana_card_number: payForm.ghanaCardNumber || null,
        due_date: payForm.dueDate || null,
        receipt_number: payForm.receiptNumber,
        notes: payForm.notes,
        recorded_by: currentUser?.fullName || 'Finance',
        created_at: new Date().toISOString(),
        status: 'CONFIRMED',
      };
      await supabase.from('finance_payments').insert([paymentRecord]);
      // Note: approveOrder sets submitting to false upon completion
      setSubmitting(false);
      await approveOrder(order);
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  }

  const pMode = (selected?.paymentMode || 'CASH') as PaymentMode;

  if (selected) {
    const enteredAmt = Number(payForm.amountReceived || 0);
    const isAboveTotal = enteredAmt > selected.totalAmount;
    const isBelowTotal = enteredAmt < selected.totalAmount;
    const isPartPaymentRequired = isBelowTotal && !isPartPayment;
    const isAmountInvalid = enteredAmt <= 0 || isAboveTotal || isPartPaymentRequired;

    let amountFeedbackMsg = '';
    let inputBorderClass = 'border-[var(--border)] focus:border-[var(--accent)]';
    let feedbackColorClass = 'text-[var(--text-muted)]';
    if (payForm.amountReceived !== '') {
      if (isAboveTotal) {
        amountFeedbackMsg = `Amount cannot exceed order total (GHS ${selected.totalAmount.toLocaleString()})`;
        inputBorderClass = 'border-red-500 focus:border-red-500 focus:ring-red-500';
        feedbackColorClass = 'text-red-500 font-medium';
      } else if (isBelowTotal && !isPartPayment) {
        amountFeedbackMsg = 'Please enable "Part Payment" to record a partial payment';
        inputBorderClass = 'border-red-500 focus:border-red-500 focus:ring-red-500';
        feedbackColorClass = 'text-red-500 font-medium';
      } else if (isBelowTotal && isPartPayment) {
        amountFeedbackMsg = '✓ Part Payment enabled';
        inputBorderClass = 'border-amber-500 focus:border-amber-500 focus:ring-amber-500';
        feedbackColorClass = 'text-amber-600 font-semibold';
      } else if (enteredAmt === selected.totalAmount) {
        amountFeedbackMsg = '✓ Matches total amount';
        inputBorderClass = 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500';
        feedbackColorClass = 'text-emerald-600 font-semibold';
      }
    }

    const isCashOrMoMoOrCheque = ['CASH', 'MOBILE_MONEY', 'CHEQUE'].includes(pMode);
    const isSubmitDisabled = (isCashOrMoMoOrCheque && isAmountInvalid) || submitting;

    return (
      <div className="p-4 md:p-6 space-y-5">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium">
          <ArrowLeft size={16} /> Back to Orders Queue
        </button>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{getProductSummaryWithQty(selected)}</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">Order ID: {selected.id} · {selected.clientName} · {selected.createdAt}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <span className="text-xl font-extrabold text-emerald-500">
                GHS {Number(selected.totalAmount ?? 0).toLocaleString()}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${MODE_COLORS[selected.paymentMode] || ''}`}>{selected.paymentMode}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_COLORS[selected.status] || ''}`}>{selected.status}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-2">
            {[
              { label: 'Total Amount', value: `GHS ${(Number(selected.totalAmount ?? 0)).toLocaleString()}` },
              { label: 'Submitted By', value: selected.submittedBy || '—' },
              { label: 'Payment Mode', value: selected.paymentMode },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--bg-input)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>

          {/* Invoice line-items breakdown */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Invoice Items</p>
            <InvoiceLineItems order={selected} />
          </div>

          {selected.status === 'PENDING_FINANCE' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[var(--text-primary)]">Payment Details</h3>

              {pMode === 'CASH' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Amount Received (GHS)</label>
                    <input
                      type="number"
                      value={payForm.amountReceived}
                      onChange={e => setPayForm(f => ({ ...f, amountReceived: e.target.value }))}
                      className={`w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border text-sm text-[var(--text-primary)] focus:outline-none ${inputBorderClass}`}
                    />
                    {amountFeedbackMsg && (
                      <p className={`text-[10px] mt-1 ${feedbackColorClass}`}>{amountFeedbackMsg}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2.5">
                      <input
                        type="checkbox"
                        id="partPayment"
                        checked={isPartPayment}
                        onChange={e => setIsPartPayment(e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] bg-[var(--bg-input)] cursor-pointer"
                      />
                      <label htmlFor="partPayment" className="text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none">
                        This is a Part Payment (Partial Payment)
                      </label>
                    </div>
                  </div>
                  <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Date Received</label><input type="date" value={payForm.dateReceived} onChange={e => setPayForm(f => ({ ...f, dateReceived: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
                  <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Receipt Number</label><input value={payForm.receiptNumber} readOnly className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-muted)]" /></div>
                  <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Received By</label><input value={currentUser?.fullName || 'Finance'} readOnly className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-muted)]" /></div>
                  <div className="col-span-full"><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Notes</label><textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none" /></div>
                </div>
              )}

              {pMode === 'CHEQUE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Cheque Number *', key: 'chequeNumber', type: 'text' },
                    { label: 'Bank Name *', key: 'bankName', type: 'text' },
                    { label: 'Account Name *', key: 'accountName', type: 'text' },
                    { label: 'Account Number *', key: 'accountNumber', type: 'text' },
                    { label: 'Branch', key: 'branch', type: 'text' },
                    { label: 'Cheque Date *', key: 'chequeDate', type: 'date' },
                    { label: 'Expected Clearing Date', key: 'expectedClearing', type: 'date' },
                    { label: 'Amount', key: 'amountReceived', type: 'number' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{label}</label>
                      <input
                        type={type}
                        value={(payForm as Record<string, string>)[key]}
                        onChange={e => setPayForm(f => ({ ...f, [key]: e.target.value }))}
                        className={`w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border text-sm text-[var(--text-primary)] focus:outline-none ${
                          key === 'amountReceived' ? inputBorderClass : 'border-[var(--border)] focus:border-[var(--accent)]'
                        }`}
                      />
                      {key === 'amountReceived' && (
                        <>
                          {amountFeedbackMsg && (
                            <p className={`text-[10px] mt-1 ${feedbackColorClass}`}>{amountFeedbackMsg}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2.5">
                            <input
                              type="checkbox"
                              id="partPaymentCheque"
                              checked={isPartPayment}
                              onChange={e => setIsPartPayment(e.target.checked)}
                              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] bg-[var(--bg-input)] cursor-pointer"
                            />
                            <label htmlFor="partPaymentCheque" className="text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none">
                              This is a Part Payment (Partial Payment)
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {pMode === 'MOBILE_MONEY' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Network</label><select value={payForm.network} onChange={e => setPayForm(f => ({ ...f, network: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"><option>MTN</option><option>Vodafone</option><option>AirtelTigo</option></select></div>
                  <div>
                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Amount Received (GHS)</label>
                    <input
                      type="number"
                      value={payForm.amountReceived}
                      onChange={e => setPayForm(f => ({ ...f, amountReceived: e.target.value }))}
                      className={`w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border text-sm text-[var(--text-primary)] focus:outline-none ${inputBorderClass}`}
                    />
                    {amountFeedbackMsg && (
                      <p className={`text-[10px] mt-1 ${feedbackColorClass}`}>{amountFeedbackMsg}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2.5">
                      <input
                        type="checkbox"
                        id="partPaymentMoMo"
                        checked={isPartPayment}
                        onChange={e => setIsPartPayment(e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] bg-[var(--bg-input)] cursor-pointer"
                      />
                      <label htmlFor="partPaymentMoMo" className="text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none">
                        This is a Part Payment (Partial Payment)
                      </label>
                    </div>
                  </div>
                  {[
                    { label: 'MoMo Number *', key: 'momoNumber' },
                    { label: 'Account Name *', key: 'momoAccountName' },
                    { label: 'Transaction ID *', key: 'transactionId' },
                  ].map(({ label, key }) => (
                    <div key={key}><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{label}</label><input value={(payForm as Record<string, string>)[key]} onChange={e => setPayForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
                  ))}
                  <div className="col-span-full">
                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Screenshot Upload</label>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--border)]">
                        <Upload size={14} /> Upload File
                        <input type="file" accept="image/*" className="hidden" />
                      </label>
                      <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--border)]">
                        <Camera size={14} /> Camera
                        <input type="file" accept="image/*" capture="environment" className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {pMode === 'CREDIT' && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700">
                    Credit orders require Management approval first. This form records the Ghana Card details for the customer.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Ghana Card Number</label><input value={payForm.ghanaCardNumber} onChange={e => setPayForm(f => ({ ...f, ghanaCardNumber: e.target.value }))} placeholder="GHA-XXXXXXXXX-X" className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
                    <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Due Date *</label><input type="date" value={payForm.dueDate} onChange={e => setPayForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
                    <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Payment Terms</label><input value={payForm.paymentTerms} onChange={e => setPayForm(f => ({ ...f, paymentTerms: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
                    <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Credit Amount (GHS)</label><input type="number" value={payForm.creditAmount || String(selected.totalAmount)} onChange={e => setPayForm(f => ({ ...f, creditAmount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
                    {[
                      { label: 'Ghana Card Front', accept: 'image/*' },
                      { label: 'Ghana Card Back', accept: 'image/*' },
                      { label: 'Customer Photo', accept: 'image/*' },
                    ].map(({ label, accept }) => (
                      <div key={label}>
                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{label}</label>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--border)]">
                            <Upload size={12} /> Upload<input type="file" accept={accept} className="hidden" />
                          </label>
                          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--border)]">
                            <Camera size={12} /> Camera<input type="file" accept={accept} capture="environment" className="hidden" />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  disabled={submitting}
                  onClick={() => setRejectModal(selected.id)}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={16} /> Reject Order
                </button>
                <button
                  disabled={isSubmitDisabled}
                  onClick={() => savePaymentAndApprove(selected)}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${
                    isSubmitDisabled ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'hover:opacity-90'
                  }`}
                  style={!isSubmitDisabled ? { background: 'var(--accent)' } : undefined}
                >
                  <CheckCircle size={16} /> {submitting ? 'Approving...' : 'Approve & Save Payment'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Orders Queue</h1>
          <p className="text-sm text-[var(--text-secondary)]">Review and process orders submitted by Marketing</p>
        </div>
        <button onClick={() => exportToCSV(filtered.map(o => ({ ID: o.id, Customer: o.clientName, Amount: o.totalAmount, Mode: o.paymentMode, Status: o.status, Date: o.createdAt })), ['ID', 'Customer', 'Amount', 'Mode', 'Status', 'Date'], 'orders_queue')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
          <Download size={14} /> Export
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', value: pending.length, sub: `GHS ${pendingValue.toLocaleString()}`, color: '#f59e0b', icon: Clock },
          { label: 'Approved / Active', value: approved.length, sub: `GHS ${approvedValue.toLocaleString()}`, color: '#10b981', icon: CheckCircle },
          { label: 'Delivered', value: delivered.length, sub: `GHS ${deliveredValue.toLocaleString()}`, color: 'var(--accent)', icon: DollarSign },
          { label: 'Rejected', value: rejected.length, sub: 'Orders declined', color: '#ef4444', icon: XCircle },
        ].map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-medium">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order ID or customer..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]">
          {['All', 'CASH', 'CHEQUE', 'MOBILE_MONEY', 'CREDIT'].map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]">
          {['All', 'PENDING_FINANCE', 'PENDING_MANAGEMENT', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loadingOrders ? (
          <div className="p-6">{[0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}</div>
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Order ID', 'Customer', 'Products', 'Amount', 'Payment Mode', 'Date', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-[var(--bg-input)] cursor-pointer group" onClick={() => setSelected(order)}>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{order.id}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{order.clientName}</td>
                  <td className="px-4 py-3 max-w-[180px]"><InvoiceLineItems order={order} compact /></td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">GHS {(Number(order.totalAmount ?? 0)).toLocaleString()}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${MODE_COLORS[order.paymentMode] || ''}`}>{order.paymentMode}</span></td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap text-xs">{order.createdAt}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || ''}`}>{order.status}</span></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSelected(order)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)]" title="View"><Eye size={14} style={{ color: 'var(--accent)' }} /></button>
                      {order.status === 'PENDING_FINANCE' && (
                        <>
                          <button onClick={() => { setSelected(order); }} className="p-1.5 rounded-lg hover:bg-green-100" title="Approve"><CheckCircle size={14} className="text-green-500" /></button>
                          <button onClick={() => { setRejectModal(order.id); }} className="p-1.5 rounded-lg hover:bg-red-100" title="Reject"><XCircle size={14} className="text-red-500" /></button>
                        </>
                      )}
                      <div className="relative">
                        <button onClick={() => setMenuOpen(menuOpen === order.id ? null : order.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                        {menuOpen === order.id && (
                          <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[160px]" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setSelected(order); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Full Details</button>
                            {order.status === 'PENDING_FINANCE' && <>
                              <button onClick={() => { setSelected(order); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-[var(--bg-input)]">Approve Order</button>
                              <button onClick={() => { setRejectModal(order.id); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-[var(--bg-input)]">Reject Order</button>
                            </>}
                            <button onClick={() => { window.print(); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Export PDF</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
            <Package size={32} className="opacity-30 mb-2" />
            <p className="text-sm">No orders found</p>
          </div>
        )}
        </>
        )}
      </div>

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">Reject Order {rejectModal}</h3>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Reason for rejection *</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Explain why this order is being rejected..." className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none mb-4" />
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Cancel</button>
              <button onClick={() => rejectOrder(rejectModal!)} disabled={!rejectReason} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
