// rebma-web/src/views/risk/CustomerCreditView.tsx
//
// Risk owns individual customer credit terms (Phase 6) — architecturally
// consistent with Risk already owning the Sales Order approval lane, credit
// orders included. Modelled directly on MgmtPriceSettingView.tsx's
// "Customer Discounts" block: same search + ResponsiveDataView + per-row
// draft-input + Save pattern. Two separate, deliberately unmerged concepts:
// Management sets discountPercent/isSpecialCustomer (pricing), Risk sets
// creditLimit/creditStatus (credit terms).
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { management } from '../../services/apiClient';
import { Search, CreditCard, ShieldAlert } from 'lucide-react';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import RatingBadge from '../../components/RatingBadge';
import CountUp from '../../components/CountUp';
import { computeCustomerRating, ordersForCustomerRow, outstandingCreditFor } from '../../utils/customerRating';
import type { Customer, Order } from '../../types/erp';

const VERIFICATION_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  RETURNED_FOR_CORRECTION: 'bg-orange-100 text-orange-700',
};
const VERIFICATION_LABELS: Record<string, string> = {
  PENDING: 'Pending Risk Review',
  APPROVED: 'Verified',
  REJECTED: 'Rejected',
  RETURNED_FOR_CORRECTION: 'Returned for Correction',
};

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function CustomerCreditView({ addNotification, currentUser }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [limitDraft, setLimitDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: custRows }, { data: orderRows }] = await Promise.all([
        supabase.from('customers').select('*').order('name', { ascending: true }),
        supabase.from('orders').select('id, customer_id, client_name, total_amount, amount_paid, payment_mode, status, created_at')
          .then(r => r, () => ({ data: [] as any[] })),
      ]);
      setCustomers((custRows || []).map((r: any) => ({
        id: r.id,
        name: r.name || 'Unnamed customer',
        companyName: r.company_name || '',
        phone: r.phone,
        location: r.location,
        registeredAt: r.registered_at,
        status: r.status || 'PENDING',
        creditLimit: r.credit_limit != null ? Number(r.credit_limit) : null,
        creditStatus: r.credit_status || 'ACTIVE',
      } as Customer)));
      setOrders((orderRows || []).map((o: any) => ({
        id: o.id,
        customerId: o.customer_id || undefined,
        clientName: o.client_name || '',
        totalAmount: Number(o.total_amount) || 0,
        amountPaid: Number(o.amount_paid) || 0,
        paymentMode: o.payment_mode || '',
        status: o.status,
        createdAt: o.created_at,
      } as Order)));
    } catch (e) {
      console.error('Error loading customer credit data:', e);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveCreditLimit(customerId: string) {
    const raw = limitDraft[customerId];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    const limit = trimmed === '' ? null : Math.max(0, Number(trimmed));
    if (trimmed !== '' && Number.isNaN(limit as number)) return;
    const target = customers.find(c => c.id === customerId);
    setSavingId(customerId);
    try {
      await management.setCustomerCreditTerms(customerId, {
        creditLimit: limit,
        creditStatus: target?.creditStatus || 'ACTIVE',
      });
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, creditLimit: limit } : c));
      setLimitDraft(prev => { const next = { ...prev }; delete next[customerId]; return next; });
      await supabase.from('global_audit_history').insert({
        action: `CREDIT_TERMS: CUST-${customerId.slice(-6).toUpperCase()} — ${target?.name || 'customer'}`,
        department: 'RISK',
        performed_by: currentUser?.fullName || 'Risk',
        reference_id: customerId,
        details: limit === null ? 'Credit limit cleared, global cap applies' : `Credit limit set to GHS ${limit.toLocaleString()}`,
        timestamp: new Date().toISOString(),
      });
      addNotification?.('Credit limit updated.');
    } catch (e: any) {
      addNotification?.(e.message || 'Failed to update credit limit.');
    } finally {
      setSavingId(null);
    }
  }

  async function toggleCreditStatus(customerId: string, next: 'ACTIVE' | 'ON_HOLD') {
    const target = customers.find(c => c.id === customerId);
    setTogglingId(customerId);
    try {
      await management.setCustomerCreditTerms(customerId, {
        creditLimit: target?.creditLimit ?? null,
        creditStatus: next,
      });
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, creditStatus: next } : c));
      await supabase.from('global_audit_history').insert({
        action: `CREDIT_TERMS: CUST-${customerId.slice(-6).toUpperCase()} — ${target?.name || 'customer'}`,
        department: 'RISK',
        performed_by: currentUser?.fullName || 'Risk',
        reference_id: customerId,
        details: next === 'ON_HOLD' ? 'Credit placed ON HOLD, new credit orders blocked' : 'Credit hold lifted',
        timestamp: new Date().toISOString(),
      });
      addNotification?.(next === 'ON_HOLD' ? 'Customer placed on credit hold.' : 'Credit hold lifted.');

      // CEO Control Center — Risk Controls: "Notify Marketing on Credit Hold"
      const { data: gate } = await supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'risk_credit_hold_notify_marketing').maybeSingle();
      if (gate?.setting_value !== false) {
        await supabase.from('supplier_order_notifications').insert({
          message: `${target?.name || 'A customer'} was ${next === 'ON_HOLD' ? 'placed on credit hold' : 'taken off credit hold'} by Risk.`,
          notified_department: 'MARKETING',
          read: false,
        });
      }
    } catch (e: any) {
      addNotification?.(e.message || 'Failed to update credit status.');
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.companyName || '').toLowerCase().includes(search.toLowerCase())
  );

  const onHoldCount = customers.filter(c => c.creditStatus === 'ON_HOLD').length;
  const overLimitCount = customers.filter(c => c.creditLimit != null && outstandingCreditFor(orders, c) >= c.creditLimit).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><CreditCard size={18} /> Customer Credit</h2>
        <p className="text-xs text-[var(--text-muted)]">Set individual credit limits and hold status. A blank limit falls back to the CEO's global credit cap.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">On Credit Hold</p>
          <p className="text-xl font-bold text-rose-500"><CountUp value={onHoldCount} /></p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">At or Over Limit</p>
          <p className="text-xl font-bold text-amber-500"><CountUp value={overLimitCount} /></p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
          <div className="relative w-full sm:w-72">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <div className="p-3">
          <ResponsiveDataView<typeof filtered[number]>
            columns={[
              { key: 'name', label: 'Customer', primary: true },
              {
                key: 'verification', label: 'Verification', render: c => (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${VERIFICATION_STYLES[c.status || 'PENDING']}`}>
                    {VERIFICATION_LABELS[c.status || 'PENDING']}
                  </span>
                )
              },
              {
                key: 'rating', label: 'Rating', status: true, render: c => {
                  const rating = computeCustomerRating(ordersForCustomerRow(orders, c));
                  return <RatingBadge rating={rating} size="xs" />;
                }
              },
              {
                key: 'outstanding', label: 'Outstanding', render: c => {
                  const outstanding = outstandingCreditFor(orders, c);
                  return <span className="font-semibold">GHS {outstanding.toLocaleString()}</span>;
                }
              },
              {
                key: 'limit', label: 'Credit Limit', render: c => {
                  const draft = limitDraft[c.id];
                  const current = draft !== undefined ? draft : (c.creditLimit != null ? String(c.creditLimit) : '');
                  return (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[var(--text-muted)]">GHS</span>
                      <input
                        type="number" min={0} step={100}
                        value={current}
                        placeholder="No limit"
                        onChange={e => setLimitDraft(prev => ({ ...prev, [c.id]: e.target.value }))}
                        className="w-24 px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  );
                }
              },
              {
                key: 'headroom', label: 'Headroom', render: c => {
                  if (c.creditLimit == null) return <span className="text-[var(--text-muted)]">Global cap applies</span>;
                  const headroom = c.creditLimit - outstandingCreditFor(orders, c);
                  return <span className={`font-semibold ${headroom <= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>GHS {headroom.toLocaleString()}</span>;
                }
              },
              {
                key: 'creditStatus', label: 'Status', render: c => (
                  <button
                    onClick={() => toggleCreditStatus(c.id, c.creditStatus === 'ON_HOLD' ? 'ACTIVE' : 'ON_HOLD')}
                    disabled={togglingId === c.id}
                    title={c.creditStatus === 'ON_HOLD' ? 'Click to lift the credit hold' : 'Click to place this customer on credit hold'}
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors disabled:opacity-50 ${
                      c.creditStatus === 'ON_HOLD'
                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {c.creditStatus === 'ON_HOLD' && <ShieldAlert size={9} />}
                    {togglingId === c.id ? '…' : c.creditStatus === 'ON_HOLD' ? 'ON HOLD' : 'Active'}
                  </button>
                )
              },
            ] as DataColumn<typeof filtered[number]>[]}
            data={filtered}
            rowKey={c => c.id}
            loading={loading}
            emptyTitle="No customers found"
            renderActions={c => {
              const draft = limitDraft[c.id];
              const currentLimitStr = c.creditLimit != null ? String(c.creditLimit) : '';
              const dirty = draft !== undefined && draft.trim() !== currentLimitStr;
              if (!dirty) return null;
              return (
                <button
                  onClick={() => saveCreditLimit(c.id)}
                  disabled={savingId === c.id}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}
                >
                  {savingId === c.id ? 'Saving…' : 'Save'}
                </button>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
