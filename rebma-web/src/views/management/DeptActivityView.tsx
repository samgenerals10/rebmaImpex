import { useState, useEffect, useRef } from 'react';
import { Activity, Search, RefreshCw, ChevronRight, Building2, Package, DollarSign, Truck, Users, ShoppingCart, Factory, UserCheck, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
import { FileSpreadsheet, FileText } from 'lucide-react';

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

const MOCK_ACTIVITIES: ActivityItem[] = [
  { id: 'ACT-001', department: 'OPERATIONS', user: 'Kwame Ofori', action: 'Cargo Intake Logged', details: 'Logged 350 units of Steel Pipes from Maersk (Germany)', timestamp: new Date(Date.now() - 2 * 60000).toISOString(), refId: 'CARGO-001' },
  { id: 'ACT-002', department: 'FINANCE', user: 'Ama Serwaa', action: 'Invoice Generated', details: 'Invoice INV-2026-041 issued for GHS 45,000', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), refId: 'INV-2026-041' },
  { id: 'ACT-003', department: 'MARKETING', user: 'Kofi Mensah', action: 'Order Created', details: 'New credit order ORD-2091 for Accra Traders Ltd', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), refId: 'ORD-2091' },
  { id: 'ACT-004', department: 'DISPATCH', user: 'Yaw Boateng', action: 'Delivery Started', details: 'Truck VH-1234-GH departed for Kumasi depot', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), refId: 'DEL-0091' },
  { id: 'ACT-005', department: 'HR', user: 'Abena Asante', action: 'Staff Registration', details: 'New staff member Kweku Nkrumah registered for DISPATCH', timestamp: new Date(Date.now() - 60 * 60000).toISOString(), refId: 'EMP-0210' },
  { id: 'ACT-006', department: 'RECEPTION', user: 'Nana Adu', action: 'Visitor Logged', details: 'Guest Mr. Osei Acheampong checked in for meeting', timestamp: new Date(Date.now() - 90 * 60000).toISOString(), refId: 'VIS-0045' },
  { id: 'ACT-007', department: 'PRODUCTION', user: 'Fiifi Mensah', action: 'Production Output', details: 'Batch B-2026-03 completed: 1200 units packaged', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), refId: 'BATCH-B03' },
  { id: 'ACT-008', department: 'OPERATIONS', user: 'Kwame Ofori', action: 'Discrepancy Reported', details: '2 damaged cartons found in Cargo-002 — flagged for review', timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), refId: 'CARGO-002' },
  { id: 'ACT-009', department: 'FINANCE', user: 'Ama Serwaa', action: 'Payment Recorded', details: 'Cash payment GHS 12,500 received from Delta Supplies', timestamp: new Date(Date.now() - 4 * 3600000).toISOString(), refId: 'PAY-0081' },
  { id: 'ACT-010', department: 'MARKETING', user: 'Adjoa Boateng', action: 'Customer Registered', details: 'New customer Tema Industries Ltd added to directory', timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), refId: 'CUST-0019' },
  { id: 'ACT-011', department: 'DISPATCH', user: 'Kojo Antwi', action: 'Delivery Completed', details: 'Order ORD-2088 delivered to Takoradi. Signed by K. Asante', timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), refId: 'DEL-0089' },
  { id: 'ACT-012', department: 'HR', user: 'Abena Asante', action: 'Leave Approved', details: 'Annual leave approved for Esi Mensah (Operations) — 5 days', timestamp: new Date(Date.now() - 7 * 3600000).toISOString(), refId: 'LEAVE-041' },
  { id: 'ACT-013', department: 'LOGISTICS', user: 'Kwabena Frimpong', action: 'Fuel Logged', details: 'Vehicle VH-5678-GH: 85L diesel logged at Kumasi depot', timestamp: new Date(Date.now() - 8 * 3600000).toISOString(), refId: 'FUEL-0102' },
  { id: 'ACT-014', department: 'PRODUCTION', user: 'Fiifi Mensah', action: 'WIP Update', details: 'Work-in-progress: 450 units at packaging stage', timestamp: new Date(Date.now() - 9 * 3600000).toISOString(), refId: 'WIP-2026' },
  { id: 'ACT-015', department: 'RECEPTION', user: 'Nana Adu', action: 'Attendance Marked', details: '28 employees checked in this morning', timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), refId: 'ATT-2026' },
];

const DEPT_STATS: Array<{ dept: string; todayCount: number; lastActivity: string; status: 'Active' | 'Quiet' | 'Alert' }> = [
  { dept: 'OPERATIONS', todayCount: 12, lastActivity: '2 min ago', status: 'Active' },
  { dept: 'FINANCE',    todayCount: 8,  lastActivity: '15 min ago', status: 'Active' },
  { dept: 'MARKETING',  todayCount: 5,  lastActivity: '30 min ago', status: 'Active' },
  { dept: 'DISPATCH',   todayCount: 15, lastActivity: '45 min ago', status: 'Active' },
  { dept: 'HR',         todayCount: 3,  lastActivity: '1 hr ago',   status: 'Quiet' },
  { dept: 'RECEPTION',  todayCount: 7,  lastActivity: '1.5 hrs ago', status: 'Quiet' },
  { dept: 'PRODUCTION', todayCount: 4,  lastActivity: '2 hrs ago',  status: 'Active' },
  { dept: 'LOGISTICS',  todayCount: 2,  lastActivity: '8 hrs ago',  status: 'Quiet' },
];

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? 's' : ''} ago`;
};

const ALL_DEPTS = ['All', 'OPERATIONS', 'FINANCE', 'MARKETING', 'DISPATCH', 'HR', 'RECEPTION', 'PRODUCTION', 'LOGISTICS'];

interface Props { addNotification: (msg: string) => void }

export default function DeptActivityView({ addNotification }: Props) {
  const [activities, setActivities] = useState<ActivityItem[]>(MOCK_ACTIVITIES);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadActivities = async () => {
    try {
      const { data } = await supabase
        .from('global_audit_history')
        .select('*')
        .not('department', 'eq', 'CEO')
        .order('timestamp', { ascending: false })
        .limit(50);
      if (data && data.length > 0) {
        const mapped: ActivityItem[] = data.map((d: any) => ({
          id: d.id,
          department: d.department,
          user: d.performed_by || d.performedBy || 'System',
          action: d.action,
          details: d.details,
          timestamp: d.timestamp || d.created_at,
          refId: d.reference_id,
        }));
        setActivities(mapped);
      }
    } catch {
      // keep mock data
    }
  };

  useEffect(() => {
    loadActivities();
    intervalRef.current = setInterval(loadActivities, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadActivities();
    setTimeout(() => setIsRefreshing(false), 600);
    addNotification('Department activity refreshed.');
  };

  const filtered = activities.filter(a => {
    const matchDept = filter === 'All' || a.department === filter;
    const matchSearch = !search || a.user.toLowerCase().includes(search.toLowerCase()) ||
      a.action.toLowerCase().includes(search.toLowerCase()) ||
      a.details.toLowerCase().includes(search.toLowerCase()) ||
      (a.refId || '').toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Department Activity Monitor</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Real-time activities across all departments (CEO excluded)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(filtered, ['id','department','user','action','details','timestamp','refId'], 'dept_activity')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg text-xs font-semibold border border-[var(--border)] cursor-pointer hover:opacity-90">
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportToPDF('Department Activity', filtered, ['department','user','action','details','timestamp'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg text-xs font-semibold border border-[var(--border)] cursor-pointer hover:opacity-90">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={handleRefresh} className={`flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--accent-light)] transition-all ${isRefreshing ? 'opacity-60' : ''}`}>
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Department Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {DEPT_STATS.map(ds => {
          const Icon = DEPT_ICONS[ds.dept] || Building2;
          const color = DEPT_COLORS[ds.dept] || 'bg-slate-500/10 text-slate-600';
          const statusColor = ds.status === 'Active' ? 'bg-emerald-500' : ds.status === 'Alert' ? 'bg-rose-500' : 'bg-amber-400';
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
                <div className={`w-2 h-2 rounded-full ${statusColor}`} title={ds.status} />
              </div>
              <p className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{ds.dept}</p>
              <p className="text-lg font-extrabold text-[var(--text-primary)]">{ds.todayCount}</p>
              <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{ds.lastActivity}</p>
              <div className="mt-2 space-y-0.5">
                {recentActivities.map(a => (
                  <p key={a.id} className="text-[8px] text-[var(--text-muted)] truncate">{a.action}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter + Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap flex-1">
          {ALL_DEPTS.map(d => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${filter === d ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}
            >
              {d === 'All' ? 'All Departments' : d.charAt(0) + d.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activities..."
            className="pl-9 pr-4 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] w-full sm:w-52"
          />
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
          {visible.length === 0 && (
            <p className="py-12 text-center text-xs text-[var(--text-muted)]">No activities found.</p>
          )}
          {visible.map(item => {
            const Icon = DEPT_ICONS[item.department] || Building2;
            const color = DEPT_COLORS[item.department] || 'bg-slate-500/10 text-slate-600';
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
                      <span className="text-[10px] font-mono text-[var(--accent)] cursor-pointer hover:underline">{item.refId}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-2" />
              </div>
            );
          })}
        </div>

        {filtered.length > visibleCount && (
          <div className="px-5 py-4 border-t border-[var(--border)] flex justify-center">
            <button
              onClick={() => setVisibleCount(c => c + 10)}
              className="px-6 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-opacity"
            >
              Load More ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
