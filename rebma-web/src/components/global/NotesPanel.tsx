// src/components/global/NotesPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Pin, Share2, Pencil, Trash2, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface Note {
  id: string;
  user_id: string;
  department: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  shared: boolean;
  shared_with_department: boolean;
  created_at: string;
  updated_at: string;
}

interface NotesPanelProps {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

const COLORS = [
  { id: 'yellow', bg: '#fef9c3', border: '#fde68a', text: '#713f12' },
  { id: 'blue',   bg: '#dbeafe', border: '#bfdbfe', text: '#1e3a8a' },
  { id: 'green',  bg: '#dcfce7', border: '#bbf7d0', text: '#14532d' },
  { id: 'pink',   bg: '#fce7f3', border: '#fbcfe8', text: '#831843' },
  { id: 'purple', bg: '#ede9fe', border: '#ddd6fe', text: '#4c1d95' },
];

const colorMap = Object.fromEntries(COLORS.map(c => [c.id, c]));

const defaultModal = { open: false, id: '', title: '', content: '', color: 'yellow', shared: false };

export default function NotesPanel({ currentUser, addNotification }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'personal' | 'shared'>('all');
  const [modal, setModal] = useState(defaultModal);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`user_id.eq.${currentUser.id},and(shared_with_department.eq.true,department.eq.${currentUser.department})`)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (!error && data) setNotes(data);
    } catch { /* table may not exist yet */ }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setModal({ open: true, id: '', title: '', content: '', color: 'yellow', shared: false });
  const openEdit = (n: Note) => setModal({ open: true, id: n.id, title: n.title, content: n.content, color: n.color, shared: n.shared_with_department });
  const closeModal = () => setModal(defaultModal);

  const save = async () => {
    if (!currentUser || !modal.title.trim()) return;
    setSaving(true);
    try {
      if (modal.id) {
        await supabase.from('notes').update({
          title: modal.title, content: modal.content,
          color: modal.color, shared_with_department: modal.shared,
          updated_at: new Date().toISOString(),
        }).eq('id', modal.id).eq('user_id', currentUser.id);
        addNotification('Note updated.');
      } else {
        await supabase.from('notes').insert({
          user_id: currentUser.id, department: currentUser.department,
          title: modal.title, content: modal.content,
          color: modal.color, shared_with_department: modal.shared,
        });
        addNotification('Note saved.');
      }
      closeModal(); load();
    } catch { addNotification('Could not save note.'); }
    setSaving(false);
  };

  const togglePin = async (n: Note) => {
    if (n.user_id !== currentUser?.id) return;
    await supabase.from('notes').update({ pinned: !n.pinned }).eq('id', n.id).eq('user_id', currentUser.id);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId || !currentUser) return;
    await supabase.from('notes').delete().eq('id', deleteId).eq('user_id', currentUser.id);
    setDeleteId(null); load();
    addNotification('Note deleted.');
  };

  const visible = notes.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'personal' && !n.shared_with_department) || (filter === 'shared' && n.shared_with_department);
    return matchSearch && matchFilter;
  });

  return (
    <div className="notes-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">My Notes</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] w-44"
            />
          </div>
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-lg overflow-hidden text-[10px] font-semibold">
            {(['all','personal','shared'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 capitalize transition-colors cursor-pointer ${filter === f ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New Note
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-36 rounded-xl bg-[var(--bg-input)] animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--accent-light)] flex items-center justify-center mb-3">
            <Pencil className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <p className="font-semibold text-[var(--text-primary)] text-sm mb-1">No notes yet</p>
          <p className="text-xs text-[var(--text-muted)]">Click + New Note to capture something.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(n => {
            const c = colorMap[n.color] || colorMap.yellow;
            const isOwn = n.user_id === currentUser?.id;
            return (
              <div key={n.id} className="rounded-xl border p-4 flex flex-col gap-2 relative group transition-shadow hover:shadow-md"
                style={{ background: c.bg, borderColor: c.border }}>
                {/* Action icons */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isOwn && (
                    <button onClick={() => togglePin(n)} title="Pin" className="p-1 rounded hover:bg-black/10 cursor-pointer">
                      <Pin className="w-3.5 h-3.5" style={{ color: c.text, fill: n.pinned ? c.text : 'none' }} />
                    </button>
                  )}
                  {isOwn && n.shared_with_department && (
                    <span title="Shared with department"><Share2 className="w-3.5 h-3.5" style={{ color: c.text }} /></span>
                  )}
                  {isOwn && (
                    <>
                      <button onClick={() => openEdit(n)} title="Edit" className="p-1 rounded hover:bg-black/10 cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" style={{ color: c.text }} />
                      </button>
                      <button onClick={() => setDeleteId(n.id)} title="Delete" className="p-1 rounded hover:bg-black/10 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" style={{ color: c.text }} />
                      </button>
                    </>
                  )}
                </div>
                {/* Pinned indicator */}
                {n.pinned && <Pin className="w-3.5 h-3.5 absolute top-3 left-3" style={{ color: c.text, fill: c.text }} />}
                <h3 className="text-sm font-bold mt-1 pr-16 leading-snug" style={{ color: c.text }}>{n.title}</h3>
                <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: c.text, opacity: 0.85 }}>{n.content || 'No content'}</p>
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="text-[9px] font-medium opacity-60" style={{ color: c.text }}>
                    {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  {n.shared_with_department && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full opacity-70" style={{ background: c.border, color: c.text }}>
                      Shared · {n.department}
                    </span>
                  )}
                  {!isOwn && (
                    <span className="text-[9px] font-semibold opacity-60" style={{ color: c.text }}>Read only</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">{modal.id ? 'Edit Note' : 'New Note'}</h3>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer">
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            <input value={modal.title} onChange={e => setModal(m => ({ ...m, title: e.target.value }))}
              placeholder="Note title…"
              className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <textarea value={modal.content} onChange={e => setModal(m => ({ ...m, content: e.target.value }))}
              placeholder="Write your note…" rows={5}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-3" />
            {/* Color picker */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Color</span>
              {COLORS.map(c => (
                <button key={c.id} onClick={() => setModal(m => ({ ...m, color: c.id }))}
                  className="w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                  style={{ background: c.bg, borderColor: modal.color === c.id ? c.text : 'transparent' }}
                />
              ))}
            </div>
            {/* Share toggle */}
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <div onClick={() => setModal(m => ({ ...m, shared: !m.shared }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${modal.shared ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${modal.shared ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">Share with my department</span>
            </label>
            <div className="flex items-center justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg transition-colors cursor-pointer">Cancel</button>
              <button onClick={save} disabled={saving || !modal.title.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-2">Delete note?</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-lg hover:bg-rose-600 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
