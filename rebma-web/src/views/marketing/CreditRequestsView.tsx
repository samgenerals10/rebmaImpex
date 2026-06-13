import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  CreditCard, Search, Download, Eye, ChevronLeft, Clock, CheckCircle,
  XCircle, AlertCircle, Camera, User, Phone, MapPin, Calendar
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

interface CreditRequest {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  phone: string;
  address: string;
  amount: number;
  date: string;
  dueDate: string;
  ghanaCardFrontUrl?: string;
  ghanaCardBackUrl?: string;
  customerPhotoUrl?: string;
  ghanaCardNumber?: string;
  status: 'Pending Management' | 'Management Approved' | 'Finance Processing' | 'Completed' | 'Rejected';
  managementNote?: string;
  financeNote?: string;
  timeline?: { event: string; by: string; date: string; note?: string }[];
}

const MOCK: CreditRequest[] = [
  {
    id: 'CR-2024-001', orderId: 'ORD-2024-012', customerId: 'CUST-001',
    customerName: 'Accra Builders Ltd', phone: '0244123456', address: '15 Industrial Ave, Tema',
    amount: 45000, date: '2024-12-08', dueDate: '2025-01-08',
    ghanaCardNumber: 'GHA-123456789-0', status: 'Pending Management',
    timeline: [
      { event: 'Credit request submitted', by: 'Sales Rep', date: '2024-12-08 10:30', note: 'Customer requested 30-day credit' },
    ],
  },
  {
    id: 'CR-2024-002', orderId: 'ORD-2024-009', customerId: 'CUST-002',
    customerName: 'Kumasi Traders Co.', phone: '0551987654', address: '7 Main St, Kumasi',
    amount: 28000, date: '2024-12-07', dueDate: '2025-01-06',
    ghanaCardNumber: 'GHA-987654321-1', status: 'Management Approved',
    managementNote: 'Approved. Customer has good payment history.',
    timeline: [
      { event: 'Credit request submitted', by: 'Sales Rep', date: '2024-12-07 09:00' },
      { event: 'Management approved', by: 'Manager', date: '2024-12-07 14:00', note: 'Good payment history' },
    ],
  },
  {
    id: 'CR-2024-003', orderId: 'ORD-2024-007', customerId: 'CUST-003',
    customerName: 'Takoradi Ventures', phone: '0302445566', address: '22 Harbour Rd, Takoradi',
    amount: 62000, date: '2024-12-06', dueDate: '2025-01-05',
    ghanaCardNumber: 'GHA-555333111-2', status: 'Finance Processing',
    managementNote: 'Approved with collateral.',
    timeline: [
      { event: 'Credit request submitted', by: 'Sales Rep', date: '2024-12-06 08:00' },
      { event: 'Management approved', by: 'Manager', date: '2024-12-06 11:00' },
      { event: 'Sent to Finance', by: 'System', date: '2024-12-06 11:01' },
    ],
  },
  {
    id: 'CR-2024-004', orderId: 'ORD-2024-005', customerId: 'CUST-004',
    customerName: 'Cape Coast Ventures', phone: '0244778899', address: '5 Beach Rd, Cape Coast',
    amount: 15000, date: '2024-12-04', dueDate: '2025-01-04',
    ghanaCardNumber: 'GHA-222444666-3', status: 'Completed',
    managementNote: 'Approved.', financeNote: 'Credit terms agreed, terms sheet signed.',
    timeline: [
      { event: 'Credit request submitted', by: 'Sales Rep', date: '2024-12-04 10:00' },
      { event: 'Management approved', by: 'Manager', date: '2024-12-04 12:00' },
      { event: 'Finance completed', by: 'Finance Team', date: '2024-12-04 16:00' },
    ],
  },
  {
    id: 'CR-2024-005', orderId: 'ORD-2024-003', customerId: 'CUST-005',
    customerName: 'Ho Supplies Ltd', phone: '0557112233', address: '3 Volta Rd, Ho',
    amount: 8000, date: '2024-12-02', dueDate: '2025-01-02',
    ghanaCardNumber: 'GHA-777888999-4', status: 'Rejected',
    managementNote: 'Rejected — insufficient business history.',
    timeline: [
      { event: 'Credit request submitted', by: 'Sales Rep', date: '2024-12-02 09:00' },
      { event: 'Management rejected', by: 'Manager', date: '2024-12-02 15:00', note: 'Insufficient business history' },
    ],
  },
];

const STATUS_TABS = ['All', 'Pending Management', 'Management Approved', 'Finance Processing', 'Completed', 'Rejected'] as const;

const STATUS_STYLES: Record<string, string> = {
  'Pending Management': 'bg-yellow-100 text-yellow-700',
  'Management Approved': 'bg-blue-100 text-blue-700',
  'Finance Processing': 'bg-purple-100 text-purple-700',
  'Completed': 'bg-green-100 text-green-700',
  'Rejected': 'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  'Pending Management': Clock,
  'Management Approved': CheckCircle,
  'Finance Processing': AlertCircle,
  'Completed': CheckCircle,
  'Rejected': XCircle,
};

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

function GhanaCardPlaceholder({ label }: { label: string }) {
  return (
    <div className="w-full aspect-video rounded-xl bg-[var(--bg-input)] border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-2">
      <Camera size={20} className="text-[var(--text-muted)]" />
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-xs text-[var(--text-muted)] opacity-60">Photo taken at order creation</p>
    </div>
  );
}

export default function MarketingCreditRequestsView({ addNotification, currentUser }: Props) {
  const [requests] = useState<CreditRequest[]>(MOCK);
  const [activeTab, setActiveTab] = useState<typeof STATUS_TABS[number]>('All');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<CreditRequest | null>(null);

  const filtered = requests.filter(r => {
    const matchTab = activeTab === 'All' || r.status === activeTab;
    const q = search.toLowerCase();
    const matchSearch = !q || r.customerName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.orderId.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const counts = {
    pending: requests.filter(r => r.status === 'Pending Management').length,
    approved: requests.filter(r => r.status === 'Management Approved').length,
    processing: requests.filter(r => r.status === 'Finance Processing').length,
    completed: requests.filter(r => r.status === 'Completed').length,
    rejected: requests.filter(r => r.status === 'Rejected').length,
  };

  function handleExport() {
    exportToCSV(
      filtered.map(r => ({ ID: r.id, 'Order Ref': r.orderId, Customer: r.customerName, Phone: r.phone, Amount: r.amount, Date: r.date, 'Due Date': r.dueDate, Status: r.status })),
      ['ID', 'Order Ref', 'Customer', 'Phone', 'Amount', 'Date', 'Due Date', 'Status'],
      'credit_requests'
    );
  }

  if (detail) {
    const Icon = STATUS_ICONS[detail.status] || Clock;
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setDetail(null)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <ChevronLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{detail.id}</h1>
            <p className="text-sm text-[var(--text-muted)]">Credit Request — {detail.orderId}</p>
          </div>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${STATUS_STYLES[detail.status]}`}>
            <Icon size={12} />{detail.status}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Customer Info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-[var(--text-primary)]">Customer Information</h3>
              <div className="space-y-3">
                {[
                  { icon: User, label: 'Name', val: detail.customerName },
                  { icon: Phone, label: 'Phone', val: detail.phone },
                  { icon: MapPin, label: 'Address', val: detail.address },
                  { icon: CreditCard, label: 'Ghana Card', val: detail.ghanaCardNumber || 'N/A' },
                  { icon: Calendar, label: 'Request Date', val: detail.date },
                  { icon: Calendar, label: 'Due Date', val: detail.dueDate },
                ].map(({ icon: I, label, val }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <I size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">{label}</p>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{val}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Credit Amount</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>GHS {detail.amount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ghana Card Photos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Ghana Card Verification</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Front Side</p>
                  {detail.ghanaCardFrontUrl
                    ? <img src={detail.ghanaCardFrontUrl} alt="Ghana Card Front" className="w-full aspect-video object-cover rounded-xl border border-[var(--border)]" />
                    : <GhanaCardPlaceholder label="Ghana Card Front" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Back Side</p>
                  {detail.ghanaCardBackUrl
                    ? <img src={detail.ghanaCardBackUrl} alt="Ghana Card Back" className="w-full aspect-video object-cover rounded-xl border border-[var(--border)]" />
                    : <GhanaCardPlaceholder label="Ghana Card Back" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Customer Photo</p>
                  {detail.customerPhotoUrl
                    ? <img src={detail.customerPhotoUrl} alt="Customer" className="w-full aspect-video object-cover rounded-xl border border-[var(--border)]" />
                    : <GhanaCardPlaceholder label="Customer Photo" />}
                </div>
              </div>
            </div>

            {/* Notes */}
            {(detail.managementNote || detail.financeNote) && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-[var(--text-primary)]">Review Notes</h3>
                {detail.managementNote && (
                  <div className="p-3 bg-[var(--bg-input)] rounded-xl">
                    <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Management Note</p>
                    <p className="text-sm text-[var(--text-primary)]">{detail.managementNote}</p>
                  </div>
                )}
                {detail.financeNote && (
                  <div className="p-3 bg-[var(--bg-input)] rounded-xl">
                    <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Finance Note</p>
                    <p className="text-sm text-[var(--text-primary)]">{detail.financeNote}</p>
                  </div>
                )}
              </div>
            )}

            {/* Activity Timeline */}
            {detail.timeline && detail.timeline.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">Activity Timeline</h3>
                <div className="space-y-4">
                  {detail.timeline.map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="relative">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent)' }} />
                        {i < detail.timeline!.length - 1 && <div className="absolute left-0.5 top-3 bottom-0 w-px -translate-x-1/2" style={{ background: 'var(--border)' }} />}
                      </div>
                      <div className="pb-2">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{t.event}</p>
                        <p className="text-xs text-[var(--text-muted)]">{t.by} · {t.date}</p>
                        {t.note && <p className="text-xs text-[var(--text-secondary)] mt-1 bg-[var(--bg-input)] px-2 py-1 rounded-lg">{t.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Credit Requests</h1>
          <p className="text-sm text-[var(--text-secondary)]">Track credit orders submitted to Management & Finance</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Pending Mgmt', count: counts.pending, color: '#f59e0b', bg: 'bg-yellow-50' },
          { label: 'Mgmt Approved', count: counts.approved, color: '#3b82f6', bg: 'bg-blue-50' },
          { label: 'Finance Processing', count: counts.processing, color: '#8b5cf6', bg: 'bg-purple-50' },
          { label: 'Completed', count: counts.completed, color: '#10b981', bg: 'bg-green-50' },
          { label: 'Rejected', count: counts.rejected, color: '#ef4444', bg: 'bg-red-50' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-[var(--bg-input)] rounded-xl p-1 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              {tab} {tab === 'All' ? `(${requests.length})` : ''}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID…" className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder-[var(--text-muted)]" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Request ID', 'Customer', 'Order Ref', 'Amount', 'Date', 'Due Date', 'Ghana Card', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-[var(--text-muted)]">No credit requests found</td></tr>
              )}
              {filtered.map(r => {
                const Icon = STATUS_ICONS[r.status] || Clock;
                return (
                  <tr key={r.id} className="hover:bg-[var(--bg-input)] cursor-pointer" onClick={() => setDetail(r)}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-[var(--accent)]">{r.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text-primary)] whitespace-nowrap">{r.customerName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{r.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs whitespace-nowrap">{r.orderId}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">GHS {r.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{r.dueDate}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.ghanaCardNumber ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.ghanaCardNumber ? 'Captured' : 'Missing'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium w-fit whitespace-nowrap ${STATUS_STYLES[r.status]}`}>
                        <Icon size={11} />{r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); setDetail(r); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-input)] whitespace-nowrap">
                        <Eye size={11} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
