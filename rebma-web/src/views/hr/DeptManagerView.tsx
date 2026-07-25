import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Building2, Users, TrendingUp, Edit2, X, Plus, CheckCircle,
  BarChart2, AlertCircle, UserCheck
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { StaffMember } from '../../types/erp';
import CountUp from '../../components/CountUp';

interface Department {
  id: string;
  name: string;
  headName: string;
  headRole: string;
  budget: number;
  headcount: number;
  activeProjects: number;
  performanceScore: number;
}

interface Props {
  staffList: StaffMember[];
  addNotification: (msg: string) => void;
}

export default function DeptManagerView({ staffList, addNotification }: Props) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Department | null>(null);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [editForm, setEditForm] = useState({ headName: '', headRole: '', budget: 0, activeProjects: 0 });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchDepts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        
        const mapped: Department[] = (data || []).map(d => ({
          id: d.id,
          name: d.name,
          headName: d.head_name || '',
          headRole: d.head_role || '',
          budget: Number(d.budget || 0),
          headcount: Number(d.headcount || 0),
          activeProjects: Number(d.active_projects || 0),
          performanceScore: Number(d.performance_score || 80)
        }));
        setDepts(mapped);
      } catch (err: any) {
        addNotification(`Error loading departments: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDepts();
  }, []);

  const totalHeadcount = depts.reduce((s, d) => s + d.headcount, 0);
  const avgPerformance = depts.length ? Math.round(depts.reduce((s, d) => s + d.performanceScore, 0) / depts.length) : 0;
  const totalBudget = depts.reduce((s, d) => s + d.budget, 0);

  const chartData = depts.map(d => ({ name: d.name.slice(0, 4), headcount: d.headcount, score: d.performanceScore }));

  const openEdit = (dept: Department) => {
    setEditDept(dept);
    setEditForm({ headName: dept.headName, headRole: dept.headRole, budget: dept.budget, activeProjects: dept.activeProjects });
  };

  const handleSaveEdit = async () => {
    if (!editDept || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('departments')
        .update({
          head_name: editForm.headName,
          head_role: editForm.headRole,
          budget: editForm.budget,
          active_projects: editForm.activeProjects
        })
        .eq('id', editDept.id);
      
      if (error) throw error;

      const updated = { ...editDept, ...editForm };
      setDepts(prev => prev.map(d => d.id === editDept.id ? updated : d));
      if (selected?.id === editDept.id) setSelected(updated);
      addNotification(`${editDept.name} department updated`);
      setEditDept(null);
    } catch (err: any) {
      addNotification(`Error saving department changes: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const perfColor = (score: number) => score >= 90 ? '#10b981' : score >= 80 ? 'var(--accent)' : score >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[var(--accent)]" />
          Department Manager
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Overview and management of all departments</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Departments', value: depts.length, color: 'var(--accent)', icon: Building2 },
          { label: 'Total Headcount', value: totalHeadcount, color: '#10b981', icon: Users },
          { label: 'Avg Performance', value: avgPerformance, suffix: '%', color: '#6366f1', icon: TrendingUp },
          { label: 'Total Budget', value: totalBudget, prefix: 'GHS ', color: '#f59e0b', icon: BarChart2 },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">{card.label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}20`, color: card.color }}>
                <card.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]"><CountUp value={card.value} prefix={card.prefix} suffix={card.suffix} /></p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-3">Headcount by Department</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                <Bar dataKey="headcount" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-3">Performance Scores</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 animate-pulse h-36 flex flex-col justify-between">
              <div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
              <div className="grid grid-cols-2 gap-2 my-2">
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full" />
            </div>
          ))
        ) : depts.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-10 text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl">
            <Building2 className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-sm">No departments found</p>
          </div>
        ) : (
          depts.map(dept => {
            const pc = perfColor(dept.performanceScore);
            return (
              <div key={dept.id} onClick={() => setSelected(dept)}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] text-sm">{dept.name}</h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{dept.headName}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); openEdit(dept); }}
                    className="w-7 h-7 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] cursor-pointer transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[var(--bg)] rounded-lg p-2 border border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-muted)]">Staff</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{dept.headcount}</p>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2 border border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-muted)]">Projects</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{dept.activeProjects}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">Performance</span>
                  <span className="text-xs font-bold" style={{ color: pc }}>{dept.performanceScore}%</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${dept.performanceScore}%`, background: pc }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)] text-lg">{selected.name} Department</h3>
              <button onClick={() => setSelected(null)} className="text-[var(--text-muted)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm">
                  {selected.headName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.headName}</p>
                  <p className="text-xs text-[var(--text-muted)]">{selected.headRole}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Headcount', value: selected.headcount },
                  { label: 'Active Projects', value: selected.activeProjects },
                  { label: 'Budget', value: `GHS ${selected.budget.toLocaleString()}` },
                  { label: 'Performance', value: `${selected.performanceScore}%` },
                ].map(item => (
                  <div key={item.label} className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">{item.label}</p>
                    <p className="font-bold text-[var(--text-primary)]">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { openEdit(selected); setSelected(null); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold cursor-pointer">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => setSelected(null)}
                  className="px-4 py-2 border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] cursor-pointer">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editDept && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Edit {editDept.name}</h3>
              <button onClick={() => setEditDept(null)} disabled={submitting} className="text-[var(--text-muted)] cursor-pointer disabled:opacity-50"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Department Head', key: 'headName' as const, type: 'text' },
                { label: 'Head Role', key: 'headRole' as const, type: 'text' },
                { label: 'Budget (GHS)', key: 'budget' as const, type: 'number' },
                { label: 'Active Projects', key: 'activeProjects' as const, type: 'number' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">{field.label}</label>
                  <input type={field.type} value={editForm[field.key]} disabled={submitting}
                    onChange={e => setEditForm(p => ({ ...p, [field.key]: field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value }))}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none disabled:opacity-50" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setEditDept(null)} disabled={submitting} className="px-4 py-2 text-xs border border-[var(--border)] rounded-xl text-[var(--text-secondary)] cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleSaveEdit} disabled={submitting} className="px-4 py-2 text-xs bg-[var(--accent)] text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
