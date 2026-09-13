// rebma-web/src/views/risk/RecruitmentView.tsx
//
// Phase 8 — Risk sees the full candidate record HR saves, not a summary.
// Reads staff_invites directly (RLS: staff_invites_select_risk grants
// this role read access, additive to the existing HR/admin policy).
// Photo and résumé are both clickable here, same as they already are on
// HR's own Staff screen — the user asked for both, in both places.
import { useEffect, useState } from 'react';
import { UserPlus, FileText, ExternalLink, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getSignedFileUrl } from '../../utils/uploadFile';

interface Invite {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  photo: string | null;
  resume_url: string | null;
  address: string | null;
  staff_category: string | null;
  guarantor_name: string | null;
  guarantor_phone: string | null;
  guarantor_relationship: string | null;
  guarantor_id_number: string | null;
  guarantor_address: string | null;
  status: string;
  sent_via: string[] | null;
  created_at: string;
  created_by: string | null;
}

interface Props {
  addNotification?: (msg: string) => void;
}

export default function RiskRecruitmentView({ addNotification }: Props) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invite | null>(null);

  useEffect(() => {
    supabase.from('staff_invites').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { addNotification?.(`Could not load recruitment records: ${error.message}`); }
        else { setInvites(data || []); }
        setLoading(false);
      });
  }, []);

  const viewResume = async (path: string) => {
    const url = await getSignedFileUrl('staff-resumes', path);
    if (!url) { addNotification?.('Could not open résumé — it may have been removed.'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (selected) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem', fontSize: 14 }}>
          ← Back to Recruitment
        </button>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.25rem' }}>
            {selected.photo ? (
              <img src={selected.photo} alt={selected.full_name} onClick={() => window.open(selected.photo!, '_blank', 'noopener,noreferrer')}
                title="Click to view full size"
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
                {selected.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <div>
              <h2 style={{ margin: '0 0 4px', color: 'var(--text-primary)' }}>{selected.full_name}</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>{selected.role || selected.department} · {selected.department}</p>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: selected.status === 'used' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: selected.status === 'used' ? '#10b981' : '#f59e0b' }}>
                {selected.status === 'used' ? 'Registered' : 'Pending'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              ['Email', selected.email], ['Phone', selected.phone], ['Address', selected.address],
              ['Staff Category', selected.staff_category], ['Entered By', selected.created_by],
              ['Date', new Date(selected.created_at).toLocaleDateString()],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bg)', borderRadius: 8, padding: '0.75rem', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{v}</div>
              </div>
            ))}
          </div>

          {selected.resume_url && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}><FileText size={16} /> Résumé / CV</span>
              <button onClick={() => viewResume(selected.resume_url!)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                View <ExternalLink size={11} />
              </button>
            </div>
          )}

          {(selected.guarantor_name || selected.guarantor_phone) && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Guarantee Information</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: 12 }}>
                {[['Name', selected.guarantor_name], ['Phone', selected.guarantor_phone], ['Relationship', selected.guarantor_relationship], ['ID Number', selected.guarantor_id_number]]
                  .filter(([, v]) => v).map(([k, v]) => (
                    <div key={k}><span style={{ color: 'var(--text-muted)' }}>{k}: </span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span></div>
                  ))}
                {selected.guarantor_address && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Address: </span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selected.guarantor_address}</span></div>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        <UserPlus size={20} /> Recruitment
      </h2>
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : invites.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No candidate records yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {invites.map(inv => (
            <button key={inv.id} onClick={() => setSelected(inv)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', cursor: 'pointer' }}>
              {inv.photo ? (
                <img src={inv.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  {inv.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{inv.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.role || inv.department} · {inv.department}</div>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                <Clock size={11} /> {new Date(inv.created_at).toLocaleDateString()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: inv.status === 'used' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: inv.status === 'used' ? '#10b981' : '#f59e0b' }}>
                {inv.status === 'used' ? 'Registered' : 'Pending'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
