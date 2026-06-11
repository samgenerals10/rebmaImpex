// src/components/global/EmailsPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import { Inbox, Send, Star, Trash2, Plus, Search, ChevronLeft, X, Check, Reply } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface Email {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string;
  body: string;
  read: boolean;
  starred: boolean;
  deleted: boolean;
  reply_to_id: string | null;
  created_at: string;
  from_profile?: { full_name: string; department: string };
  to_profile?:   { full_name: string; department: string };
}

interface Profile { id: string; full_name: string; department: string; }

interface EmailsPanelProps {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
  onUnreadCountChange?: (n: number) => void;
}

const blankCompose = { to: '', subject: '', body: '', replyToId: null as string | null };

export default function EmailsPanel({ currentUser, addNotification, onUnreadCountChange }: EmailsPanelProps) {
  const [emails, setEmails]         = useState<Email[]>([]);
  const [profiles, setProfiles]     = useState<Profile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [folder, setFolder]         = useState<'inbox' | 'sent' | 'starred' | 'trash'>('inbox');
  const [selected, setSelected]     = useState<Email | null>(null);
  const [search, setSearch]         = useState('');
  const [compose, setCompose]       = useState({ ...blankCompose, open: false });
  const [saving, setSaving]         = useState(false);
  const [toSearch, setToSearch]     = useState('');

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('internal_emails')
        .select('*, from_profile:from_user_id(full_name,department), to_profile:to_user_id(full_name,department)')
        .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });
      if (data) {
        setEmails(data);
        const unread = data.filter(e => e.to_user_id === currentUser.id && !e.read && !e.deleted).length;
        onUnreadCountChange?.(unread);
      }
      const { data: profs } = await supabase.from('profiles').select('id, full_name, department').neq('id', currentUser.id);
      if (profs) setProfiles(profs);
    } catch { /* table may not exist yet */ }
    setLoading(false);
  }, [currentUser, onUnreadCountChange]);

  useEffect(() => { load(); }, [load]);

  const folderItems = emails.filter(e => {
    if (!currentUser) return false;
    const inboundFrom = e.to_user_id === currentUser.id;
    const outboundFrom = e.from_user_id === currentUser.id;
    const matchSearch = e.subject.toLowerCase().includes(search.toLowerCase()) || e.body.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (folder === 'inbox')   return inboundFrom && !e.deleted;
    if (folder === 'sent')    return outboundFrom && !e.deleted;
    if (folder === 'starred') return (inboundFrom || outboundFrom) && e.starred && !e.deleted;
    if (folder === 'trash')   return (inboundFrom || outboundFrom) && e.deleted;
    return false;
  });

  const markRead = async (e: Email) => {
    if (e.to_user_id === currentUser?.id && !e.read) {
      await supabase.from('internal_emails').update({ read: true }).eq('id', e.id);
      load();
    }
    setSelected(e);
  };

  const toggleStar = async (e: Email, ev: React.MouseEvent) => {
    ev.stopPropagation();
    await supabase.from('internal_emails').update({ starred: !e.starred }).eq('id', e.id);
    load();
  };

  const moveToTrash = async (id: string) => {
    await supabase.from('internal_emails').update({ deleted: true }).eq('id', id);
    if (selected?.id === id) setSelected(null);
    load(); addNotification('Moved to trash.');
  };

  const permanentDelete = async (id: string) => {
    await supabase.from('internal_emails').delete().eq('id', id);
    if (selected?.id === id) setSelected(null);
    load(); addNotification('Email deleted.');
  };

  const openCompose = (replyTo?: Email) => {
    if (replyTo) {
      setCompose({ open: true, to: replyTo.from_user_id, subject: `Re: ${replyTo.subject}`, body: '', replyToId: replyTo.id });
    } else {
      setCompose({ ...blankCompose, open: true });
    }
    setToSearch('');
  };

  const send = async () => {
    if (!currentUser || !compose.to || !compose.subject.trim()) return;
    setSaving(true);
    try {
      await supabase.from('internal_emails').insert({
        from_user_id: currentUser.id, to_user_id: compose.to,
        subject: compose.subject, body: compose.body,
        reply_to_id: compose.replyToId,
      });
      addNotification('Email sent.');
      setCompose({ ...blankCompose, open: false });
      load();
    } catch { addNotification('Could not send email.'); }
    setSaving(false);
  };

  const filteredProfiles = toSearch
    ? profiles.filter(p => p.full_name.toLowerCase().includes(toSearch.toLowerCase()))
    : profiles;

  const selectedTo = profiles.find(p => p.id === compose.to);

  const FOLDERS = [
    { id: 'inbox',   label: 'Inbox',   Icon: Inbox,  count: emails.filter(e => e.to_user_id === currentUser?.id && !e.read && !e.deleted).length },
    { id: 'sent',    label: 'Sent',    Icon: Send,   count: 0 },
    { id: 'starred', label: 'Starred', Icon: Star,   count: 0 },
    { id: 'trash',   label: 'Trash',   Icon: Trash2, count: 0 },
  ] as const;

  return (
    <div className="emails-panel flex flex-col h-full" style={{ minHeight: 500 }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Internal Mail</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-40 focus:ring-1 focus:ring-[var(--accent)]" />
          </div>
          <button onClick={() => openCompose()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Compose
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Folder sidebar */}
        <div className="w-28 flex-shrink-0 space-y-0.5">
          {FOLDERS.map(({ id, label, Icon, count }) => (
            <button key={id} onClick={() => { setFolder(id); setSelected(null); }}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${folder === id ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {count > 0 && <span className={`text-[9px] font-bold px-1.5 rounded-full ${folder === id ? 'bg-white/30 text-white' : 'bg-[var(--accent)] text-white'}`}>{count}</span>}
            </button>
          ))}
        </div>

        {/* Email list + detail */}
        <div className="flex-1 flex gap-3 min-w-0 overflow-hidden">
          {/* List */}
          <div className={`flex flex-col gap-1 overflow-y-auto ${selected ? 'hidden lg:flex lg:w-64 flex-shrink-0' : 'flex-1'}`} style={{ maxHeight: 520 }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-[var(--bg-input)] animate-pulse" />)
            ) : folderItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Inbox className="w-8 h-8 text-[var(--text-muted)] mb-2" />
                <p className="text-xs text-[var(--text-muted)]">No emails here</p>
              </div>
            ) : folderItems.map(e => {
              const isUnread = e.to_user_id === currentUser?.id && !e.read;
              const fromName = (e.from_profile as any)?.full_name || 'Unknown';
              return (
                <button key={e.id} onClick={() => markRead(e)}
                  className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-colors ${selected?.id === e.id ? 'bg-[var(--accent-light)] border-[var(--accent)]' : 'bg-[var(--bg-card)] border-[var(--border)] hover:bg-[var(--accent-light)]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] truncate ${isUnread ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>{fromName}</p>
                      <p className={`text-[11px] truncate mt-0.5 ${isUnread ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{e.subject}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{e.body.slice(0, 60)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[9px] text-[var(--text-muted)] whitespace-nowrap">{new Date(e.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</span>
                      <button onClick={ev => toggleStar(e, ev)} className="cursor-pointer">
                        <Star className={`w-3 h-3 ${e.starred ? 'fill-amber-400 text-amber-400' : 'text-[var(--text-muted)]'}`} />
                      </button>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          {selected && (
            <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 overflow-y-auto flex flex-col gap-3" style={{ maxHeight: 520 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">{selected.subject}</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    From: <span className="text-[var(--text-secondary)] font-medium">{(selected.from_profile as any)?.full_name}</span>
                    {' · '}To: <span className="text-[var(--text-secondary)] font-medium">{(selected.to_profile as any)?.full_name}</span>
                    {' · '}{new Date(selected.created_at).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openCompose(selected)} title="Reply" className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer">
                    <Reply className="w-4 h-4 text-[var(--accent)]" />
                  </button>
                  <button onClick={() => folder === 'trash' ? permanentDelete(selected.id) : moveToTrash(selected.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer lg:hidden">
                    <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                </div>
              </div>
              <hr className="border-[var(--border)]" />
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{selected.body || '(no content)'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {compose.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">{compose.replyToId ? 'Reply' : 'New Email'}</h3>
              <button onClick={() => setCompose({ ...blankCompose, open: false })} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer">
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            {/* To field */}
            <div className="mb-3 relative">
              <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">To</label>
              {selectedTo ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg">
                  <span className="text-xs text-[var(--text-primary)] flex-1">{selectedTo.full_name} <span className="text-[var(--text-muted)]">({selectedTo.department})</span></span>
                  <button onClick={() => setCompose(c => ({ ...c, to: '' }))} className="cursor-pointer"><X className="w-3 h-3 text-[var(--text-muted)]" /></button>
                </div>
              ) : (
                <div>
                  <input value={toSearch} onChange={e => setToSearch(e.target.value)} placeholder="Search people…"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
                  {toSearch && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden max-h-36 overflow-y-auto">
                      {filteredProfiles.map(p => (
                        <button key={p.id} onClick={() => { setCompose(c => ({ ...c, to: p.id })); setToSearch(''); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-[var(--text-primary)]">
                          {p.full_name} <span className="text-[var(--text-muted)]">· {p.department}</span>
                        </button>
                      ))}
                      {filteredProfiles.length === 0 && <p className="px-3 py-2 text-xs text-[var(--text-muted)]">No results</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
            <input value={compose.subject} onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))} placeholder="Subject…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <textarea value={compose.body} onChange={e => setCompose(c => ({ ...c, body: e.target.value }))} placeholder="Write your message…" rows={6}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCompose({ ...blankCompose, open: false })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={send} disabled={saving || !compose.to || !compose.subject.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
