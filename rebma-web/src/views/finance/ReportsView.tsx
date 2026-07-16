import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { FileText, Download, BarChart2, TrendingUp, Users, CreditCard, Receipt, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../utils/export';

interface ReportCard {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  lastGenerated?: string;
}

const REPORTS: ReportCard[] = [
  { id: 'daily_cash', name: 'Daily Cash Report', description: 'Summary of all cash transactions for the day', icon: DollarSign, color: '#10b981' },
  { id: 'weekly_sales', name: 'Weekly Sales Report', description: 'Sales performance and order summary for the week', icon: TrendingUp, color: '#6366f1' },
  { id: 'monthly_pl', name: 'Monthly P&L Statement', description: 'Profit and loss overview for the month', icon: BarChart2, color: 'var(--accent)' },
  { id: 'quarterly', name: 'Quarterly Financial Summary', description: 'Comprehensive financial review for the quarter', icon: Calendar, color: '#f59e0b' },
  { id: 'annual', name: 'Annual Report', description: 'Full-year financial report and analysis', icon: FileText, color: '#3b82f6' },
  { id: 'vat', name: 'VAT Report (GRA Format)', description: 'VAT return in GRA-compliant format', icon: Receipt, color: '#8b5cf6' },
  { id: 'payroll', name: 'Payroll Summary', description: 'Department payroll totals and processing status', icon: Users, color: '#06b6d4' },
  { id: 'credit', name: 'Customer Credit Report', description: 'Outstanding credit balances and collection status', icon: CreditCard, color: '#ef4444' },
  { id: 'outstanding_inv', name: 'Outstanding Invoices', description: 'All unpaid invoices with aging breakdown', icon: FileText, color: '#f97316' },
  { id: 'payment_methods', name: 'Payment Methods Analysis', description: 'Breakdown of payments by method and network', icon: BarChart2, color: '#10b981' },
  { id: 'expense', name: 'Expense Report', description: 'All approved and pending expense submissions', icon: Receipt, color: '#6366f1' },
  { id: 'bank_recon', name: 'Bank Reconciliation', description: 'Bank statement vs. internal records reconciliation', icon: RefreshCw, color: '#f59e0b' },
];

interface ReportHistoryEntry {
  date: string;
  type: string;
  period: string;
  generatedBy: string;
}

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function FinanceReportsView({ addNotification, currentUser }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [showPeriodModal, setShowPeriodModal] = useState<ReportCard | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [reportHistory, setReportHistory] = useState<ReportHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setHistoryLoading(true);
      try {
        const { data } = await supabase
          .from('finance_report_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        setReportHistory((data ?? []) as ReportHistoryEntry[]);
      } catch {
        setReportHistory([]);
      }
      setHistoryLoading(false);
    };
    load();
  }, []);

  async function generateReport(report: ReportCard) {
    setShowPeriodModal(null);
    setGenerating(report.id);
    const generatedAt = new Date();
    
    try {
      let dataToExport: any[] = [];
      let headers: string[] = [];

      // Determine date ranges based on selectedPeriod
      let dateFilterGte = '';
      const now = new Date();
      if (selectedPeriod === 'Today') {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilterGte = d.toISOString();
      } else if (selectedPeriod === 'This Week') {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilterGte = d.toISOString();
      } else if (selectedPeriod === 'This Month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilterGte = d.toISOString();
      } else if (selectedPeriod === 'Last Month') {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        dateFilterGte = d.toISOString();
      } else if (selectedPeriod === 'This Quarter') {
        const currentQuarterMonth = Math.floor(now.getMonth() / 3) * 3;
        const d = new Date(now.getFullYear(), currentQuarterMonth, 1);
        dateFilterGte = d.toISOString();
      } else if (selectedPeriod === 'This Year') {
        const d = new Date(now.getFullYear(), 0, 1);
        dateFilterGte = d.toISOString();
      }

      if (report.id === 'daily_cash') {
        // Daily Cash Report: Cash inflow from cash payments
        let query = supabase.from('finance_payments').select('*').eq('payment_mode', 'Cash');
        if (dateFilterGte) query = query.gte('created_at', dateFilterGte);
        const { data } = await query;
        const payments = data || [];
        dataToExport = payments.map(p => ({
          'Receipt ID': p.id,
          'Client Name': p.client_name,
          'Amount (GHS)': Number(p.amount).toLocaleString(),
          'Payment Mode': p.payment_mode,
          'Payment Type': p.payment_type,
          'Recorded By': p.recorded_by || '—',
          'Date': new Date(p.created_at).toLocaleDateString()
        }));
        headers = ['Receipt ID', 'Client Name', 'Amount (GHS)', 'Payment Mode', 'Payment Type', 'Recorded By', 'Date'];

      } else if (report.id === 'weekly_sales') {
        // Weekly Sales Report: sales orders in selected period
        let query = supabase.from('orders').select('*');
        if (dateFilterGte) query = query.gte('created_at', dateFilterGte);
        const { data } = await query;
        const orders = data || [];
        dataToExport = orders.map(o => ({
          'Order ID': o.id,
          'Client Name': o.client_name,
          'Product Name': o.product_name || '—',
          'Quantity': o.quantity || 1,
          'Amount (GHS)': Number(o.total_amount).toLocaleString(),
          'Payment Mode': o.payment_mode,
          'Status': o.status,
          'Date': new Date(o.created_at).toLocaleDateString()
        }));
        headers = ['Order ID', 'Client Name', 'Product Name', 'Quantity', 'Amount (GHS)', 'Payment Mode', 'Status', 'Date'];

      } else if (report.id === 'monthly_pl') {
        // Monthly P&L Statement: Revenue vs Expenses
        let pQuery = supabase.from('finance_payments').select('amount, created_at');
        let eQuery = supabase.from('general_purchases').select('cost, created_at').eq('status', 'APPROVED');
        if (dateFilterGte) {
          pQuery = pQuery.gte('created_at', dateFilterGte);
          eQuery = eQuery.gte('created_at', dateFilterGte);
        }
        const { data: pData } = await pQuery;
        const { data: eData } = await eQuery;
        
        const rev = (pData || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const exp = (eData || []).reduce((sum, e) => sum + Number(e.cost || 0), 0);
        const net = rev - exp;

        dataToExport = [
          { 'Financial Metric': 'Total Revenue (Collections)', 'Amount (GHS)': rev.toLocaleString(), 'Description': 'Revenue collected from payments' },
          { 'Financial Metric': 'Total Approved Expenses', 'Amount (GHS)': exp.toLocaleString(), 'Description': 'Operations & general purchases approved' },
          { 'Financial Metric': 'Net Operating Income', 'Amount (GHS)': net.toLocaleString(), 'Description': 'Net profit/loss before tax' }
        ];
        headers = ['Financial Metric', 'Amount (GHS)', 'Description'];

      } else if (report.id === 'payroll') {
        // Payroll Summary: Active staff list by department
        const { data } = await supabase.from('profiles').select('*').eq('status', 'ACTIVE');
        const staff = data || [];
        dataToExport = staff.map(s => ({
          'Staff ID': s.id.slice(0, 8).toUpperCase(),
          'Full Name': s.full_name || '—',
          'Role': s.role || 'Staff',
          'Department': s.department || '—',
          'Phone': s.phone || '—',
          'Status': s.status
        }));
        headers = ['Staff ID', 'Full Name', 'Role', 'Department', 'Phone', 'Status'];

      } else if (report.id === 'credit') {
        // Customer Credit Report: Outstanding credit balances
        const { data } = await supabase.from('orders').select('*').eq('payment_mode', 'CREDIT');
        const creditOrders = data || [];
        dataToExport = creditOrders.map(o => ({
          'Order ID': o.id,
          'Client Name': o.client_name,
          'Total Amount (GHS)': Number(o.total_amount).toLocaleString(),
          'Status': o.status,
          'Date Placed': new Date(o.created_at).toLocaleDateString()
        }));
        headers = ['Order ID', 'Client Name', 'Total Amount (GHS)', 'Status', 'Date Placed'];

      } else if (report.id === 'outstanding_inv') {
        // Outstanding Invoices: Unpaid and processing orders
        const { data } = await supabase.from('orders').select('*').in('status', ['PENDING_FINANCE', 'PENDING_MANAGEMENT', 'PROCESSING', 'OUT_FOR_DELIVERY']);
        const unpaid = data || [];
        dataToExport = unpaid.map(o => ({
          'Invoice ID': o.ticket_number || o.id,
          'Client Name': o.client_name,
          'Product Name': o.product_name || '—',
          'Amount (GHS)': Number(o.total_amount).toLocaleString(),
          'Payment Mode': o.payment_mode,
          'Invoice Status': o.status,
          'Date Issued': new Date(o.created_at).toLocaleDateString()
        }));
        headers = ['Invoice ID', 'Client Name', 'Product Name', 'Amount (GHS)', 'Payment Mode', 'Invoice Status', 'Date Issued'];

      } else if (report.id === 'payment_methods') {
        // Payment Methods Analysis: payments grouped by method
        const { data } = await supabase.from('finance_payments').select('payment_mode, amount');
        const payments = data || [];
        const groups: Record<string, { count: number; total: number }> = {};
        for (const p of payments) {
          const mode = p.payment_mode || 'Unknown';
          if (!groups[mode]) groups[mode] = { count: 0, total: 0 };
          groups[mode].count += 1;
          groups[mode].total += Number(p.amount || 0);
        }
        dataToExport = Object.entries(groups).map(([mode, s]) => ({
          'Payment Method': mode,
          'Transaction Count': s.count,
          'Total Collected (GHS)': s.total.toLocaleString()
        }));
        headers = ['Payment Method', 'Transaction Count', 'Total Collected (GHS)'];

      } else if (report.id === 'expense') {
        // Expense Report: approved and pending general purchases
        let query = supabase.from('general_purchases').select('*');
        if (dateFilterGte) query = query.gte('created_at', dateFilterGte);
        const { data } = await query;
        const expenses = data || [];
        dataToExport = expenses.map(e => ({
          'Expense ID': e.id,
          'Item Name': e.item_name,
          'Category': e.category || 'General',
          'Cost (GHS)': Number(e.cost).toLocaleString(),
          'Status': e.status,
          'Department': e.department || '—',
          'Date Received': e.date_received || '—'
        }));
        headers = ['Expense ID', 'Item Name', 'Category', 'Cost (GHS)', 'Status', 'Department', 'Date Received'];

      } else {
        // Fallback for generic reports
        dataToExport = [{ Report: report.name, Period: selectedPeriod, 'Generated By': currentUser?.fullName || 'Finance', Date: generatedAt.toLocaleDateString() }];
        headers = ['Report', 'Period', 'Generated By', 'Date'];
      }

      exportToPDF(
        `${report.name} — ${selectedPeriod}`,
        dataToExport,
        headers
      );

      const entry: ReportHistoryEntry = {
        date: generatedAt.toISOString().slice(0, 10),
        type: report.name,
        period: selectedPeriod,
        generatedBy: currentUser?.fullName || 'Finance',
      };

      const { error: historyError } = await supabase.from('finance_report_history').insert([{
        date: entry.date,
        type: entry.type,
        period: entry.period,
        generated_by: entry.generatedBy,
        created_at: generatedAt.toISOString(),
      }]);
      if (historyError) throw historyError;

      setReportHistory(prev => [entry, ...prev]);
      addNotification?.(`${report.name} generated for ${selectedPeriod}`);
    } catch (e: any) {
      console.error('Failed to generate report:', e);
      addNotification?.(`Error generating report: ${e.message || e}`);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Financial Reports</h1>
        <p className="text-sm text-[var(--text-secondary)]">Generate and download financial reports</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map(report => {
          const Icon = report.icon;
          const lastEntry = reportHistory.find(h => h.type === report.name);
          return (
            <div key={report.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--accent)] transition-colors group">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${report.color}20` }}>
                  <Icon size={18} style={{ color: report.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{report.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{report.description}</p>
                </div>
              </div>
              {lastEntry ? (
                <p className="text-xs text-[var(--text-muted)]">Last: {lastEntry.date} · {lastEntry.period}</p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Never generated</p>
              )}
              <button
                onClick={() => setShowPeriodModal(report)}
                disabled={generating === report.id}
                className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-white text-sm font-medium transition-opacity ${generating === report.id ? 'opacity-60' : 'hover:opacity-90'}`}
                style={{ background: report.color }}
              >
                {generating === report.id ? (
                  <><RefreshCw size={14} className="animate-spin" /> Generating...</>
                ) : (
                  <><Download size={14} /> Generate Report</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Report History</h3>
          <button onClick={() => exportToCSV(reportHistory, ['date', 'type', 'period', 'generatedBy'], 'report_history')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"><Download size={12} /> Export</button>
        </div>
        {historyLoading ? (
          <div>{[0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}</div>
        ) : reportHistory.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-[var(--text-muted)]">
            <FileText size={28} className="opacity-30 mb-2" />
            <p className="text-sm">No report history yet</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)]">{['Date', 'Report Type', 'Period', 'Generated By', 'Download'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {reportHistory.map((h, i) => (
                <tr key={i} className="hover:bg-[var(--bg-input)]">
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{h.date}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{h.type}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{h.period}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{h.generatedBy}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"><Download size={12} /> Download PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPeriodModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{showPeriodModal.name}</h3>
            <p className="text-xs text-[var(--text-muted)] mb-5">{showPeriodModal.description}</p>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Select Period</label>
              <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]">
                {['Today', 'This Week', 'This Month', 'Last Month', 'This Quarter', 'Last Quarter', 'This Year', 'Last Year'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button onClick={() => setShowPeriodModal(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]">Cancel</button>
              <button onClick={() => generateReport(showPeriodModal)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: showPeriodModal.color }}><Download size={14} /> Generate & Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
