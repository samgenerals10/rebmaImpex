// src/views/ceo/ApprovalsView.tsx
//
// Registrations: clicking a row opens a review panel with everything the
// CEO needs before approving. What HR entered (photo, contact, address,
// staff category, résumé, guarantor) comes from the profile; the device,
// GPS location, approximate network location and IP address come from
// staff_registration_details (CEO only under RLS).
//
// A registration must be approved within 12 hours of registering. Past
// that it shows Expired, can't be approved, and HR resends the link.
// People who chose their own password at registration get no temporary
// password here; the server emails them that they can sign in.
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Download, History, FileText, MapPin, X } from 'lucide-react';
import { getSignedFileUrl } from '../../utils/uploadFile';
import { isRegistrationExpired, approvalTimeLeft } from '../../utils/registration';
import PasswordConfirmModal from '../../components/ui/PasswordConfirmModal';
import { supabase } from '../../lib/supabaseClient';
import SidePanel from '../../components/ui/SidePanel';
import RequestTimelinePanel from '../../components/global/RequestTimelinePanel';
import { hr } from '../../services/apiClient';
import type { CurrentUser } from '../../types/erp';
import { exportToCSV } from '../../utils/export';
import DeletionRequestsPanel from '../../components/hr/DeletionRequestsPanel';
import DepartmentChangesPanel from '../../components/hr/DepartmentChangesPanel';
import CountBadge from '../../components/ui/CountBadge';

interface Approval {
  id: string;
  // 'credit'/'cargo' stay in the type union so old audit-history rows (from
  // before Risk took over these two approval types) still render correctly
  // in the history list below — they're no longer live/actionable tabs.
  type: 'credit' | 'cargo' | 'payment' | 'registration';
  requester: string;
  department: string;
  description: string;
  amount?: number;
  date_submitted: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt?: string | null;
  expired?: boolean;
  raw?: any;
}

interface RegDetails {
  device: Record<string, any> | null;
  location: Record<string, any> | null;
  network_location: Record<string, any> | null;
  ip_address: string | null;
}

const TYPE_STYLES: Record<string, string> = {
  credit:       'bg-blue-100 text-blue-700',
  cargo:        'bg-amber-100 text-amber-700',
  payment:      'bg-emerald-100 text-emerald-700',
  registration: 'bg-purple-100 text-purple-700',
};

interface Props { currentUser: CurrentUser | null; addNotification: (msg: string) => void }

export default function ApprovalsView({ currentUser, addNotification }: Props) {
  const [rows, setRows]           = useState<Approval[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'all'|'credit'|'cargo'|'payment'|'registration'>('all');
  const [history, setHistory]     = useState<Approval[]>([]);
  const [credPopup, setCredPopup] = useState<{ fullName: string; password: string } | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [remark, setRemark] = useState('');
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Approval | null>(null);
  const [details, setDetails] = useState<RegDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  // Approving a co-CEO is a high-risk action: the CEO types his password.
  const [ceoApproval, setCeoApproval] = useState<{ item: Approval; note?: string } | null>(null);

  const openReview = async (item: Approval) => {
    setReviewing(item);
    setDetails(null);
    setDetailsLoading(true);
    const { data } = await supabase
      .from('staff_registration_details')
      .select('device, location, network_location, ip_address')
      .eq('user_id', item.id)
      .maybeSingle();
    setDetails((data as RegDetails) || null);
    setDetailsLoading(false);
  };

  const openResume = async (path: string) => {
    const url = await getSignedFileUrl('staff-resumes', path);
    if (url) window.open(url, '_blank', 'noopener');
    else addNotification('Could not open the résumé. It may have been removed.');
  };

  const load = async () => {
    setLoading(true);
    try {
      // Credit and cargo approvals moved to the Risk department — Risk is now
      // the only writer of decisions for those two request types (see
      // src/views/risk/RiskApprovalsView.tsx). Querying them here too would
      // reopen the "two doors into the same rows" problem this fix removes.
      // Registration stays CEO/HR territory, untouched.

      // Query pending registrations from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'PENDING_APPROVAL')
        .order('created_at', { ascending: false })
        .limit(100);

      const approvals: Approval[] = [
        ...(profiles || []).map((p: any) => ({
          id: p.id,
          type: 'registration' as const,
          requester: p.full_name || 'New Employee',
          department: (p.role || 'STAFF').toUpperCase(),
          description: `Sign-up approval for role: ${p.metadata?.inviteRole || p.role}`,
          date_submitted: (p.registered_at || p.created_at) ? new Date(p.registered_at || p.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '',
          status: 'pending' as const,
          registeredAt: p.registered_at || null,
          expired: isRegistrationExpired(p.status, p.registered_at),
          raw: p,
        })),
      ];

      setRows(approvals);

      // Load history from global audit logs
      const { data: auditLogs } = await supabase
        .from('global_audit_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      // Price-request decisions get their own recent-decisions list on the
      // dedicated Price Approvals page — excluded here so they don't dupe.
      const historyLogs: Approval[] = (auditLogs || [])
        .filter((log: any) => !log.action.toLowerCase().includes('price'))
        .map((log: any) => ({
          id: log.id,
          type: log.action.toLowerCase().includes('cargo') ? 'cargo'
                : log.action.toLowerCase().includes('payment') ? 'payment'
                : log.action.toLowerCase().includes('credit') ? 'credit'
                : 'registration',
          requester: log.performed_by || 'System',
          department: log.department || 'GENERAL',
          description: log.details || log.action,
          date_submitted: log.timestamp ? log.timestamp.split('T')[0] : '',
          status: log.action.toLowerCase().includes('reject') ? 'rejected' : 'approved',
        }));

      setHistory(historyLogs);
    } catch (e) {
      console.error('Error loading approvals queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = rows.filter(r => tab === 'all' || r.type === tab);

  // 'registration' is the only live type in `rows` today — credit/cargo moved
  // to Risk (see the comment in load() above), and 'payment' has never had a
  // row-producing query in this file. The old `item.type !== 'registration'`
  // branches below were therefore dead code; removed rather than left to rot.
  const handleApprove = async (id: string, note?: string) => {
    const item = rows.find(r => r.id === id);
    if (!item) return;
    if (item.department === 'CEO') { setCeoApproval({ item, note }); return; }
    try {
      // Routed through the service-role-backed endpoint — a direct client
      // update silently no-ops here because profiles' RLS only lets a user
      // update their own row. This also enforces the CEO-only gate for
      // Management/HR registrants server-side. approve-user.ts writes its
      // own audit entry (with reference_id + the remark) — no duplicate
      // insert needed here.
      // Only older registrations (no registered_at) need a temporary
      // password; the server makes it and returns it once.
      const res = await hr.approveUser(id, true, !item.registeredAt, undefined, note);
      if (res?.temporaryPassword) setCredPopup({ fullName: item.requester, password: res.temporaryPassword });
      else if (res?.message) addNotification(res.message);
      setReviewing(null);

      addNotification(`Approved ${item.type} request successfully.`);
      setRows(prev => prev.filter(r => r.id !== id));
      load(); // Refresh queue and history
    } catch (e: any) {
      console.error(e);
      addNotification(e?.message || 'Approval action failed.');
    }
  };

  const handleReject = async (id: string, note?: string) => {
    const item = rows.find(r => r.id === id);
    if (!item) return;
    try {
      await hr.approveUser(id, false, undefined, undefined, note);
      // The registration desk (HR) previously learned nothing about a
      // rejection unless they happened to notice the row disappear.
      await supabase.from('supplier_order_notifications').insert([{
        message: `Registration REJECTED by CEO: ${item.requester} (${item.department})${note ? `: ${note}` : ''}`,
        notified_department: 'HR',
        read: false,
      }]);

      addNotification(`Rejected ${item.type} request.`);
      setReviewing(null);
      setRows(prev => prev.filter(r => r.id !== id));
      load(); // Refresh queue and history
    } catch (e: any) {
      console.error(e);
      addNotification(e?.message || 'Rejection action failed.');
    }
  };

  const TABS = ['all','payment','registration'] as const;

  return (
    <div className="space-y-5">
      {/* Department moves wait for the CEO; Delete Account requests from
          HR and Management staff are the CEO's to confirm. */}
      <DepartmentChangesPanel addNotification={addNotification} />
      <DeletionRequestsPanel callerIsCeo={!!currentUser?.isAdmin} callerId={currentUser?.id} addNotification={addNotification} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Approval Queue</h2>
          <p className="text-xs text-[var(--text-muted)]">{rows.length} pending approval{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { exportToCSV([...rows,...history], ['id','type','requester','department','description','date_submitted','status'], 'approvals'); addNotification('Exported.'); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border)]">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg capitalize cursor-pointer transition-colors ${tab === t ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
            {t === 'all' ? 'All' : t}<CountBadge count={t === 'all' ? rows.length : rows.filter(r => r.type === t).length} />
          </button>
        ))}
      </div>

      {/* Pending approvals */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl">
          <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">All clear!</p>
          <p className="text-xs text-[var(--text-muted)]">No pending approvals in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <div key={item.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 shadow-[var(--box-shadow)]">
              <button type="button" onClick={() => openReview(item)} className="flex-1 min-w-0 text-left cursor-pointer" title="Review full details">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${TYPE_STYLES[item.type] || 'bg-slate-100 text-slate-700'}`}>{item.type}</span>
                  {item.expired
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">EXPIRED</span>
                    : approvalTimeLeft(item.registeredAt) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{approvalTimeLeft(item.registeredAt)}</span>}
                  <span className="text-[10px] font-semibold text-[var(--text-muted)]">{item.department}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{item.date_submitted}</span>
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{item.requester}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{item.description}</p>
              </button>
              {item.amount ? (
                <p className="text-base font-bold text-[var(--accent)] shrink-0 whitespace-nowrap">GHS {item.amount.toLocaleString()}</p>
              ) : null}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setTimelineId(item.id)} title="View Timeline"
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--bg-input)]">
                  <History className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setRemark(''); setDecisionModal({ id: item.id, action: 'approve' }); }}
                  disabled={item.expired} title={item.expired ? 'Expired. HR can resend the link.' : undefined}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => { setRemark(''); setDecisionModal({ id: item.id, action: 'reject' }); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-rose-600">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {history.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 text-center text-xs text-[var(--text-muted)]">
          No approval history logged in audit logs.
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text-secondary)]">Recent History</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {history.slice(0, 8).map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 opacity-70 hover:opacity-100 transition-opacity">
                {item.status === 'approved'
                  ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{item.requester} — {item.description}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{item.department} · {item.date_submitted}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approve/Reject remark modal — required on reject, optional on approve */}
      <SidePanel
        open={!!decisionModal}
        onClose={() => setDecisionModal(null)}
        title={decisionModal?.action === 'approve' ? 'Approve Registration' : 'Reject Registration'}
        footer={
          <button
            disabled={decisionModal?.action === 'reject' && !remark.trim()}
            onClick={() => {
              if (!decisionModal) return;
              const { id, action } = decisionModal;
              setDecisionModal(null);
              if (action === 'approve') handleApprove(id, remark.trim() || undefined);
              else handleReject(id, remark.trim() || undefined);
            }}
            className="erp-btn erp-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {decisionModal?.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
          </button>
        }
      >
        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
          Remark {decisionModal?.action === 'reject' ? '(required)' : '(optional)'}
        </label>
        <textarea
          value={remark}
          onChange={e => setRemark(e.target.value)}
          rows={4}
          placeholder={decisionModal?.action === 'reject' ? 'Why is this registration being rejected?' : 'Optional note...'}
          className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        />
      </SidePanel>

      <SidePanel
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={reviewing?.requester || ''}
        subtitle={reviewing ? reviewing.department : undefined}
        width="lg"
        footer={reviewing ? (
          <div className="flex gap-2">
            <button onClick={() => setTimelineId(reviewing.id)} className="erp-btn erp-btn-ghost flex items-center gap-1"><History className="w-3.5 h-3.5" /> Timeline</button>
            <button onClick={() => { setRemark(''); setDecisionModal({ id: reviewing.id, action: 'approve' }); setReviewing(null); }} disabled={reviewing.expired}
              className="erp-btn erp-btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">Approve</button>
            <button onClick={() => { setRemark(''); setDecisionModal({ id: reviewing.id, action: 'reject' }); setReviewing(null); }}
              className="flex-1 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl cursor-pointer">Reject</button>
          </div>
        ) : undefined}
      >
        {reviewing && (() => {
          const p = reviewing.raw || {};
          const dev = details?.device || {};
          const gps = details?.location || {};
          const net = details?.network_location || {};
          const hasGps = typeof gps.latitude === 'number' && typeof gps.longitude === 'number';
          const row = (label: string, value: any) => (value === undefined || value === null || value === '') ? null : (
            <div key={label} className="flex justify-between gap-4 py-1.5 border-b border-[var(--border)] last:border-0">
              <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
              <span className="text-xs text-[var(--text-primary)] text-right break-words select-text">{String(value)}</span>
            </div>
          );
          const section = (title: string, children: any) => (
            <div className="mb-5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{title}</h4>
              {children}
            </div>
          );
          return (
            <div>
              <div className="flex items-center gap-4 mb-5">
                <button type="button" onClick={() => p.photo && setPhotoOpen(true)} disabled={!p.photo} className="shrink-0 cursor-pointer disabled:cursor-default" title={p.photo ? 'View photo' : undefined}>
                  {p.photo
                    ? <img src={p.photo} alt={reviewing.requester} className="w-20 h-20 rounded-2xl object-cover border border-[var(--border)]" />
                    : <div className="w-20 h-20 rounded-2xl bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xl font-bold">{reviewing.requester.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}</div>}
                </button>
                <div className="space-y-1">
                  {reviewing.expired
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">EXPIRED</span>
                    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{approvalTimeLeft(reviewing.registeredAt) || 'Pending'}</span>}
                  <p className="text-xs text-[var(--text-secondary)]">Registered {reviewing.date_submitted}</p>
                  {reviewing.expired && <p className="text-xs text-rose-600">Not approved within 12 hours. HR can resend the link from the staff list.</p>}
                </div>
              </div>

              {section('Entered by HR', <>
                {row('Email', p.email)}
                {row('Phone', p.phone)}
                {row('Department', reviewing.department)}
                {row('Role', p.metadata?.inviteRole)}
                {row('Employee number', p.employee_number)}
                {row('Staff category', p.staff_category)}
                {row('Address', p.address)}
                {row('Ghana Card', p.ghana_card_id)}
                {p.resume_url && (
                  <button onClick={() => openResume(p.resume_url)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-[var(--accent)] cursor-pointer hover:underline">
                    <FileText className="w-3.5 h-3.5" /> Open résumé
                  </button>
                )}
              </>)}

              {(p.guarantor_name || p.guarantor_phone) && section('Guarantor', <>
                {row('Name', p.guarantor_name)}
                {row('Phone', p.guarantor_phone)}
                {row('Relationship', p.guarantor_relationship)}
                {row('ID number', p.guarantor_id_number)}
                {row('Address', p.guarantor_address)}
              </>)}

              {section('Device used to register', detailsLoading
                ? <p className="text-xs text-[var(--text-muted)]">Loading…</p>
                : !details
                  ? <p className="text-xs text-[var(--text-muted)]">Not recorded. This person registered before device details were collected.</p>
                  : <>
                      {row('Type', dev.kind)}
                      {row('Using', dev.platform)}
                      {row('Model', [dev.manufacturer, dev.model].filter(Boolean).join(' ') || undefined)}
                      {row('System', [dev.os, dev.osVersion].filter(Boolean).join(' ') || undefined)}
                      {row('Browser', dev.browser)}
                      {row('App version', dev.appVersion)}
                      {row('Screen', dev.screen)}
                    </>)}

              {details && section('Location when registering', <>
                {hasGps ? (
                  <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] mb-2">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] mb-1">GPS</p>
                    {gps.address && <p className="text-xs text-[var(--text-primary)]">{gps.address}</p>}
                    <p className="text-xs text-[var(--text-secondary)] select-text">{gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}{gps.accuracy ? ` (within about ${gps.accuracy} m)` : ''}</p>
                    <a href={`https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline">
                      <MapPin className="w-3.5 h-3.5" /> Open in Maps
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] mb-2">No GPS location. {gps.refusedReason || 'They did not share it.'}</p>
                )}
                {row('Approximate area', [net.city, net.region, net.country].filter(Boolean).join(', ') || 'Not available')}
                {row('Network address (IP)', details.ip_address || 'Not available')}
              </>)}
            </div>
          );
        })()}
      </SidePanel>

      {photoOpen && reviewing?.raw?.photo && (
        <div className="fixed inset-0 z-[600] bg-black/90 flex items-center justify-center p-6 cursor-pointer" onClick={() => setPhotoOpen(false)} role="dialog" aria-label="Photo">
          <img src={reviewing.raw.photo} alt={reviewing.requester} className="max-w-full max-h-full object-contain rounded-xl" />
          <button className="absolute top-5 right-5 text-white" aria-label="Close"><X className="w-6 h-6" /></button>
        </div>
      )}

      <PasswordConfirmModal
        open={!!ceoApproval}
        onClose={() => setCeoApproval(null)}
        title="Confirm Co-CEO Approval"
        description={ceoApproval ? `Approve ${ceoApproval.item.requester} as a co-CEO? They get the same powers as you. Type your password to confirm it is you.` : ''}
        confirmLabel="Approve co-CEO"
        onConfirm={async (password) => {
          if (!ceoApproval) return;
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) throw new Error('Not authenticated.');
          const res = await fetch('/api/approve-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ userId: ceoApproval.item.id, approve: true, remark: ceoApproval.note, password }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || 'Approval failed.');
          setCeoApproval(null);
          setRows(prev => prev.filter(r => r.id !== ceoApproval.item.id));
          addNotification(body.message || `${ceoApproval.item.requester} is now a co-CEO.`);
          load();
        }}
      />

      <RequestTimelinePanel
        open={!!timelineId}
        onClose={() => setTimelineId(null)}
        referenceId={timelineId || ''}
      />

      {/* Temp credentials after approving a registration */}
      <SidePanel
        open={!!credPopup}
        onClose={() => setCredPopup(null)}
        title="Account approved"
        footer={<button onClick={() => setCredPopup(null)} className="erp-btn erp-btn-ghost w-full">Close</button>}
      >
        {credPopup && (
          <>
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Share this temporary password with <strong className="text-[var(--text-primary)]">{credPopup.fullName}</strong>. They'll be asked to change it on first login.
            </p>
            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-emerald-500 font-mono break-all select-all">{credPopup.password}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(credPopup.password); addNotification('Password copied to clipboard'); }}
                className="shrink-0 px-2.5 py-1.5 text-[10px] font-semibold bg-[var(--accent-light)] text-[var(--accent)] rounded-lg cursor-pointer hover:opacity-90">
                Copy
              </button>
            </div>
          </>
        )}
      </SidePanel>
    </div>
  );
}
