import { X, Download } from 'lucide-react';

interface Field {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeStyle?: { background: string; color: string };
  fields: Field[];
  onClose: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onDownloadPdf?: () => void;
}

export default function EntityDetailPanel({ title, subtitle, badgeText, badgeStyle, fields, onClose, actions, children, onDownloadPdf }: Props) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 520, border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
              {badgeText && badgeStyle && (
                <span style={{ ...badgeStyle, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{badgeText}</span>
              )}
            </div>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {onDownloadPdf && (
              <button onClick={onDownloadPdf} title="Download PDF" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4, borderRadius: 8 }}>
                <Download size={18} />
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 8 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: children || actions ? '1.25rem' : 0 }}>
          {fields.map((f, i) => (
            <div key={i} style={{ background: 'var(--bg)', borderRadius: 10, padding: '0.625rem 0.875rem', border: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{f.label}</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: f.highlight ? 700 : 500, color: f.highlight ? 'var(--accent)' : 'var(--text-primary)', wordBreak: 'break-word' }}>
                {f.value !== null && f.value !== undefined && f.value !== '' ? String(f.value) : '—'}
              </p>
            </div>
          ))}
        </div>

        {/* Optional extra content */}
        {children && <div style={{ marginBottom: actions ? '1rem' : 0 }}>{children}</div>}

        {/* Actions */}
        {actions && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
