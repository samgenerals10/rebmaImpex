// src/views/DepartmentManager.tsx — HR only
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { CurrentUser } from '../types/erp';
import { useCeoSettings } from '../contexts/CeoSettingsContext';
import SidePanel from '../components/ui/SidePanel';

interface DeptRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  head_user_id: string | null;
  active: boolean;
  nav_items: string[];
  workflows: string[];
  created_at: string;
}

interface DepartmentManagerProps {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

const blank = { name: '', code: '', description: '', head_user_id: '', active: true, nav_items: [] as string[], workflows: [] as string[] };

export default function DepartmentManager({ currentUser, addNotification }: DepartmentManagerProps) {
  const { getSetting } = useCeoSettings();
  const ceoMustApproveDepartments = getSetting('ceo_must_approve_departments', false);
  const [depts, setDepts] = useState<DeptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; id: string } & typeof blank>({ open: false, id: '', ...blank });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newNav, setNewNav] = useState('');
  const [newWorkflow, setNewWorkflow] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('departments').select('*').order('name');
      if (data) setDepts(data);
    } catch { /* table may not exist yet */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setModal({ open: true, id: '', ...blank });
  const openEdit = (d: DeptRecord) => setModal({ open: true, id: d.id, name: d.name, code: d.code, description: d.description, head_user_id: d.head_user_id || '', active: d.active, nav_items: d.nav_items || [], workflows: d.workflows || [] });

  const save = async () => {
    if (!modal.name.trim() || !modal.code.trim()) return;
    setSaving(true);
    try {
      if (modal.id) {
        await supabase.from('departments').update({
          name: modal.name, code: modal.code.toUpperCase(), description: modal.description,
          active: modal.active, nav_items: modal.nav_items, workflows: modal.workflows,
          head_user_id: modal.head_user_id || null,
          updated_at: new Date().toISOString(),
        }).eq('id', modal.id);
        addNotification(`Department "${modal.name}" updated.`);
      } else {
        // departments only has id/name/head_name/head_role/budget/headcount/
        // active_projects/performance_score/status live — code, description,
        // active, nav_items, workflows and head_user_id (used above) don't
        // exist on the table, so only name (+status) is written here.
        const { error } = await supabase.from('departments').insert({
          name: modal.name,
          status: ceoMustApproveDepartments ? 'pending' : 'active',
        });
        if (error) throw error;
        addNotification(ceoMustApproveDepartments
          ? `Department "${modal.name}" submitted — pending CEO approval.`
          : `Department "${modal.name}" created.`);
      }
      setModal({ open: false, id: '', ...blank });
      load();
    } catch (e: any) {
      addNotification('Could not save department. Ensure the departments table exists with correct RLS.');
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteId || saving) return;
    setSaving(true);
    try {
      await supabase.from('departments').delete().eq('id', deleteId);
      setDeleteId(null);
      addNotification('Department removed.');
      load();
    } catch (err: any) {
      addNotification(`Failed to delete department: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addNavItem = () => {
    if (!newNav.trim()) return;
    setModal(m => ({ ...m, nav_items: [...m.nav_items, newNav.trim()] }));
    setNewNav('');
  };

  const removeNavItem = (i: number) => setModal(m => ({ ...m, nav_items: m.nav_items.filter((_, idx) => idx !== i) }));

  const addWorkflow = () => {
    if (!newWorkflow.trim()) return;
    setModal(m => ({ ...m, workflows: [...m.workflows, newWorkflow.trim()] }));
    setNewWorkflow('');
  };

  const removeWorkflow = (i: number) => setModal(m => ({ ...m, workflows: m.workflows.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Department Manager</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Create and configure company departments</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl hover:opacity-90 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> New Department
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : depts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Building2 className="w-10 h-10 text-[var(--text-muted)] mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No departments yet</p>
          <p className="text-xs text-[var(--text-muted)]">Click "New Department" to create the first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {depts.map(dept => (
            <div key={dept.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{dept.name}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">{dept.code}</span>
                    {!dept.active && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">Inactive</span>}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{dept.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setExpandId(expandId === dept.id ? null : dept.id)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer text-[var(--text-secondary)]">
                    {expandId === dept.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(dept)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer text-[var(--accent)]">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(dept.id)} className="p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {expandId === dept.id && (
                <div className="px-4 pb-4 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">Nav Items ({dept.nav_items?.length || 0})</p>
                    {dept.nav_items?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {dept.nav_items.map((n, i) => (
                          <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">{n}</span>
                        ))}
                      </div>
                    ) : <p className="text-xs text-[var(--text-muted)] italic">No nav items configured</p>}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">Workflows ({dept.workflows?.length || 0})</p>
                    {dept.workflows?.length ? (
                      <ul className="space-y-1">
                        {dept.workflows.map((w, i) => <li key={i} className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-500" />{w}</li>)}
                      </ul>
                    ) : <p className="text-xs text-[var(--text-muted)] italic">No workflows configured</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SQL Hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <p className="font-bold mb-1">Supabase Table Required</p>
        <p>Create <code className="bg-amber-100 px-1 rounded">departments</code> table with columns: <code className="bg-amber-100 px-1 rounded">id uuid primary key, name text, code text unique, description text, head_user_id uuid, active boolean default true, nav_items text[], workflows text[], created_by uuid, created_at timestamptz default now(), updated_at timestamptz</code>. Enable RLS — HR and Management can INSERT/UPDATE; all authenticated users can SELECT.</p>
      </div>

      {/* Modal */}
      <SidePanel
        open={modal.open}
        onClose={() => setModal({ open: false, id: '', ...blank })}
        title={modal.id ? 'Edit Department' : 'New Department'}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setModal({ open: false, id: '', ...blank })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
            <button onClick={save} disabled={saving || !modal.name.trim() || !modal.code.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
              <Check className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Department'}
            </button>
          </div>
        }
      >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Department Name *</label>
                  <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} placeholder="e.g. Finance"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Code *</label>
                  <input value={modal.code} onChange={e => setModal(m => ({ ...m, code: e.target.value.toUpperCase() }))} placeholder="e.g. FIN" maxLength={10}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Description</label>
                <textarea value={modal.description} onChange={e => setModal(m => ({ ...m, description: e.target.value }))} placeholder="Brief description of this department…" rows={2}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none" />
              </div>

              {/* Nav Items Builder */}
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Navigation Items</label>
                <div className="flex gap-2 mb-2">
                  <input value={newNav} onChange={e => setNewNav(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNavItem()} placeholder="Add nav item (e.g. Dashboard)…"
                    className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
                  <button onClick={addNavItem} className="p-1.5 bg-[var(--accent)] text-white rounded-lg cursor-pointer hover:opacity-90"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-6">
                  {modal.nav_items.map((n, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">
                      {n}
                      <button onClick={() => removeNavItem(i)} className="cursor-pointer hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Workflow Builder */}
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Workflows</label>
                <div className="flex gap-2 mb-2">
                  <input value={newWorkflow} onChange={e => setNewWorkflow(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWorkflow()} placeholder="Add workflow (e.g. Manager Approval)…"
                    className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
                  <button onClick={addWorkflow} className="p-1.5 bg-[var(--accent)] text-white rounded-lg cursor-pointer hover:opacity-90"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="space-y-1">
                  {modal.workflows.map((w, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-input)] rounded-lg">
                      <span className="text-xs text-[var(--text-secondary)]">{w}</span>
                      <button onClick={() => removeWorkflow(i)} className="cursor-pointer text-rose-500 hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setModal(m => ({ ...m, active: !m.active }))}
                  className={`w-9 h-5 rounded-full transition-colors relative ${modal.active ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${modal.active ? 'left-4' : 'left-0.5'}`} />
                </div>
                <span className="text-xs text-[var(--text-secondary)]">Department is active</span>
              </label>
            </div>
      </SidePanel>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-2">Delete department?</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">This cannot be undone. Staff in this department will not be automatically reassigned.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} disabled={saving} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={confirmDelete} disabled={saving} className="px-4 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-lg hover:bg-rose-600 cursor-pointer disabled:opacity-50">{saving ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
