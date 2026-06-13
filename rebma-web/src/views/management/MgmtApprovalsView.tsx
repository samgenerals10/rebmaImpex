import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Search, Filter,
  ChevronDown, MoreVertical, ArrowLeft, Package, CreditCard,
  UserPlus, FileText, Tag, RefreshCw, Download, Eye
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

interface ApprovalItem {
  id: string;
  requestId: string;
  type: 'Cargo Intake' | 'Credit Order' | 'Staff Registration' | 'Discrepancy' | 'Price Review';
  description: string;
  department: string;
  amount: number | null;
  date: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Info Requested';
  submittedBy: string;
  notes?: string;
  raw?: Record<string, unknown>;
}

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  'Cargo Intake': 'bg-blue-100 text-blue-700',
  'Credit Order': 'bg-purple-100 text-purple-700',
  'Staff Registration': 'bg-green-100 text-green-700',
  'Discrepancy': 'bg-orange-100 text-orange-700',
  'Price Review': 'bg-pink-100 text-pink-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: 'text-red-500',
  Medium: 'text-yellow-500',
  Low: 'text-green-500',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  'Info Requested': 'bg-blue-100 text-blue-700',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  'Cargo Intake': Package,
  'Credit Order': CreditCard,
  'Staff Registration': UserPlus,
  'Discrepancy': AlertTriangle,
  'Price Review': Tag,
};

const MOCK_APPROVALS: ApprovalItem[] = [
  { id: '1', requestId: 'REQ-2024-001', type: 'Cargo Intake', description: 'Hydraulic Hose Fittings — 500 units from Accra Port', department: 'OPERATIONS', amount: 45000, date: '2024-12-10', priority: 'High', status: 'Pending', submittedBy: 'Kofi Mensah' },
  { id: '2', requestId: 'REQ-2024-002', type: 'Credit Order', description: 'Steel Pipe Fittings for Tema Industrial', department: 'MARKETING', amount: 120000, date: '2024-12-09', priority: 'High', status: 'Pending', submittedBy: 'Ama Boateng' },
  { id: '3', requestId: 'REQ-2024-003', type: 'Staff Registration', description: 'New hire: Emmanuel Asante — Warehouse Associate', department: 'HR', amount: null, date: '2024-12-08', priority: 'Medium', status: 'Pending', submittedBy: 'HR Dept' },
  { id: '4', requestId: 'REQ-2024-004', type: 'Discrepancy', description: 'Quantity mismatch: Rubber Gaskets — Expected 200, Received 185', department: 'OPERATIONS', amount: 3500, date: '2024-12-07', priority: 'Medium', status: 'Pending', submittedBy: 'Kwame Adjei' },
  { id: '5', requestId: 'REQ-2024-005', type: 'Price Review', description: 'Price update request: Copper Wire — GHS 45 → GHS 52 per unit', department: 'MANAGEMENT', amount: null, date: '2024-12-06', priority: 'Low', status: 'Pending', submittedBy: 'Finance Dept' },
  { id: '6', requestId: 'REQ-2024-006', type: 'Cargo Intake', description: 'PVC Pipes — 1200 units from Takoradi Port', department: 'OPERATIONS', amount: 78000, date: '2024-12-05', priority: 'High', status: 'Approved', submittedBy: 'Yaw Darko' },
  { id: '7', requestId: 'REQ-2024-007', type: 'Credit Order', description: 'Aluminium Sheets for Cape Coast Project', department: 'MARKETING', amount: 95000, date: '2024-12-04', priority: 'Medium', status: 'Rejected', submittedBy: 'Akua Sarpong' },
  { id: '8', requestId: 'REQ-2024-008', type: 'Staff Registration', description: 'New hire: Abena Owusu — Finance Analyst', department: 'HR', amount: null, date: '2024-12-03', priority: 'Low', status: 'Approved', submittedBy: 'HR Dept' },
];

const TABS = ['All', 'Cargo Intake', 'Credit Order', 'Staff Registration', 'Discrepancy', 'Price Review'] as const;

export default function MgmtApprovalsView({ addNotification, currentUser }: Props) {
  const [items, setItems] = useState<ApprovalItem[]>(MOCK_APPROVALS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('All');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<'approve' | 'reject' | 'info' | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [notifyOps, setNotifyOps] = useState(true);
  const [notifyCeo, setNotifyCeo] = useState(true);

  useEffect(() => {
    loadApprovals();
  }, []);

  async function loadApprovals() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('cargo_intake')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const mapped: ApprovalItem[] = data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          requestId: `REQ-${String(row.id).slice(0, 8).toUpperCase()}`,
          type: 'Cargo Intake' as const,
          description: `${String(row.product_name || 'Unknown')} — ${String(row.quantity || 0)} units`,
          department: 'OPERATIONS',
          amount: typeof row.total_value === 'number' ? row.total_value : null,
          date: String(row.created_at || '').slice(0, 10),
          priority: 'High' as const,
          status: (String(row.status || '') === 'PENDING_MANAGEMENT_APPROVAL' ? 'Pending' : String(row.status || '') === 'APPROVED' ? 'Approved' : 'Pending') as ApprovalItem['status'],
          submittedBy: String(row.submitted_by || 'Operations'),
          raw: row,
        }));
        setItems(mapped.length > 0 ? mapped : MOCK_APPROVALS);
      }
    } catch (_) {
      // fallback to mock
    }
    setLoading(false);
  }

  const filtered = items.filter(item => {
    const matchTab = activeTab === 'All' || item.type === activeTab;
    const matchStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchSearch = !search || item.description.toLowerCase().includes(search.toLowerCase()) || item.requestId.toLowerCase().includes(search.toLowerCase()) || item.department.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchStatus && matchSearch;
  });

  const counts = {
    total: items.length,
    pending: items.filter(i => i.status === 'Pending').length,
    approved: items.filter(i => i.status === 'Approved').length,
    rejected: items.filter(i => i.status === 'Rejected').length,
  };

  const selectedItem = items.find(i => i.id === selected);

  function handleAction(id: string, action: 'approve' | 'reject' | 'info') {
    setSelected(id);
    setShowModal(action);
    setModalNote('');
    setSellingPrice('');
  }

  async function confirmAction() {
    if (!selectedItem || !showModal) return;
    const action = showModal;
    const newStatus: ApprovalItem['status'] = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Info Requested';

    setItems(prev => prev.map(i => i.id === selectedItem.id ? { ...i, status: newStatus } : i));

    if (selectedItem.type === 'Cargo Intake' && selectedItem.raw) {
      const newDbStatus = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'INFO_REQUESTED';
      supabase.from('cargo_intake').update({ status: newDbStatus }).eq('id', selectedItem.raw.id).then(() => {}, () => {});

      if (action === 'approve') {
        if (notifyOps) {
          supabase.from('supplier_order_notifications').insert([{ order_id: selectedItem.raw.id, message: `Cargo intake APPROVED by Management: ${selectedItem.description}`, notified_department: 'OPERATIONS', read: false }]).then(() => {}, () => {});
        }
        if (notifyCeo) {
          supabase.from('supplier_order_notifications').insert([{ order_id: selectedItem.raw.id, message: `Cargo intake APPROVED by Management: ${selectedItem.description}`, notified_department: 'CEO', read: false }]).then(() => {}, () => {});
        }
        if (sellingPrice) {
          supabase.from('goods_prices').upsert([{ product_name: String(selectedItem.raw.product_name || ''), unit_price: parseFloat(sellingPrice), currency: 'GHS', category: 'INCOMING_GOODS' }]).then(() => {}, () => {});
        }
      }
    }

    if (selectedItem.type === 'Credit Order') {
      if (action === 'approve') {
        supabase.from('supplier_order_notifications').insert([{ order_id: selectedItem.id, message: `Credit order APPROVED: ${selectedItem.description}`, notified_department: 'FINANCE', read: false }]).then(() => {}, () => {});
        supabase.from('supplier_order_notifications').insert([{ order_id: selectedItem.id, message: `Credit order APPROVED: ${selectedItem.description}`, notified_department: 'MARKETING', read: false }]).then(() => {}, () => {});
      }
    }

    if (selectedItem.type === 'Staff Registration' && action === 'approve') {
      supabase.from('supplier_order_notifications').insert([{ order_id: selectedItem.id, message: `Staff registration APPROVED: ${selectedItem.description}`, notified_department: 'HR', read: false }]).then(() => {}, () => {});
    }

    supabase.from('global_audit_history').insert([{
      department: 'MANAGEMENT',
      action: `${action.toUpperCase()}: ${selectedItem.requestId} — ${selectedItem.description}${modalNote ? ` | Note: ${modalNote}` : ''}`,
      performed_by: currentUser?.fullName || 'Management',
      created_at: new Date().toISOString(),
    }]).then(() => {}, () => {});

    addNotification?.(`${selectedItem.requestId} ${newStatus}${modalNote ? ` — "${modalNote}"` : ''}`);
    setShowModal(null);
    setSelected(null);
  }

  const handleExport = () => {
    exportToCSV(
      filtered.map(i => ({ ID: i.requestId, Type: i.type, Description: i.description, Department: i.department, Amount: i.amount ?? '', Date: i.date, Priority: i.priority, Status: i.status, SubmittedBy: i.submittedBy })),
      ['ID', 'Type', 'Description', 'Department', 'Amount', 'Date', 'Priority', 'Status', 'SubmittedBy'],
      'approvals_queue'
    );
  };

  if (selectedItem && !showModal) {
    const Icon = TYPE_ICONS[selectedItem.type] || FileText;
    return (
      <div className="p-4 md:p-6 space-y-5">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Approvals Queue
        </button>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                <Icon size={24} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedItem.requestId}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[selectedItem.type]}`}>{selectedItem.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedItem.status]}`}>{selectedItem.status}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{selectedItem.description}</p>
              </div>
            </div>
            {selectedItem.status === 'Pending' && (
              <div className="flex items-center gap-2">
                <button onClick={() => handleAction(selectedItem.id, 'info')} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Request Info</button>
                <button onClick={() => handleAction(selectedItem.id, 'reject')} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"><XCircle size={14} className="inline mr-1" />Reject</button>
                <button onClick={() => handleAction(selectedItem.id, 'approve')} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}><CheckCircle size={14} className="inline mr-1" />Approve</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Department', value: selectedItem.department },
              { label: 'Submitted By', value: selectedItem.submittedBy },
              { label: 'Date', value: selectedItem.date },
              { label: 'Priority', value: selectedItem.priority },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--bg-input)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className={`text-sm font-semibold ${label === 'Priority' ? PRIORITY_COLORS[value] : 'text-[var(--text-primary)]'}`}>{value}</p>
              </div>
            ))}
          </div>

          {selectedItem.amount !== null && (
            <div className="bg-[var(--bg-input)] rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Transaction Amount</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>GHS {selectedItem.amount.toLocaleString()}</p>
            </div>
          )}

          {selectedItem.notes && (
            <div className="bg-[var(--bg-input)] rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-2">Notes</p>
              <p className="text-sm text-[var(--text-primary)]">{selectedItem.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Approvals Queue</h1>
          <p className="text-sm text-[var(--text-secondary)]">Review and action all pending requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadApprovals} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: counts.total, icon: FileText, color: 'var(--accent)' },
          { label: 'Pending', value: counts.pending, icon: Clock, color: '#f59e0b' },
          { label: 'Approved', value: counts.approved, icon: CheckCircle, color: '#10b981' },
          { label: 'Rejected', value: counts.rejected, icon: XCircle, color: '#ef4444' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === tab ? 'text-white' : 'text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-input)]'}`}
            style={activeTab === tab ? { background: 'var(--accent)' } : {}}
          >
            {tab}
            {tab !== 'All' && (
              <span className="ml-1.5 text-xs opacity-70">({items.filter(i => i.type === tab).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Status Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ID, description, department..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)]"
          >
            <Filter size={14} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-[var(--text-secondary)] text-sm focus:outline-none"
            >
              {['All', 'Pending', 'Approved', 'Rejected', 'Info Requested'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">Loading approvals...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-muted)]">
            <CheckCircle size={32} className="opacity-30" />
            <p className="text-sm">No requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  {['Request ID', 'Type', 'Description', 'Department', 'Amount', 'Date', 'Priority', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(item => {
                  const Icon = TYPE_ICONS[item.type] || FileText;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--bg-input)] transition-colors cursor-pointer group"
                      onClick={() => setSelected(item.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">{item.requestId}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap w-fit ${TYPE_COLORS[item.type]}`}>
                          <Icon size={11} />{item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] max-w-[200px]">
                        <p className="truncate">{item.description}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{item.department}</td>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        {item.amount !== null ? `GHS ${item.amount.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{item.date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-semibold text-xs ${PRIORITY_COLORS[item.priority]}`}>● {item.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSelected(item.id)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)]" title="View"><Eye size={14} style={{ color: 'var(--accent)' }} /></button>
                          {item.status === 'Pending' && <>
                            <button onClick={() => handleAction(item.id, 'approve')} className="p-1.5 rounded-lg hover:bg-green-100" title="Approve"><CheckCircle size={14} className="text-green-500" /></button>
                            <button onClick={() => handleAction(item.id, 'reject')} className="p-1.5 rounded-lg hover:bg-red-100" title="Reject"><XCircle size={14} className="text-red-500" /></button>
                          </>}
                          <div className="relative">
                            <button onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                            {menuOpen === item.id && (
                              <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]" onClick={() => setMenuOpen(null)}>
                                <button onClick={() => setSelected(item.id)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Details</button>
                                {item.status === 'Pending' && <>
                                  <button onClick={() => handleAction(item.id, 'approve')} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-[var(--bg-input)]">Approve</button>
                                  <button onClick={() => handleAction(item.id, 'reject')} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-[var(--bg-input)]">Reject</button>
                                  <button onClick={() => handleAction(item.id, 'info')} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Request Info</button>
                                </>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              {showModal === 'approve' && <CheckCircle size={20} className="text-green-500" />}
              {showModal === 'reject' && <XCircle size={20} className="text-red-500" />}
              {showModal === 'info' && <AlertTriangle size={20} className="text-yellow-500" />}
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {showModal === 'approve' ? 'Approve' : showModal === 'reject' ? 'Reject' : 'Request More Info'}: {selectedItem.requestId}
              </h3>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">{selectedItem.description}</p>

            {showModal === 'approve' && selectedItem.type === 'Cargo Intake' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Selling Price (GHS) — optional</label>
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={e => setSellingPrice(e.target.value)}
                    placeholder="Enter selling price per unit"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-secondary)] block">Notify departments:</label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                    <input type="checkbox" checked={notifyOps} onChange={e => setNotifyOps(e.target.checked)} className="rounded" />
                    Operations Department
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                    <input type="checkbox" checked={notifyCeo} onChange={e => setNotifyCeo(e.target.checked)} className="rounded" />
                    CEO / Director
                  </label>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                {showModal === 'approve' ? 'Additional notes (optional)' : showModal === 'reject' ? 'Reason for rejection *' : 'Information needed *'}
              </label>
              <textarea
                value={modalNote}
                onChange={e => setModalNote(e.target.value)}
                rows={3}
                placeholder={showModal === 'approve' ? 'Any notes for this approval...' : showModal === 'reject' ? 'Explain why this is being rejected...' : 'Describe what additional information is needed...'}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setShowModal(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Cancel</button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 rounded-xl text-white text-sm font-medium ${showModal === 'approve' ? 'bg-green-500 hover:bg-green-600' : showModal === 'reject' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'}`}
              >
                {showModal === 'approve' ? 'Confirm Approval' : showModal === 'reject' ? 'Confirm Rejection' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
