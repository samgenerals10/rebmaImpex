import { useState, useEffect, useRef } from 'react';
import {
  Activity, Search, RefreshCw, ChevronRight, Building2, Package, DollarSign,
  Truck, Users, ShoppingCart, Factory, UserCheck, Clock, Trash2, Eye,
  Download, Share2, MoreVertical, FileSpreadsheet, FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SidePanel from '../../components/ui/SidePanel';
import { exportToCSV, exportToPDF } from '../../utils/export';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import CountUp from '../../components/CountUp';

interface ActivityItem {
  id: string;
  department: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
  refId?: string;
}

const DEPT_COLORS: Record<string, string> = {
  OPERATIONS: 'bg-blue-500/10 text-blue-600',
  FINANCE:    'bg-emerald-500/10 text-emerald-600',
  MARKETING:  'bg-purple-500/10 text-purple-600',
  DISPATCH:   'bg-orange-500/10 text-orange-600',
  HR:         'bg-teal-500/10 text-teal-600',
  RECEPTION:  'bg-pink-500/10 text-pink-600',
  PRODUCTION: 'bg-amber-500/10 text-amber-600',
  LOGISTICS:  'bg-indigo-500/10 text-indigo-600',
  CEO:        'bg-rose-500/10 text-rose-600',
};

const DEPT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  OPERATIONS: Package,
  FINANCE:    DollarSign,
  MARKETING:  ShoppingCart,
  DISPATCH:   Truck,
  HR:         Users,
  RECEPTION:  UserCheck,
  PRODUCTION: Factory,
  LOGISTICS:  Truck,
};

const timeAgo = (iso: string): string => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? 's' : ''} ago`;
};

interface Props {
  addNotification: (msg: string) => void;
  currentUser?: { id: string; fullName?: string; department?: string } | null;
}

export default function DeptActivityView({ addNotification, currentUser }: Props) {
  const isCeo = currentUser?.department === 'CEO';
  const { getSetting } = useCeoSettings();
  // Other departments only see CEO entries when CEO has explicitly enabled it
  const ceoActivityVisible: boolean = getSetting('ceo_activity_visible_to_others', false);
  const showCeoEntries = isCeo || ceoActivityVisible;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<ActivityItem | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadActivities = async () => {
    try {
      let query = supabase
        .from('global_audit_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (!showCeoEntries) {
        query = query.not('department', 'eq', 'CEO');
      }

      const { data } = await query;
      const mapped: ActivityItem[] = (data ?? []).map((d: any) => ({
        id: d.id,
        department: d.department,
        user: d.performed_by || d.performedBy || 'System',
        action: d.action,
        details: d.details,
        timestamp: d.timestamp || d.created_at,
        refId: d.reference_id,
      }));
      setActivities(mapped);
    } catch {
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    loadActivities();
    intervalRef.current = setInterval(loadActivities, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCeoEntries]);

  // Close row menu on outside click
  useEffect(() => {
    const close = () => setRowMenuOpen(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadActivities();
    setTimeout(() => setIsRefreshing(false), 600);
    addNotification('Department activity refreshed.');
  };

  const handleDelete = async (item: ActivityItem) => {
    const canDelete = isCeo || item.user === (currentUser?.fullName ?? '');
    if (!canDelete) return;
    await supabase.from('global_audit_history').delete().eq('id', item.id);
    setActivities(prev => prev.filter(a => a.id !== item.id));
    if (detailItem?.id === item.id) setDetailItem(null);
    addNotification('Activity entry deleted.');
  };

  const handleExportSingle = (item: ActivityItem) => {
    exportToCSV([item], ['id', 'department', 'user', 'action', 'details', 'timestamp', 'refId'], `activity_${item.id}`);
    addNotification('Activity entry exported.');
  };

  const handleShare = (item: ActivityItem) => {
    const text = `[REBMA IMPEX Activity]\nDept: ${item.department} | By: ${item.user}\nAction: ${item.action}\nDetails: ${item.details}\nTime: ${item.timestamp}`;
    navigator.clipboard.writeText(text).then(
      () => addNotification('Activity entry copied to clipboard.'),
      () => addNotification('Share: ' + item.action),
    );
  };

  const filtered = activities.filter(a => {
    const matchDept = filter === 'All' || a.department === filter;
    const matchSearch = !search
      || a.user.toLowerCase().includes(search.toLowerCase())
      || a.action.toLowerCase().includes(search.toLowerCase())
      || a.details.toLowerCase().includes(search.toLowerCase())
      || (a.refId || '').toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const visible = filtered.slice(0, visibleCount);

  // Dept keys shown — CEO card only shown if permitted
  const BASE_DEPTS = ['OPERATIONS', 'FINANCE', 'MARKETING', 'DISPATCH', 'HR', 'RECEPTION', 'PRODUCTION', 'LOGISTICS'];
  const ALL_DEPT_KEYS = showCeoEntries ? [...BASE_DEPTS, 'CEO'] : BASE_DEPTS;
  const ALL_DEPTS = ['All', ...ALL_DEPT_KEYS];

  const deptStats = ALL_DEPT_KEYS.map(dept => {
    const deptActivities = activities.filter(a => a.department === dept);
    return {
      dept,
      count: deptActivities.length,
      lastActivity: deptActivities[0] ? timeAgo(deptActivities[0].timestamp) : null,
    };
  });

  return (
    <>
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Department Activity Monitor</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {isCeo
              ? 'Real-time activities across all departments including CEO'
              : ceoActivityVisible
                ? 'Real-time activities across all departments (CEO activity visible)'
                : 'Real-time activities across all departments (CEO excluded)'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(filtered, ['id','department','user','action','details','timestamp','refId'], 'dept_activity')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg text-xs font-semibold border border-[var(--border)] cursor-pointer hover:opacity-90">
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportToPDF('Department Activity', filtered, ['department','user','action','details','timestamp'])}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg text-xs font-semibold border border-[var(--border)] cursor-pointer hover:opacity-90">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={handleRefresh}
            className={`flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--accent-light)] transition-all ${isRefreshing ? 'opacity-60' : ''}`}>
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Department Summary Cards — counts from real data */}
      <div className={`grid gap-3 ${showCeoEntries ? 'grid-cols-3 sm:grid-cols-5 xl:grid-cols-9' : 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-8'}`}>
        {deptStats.map(ds => {
          const Icon = DEPT_ICONS[ds.dept] || Building2;
          const color = DEPT_COLORS[ds.dept] || 'bg-slate-500/10 text-slate-600';
          const statusColor = ds.count > 0 ? 'bg-emerald-500' : 'bg-slate-300';
          const recentActivities = activities.filter(a => a.department === ds.dept).slice(0, 3);
          return (
            <div
              key={ds.dept}
              onClick={() => setFilter(filter === ds.dept ? 'All' : ds.dept)}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${filter === ds.dept ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className={`w-2 h-2 rounded-full ${statusColor}`} />
              </div>
              <p className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{ds.dept}</p>
              <p className="text-lg font-extrabold text-[var(--text-primary)]"><CountUp value={ds.count} /></p>
              <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{ds.lastActivity ?? 'No activity yet'}</p>
              <div className="mt-2 space-y-0.5">
                {recentActivities.map(a => (
                  <p key={a.id} className="text-[8px] text-[var(--text-muted)] truncate">{a.action}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap flex-1">
          {ALL_DEPTS.map(d => (
            <button key={d} onClick={() => setFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${filter === d ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
              {d === 'All' ? 'All Departments' : d.charAt(0) + d.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activities..."
            className="pl-9 pr-4 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] w-full sm:w-52" />
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Activity Feed</h2>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full font-mono">{filtered.length} entries</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-[var(--text-muted)]">Live</span>
          </div>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {loadingActivities && (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              ))}
            </div>
          )}
          {!loadingActivities && visible.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-muted)]">
              <Activity className="w-8 h-8 opacity-30" />
              <p className="text-xs">No activities found.</p>
            </div>
          )}
          {visible.map(item => {
            const Icon = DEPT_ICONS[item.department] || Building2;
            const color = DEPT_COLORS[item.department] || 'bg-slate-500/10 text-slate-600';
            const canDelete = isCeo || item.user === (currentUser?.fullName ?? '');
            return (
              <div key={item.id} className="flex items-start gap-4 px-5 py-4 hover:bg-[var(--accent-light)] transition-colors group">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${color}`}>{item.department}</span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">{item.user}</span>
                    <span className="text-xs text-[var(--text-muted)]">·</span>
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">{item.action}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{item.details}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                    {item.refId && (
                      <span className="text-[10px] font-mono text-[var(--accent)]">{item.refId}</span>
                    )}
                  </div>
                </div>

                {/* Row action menu */}
                <div className="shrink-0 relative" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setRowMenuOpen(rowMenuOpen === item.id ? null : item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg)] border border-transparent hover:border-[var(--border)] text-[var(--text-muted)] cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {rowMenuOpen === item.id && (
                    <div className="absolute right-0 top-9 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                      <button
                        onClick={() => { setDetailItem(item); setRowMenuOpen(null); }}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[var(--accent)]" /> View More
                      </button>
                      <button
                        onClick={() => { handleExportSingle(item); setRowMenuOpen(null); }}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[var(--accent)]" /> Export
                      </button>
                      <button
                        onClick={() => { handleShare(item); setRowMenuOpen(null); }}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[var(--accent)]" /> Share
                      </button>
                      {canDelete && (
                        <>
                          <div className="h-px bg-[var(--border)] my-1" />
                          <button
                            onClick={() => { handleDelete(item); setRowMenuOpen(null); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors text-left cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-2" />
              </div>
            );
          })}
        </div>

        {filtered.length > visibleCount && (
          <div className="px-5 py-4 border-t border-[var(--border)] flex justify-center">
            <button onClick={() => setVisibleCount(c => c + 10)}
              className="px-6 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-opacity">
              Load More ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>

    {/* View More Detail Modal */}
    <SidePanel
      open={!!detailItem}
      onClose={() => setDetailItem(null)}
      title="Activity Detail"
      subtitle={detailItem?.id}
    >
      {detailItem && (
        <>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Department', value: detailItem.department },
              { label: 'Performed By', value: detailItem.user },
              { label: 'Action', value: detailItem.action },
              { label: 'Details', value: detailItem.details || '—' },
              { label: 'Timestamp', value: detailItem.timestamp ? new Date(detailItem.timestamp).toLocaleString() : '—' },
              { label: 'Reference ID', value: detailItem.refId || '—' },
            ].map(row => (
              <div key={row.label} className="flex flex-col gap-0.5 p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">{row.label}</span>
                <span className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4 flex-wrap">
            <button onClick={() => handleExportSingle(detailItem)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent-light)] text-[var(--accent)] rounded-xl text-xs font-semibold border border-[var(--border)] cursor-pointer hover:opacity-90">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={() => handleShare(detailItem)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent-light)] text-[var(--accent)] rounded-xl text-xs font-semibold border border-[var(--border)] cursor-pointer hover:opacity-90">
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            {(isCeo || detailItem.user === (currentUser?.fullName ?? '')) && (
              <button onClick={() => handleDelete(detailItem)}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900 cursor-pointer hover:opacity-90 ml-auto">
                <Trash2 className="w-3.5 h-3.5" /> Delete Entry
              </button>
            )}
          </div>
        </>
      )}
    </SidePanel>
    </>
  );
}
