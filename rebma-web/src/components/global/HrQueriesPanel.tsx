// src/components/global/HrQueriesPanel.tsx
//
// Employee Queries — any staff member can ask HR a question and see HR's
// reply; HR/admin see and respond to every query. Modeled directly on
// FeedbackPanel.tsx's submit/list/SidePanel pattern, but with real
// response/responded_by/responded_at fields (feedback has none — a plain
// resolved boolean isn't a real answer). Table: employee_queries.
import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageCircleQuestion, Check, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';
import SidePanel from '../ui/SidePanel';

interface QueryItem {
  id: string;
  staff_id: string;
  staff_name: string;
  department: string;
  subject: string;
  body: string;
  status: 'OPEN' | 'RESOLVED';
  response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
}

interface Props {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

export default function HrQueriesPanel({ currentUser, addNotification }: Props) {
  const [items, setItems] = useState<QueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [respondDraft, setRespondDraft] = useState('');
  const [responding, setResponding] = useState(false);

  const isHrOrAdmin = currentUser?.isAdmin || currentUser?.department?.toUpperCase() === 'HR';

  // RLS already scopes non-HR viewers to their own rows (see
  // supabase_hr_additions.sql's employee_queries_select policy), so this
  // can just be an unfiltered select — no client-side .or() filter needed,
  // unlike FeedbackPanel's equivalent load().
  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('employee_queries').select('*').order('created_at', { ascending: false });
      setItems(data || []);
    } catch { /* table may not exist yet */ }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const visible = items.filter(i => filter === 'all' || (filter === 'open' ? i.status === 'OPEN' : i.status === 'RESOLVED'));

  const submit = async () => {
    if (!currentUser || !subject.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await supabase.from('employee_queries').insert({
        staff_id: currentUser.id,
        staff_name: currentUser.fullName,
        department: currentUser.department,
        subject: subject.trim(),
        body: body.trim(),
        status: 'OPEN',
      });
      addNotification('Query submitted to HR.');
      setSubject(''); setBody(''); setModalOpen(false);
      load();
    } catch {
      addNotification('Could not submit query.');
    }
    setSaving(false);
  };

  const respond = async (id: string) => {
    if (!respondDraft.trim()) return;
    setResponding(true);
    try {
      await supabase.from('employee_queries').update({
        response: respondDraft.trim(),
        responded_by: currentUser?.fullName || 'HR',
        responded_at: new Date().toISOString(),
        status: 'RESOLVED',
      }).eq('id', id);
      addNotification('Response sent.');
      setRespondDraft('');
      load();
    } catch {
      addNotification('Could not send response.');
    }
    setResponding(false);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{isHrOrAdmin ? 'Employee Queries' : 'HR Queries'}</h2>
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-lg overflow-hidden text-[10px] font-semibold">
            {([['all', 'All'], ['open', 'Open'], ['resolved', 'Resolved']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-3 py-1.5 cursor-pointer transition-colors ${filter === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> New Query
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <MessageCircleQuestion className="w-8 h-8 text-[var(--text-muted)] mb-2" />
          <p className="text-xs text-[var(--text-muted)]">{isHrOrAdmin ? 'No employee queries yet' : "You haven't asked HR anything yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <div key={item.id} className={`bg-[var(--bg-card)] border rounded-xl overflow-hidden ${item.status === 'RESOLVED' ? 'opacity-70 border-[var(--border)]' : 'border-[var(--border)]'}`}>
              <button onClick={() => { setExpandId(expandId === item.id ? null : item.id); setRespondDraft(''); }} className="w-full text-left p-4 cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${item.status === 'RESOLVED' ? 'bg-emerald-100 border-emerald-200' : 'bg-amber-100 border-amber-200'}`}>
                      {item.status === 'RESOLVED' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.subject}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {isHrOrAdmin ? `${item.staff_name || 'Unknown'} · ${item.department}` : item.department}
                        {' · '}{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${item.status === 'RESOLVED' ? 'text-emerald-600 bg-emerald-100 border border-emerald-200' : 'text-amber-600 bg-amber-100 border border-amber-200'}`}>
                    {item.status === 'RESOLVED' ? 'Resolved' : 'Open'}
                  </span>
                </div>
              </button>
              {expandId === item.id && (
                <div className="px-4 pb-4 border-t border-[var(--border)]">
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-3">{item.body}</p>
                  {item.response && (
                    <div className="mt-3 p-3 bg-[var(--bg-input)] rounded-lg border border-[var(--border)]">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">HR Response{item.responded_by ? ` — ${item.responded_by}` : ''}</p>
                      <p className="text-sm text-[var(--text-primary)]">{item.response}</p>
                    </div>
                  )}
                  {isHrOrAdmin && item.status === 'OPEN' && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={respondDraft}
                        onChange={e => setRespondDraft(e.target.value)}
                        placeholder="Write a response…"
                        rows={3}
                        className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                      />
                      <div className="flex justify-end">
                        <button onClick={() => respond(item.id)} disabled={responding || !respondDraft.trim()}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                          {responding ? 'Sending…' : 'Send Response & Resolve'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SidePanel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ask HR"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="erp-btn erp-btn-ghost">Cancel</button>
            <button onClick={submit} disabled={saving || !subject.trim() || !body.trim()} className="erp-btn erp-btn-primary disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> {saving ? 'Submitting…' : 'Submit'}
            </button>
          </>
        }
      >
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject…"
          className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Describe your question…" rows={5}
          className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none" />
      </SidePanel>
    </div>
  );
}
