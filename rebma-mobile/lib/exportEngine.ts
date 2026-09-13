// rebma-mobile/lib/exportEngine.ts
//
// Gap-Closure Backlog, Item 1 (D99-D105). Mirrors rebma-web/src/utils/export.ts
// (legacy exportToCSV/exportToPDF/downloadRowPDF) and
// rebma-web/src/components/common/UniversalExportModal.tsx (branded
// exportToPDFWithWatermark/exportToDOC) — the MECHANISM only. Every screen
// supplies its own ExportColumn[] definition and already-filtered data,
// exactly matching its web source's columns/labels/ordering/formatting —
// this file never assumes uniform content across screens (see the plan's
// D99-D101 for why web itself has two different letterhead styles and two
// different format sets, both preserved here, not merged).
//
// CSV escaping is a byte-for-byte port of exportToCSV (utils/export.ts:23-44).
// The legacy letterhead is a byte-for-byte port of drawLetterhead()
// (utils/export.ts:62-78) — including the literal "REMBA IMPEX GHANA
// LIMITED" typo in the real web source, preserved deliberately, not fixed.
// The branded letterhead matches exportToPDFWithWatermark's visual
// (gradient stripe, diagonal watermark, dynamic document_templates data),
// always reading the 'RECEIPT' doc type regardless of what's being
// exported — same quirk as UniversalExportModal.tsx:73.
//
// exportToDOC on web is confirmed (by direct read) to be the SAME branded
// HTML as the PDF path, just written with a .doc extension/MIME so Word/
// LibreOffice open it via the mso-application trick — no jsPDF involved.
// exportDoc() below reuses the identical renderDocumentHtml() output for
// exactly that reason (D103).
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabaseClient';

export interface ExportColumn {
  key: string;
  label: string;
  render?: (row: any) => string;
}

export type ExportFormat = 'csv' | 'pdf' | 'doc';
export type Letterhead = 'legacy' | 'branded';

export interface DocTemplate {
  logoUrl: string;
  companyName: string;
  subtitle: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  website: string;
  footerNote: string;
}

const FALLBACK_TEMPLATE: DocTemplate = {
  logoUrl: '',
  companyName: 'REBMA IMPEX',
  subtitle: 'Enterprise Resource Planning',
  companyAddress: 'Accra Business District, Accra, Ghana',
  companyPhone: '',
  companyEmail: '',
  website: 'rebmaimpex.com',
  footerNote: 'REBMA IMPEX Ghana Limited Enterprise Resource Planning. This document is system-generated and confidential.',
};

// Matches UniversalExportModal.tsx:73 exactly — always the RECEIPT
// template regardless of what's being exported, not a per-doc-type lookup.
export async function fetchBrandedTemplate(): Promise<DocTemplate> {
  try {
    const { data } = await supabase.from('document_templates').select('*').eq('doc_type', 'RECEIPT').maybeSingle();
    if (!data) return FALLBACK_TEMPLATE;
    return {
      logoUrl: data.logo_url || FALLBACK_TEMPLATE.logoUrl,
      companyName: data.company_name || FALLBACK_TEMPLATE.companyName,
      subtitle: data.subtitle ?? FALLBACK_TEMPLATE.subtitle,
      companyAddress: data.company_address ?? FALLBACK_TEMPLATE.companyAddress,
      companyPhone: data.company_phone ?? FALLBACK_TEMPLATE.companyPhone,
      companyEmail: data.company_email ?? FALLBACK_TEMPLATE.companyEmail,
      website: data.website || FALLBACK_TEMPLATE.website,
      footerNote: data.footer_note ?? FALLBACK_TEMPLATE.footerNote,
    };
  } catch {
    return FALLBACK_TEMPLATE;
  }
}

function cellText(col: ExportColumn, row: any): string {
  if (col.render) return col.render(row);
  const v = row[col.key];
  if (v === undefined || v === null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function slugFileName(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── CSV — byte-for-byte port of exportToCSV's quoting/escaping ──────────
export function buildCsvString(columns: ExportColumn[], data: any[]): string {
  const rows: string[] = [];
  rows.push(columns.map((c) => `"${c.label.toUpperCase()}"`).join(','));
  for (const row of data) {
    rows.push(columns.map((c) => `"${cellText(c, row).replace(/"/g, '""')}"`).join(','));
  }
  return rows.join('\n');
}

// ── Legacy letterhead — verbatim from drawLetterhead(), typo included ───
function legacyLetterheadHtml(title: string): string {
  const now = new Date();
  return `
    <div style="height:3px;background:#0298d0;"></div>
    <div style="padding:14px 14px 8px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:16px;font-weight:700;color:#064e29;">REMBA IMPEX GHANA LIMITED</div>
        <div style="font-size:10px;color:#64748b;margin-top:3px;">${escapeHtml(title)} Report - Confidential Internal Document</div>
      </div>
      <div style="font-size:10px;color:#64748b;text-align:right;">Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</div>
    </div>
    <div style="height:0.5px;background:#0298d0;margin:0 14px;"></div>
  `;
}

function legacyFooterHtml(): string {
  return `<div style="margin-top:16px;padding:10px 14px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;text-align:center;">REMBA IMPEX GHANA LIMITED Enterprise Resource Planning. This document is system-generated and confidential.</div>`;
}

// ── Branded letterhead — matches exportToPDFWithWatermark's visual ──────
function brandedLetterheadHtml(title: string, t: DocTemplate, recordCount: number): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const addrLine = [t.companyAddress, t.companyPhone ? `Tel: ${t.companyPhone}` : '', t.companyEmail].filter(Boolean).join(' · ');
  return `
    <div style="height:6px;background:linear-gradient(90deg,#1a5c32,#29a9dc,#7fc241);"></div>
    <div style="padding:20px 28px 0;position:relative;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:56px;font-weight:900;color:rgba(26,92,50,0.045);white-space:nowrap;letter-spacing:4px;font-style:italic;">REBMA IMPEX</div>
      <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${t.logoUrl ? `<img src="${t.logoUrl}" style="width:48px;height:48px;object-fit:contain;flex-shrink:0;" />` : ''}
          <div>
            <div style="font-size:16px;font-weight:900;color:#1a5c32;letter-spacing:0.5px;">${escapeHtml(t.companyName)}</div>
            <div style="font-size:9px;font-weight:700;color:#29a9dc;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">${escapeHtml(t.subtitle || 'Official Report')}</div>
            <div style="font-size:9px;color:#64748b;margin-top:3px;">${escapeHtml(addrLine)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:3px;">Report</div>
          <div style="font-size:16px;font-weight:900;color:#1a5c32;">${escapeHtml(title)}</div>
          <div style="font-size:9px;color:#64748b;margin-top:3px;">${dateStr} ${timeStr}</div>
          <div style="font-size:9px;color:#64748b;">${recordCount} record${recordCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style="height:1.5px;background:linear-gradient(90deg,#1a5c32,#29a9dc,transparent);margin-bottom:16px;"></div>
    </div>
  `;
}

function brandedFooterHtml(t: DocTemplate): string {
  return `
    <div style="border-top:1px solid #e2e8f0;padding:10px 28px 16px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:7.5px;color:#94a3b8;line-height:1.8;max-width:420px;">${escapeHtml(t.footerNote)}</div>
      <div style="text-align:right;"><div style="font-size:9px;font-weight:700;color:#1a5c32;">${escapeHtml(t.website)}</div></div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#1a5c32,#29a9dc,#7fc241);"></div>
  `;
}

function tableBodyHtml(columns: ExportColumn[], data: any[]): string {
  const headerCells = columns
    .map((c) => `<th style="padding:7px 10px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#1a5c32;text-align:left;border-bottom:1.5px solid rgba(22,101,52,0.18);">${escapeHtml(c.label)}</th>`)
    .join('');
  const rows = data
    .map(
      (row, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'};">
      <td style="padding:6px 10px;color:#94a3b8;border-bottom:1px solid #f1f5f9;font-size:9px;">${idx + 1}</td>
      ${columns.map((c) => `<td style="padding:6px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9;font-size:9px;">${escapeHtml(cellText(c, row))}</td>`).join('')}
    </tr>`
    )
    .join('');
  return `
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f0fdf4;"><th style="padding:7px 10px;font-size:8px;font-weight:800;color:#1a5c32;">#</th>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// Single-record "Field / Value" table — mirrors downloadRowPDF.
function fieldValueBodyHtml(fields: Record<string, any>): string {
  const rows = Object.entries(fields)
    .map(
      ([k, v]) => `
    <tr>
      <td style="padding:6px 10px;font-weight:700;color:#1e293b;border-bottom:1px solid #f1f5f9;font-size:9px;width:40%;">${escapeHtml(k)}</td>
      <td style="padding:6px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9;font-size:9px;">${escapeHtml(v === undefined || v === null ? '' : String(v))}</td>
    </tr>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:7px 10px;font-size:8px;font-weight:800;color:#334155;text-align:left;">Field</th><th style="padding:7px 10px;font-size:8px;font-weight:800;color:#334155;text-align:left;">Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDocumentHtml(title: string, letterhead: Letterhead, template: DocTemplate | undefined, bodyHtml: string, recordCount: number): string {
  const head = letterhead === 'branded' && template ? brandedLetterheadHtml(title, template, recordCount) : legacyLetterheadHtml(title);
  const foot = letterhead === 'branded' && template ? brandedFooterHtml(template) : legacyFooterHtml();
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:0;}</style></head><body>${head}<div style="padding:0 28px;">${bodyHtml}</div>${foot}</body></html>`;
}

// ── Terminal steps ────────────────────────────────────────────────────

export async function exportCsv(columns: ExportColumn[], data: any[], title: string): Promise<void> {
  const csv = buildCsvString(columns, data);
  const file = new File(Paths.cache, `${slugFileName(title)}.csv`);
  file.create({ overwrite: true });
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: title });
}

async function exportPdf(title: string, html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

async function exportDoc(title: string, html: string): Promise<void> {
  const file = new File(Paths.cache, `${slugFileName(title)}.doc`);
  file.create({ overwrite: true });
  file.write(html);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/msword', UTI: 'com.microsoft.word.doc', dialogTitle: title });
}

export async function exportTableDocument(
  format: 'pdf' | 'doc',
  title: string,
  columns: ExportColumn[],
  data: any[],
  letterhead: Letterhead,
  template?: DocTemplate
): Promise<void> {
  const html = renderDocumentHtml(title, letterhead, template, tableBodyHtml(columns, data), data.length);
  if (format === 'pdf') await exportPdf(title, html);
  else await exportDoc(title, html);
}

export async function exportFieldValueDocument(
  format: 'pdf' | 'doc',
  title: string,
  fields: Record<string, any>,
  letterhead: Letterhead = 'legacy',
  template?: DocTemplate
): Promise<void> {
  const html = renderDocumentHtml(title, letterhead, template, fieldValueBodyHtml(fields), 1);
  if (format === 'pdf') await exportPdf(title, html);
  else await exportDoc(title, html);
}
