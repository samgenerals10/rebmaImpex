// src/components/global/FeedbackPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, ThumbsUp, ThumbsDown, Minus, X, Check, Star } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface FeedbackItem {
  id: string;
  user_id: string;
  department: string;
  type: 'internal' | 'customer';
  category: string;
  subject: string;
  body: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  rating: number | null;
  anonymous: boolean;
  resolved: boolean;
  created_at: string;
  submitter_name?: string;
}

interface FeedbackPanelProps {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

type FeedbackModal = { open: boolean; type: 'internal' | 'customer'; category: string; subject: string; body: string; sentiment: 'positive' | 'neutral' | 'negative'; rating: number | null; anonymous: boolean };
const blank: Omit<FeedbackModal, 'open'> = { type: 'internal', category: 'General', subject: '', body: '', sentiment: 'neutral', rating: null, anonymous: false };

const SENTIMENT_STYLES = {
  positive: { Icon: ThumbsUp,   color: 'text-emerald-600', bg: 'bg-emerald-100 border-emerald-200' },
  neutral:  { Icon: Minus,      color: 'text-amber-600',   bg: 'bg-amber-100 border-amber-200'   },
  negative: { Icon: ThumbsDown, color: 'text-rose-600',    bg: 'bg-rose-100 border-rose-200'     },
};

export default function FeedbackPanel({ currentUser, addNotification }: FeedbackPanelProps) {
  const [items, setItems]       = useState<FeedbackItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'internal' | 'customer'>('internal');
  const [filter, setFilter]     = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [modal, setModal]       = useState<FeedbackModal>({ open: false, ...blank });
  const [saving, setSaving]     = useState(false);
  const [expandId, setExpandId] = useState<string | null>(null);

  const isManagement = currentUser?.isCeo || currentUser?.department === 'MANAGEMENT' || currentUser?.department === 'CEO';

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let q = supabase.from('feedback').select('*, profiles(full_name)').order('created_at', { ascending: false });
      if (!isManagement) q = q.or(`user_id.eq.${currentUser.id},and(anonymous.eq.false,department.eq.${currentUser.department})`);
      const { data } = await q;
      if (data) setItems(data.map(d => ({ ...d, submitter_name: (d as any).profiles?.full_name })));
    } catch { /* table may not exist */ }
    setLoading(false);
  }, [currentUser, isManagement]);

  useEffect(() => { load(); }, [load]);

  const visible = items.filter(i => i.type === tab && (filter === 'all' || i.sentiment === filter));

  const save = async () => {
    if (!currentUser || !modal.subject.trim()) return;
    setSaving(true);
    try {
      await supabase.from('feedback').insert({
        user_id: currentUser.id, department: currentUser.department,
        type: modal.type, category: modal.category,
        subject: modal.subject, body: modal.body,
        sentiment: modal.sentiment, rating: modal.rating,
        anonymous: modal.anonymous,
      });
      addNotification('Feedback submitted. Thank you!');
      setModal({ open: false, ...blank });
      load();
    } catch { addNotification('Could not submit feedback.'); }
    setSaving(false);
  };

  const toggleResolved = async (id: string, current: boolean) => {
    await supabase.from('feedback').update({ resolved: !current }).eq('id', id);
    load();
  };

  return (
    <div className="feedback-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Feedback</h2>
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-lg overflow-hidden text-[10px] font-semibold">
            {([['internal','Internal'],['customer','Customer']] as const).map(([v,l]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`px-3 py-1.5 cursor-pointer transition-colors ${tab === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-lg overflow-hidden text-[9px] font-semibold">
            {(['all','positive','neutral','negative'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-1.5 capitalize cursor-pointer transition-colors ${filter === f ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => setModal({ open: true, ...blank })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Submit
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_,i) => <div key={i} className="h-16 rounded-xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <MessageSquare className="w-8 h-8 text-[var(--text-muted)] mb-2" />
          <p className="text-xs text-[var(--text-muted)]">No {tab} feedback yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => {
            const { Icon, color, bg } = SENTIMENT_STYLES[item.sentiment];
            const isOwn = item.user_id === currentUser?.id;
            return (
              <div key={item.id} className={`bg-[var(--bg-card)] border rounded-xl overflow-hidden ${item.resolved ? 'opacity-60 border-[var(--border)]' : 'border-[var(--border)]'}`}>
                <button onClick={() => setExpandId(expandId === item.id ? null : item.id)} className="w-full text-left p-4 cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.subject}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {item.anonymous ? 'Anonymous' : item.submitter_name || 'Unknown'}
                          {' · '}{item.category}
                          {' · '}{new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.rating !== null && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_,i) => (
                            <Star key={i} className={`w-3 h-3 ${i < item.rating! ? 'fill-amber-400 text-amber-400' : 'text-[var(--border)]'}`} />
                          ))}
                        </div>
                      )}
                      {item.resolved && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">Resolved</span>}
                    </div>
                  </div>
                </button>
                {expandId === item.id && (
                  <div className="px-4 pb-4 border-t border-[var(--border)]">
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-3">{item.body || '(no additional detail)'}</p>
                    {(isManagement || isOwn) && (
                      <div className="flex justify-end mt-3">
                        <button onClick={() => toggleResolved(item.id, item.resolved)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${item.resolved ? 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
                          {item.resolved ? 'Mark Open' : 'Mark Resolved'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Feedback Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-5 overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Submit Feedback</h3>
              <button onClick={() => setModal({ open: false, ...blank })} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>

            {/* Type selector */}
            <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-lg overflow-hidden text-[10px] font-semibold mb-3">
              {([['internal','Internal'],['customer','Customer']] as const).map(([v,l]) => (
                <button key={v} onClick={() => setModal(m => ({ ...m, type: v }))}
                  className={`flex-1 py-1.5 cursor-pointer transition-colors ${modal.type === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}>
                  {l}
                </button>
              ))}
            </div>

            <input value={modal.category} onChange={e => setModal(m => ({ ...m, category: e.target.value }))} placeholder="Category (e.g. Process, Product)…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <input value={modal.subject} onChange={e => setModal(m => ({ ...m, subject: e.target.value }))} placeholder="Subject…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <textarea value={modal.body} onChange={e => setModal(m => ({ ...m, body: e.target.value }))} placeholder="Describe the feedback…" rows={4}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-3" />

            {/* Sentiment */}
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Sentiment</label>
              <div className="flex gap-2">
                {(['positive','neutral','negative'] as const).map(s => {
                  const { Icon, color, bg } = SENTIMENT_STYLES[s];
                  return (
                    <button key={s} onClick={() => setModal(m => ({ ...m, sentiment: s }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer capitalize transition-all ${modal.sentiment === s ? bg + ' ' + color : 'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-muted)]'}`}>
                      <Icon className="w-3.5 h-3.5" /> {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rating */}
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Rating (optional)</label>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setModal(m => ({ ...m, rating: m.rating === n ? null : n }))} className="cursor-pointer">
                    <Star className={`w-5 h-5 transition-colors ${modal.rating !== null && n <= modal.rating ? 'fill-amber-400 text-amber-400' : 'text-[var(--border)]'}`} />
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <div onClick={() => setModal(m => ({ ...m, anonymous: !m.anonymous }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${modal.anonymous ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${modal.anonymous ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">Submit anonymously</span>
            </label>

            <div className="flex justify-end gap-2">
              <button onClick={() => setModal({ open: false, ...blank })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={save} disabled={saving || !modal.subject.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
