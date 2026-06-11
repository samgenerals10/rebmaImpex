// src/components/global/TasksPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, ChevronRight, MoreVertical, X, Check, ArrowUpCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface Task {
  id: string;
  user_id: string;
  department: string;
  assigned_to: string | null;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  shared: boolean;
  escalated: boolean;
  escalated_to: string | null;
  escalation_reason: string | null;
  escalated_at: string | null;
  created_at: string;
}

interface ColleagueProfile {
  id: string;
  full_name: string;
  department: string;
}

interface TasksPanelProps {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

const PRIORITY_STYLES = {
  high:   'bg-rose-100 text-rose-700 border-rose-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-emerald-100 text-emerald-700 border-emerald-200',
};

type BlankTask = { title: string; description: string; priority: 'low' | 'medium' | 'high'; due_date: string; shared: boolean; assigned_to: string };
const blankTask: BlankTask = { title: '', description: '', priority: 'medium', due_date: '', shared: false, assigned_to: '' };
const blankEsc  = { reason: '', escalate_to: 'MANAGEMENT' };

const STATUS_COLS: { id: Task['status']; label: string }[] = [
  { id: 'todo',        label: 'To Do'       },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done',        label: 'Done'        },
];

export default function TasksPanel({ currentUser, addNotification }: TasksPanelProps) {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [colleagues, setColleagues] = useState<ColleagueProfile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'mine' | 'assigned' | 'dept' | 'all'>('mine');
  const [taskModal, setTaskModal]   = useState<{ open: boolean; id: string } & BlankTask>({ open: false, id: '', ...blankTask });
  const [escModal, setEscModal]     = useState<{ open: boolean; taskId: string; taskTitle: string } & typeof blankEsc>({ open: false, taskId: '', taskTitle: '', ...blankEsc });
  const [menuId, setMenuId]         = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .or(`user_id.eq.${currentUser.id},assigned_to.eq.${currentUser.id},and(shared.eq.true,department.eq.${currentUser.department})`)
        .order('created_at', { ascending: false });
      if (data) setTasks(data);

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, department')
        .eq('department', currentUser.department)
        .neq('id', currentUser.id);
      if (profs) setColleagues(profs);
    } catch { /* tables may not exist */ }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter(t => {
    if (filter === 'mine')     return t.user_id === currentUser?.id && !t.assigned_to;
    if (filter === 'assigned') return t.assigned_to === currentUser?.id;
    if (filter === 'dept')     return t.shared && t.department === currentUser?.department;
    return true;
  });

  const byStatus = (s: Task['status']) => filtered.filter(t => t.status === s);

  const advance = async (t: Task) => {
    const next: Task['status'] = t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'done';
    await supabase.from('tasks').update({ status: next, updated_at: new Date().toISOString() }).eq('id', t.id);
    load();
  };

  const openNew  = () => setTaskModal({ open: true, id: '', ...blankTask });
  const openEdit = (t: Task) => setTaskModal({ open: true, id: t.id, title: t.title, description: t.description, priority: t.priority, due_date: t.due_date || '', shared: t.shared, assigned_to: t.assigned_to || '' });
  const closeTask = () => setTaskModal({ open: false, id: '', ...blankTask });

  const saveTask = async () => {
    if (!currentUser || !taskModal.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: taskModal.title, description: taskModal.description,
        priority: taskModal.priority,
        due_date: taskModal.due_date || null,
        shared: taskModal.shared,
        assigned_to: taskModal.assigned_to || null,
        updated_at: new Date().toISOString(),
      };
      if (taskModal.id) {
        await supabase.from('tasks').update(payload).eq('id', taskModal.id).eq('user_id', currentUser.id);
        addNotification('Task updated.');
      } else {
        await supabase.from('tasks').insert({ ...payload, user_id: currentUser.id, department: currentUser.department });
        addNotification('Task created.');
      }
      closeTask(); load();
    } catch { addNotification('Could not save task.'); }
    setSaving(false);
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id).eq('user_id', currentUser!.id);
    setMenuId(null); load(); addNotification('Task deleted.');
  };

  const openEsc = (t: Task) => { setMenuId(null); setEscModal({ open: true, taskId: t.id, taskTitle: t.title, ...blankEsc }); };
  const closeEsc = () => setEscModal({ open: false, taskId: '', taskTitle: '', ...blankEsc });

  const escalate = async () => {
    if (!currentUser || !escModal.reason.trim()) return;
    setSaving(true);
    try {
      await supabase.from('tasks').update({
        escalated: true, escalated_to: escModal.escalate_to,
        escalated_by: currentUser.id, escalation_reason: escModal.reason,
        escalated_at: new Date().toISOString(),
      }).eq('id', escModal.taskId);
      addNotification(`${currentUser.fullName} escalated task: ${escModal.taskTitle}`);
      closeEsc(); load();
    } catch { addNotification('Could not escalate.'); }
    setSaving(false);
  };

  const isOverdue = (due: string | null) => due && new Date(due) < new Date();

  return (
    <div className="tasks-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Tasks</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-lg overflow-hidden text-[10px] font-semibold">
            {([['mine','Mine'],['assigned','Assigned'],['dept','Dept'],['all','All']] as const).map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${filter === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-xl bg-[var(--bg-input)] animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STATUS_COLS.map(col => (
            <div key={col.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wide">{col.label}</span>
                <span className="w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">
                  {byStatus(col.id).length}
                </span>
              </div>
              <div className="space-y-3 min-h-[80px]">
                {byStatus(col.id).length === 0 && (
                  <div className="h-16 rounded-xl border-2 border-dashed border-[var(--border)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">
                    No tasks
                  </div>
                )}
                {byStatus(col.id).map(t => {
                  const overdue = isOverdue(t.due_date);
                  const isOwn = t.user_id === currentUser?.id;
                  return (
                    <div key={t.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-card)] relative">
                      {/* Priority + escalated badge */}
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border capitalize ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                        {t.escalated && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Escalated</span>}
                      </div>
                      <p className="text-xs font-semibold text-[var(--text-primary)] mb-1 pr-6">{t.title}</p>
                      {t.description && <p className="text-[10px] text-[var(--text-muted)] line-clamp-2 mb-2">{t.description}</p>}
                      {t.due_date && (
                        <div className={`flex items-center gap-1 text-[10px] font-medium mb-2 ${overdue ? 'text-rose-600' : 'text-[var(--text-muted)]'}`}>
                          <Calendar className="w-3 h-3" />
                          {overdue && <AlertCircle className="w-3 h-3" />}
                          {new Date(t.due_date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                        </div>
                      )}
                      {/* Actions row */}
                      <div className="flex items-center justify-between">
                        {col.id !== 'done' ? (
                          <button onClick={() => advance(t)} title="Move forward"
                            className="flex items-center gap-1 text-[10px] text-[var(--accent)] font-semibold hover:underline cursor-pointer">
                            <ChevronRight className="w-3.5 h-3.5" />
                            {col.id === 'todo' ? 'Start' : 'Done'}
                          </button>
                        ) : <span />}
                        {isOwn && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEsc(t)} title="Escalate" className="p-1 rounded hover:bg-[var(--accent-light)] cursor-pointer">
                              <ArrowUpCircle className="w-3.5 h-3.5 text-orange-500" />
                            </button>
                            <div className="relative">
                              <button onClick={() => setMenuId(menuId === t.id ? null : t.id)} className="p-1 rounded hover:bg-[var(--accent-light)] cursor-pointer">
                                <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                              </button>
                              {menuId === t.id && (
                                <div className="absolute right-0 top-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-10 w-28 overflow-hidden">
                                  <button onClick={() => { openEdit(t); setMenuId(null); }} className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--accent-light)] cursor-pointer text-[var(--text-primary)]">Edit</button>
                                  <button onClick={() => deleteTask(t.id)} className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 cursor-pointer">Delete</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Modal */}
      {taskModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">{taskModal.id ? 'Edit Task' : 'New Task'}</h3>
              <button onClick={closeTask} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <input value={taskModal.title} onChange={e => setTaskModal(m => ({ ...m, title: e.target.value }))}
              placeholder="Task title…" className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <textarea value={taskModal.description} onChange={e => setTaskModal(m => ({ ...m, description: e.target.value }))}
              placeholder="Description…" rows={3}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Priority</label>
                <select value={taskModal.priority} onChange={e => setTaskModal(m => ({ ...m, priority: e.target.value as any }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Due Date</label>
                <input type="date" value={taskModal.due_date} onChange={e => setTaskModal(m => ({ ...m, due_date: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer" />
              </div>
            </div>
            {colleagues.length > 0 && (
              <div className="mb-3">
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Assign to (optional)</label>
                <select value={taskModal.assigned_to} onChange={e => setTaskModal(m => ({ ...m, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
                  <option value="">— nobody —</option>
                  {colleagues.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <div onClick={() => setTaskModal(m => ({ ...m, shared: !m.shared }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${taskModal.shared ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${taskModal.shared ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">Share with my department</span>
            </label>
            <div className="flex items-center justify-end gap-2">
              <button onClick={closeTask} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={saveTask} disabled={saving || !taskModal.title.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalation Modal */}
      {escModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Escalate Task</h3>
              <button onClick={closeEsc} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4 truncate">"{escModal.taskTitle}"</p>
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Escalate to</label>
              <select value={escModal.escalate_to} onChange={e => setEscModal(m => ({ ...m, escalate_to: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
                <option value="MANAGEMENT">Management</option>
                <option value="CEO">CEO</option>
              </select>
            </div>
            <textarea value={escModal.reason} onChange={e => setEscModal(m => ({ ...m, reason: e.target.value }))}
              placeholder="Reason for escalation (required)…" rows={3}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={closeEsc} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={escalate} disabled={saving || !escModal.reason.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 cursor-pointer">
                <ArrowUpCircle className="w-3.5 h-3.5" /> {saving ? 'Escalating…' : 'Escalate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
