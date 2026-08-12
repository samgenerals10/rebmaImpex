import { Download } from 'lucide-react';
import SidePanel from '../ui/SidePanel';

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

// Same external contract as before this migration, so every existing call
// site (StockView, InvoicesView, ChequesView, LeaveManagementView,
// StatementView) keeps working unchanged. Only the internal container is
// now the shared SidePanel instead of its own centered-dialog boilerplate.
export default function EntityDetailPanel({ title, subtitle, badgeText, badgeStyle, fields, onClose, actions, children, onDownloadPdf }: Props) {
  return (
    <SidePanel
      open
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      badge={badgeText && badgeStyle ? (
        <span style={{ ...badgeStyle, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{badgeText}</span>
      ) : undefined}
      footer={
        (actions || onDownloadPdf) ? (
          <>
            {onDownloadPdf && (
              <button onClick={onDownloadPdf} className="erp-btn erp-btn-ghost">
                <Download size={14} /> PDF
              </button>
            )}
            {actions}
          </>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f, i) => (
          <div key={i} className="bg-[var(--bg-input)] rounded-xl px-3.5 py-2.5 border border-[var(--border)]">
            <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wide mb-0.5">{f.label}</p>
            <p className={`text-sm break-words ${f.highlight ? 'font-bold text-[var(--accent)]' : 'font-medium text-[var(--text-primary)]'}`}>
              {f.value !== null && f.value !== undefined && f.value !== '' ? String(f.value) : '—'}
            </p>
          </div>
        ))}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </SidePanel>
  );
}
