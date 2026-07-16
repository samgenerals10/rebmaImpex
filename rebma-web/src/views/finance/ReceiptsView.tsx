// rebma-web/src/views/finance/ReceiptsView.tsx
// Every payment approval auto-generates a finance_payments row (the receipt)
// but there was nowhere in the app to actually see it — this is that page:
// a searchable, printable list of every receipt on record.
import { useEffect, useState, useCallback } from 'react';
import { Search, Receipt as ReceiptIcon, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, downloadRowPDF } from '../../utils/export';

interface ReceiptRow {
  id: string;
  clientName: string;
  amount: number;
  paymentMode: string;
  paymentType: string;
  orderId: string | null;
  invoiceNumber: string;
  recordedBy: string | null;
  status: string;
  createdAt: string;
}

interface Props {
  addNotification?: (msg: string) => void;
}

export default function FinanceReceiptsView({ addNotification }: Props) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('finance_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      setReceipts((data || []).map((r: any) => ({
        id: r.id,
        clientName: r.client_name || r.customer_name || 'Customer',
        amount: Number(r.amount || 0),
        paymentMode: r.payment_mode || 'CASH',
        paymentType: r.payment_type || 'Full Payment',
        orderId: r.order_id || null,
        invoiceNumber: r.invoice_number || r.id,
        recordedBy: r.recorded_by || null,
        status: r.status || 'CONFIRMED',
        createdAt: r.created_at || '',
      })));
    } catch {
      setReceipts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('finance-receipts-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_payments' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const filtered = receipts.filter(r =>
    !search ||
    r.clientName.toLowerCase().includes(search.toLowerCase()) ||
    r.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.orderId || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);

  const downloadReceipt = (r: ReceiptRow) => {
    downloadRowPDF(`Receipt ${r.invoiceNumber}`, {
      InvoiceNumber: r.invoiceNumber,
      Client: r.clientName,
      Amount: `GHS ${r.amount.toLocaleString()}`,
      PaymentMode: r.paymentMode,
      PaymentType: r.paymentType,
      OrderRef: r.orderId || '—',
      RecordedBy: r.recordedBy || '—',
      Status: r.status,
      Date: r.createdAt ? new Date(r.createdAt).toLocaleString() : '—',
    });
    addNotification?.(`Downloaded receipt ${r.invoiceNumber}.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Receipts</h2>
          <p className="text-xs text-[var(--text-muted)]">{filtered.length} receipt{filtered.length !== 1 ? 's' : ''} · GHS {totalAmount.toLocaleString()} total</p>
        </div>
        <button
          onClick={() => { exportToCSV(filtered.map(r => ({ Invoice: r.invoiceNumber, Client: r.clientName, Amount: r.amount, PaymentMode: r.paymentMode, PaymentType: r.paymentType, OrderId: r.orderId || '', RecordedBy: r.recordedBy || '', Status: r.status, Date: r.createdAt })), ['Invoice', 'Client', 'Amount', 'PaymentMode', 'PaymentType', 'OrderId', 'RecordedBy', 'Status', 'Date'], 'receipts'); addNotification?.('Exported CSV.'); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90 shrink-0"
        >
          Export CSV
        </button>
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search client, invoice#, order#…"
          className="w-full sm:w-96 pl-8 pr-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
              {['Invoice', 'Client', 'Amount', 'Payment', 'Order Ref', 'Recorded By', 'Status', 'Date', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-3 py-4"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-[var(--text-muted)]">No receipts found.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                  <td className="px-3 py-2 font-mono font-semibold text-[var(--text-primary)] whitespace-nowrap">{r.invoiceNumber}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">{r.clientName}</td>
                  <td className="px-3 py-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">GHS {r.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{r.paymentMode} · {r.paymentType}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] font-mono">{r.orderId || '—'}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{r.recordedBy || '—'}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">{r.status}</span></td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => downloadReceipt(r)} className="p-1 hover:bg-[var(--accent-light)] rounded-lg cursor-pointer text-[var(--accent)]" title="Download PDF">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center py-6 text-[var(--text-muted)]">
          <ReceiptIcon className="w-8 h-8 opacity-30 mb-2" />
        </div>
      )}
    </div>
  );
}
