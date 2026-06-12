// src/components/KpiDetailView.tsx
import { useState } from 'react';
import { ArrowLeft, Download, Filter } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { exportToCSV, exportToPDF } from '../utils/export';

interface Column {
  key: string;
  label: string;
  render?: (val: any, row: any) => React.ReactNode;
}

interface KpiDetailViewProps {
  title: string;
  metric: string;
  trendData: Array<{ name: string; value: number }>;
  breakdownData: Array<{ name: string; value: number }>;
  tableData: any[];
  columns: Column[];
  onBack: () => void;
  color?: string;
}

type Period = 'Today' | 'Week' | 'Month' | 'Quarter' | 'Year';
const PERIODS: Period[] = ['Today', 'Week', 'Month', 'Quarter', 'Year'];
const CHART_COLORS = ['var(--accent)', '#6366f1', '#f59e0b', '#10b981', '#ef4444'];

const PAGE_SIZE = 10;

export default function KpiDetailView({
  title, metric, trendData, breakdownData, tableData, columns, onBack, color = 'var(--accent)'
}: KpiDetailViewProps) {
  const [period, setPeriod]     = useState<Period>('Month');
  const [sortKey, setSortKey]   = useState('');
  const [sortAsc, setSortAsc]   = useState(true);
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filtered = tableData.filter(row =>
    !search || Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportCSV = () => {
    exportToCSV(filtered, columns.map(c => c.key), `${title.replace(/\s/g,'_').toLowerCase()}_detail`);
  };

  const handleExportPDF = () => {
    exportToPDF(title, filtered, columns.map(c => c.label));
  };

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-[var(--accent-light)] text-[var(--text-secondary)] cursor-pointer transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
            <p className="text-xs text-[var(--text-muted)]">{metric}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-xl overflow-hidden text-[10px] font-semibold">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1.5 cursor-pointer transition-colors ${period === p ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={handleExportCSV} className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] mb-3">Trend — {period}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="kpiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke={color} fill="url(#kpiGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] mb-3">Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={breakdownData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {breakdownData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-xs font-bold text-[var(--text-secondary)]">Records ({filtered.length})</h3>
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Filter…"
              className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] w-36"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
                {columns.map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)] select-none whitespace-nowrap">
                    {col.label} {sortKey === col.key ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={columns.length} className="text-center py-8 text-[var(--text-muted)] text-xs">No records</td></tr>
              ) : paginated.map((row, i) => (
                <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)]">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] disabled:opacity-40 cursor-pointer hover:bg-[var(--accent-light)]">Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] disabled:opacity-40 cursor-pointer hover:bg-[var(--accent-light)]">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
