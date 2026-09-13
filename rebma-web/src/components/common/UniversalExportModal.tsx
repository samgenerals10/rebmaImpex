// rebma-web/src/components/common/UniversalExportModal.tsx
// ── Universal Branded Export Modal ────────────────────────────
// Drop this beside any table. Pass `data`, `columns`, and a `title`; the
// modal handles format selection (PDF / CSV / DOC), live preview (with the
// same REBMA letterhead/watermark used on Receipts & Dispatch Tickets), and
// the actual download. No backend changes — pure client-side.
//
// Usage:
//   const [exportOpen, setExportOpen] = useState(false);
//   <ExportButton onClick={() => setExportOpen(true)} />
//   <UniversalExportModal
//     open={exportOpen}
//     onClose={() => setExportOpen(false)}
//     title="Sales History"
//     data={filteredRows}
//     columns={[{ key: 'clientName', label: 'Client' }, ...]}
//   />

import { useEffect, useRef, useState } from 'react';
import { X, Download, FileText, Sheet, FileType } from 'lucide-react';
import {
  exportToCSV,
  exportToPDFWithWatermark,
  exportToDOC,
} from '../../utils/export';
import { documentTemplates, type DocumentTemplate } from '../../services/apiClient';

const BRAND = { green: '#1a5c32', blue: '#29a9dc', lime: '#7fc241' };

export interface ExportColumn {
  key: string;
  label: string;
  /** Optional value formatter for export cells */
  render?: (row: any) => string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Array of data objects to export */
  data: any[];
  /** Column definitions — key must match a property on each data object */
  columns: ExportColumn[];
  /** Optional subtitle shown under the table title in letterhead */
  subtitle?: string;
}

type Format = 'pdf' | 'csv' | 'doc';

const FORMAT_META: Record<Format, { label: string; icon: typeof FileText; ext: string; color: string }> = {
  pdf: { label: 'PDF', icon: FileText, ext: '.pdf', color: '#ef4444' },
  csv: { label: 'CSV / Excel', icon: Sheet, ext: '.csv', color: '#16a34a' },
  doc: { label: 'Word DOC', icon: FileType, ext: '.docx', color: '#2563eb' },
};

function cellText(col: ExportColumn, row: any): string {
  if (col.render) return col.render(row);
  const v = row[col.key];
  if (v === undefined || v === null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

export default function UniversalExportModal({ open, onClose, title, data, columns, subtitle }: Props) {
  const [format, setFormat] = useState<Format>('pdf');
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load the document template (shared with Receipts / Invoices)
  useEffect(() => {
    if (!open) return;
    documentTemplates.get('RECEIPT').then(setTemplate).catch(() => setTemplate(null));
  }, [open]);

  if (!open) return null;

  const t = template ?? {
    companyName: 'REBMA IMPEX',
    subtitle: 'Enterprise Resource Planning',
    companyAddress: 'Accra Business District, Accra, Ghana',
    companyPhone: '',
    companyEmail: '',
    website: 'rebmaimpex.com',
    footerNote: 'REBMA IMPEX Ghana Limited Enterprise Resource Planning. This document is system-generated and confidential.',
    logoUrl: '/logo.png',
  } as DocumentTemplate;

  const logoSrc = t.logoUrl.startsWith('http') || t.logoUrl.startsWith('data:')
    ? t.logoUrl
    : window.location.origin + t.logoUrl;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Preview Table rows (capped at 12 for the modal) ──────────
  const previewRows = data.slice(0, 12);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const fileName = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'report';
      const headers = columns.map(c => c.label);
      const rows = data.map(row => {
        const obj: Record<string, string> = {};
        columns.forEach(c => { obj[c.label] = cellText(c, row); });
        return obj;
      });

      if (format === 'csv') {
        exportToCSV(rows, headers, fileName);
      } else if (format === 'pdf') {
        await exportToPDFWithWatermark(title, data, columns, t);
      } else {
        exportToDOC(title, data, columns, t);
      }
      onClose();
    } finally {
      setDownloading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#fff' }}
      >
        {/* ── Modal Header ───────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: `linear-gradient(135deg, ${BRAND.green}, #2d7a50)` }}
        >
          <div>
            <h2 className="text-white font-bold text-lg tracking-tight">Export Preview</h2>
            <p className="text-white/70 text-xs mt-0.5">{title} · {data.length} record{data.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Format Selector ─────────────────────────────── */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Format:</span>
          {(Object.keys(FORMAT_META) as Format[]).map(fmt => {
            const meta = FORMAT_META[fmt];
            const Icon = meta.icon;
            const active = fmt === format;
            return (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer"
                style={{
                  background: active ? meta.color : 'transparent',
                  color: active ? '#fff' : '#475569',
                  borderColor: active ? meta.color : '#e2e8f0',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </button>
            );
          })}
          <span className="ml-auto text-[10px] text-gray-400">
            Preview shows first 12 rows · Download exports all {data.length}
          </span>
        </div>

        {/* ── Live Preview ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-[#e8f0f4] p-4" ref={previewRef}>
          {/* Document preview card */}
          <div
            className="mx-auto rounded-xl overflow-hidden shadow-lg"
            style={{ background: '#fff', maxWidth: 760, position: 'relative' }}
          >
            {/* Diagonal watermark */}
            <div
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%) rotate(-30deg)',
                fontSize: 56, fontWeight: 900, color: 'rgba(26,92,50,0.045)',
                whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 0,
                letterSpacing: 4, fontStyle: 'italic', fontFamily: 'sans-serif',
              }}
            >
              REBMA IMPEX
            </div>

            {/* Top gradient stripe */}
            <div style={{ height: 6, background: `linear-gradient(90deg,${BRAND.green},${BRAND.blue},${BRAND.lime})` }} />

            {/* Letterhead */}
            <div style={{ position: 'relative', zIndex: 1, padding: '20px 28px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={logoSrc} alt={t.companyName} style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: BRAND.green, letterSpacing: 0.5 }}>{t.companyName}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: BRAND.blue, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>{t.subtitle || 'Official Report'}</div>
                    <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>
                      {t.companyAddress}{t.companyPhone ? ` · Tel: ${t.companyPhone}` : ''}{t.companyEmail ? ` · ${t.companyEmail}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', marginBottom: 3 }}>Report</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: BRAND.green }}>{title}</div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>{dateStr} {timeStr}</div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1.5, background: `linear-gradient(90deg,${BRAND.green},${BRAND.blue},transparent)`, marginBottom: 16, borderRadius: 99 }} />

              {/* Table */}
              {format === 'csv' ? (
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569', background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 16, overflowX: 'auto' }}>
                  <div style={{ color: BRAND.green, fontWeight: 700, marginBottom: 4 }}>CSV Preview (comma-separated)</div>
                  <div style={{ color: '#94a3b8' }}>{columns.map(c => `"${c.label}"`).join(',')}</div>
                  {previewRows.slice(0, 5).map((row, i) => (
                    <div key={i} style={{ color: '#334155' }}>
                      {columns.map(c => `"${cellText(c, row).replace(/"/g, '""')}"`).join(',')}
                    </div>
                  ))}
                  {data.length > 5 && <div style={{ color: '#94a3b8', marginTop: 4 }}>... and {data.length - 5} more rows</div>}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ background: '#f0fdf4' }}>
                        <th style={{ padding: '7px 10px', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: BRAND.green, textAlign: 'left', borderBottom: `1.5px solid rgba(22,101,52,0.18)` }}>#</th>
                        {columns.map(col => (
                          <th key={col.key} style={{ padding: '7px 10px', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: BRAND.green, textAlign: 'left', borderBottom: `1.5px solid rgba(22,101,52,0.18)` }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '6px 10px', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', fontSize: 9 }}>{i + 1}</td>
                          {columns.map(col => (
                            <td key={col.key} style={{ padding: '6px 10px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cellText(col, row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {data.length > 12 && (
                        <tr>
                          <td colSpan={columns.length + 1} style={{ padding: '8px 10px', color: '#94a3b8', fontStyle: 'italic', fontSize: 9, textAlign: 'center' }}>
                            … {data.length - 12} more rows will be included in the download
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div style={{ borderTop: '1px solid #e2e8f0', padding: '10px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#94a3b8', lineHeight: 1.8, maxWidth: 420 }}>
                  {t.footerNote}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: BRAND.green }}>{t.website}</div>
                  <div style={{ fontSize: 7.5, color: '#94a3b8', marginTop: 2 }}>
                    {t.companyName} · {dateStr}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom stripe */}
            <div style={{ height: 4, background: `linear-gradient(90deg,${BRAND.green},${BRAND.blue},${BRAND.lime})` }} />
          </div>
        </div>

        {/* ── Action Bar ──────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0 bg-white">
          <p className="text-xs text-gray-400">
            Will download as <span className="font-semibold text-gray-600">{title}{FORMAT_META[format].ext}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${BRAND.green}, #2d7a50)` }}
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Preparing…' : `Download ${FORMAT_META[format].label}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Convenience trigger button ─────────────────────────────────
// Replaces the existing plain "Export CSV" / "Export PDF" buttons with a
// single styled button that opens the modal.
interface ExportButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function ExportButton({ onClick, label = 'Export', className = '' }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer shrink-0 ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
