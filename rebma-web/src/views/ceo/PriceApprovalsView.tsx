// src/views/ceo/PriceApprovalsView.tsx
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Tag, ArrowRight, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface PriceRequest {
  id: string;
  product_name: string;
  category: string | null;
  unit_price: number;
  cost_price: number | null;
  currency: string;
  product_image: string | null;
  requested_by_name: string | null;
  created_at: string;
  status: string;
}

interface Props { currentUser: CurrentUser | null; addNotification: (msg: string) => void }

export default function PriceApprovalsView({ currentUser, addNotification }: Props) {
  const [pending, setPending]   = useState<PriceRequest[]>([]);
  const [current, setCurrent]   = useState<Record<string, number>>({});
  const [history, setHistory]   = useState<PriceRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: pendingRows }, { data: historyRows }, { data: liveGoods }] = await Promise.all([
        supabase.from('goods_price_change_requests').select('*').eq('status', 'PENDING').order('created_at', { ascending: false }),
        supabase.from('goods_price_change_requests').select('*').neq('status', 'PENDING').order('decided_at', { ascending: false }).limit(10),
        supabase.from('goods_prices').select('product_name,unit_price'),
      ]);
      setPending(pendingRows || []);
      setHistory(historyRows || []);
      const priceMap: Record<string, number> = {};
      (liveGoods || []).forEach((g: any) => { priceMap[g.product_name] = Number(g.unit_price || 0); });
      setCurrent(priceMap);
    } catch (e) {
      console.error('Error loading price approvals:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (req: PriceRequest, approve: boolean) => {
    setDecidingId(req.id);
    try {
      if (approve) {
        await supabase.from('goods_prices').upsert([{
          product_name: req.product_name,
          unit_price: req.unit_price,
          cost_price: req.cost_price,
          category: req.category,
          currency: req.currency,
          product_image: req.product_image,
          updated_by: req.requested_by_name,
          updated_at: new Date().toISOString(),
          status: 'active',
        }], { onConflict: 'product_name' });
      }
      await supabase.from('goods_price_change_requests').update({
        status: approve ? 'APPROVED' : 'REJECTED',
        decided_at: new Date().toISOString(),
      }).eq('id', req.id);

      await supabase.from('global_audit_history').insert({
        action: `${approve ? 'Approved' : 'Rejected'} price request`,
        department: 'MANAGEMENT',
        performed_by: currentUser?.fullName || 'CEO',
        details: `${req.product_name} → ${req.currency} ${Number(req.unit_price).toLocaleString()}`,
      });

      addNotification(`${approve ? 'Approved' : 'Rejected'} price change for ${req.product_name}.`);
      setPending(prev => prev.filter(r => r.id !== req.id));
      load();
    } catch (e: any) {
      console.error(e);
      addNotification(e?.message || 'Price decision failed.');
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Price Approvals</h2>
        <p className="text-xs text-[var(--text-muted)]">
          {loading ? 'Loading…' : `${pending.length} price change${pending.length !== 1 ? 's' : ''} awaiting your decision`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl">
          <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">All clear!</p>
          <p className="text-xs text-[var(--text-muted)]">No price changes waiting on you right now.</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
          <div className="divide-y divide-[var(--border)]">
            {pending.map(req => {
              const prev = current[req.product_name];
              const isIncrease = prev != null && req.unit_price > prev;
              const isDecrease = prev != null && req.unit_price < prev;
              return (
                <div key={req.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent-light)] flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-[var(--accent)]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{req.product_name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {req.requested_by_name || 'Management'} · {req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                    {prev != null && (
                      <>
                        <span className="text-xs text-[var(--text-muted)] line-through">{req.currency} {prev.toLocaleString()}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      </>
                    )}
                    <span className={`text-sm font-bold ${isIncrease ? 'text-rose-500' : isDecrease ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>
                      {req.currency} {Number(req.unit_price).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => decide(req, true)}
                      disabled={decidingId === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-emerald-600 disabled:opacity-50">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => decide(req, false)}
                      disabled={decidingId === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-rose-600 disabled:opacity-50">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <h3 className="text-sm font-bold text-[var(--text-secondary)]">Recent Decisions</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {history.map(req => (
              <div key={req.id} className="flex items-center gap-3 px-4 py-2.5 opacity-70 hover:opacity-100 transition-opacity">
                {req.status === 'APPROVED'
                  ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {req.product_name} — {req.currency} {Number(req.unit_price).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)]">
                    {req.requested_by_name || 'Management'}
                  </p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                  {req.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
