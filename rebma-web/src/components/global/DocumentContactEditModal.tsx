// rebma-web/src/components/global/DocumentContactEditModal.tsx
// Shared "edit before printing" modal for receipts, dispatch tickets, and
// proforma invoices — lets Finance/Operations/Marketing correct or fill in
// the customer's and the company's contact details on an already-generated
// document before it's sent or printed. Who issued it (name/email) is shown
// read-only: that's a system-recorded fact about the original approval, not
// something an editor should be able to overwrite.
import { useState } from 'react';
import { X, Save } from 'lucide-react';

export interface DocumentContactInfo {
  customerPhone: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
}

interface Props {
  title: string;
  documentLabel: string; // e.g. "TKT-18371" or "RCP-48213"
  initial: DocumentContactInfo;
  issuedByName: string;
  issuedByEmail?: string;
  department: string;
  saving?: boolean;
  onSave: (info: DocumentContactInfo) => void;
  onClose: () => void;
}

const field: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5,
};

export default function DocumentContactEditModal({
  title, documentLabel, initial, issuedByName, issuedByEmail, department, saving, onSave, onClose,
}: Props) {
  const [form, setForm] = useState<DocumentContactInfo>(initial);
  const set = (k: keyof DocumentContactInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 480, border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{documentLabel}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Issued By (system-recorded)</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{issuedByName}{issuedByEmail ? ` · ${issuedByEmail}` : ''}</div>
          <div>{department}</div>
        </div>

        <div style={{ display: 'grid', gap: 12, marginBottom: 4 }}>
          <div>
            <label style={label}>Customer Phone</label>
            <input style={field} value={form.customerPhone} onChange={set('customerPhone')} placeholder="e.g. +233 24 123 4567" />
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <div>
            <label style={label}>Company Phone</label>
            <input style={field} value={form.companyPhone} onChange={set('companyPhone')} placeholder="e.g. +233 30 200 0000" />
          </div>
          <div>
            <label style={label}>Company Email</label>
            <input style={field} value={form.companyEmail} onChange={set('companyEmail')} placeholder="e.g. info@rebmaimpex.com" />
          </div>
          <div>
            <label style={label}>Company Address</label>
            <input style={field} value={form.companyAddress} onChange={set('companyAddress')} placeholder="e.g. Accra Business District, Accra, Ghana" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={saving}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_COMPANY_CONTACT: Pick<DocumentContactInfo, 'companyPhone' | 'companyEmail' | 'companyAddress'> = {
  companyPhone: '+233 (0) 302 000 000',
  companyEmail: 'info@rebmaimpex.com',
  companyAddress: 'Accra Business District, Accra, Ghana',
};
