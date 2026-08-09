// rebma-web/src/views/management/DocumentTemplatesView.tsx
// CEO-only control over the header and footer printed on every receipt,
// dispatch ticket, and proforma invoice. Finance/Operations/Marketing/
// Management view and issue these documents but don't edit them — this
// page is the one place that does. Saved once per document type, applied to
// every document of that type from then on (not per-transaction). The
// per-transaction content — customer, amounts, line items, who issued it,
// the document number, the QR code — is system-generated and untouched here.
import { useState, useEffect, useRef } from 'react';
import { Receipt, Ticket, FileText, Save, Image as ImageIcon, Upload, X, Loader2, MapPin } from 'lucide-react';
import { documentTemplates, type DocumentTemplate } from '../../services/apiClient';
import { uploadFile } from '../../utils/uploadFile';
import DestinationLocator from '../../components/dispatch/DestinationLocator';

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
  // Set when embedded inside another settings page (CEO Control Center)
  // that already provides its own section heading — skips this component's
  // own "Document Templates" title/description so it isn't shown twice.
  hideHeader?: boolean;
}

const TABS: { key: DocumentTemplate['docType']; label: string; icon: typeof Receipt }[] = [
  { key: 'RECEIPT', label: 'Receipt', icon: Receipt },
  { key: 'TICKET', label: 'Dispatch Ticket', icon: Ticket },
  { key: 'INVOICE', label: 'Proforma Invoice', icon: FileText },
];

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';
const labelCls = 'text-xs font-semibold text-[var(--text-secondary)] mb-1 block';

export default function DocumentTemplatesView({ addNotification, currentUser, hideHeader = false }: Props) {
  const [activeTab, setActiveTab] = useState<DocumentTemplate['docType']>('RECEIPT');
  const [templates, setTemplates] = useState<Record<DocumentTemplate['docType'], DocumentTemplate> | null>(null);
  const [drafts, setDrafts] = useState<Record<DocumentTemplate['docType'], DocumentTemplate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await documentTemplates.getAll();
      setTemplates(all);
      setDrafts(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const draft = drafts?.[activeTab];
  const saved = templates?.[activeTab];
  const dirty = draft && saved && JSON.stringify(draft) !== JSON.stringify(saved);

  const setField = (key: keyof DocumentTemplate, value: string | number | null) => {
    setDrafts(prev => prev ? { ...prev, [activeTab]: { ...prev[activeTab], [key]: value } } : prev);
  };

  const setCompanyPin = (coords: { lat: number; lng: number } | null) => {
    setDrafts(prev => prev ? {
      ...prev,
      [activeTab]: { ...prev[activeTab], companyLat: coords?.lat ?? null, companyLng: coords?.lng ?? null }
    } : prev);
  };

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFile(file, 'document-logos', activeTab);
      if (url) {
        setField('logoUrl', url);
      } else {
        addNotification?.('Failed to upload logo.');
      }
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      await documentTemplates.update(draft, currentUser?.fullName || 'Management');
      setTemplates(prev => prev ? { ...prev, [activeTab]: draft } : prev);
      addNotification?.(`${TABS.find(t => t.key === activeTab)?.label} template saved.`);
    } catch (e: any) {
      addNotification?.(e.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading document templates…</div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {!hideHeader && (
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Document Templates</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Control the header and footer printed on every receipt, dispatch ticket, and proforma invoice.
            Changes apply to every document of that type going forward — Finance, Operations, and Management can view and issue these documents but not edit them.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-1.5 w-fit">
        {TABS.map(t => {
          const isActive = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${isActive ? 'text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'}`}
              style={isActive ? { background: 'var(--accent)' } : undefined}>
              <t.icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Edit form */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Header</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Logo</label>
                <div className="flex items-center gap-3">
                  {draft.logoUrl ? (
                    <img src={draft.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-white border border-[var(--border)]" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] flex items-center justify-center">
                      <ImageIcon size={16} className="text-[var(--text-muted)]" />
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => handleLogoFile(e.target.files?.[0])} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer disabled:opacity-50">
                    {uploadingLogo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploadingLogo ? 'Uploading…' : draft.logoUrl ? 'Replace' : 'Upload Image'}
                  </button>
                  {draft.logoUrl && (
                    <button type="button" onClick={() => setField('logoUrl', '')}
                      className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-500/10 cursor-pointer">
                      <X size={13} /> Remove
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Company Name</label>
                <input className={inputCls} value={draft.companyName} onChange={e => setField('companyName', e.target.value)} placeholder="REBMA IMPEX" />
              </div>
              <div>
                <label className={labelCls}>Document Subtitle</label>
                <input className={inputCls} value={draft.subtitle} onChange={e => setField('subtitle', e.target.value)} placeholder="e.g. Official Payment Receipt" />
              </div>
              <div>
                <label className={labelCls}>Company Address</label>
                <DestinationLocator
                  value={draft.companyAddress}
                  onChange={text => setField('companyAddress', text)}
                  onResolve={setCompanyPin}
                  placeholder="Accra Business District, Accra, Ghana"
                />
                <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${draft.companyLat != null ? 'text-emerald-600' : 'text-[var(--text-muted)]'}`}>
                  <MapPin size={11} />
                  {draft.companyLat != null
                    ? `Pinned at ${draft.companyLat.toFixed(5)}, ${draft.companyLng?.toFixed(5)}`
                    : 'Not pinned yet — click the locate icon or the map to drop an exact pin'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Company Phone</label>
                  <input className={inputCls} value={draft.companyPhone} onChange={e => setField('companyPhone', e.target.value)} placeholder="+233 (0) 302 000 000" />
                </div>
                <div>
                  <label className={labelCls}>Company Email</label>
                  <input className={inputCls} value={draft.companyEmail} onChange={e => setField('companyEmail', e.target.value)} placeholder="info@rebmaimpex.com" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input className={inputCls} value={draft.website} onChange={e => setField('website', e.target.value)} placeholder="rebmaimpex.com" />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1 mt-3">Footer Note</h3>
            <p className="text-[11px] text-[var(--text-muted)] mb-2">
              The document number, QR code, and who issued it are always added automatically below this note — they aren't part of what you edit here.
            </p>
            <textarea className={inputCls} rows={5} value={draft.footerNote} onChange={e => setField('footerNote', e.target.value)}
              placeholder="e.g. This receipt is issued by REBMA IMPEX Ghana Limited Finance..." />
          </div>

          <button onClick={handleSave} disabled={!dirty || saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)' }}>
            <Save size={15} /> {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>

        {/* Live preview */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Preview</h3>
          <div className="rounded-xl overflow-hidden border border-[var(--border)]">
            <div style={{ height: 6, background: 'linear-gradient(90deg,#1a5c32,#29a9dc,#7fc241)' }} />
            <div className="bg-white p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  {draft.logoUrl ? (
                    <img src={draft.logoUrl} alt="Logo" className="w-10 h-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><ImageIcon size={16} className="text-slate-400" /></div>
                  )}
                  <div>
                    <div className="font-black text-[#1a5c32] text-sm leading-tight">{draft.companyName || 'REBMA IMPEX'}</div>
                    <div className="text-[9px] font-bold text-[#29a9dc] uppercase tracking-wide">{draft.subtitle || '—'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-slate-400 uppercase tracking-wide">Document No.</div>
                  <div className="text-sm font-black text-[#1a5c32]">XXX-00000</div>
                </div>
              </div>
              <div className="text-[9px] text-slate-500 mb-4 leading-relaxed">
                {draft.companyAddress}{draft.companyPhone ? ` · Tel: ${draft.companyPhone}` : ''}{draft.companyEmail ? ` · ${draft.companyEmail}` : ''}
              </div>
              <div className="border-t border-dashed border-slate-200 pt-3">
                <p className="text-[9px] text-slate-400 leading-relaxed">{draft.footerNote || '—'}</p>
                <p className="text-[8px] text-slate-300 mt-2 italic">+ document number, QR code, issued-by (added automatically)</p>
              </div>
              <div className="flex items-center justify-between mt-4 pt-2 border-t border-slate-100 text-[8px] text-slate-400">
                <span>{draft.companyName} Ghana Limited · Document No. · Date</span>
                <span className="font-bold text-[#1a5c32]">{draft.website}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
