// rebma-web/src/views/finance/StatementView.tsx
// A complete row-per-product ledger: every purchase line item, who bought it,
// where it was sent, and live stock remaining — every row drills into the
// underlying order, customer, and audit trail.
import { useState, useEffect, useMemo } from 'react';
import { Search, Eye, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, downloadRowPDF } from '../../utils/export';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';

interface StatementRow {
  key: string;
  orderId: string;
  ticketNumber: string | null;
  date: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  clientName: string;
  destination: string | null;
  paymentMode: string;
  status: string;
  stockRemaining: number | null;
}

interface Props {
  addNotification?: (msg: string) => void;
}

export default function StatementView({ addNotification }: Props) {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StatementRow | null>(null);
  const [detailTab, setDetailTab] = useState<'order' | 'customer' | 'audit'>('order');

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: ords }, { data: custs }, { data: stk }, { data: audit }] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('customers').select('*'),
        supabase.from('stock').select('product_name, quantity'),
        supabase.from('global_audit_history').select('*').order('timestamp', { ascending: false }).limit(500),
      ]);
      setOrders(ords || []);
      setCustomers(custs || []);
      setStock(stk || []);
      setAuditLog(audit || []);
    } catch (e) {
      console.error('Error loading statement data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stockFor = (productName: string) => {
    const key = productName.toLowerCase().trim();
    const row = stock.find(s => String(s.product_name || '').toLowerCase().trim() === key);
    return row ? Number(row.quantity) || 0 : null;
  };

  const rows: StatementRow[] = useMemo(() => {
    const out: StatementRow[] = [];
    for (const o of orders) {
      const items = Array.isArray(o.metadata?.items) && o.metadata.items.length > 0
        ? o.metadata.items
        : [{ productName: o.product_name || 'Generic Goods', quantity: o.quantity || 1, unitPrice: 0 }];
      items.forEach((item: any, idx: number) => {
        const productName = item.productName || item.product_name || o.product_name || 'Generic Goods';
        out.push({
          key: `${o.id}-${idx}`,
          orderId: o.id,
          ticketNumber: o.ticket_number || null,
          date: o.created_at,
          productName,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0),
          lineTotal: Number(item.lineTotal ?? item.line_total ?? (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
          clientName: o.client_name || 'Unknown',
          destination: o.destination || null,
          paymentMode: o.payment_mode || 'CASH',
          status: o.status || 'PENDING_FINANCE',
          stockRemaining: stockFor(productName),
        });
      });
    }
    return out;
  }, [orders, stock]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.productName.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q) ||
      (r.ticketNumber || '').toLowerCase().includes(q) ||
      (r.destination || '').toLowerCase().includes(q);
  });

  const matchedCustomer = selected ? customers.find(c => String(c.name || '').toLowerCase().trim() === selected.clientName.toLowerCase().trim()) : null;
  const matchedAudit = selected ? auditLog.filter(a => (a.details || '').includes(selected.ticketNumber || selected.orderId) || (a.action || '').includes(selected.orderId)) : [];
  const fullOrder = selected ? orders.find(o => o.id === selected.orderId) : null;

  const STATUS_STYLES: Record<string, string> = {
    PENDING_FINANCE: 'bg-amber-100 text-amber-700',
    PENDING_MANAGEMENT: 'bg-purple-100 text-purple-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    PROCESSING: 'bg-indigo-100 text-indigo-700',
    OUT_FOR_DELIVERY: 'bg-teal-100 text-teal-700',
    DELIVERED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-rose-100 text-rose-700',
  };

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Statement</h2>
          <p className="text-xs text-[var(--text-muted)]">Every product purchase — who bought it, where it went, and live stock. Click any row for full detail.</p>
        </div>
        <button
          onClick={() => { exportToCSV(filtered, ['ticketNumber', 'date', 'productName', 'quantity', 'clientName', 'destination', 'paymentMode', 'status', 'stockRemaining'], 'statement'); addNotification?.('Exported CSV.'); }}
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
          placeholder="Search product, customer, ticket, destination…"
          className="w-full sm:w-96 pl-8 pr-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
              {['Date/Time', 'Product', 'Qty', 'Purchased By', 'Sent To', 'Payment', 'Status', 'Stock Left', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={9} className="px-3 py-4"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                  ))
                : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-10 text-center text-[var(--text-muted)]">No purchases found.</td></tr>
                  ) : filtered.map(row => (
                    <tr
                      key={row.key}
                      onClick={() => { setSelected(row); setDetailTab('order'); }}
                      className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{new Date(row.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td className="px-3 py-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">{row.productName}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">×{row.quantity}</td>
                      <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">{row.clientName}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{row.destination || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{row.paymentMode}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${STATUS_STYLES[row.status] || 'bg-gray-100 text-gray-600'}`}>{row.status.replace(/_/g, ' ')}</span></td>
                      <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{row.stockRemaining !== null ? row.stockRemaining.toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setSelected(row); setDetailTab('order'); }} className="p-1 hover:bg-[var(--accent-light)] rounded-lg cursor-pointer text-[var(--accent)]">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => downloadRowPDF(`Statement - ${row.ticketNumber || row.orderId}`, {
                            Ticket: row.ticketNumber || '—', OrderId: row.orderId, Date: new Date(row.date).toLocaleString(),
                            Product: row.productName, Quantity: row.quantity, PurchasedBy: row.clientName,
                            SentTo: row.destination || '—', PaymentMode: row.paymentMode,
                            Status: row.status.replace(/_/g, ' '), StockRemaining: row.stockRemaining ?? '—',
                          })}
                          className="p-1 hover:bg-[var(--accent-light)] rounded-lg cursor-pointer text-[var(--accent)]"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {selected && (
      <EntityDetailPanel
        title={selected.ticketNumber || selected.orderId}
        subtitle={selected.productName}
        badgeText={selected.status.replace(/_/g, ' ')}
        badgeStyle={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
        fields={[]}
        onClose={() => setSelected(null)}
        onDownloadPdf={() => downloadRowPDF(`Statement - ${selected.ticketNumber || selected.orderId}`, {
          Ticket: selected.ticketNumber || '—', OrderId: selected.orderId, Date: new Date(selected.date).toLocaleString(),
          Product: selected.productName, Quantity: selected.quantity, PurchasedBy: selected.clientName,
          SentTo: selected.destination || '—', PaymentMode: selected.paymentMode,
          Status: selected.status.replace(/_/g, ' '), StockRemaining: selected.stockRemaining ?? '—',
        })}
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['order', 'customer', 'audit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setDetailTab(tab)}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: detailTab === tab ? 'var(--accent)' : 'var(--bg-input)',
                color: detailTab === tab ? '#fff' : 'var(--text-secondary)',
                border: 'none', textTransform: 'capitalize',
              }}
            >
              {tab === 'order' ? 'Order' : tab === 'customer' ? 'Customer' : 'Approvals / Audit'}
            </button>
          ))}
        </div>

        {detailTab === 'order' && (
          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
            {[
              ['Ticket', selected.ticketNumber || '—'],
              ['Order ID', selected.orderId],
              ['Product', selected.productName],
              ['Quantity', String(selected.quantity)],
              ['Unit Price', selected.unitPrice ? `GHS ${selected.unitPrice.toLocaleString()}` : '—'],
              ['Line Total', selected.lineTotal ? `GHS ${selected.lineTotal.toLocaleString()}` : '—'],
              ['Order Total', fullOrder ? `GHS ${Number(fullOrder.total_amount || 0).toLocaleString()}` : '—'],
              ['Destination', selected.destination || '—'],
              ['Payment Mode', selected.paymentMode],
              ['Status', selected.status.replace(/_/g, ' ')],
              ['Stock Remaining', selected.stockRemaining !== null ? selected.stockRemaining.toLocaleString() : '—'],
              ['Date', new Date(selected.date).toLocaleString()],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {detailTab === 'customer' && (
          matchedCustomer ? (
            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
              {[
                ['Name', matchedCustomer.name],
                ['Company', matchedCustomer.company_name || '—'],
                ['Phone', matchedCustomer.phone || '—'],
                ['Location', matchedCustomer.location || '—'],
                ['Registered', matchedCustomer.registered_at ? new Date(matchedCustomer.registered_at).toLocaleDateString() : '—'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No matching customer record found for "{selected.clientName}" — they may have been registered under a different name, or this was a walk-in sale.</p>
          )
        )}

        {detailTab === 'audit' && (
          matchedAudit.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matchedAudit.map(a => (
                <div key={a.id} style={{ padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <strong>{a.department}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(a.timestamp).toLocaleString()}</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{a.details || a.action}</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No audit/approval entries reference this order yet.</p>
          )
        )}
      </EntityDetailPanel>
    )}
    </>
  );
}
