// rebma-web/src/utils/export.ts
// ── Shared export helpers ─────────────────────────────────────
// Used by: UniversalExportModal, individual table views.
// Formats: CSV (legacy + modal), PDF with REBMA watermark/letterhead, DOC.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentTemplate } from '../services/apiClient';
import type { ExportColumn } from '../components/common/UniversalExportModal';

const BRAND = { green: [26, 92, 50] as [number, number, number], blue: [41, 169, 220] as [number, number, number], lime: [127, 194, 65] as [number, number, number] };

// ── Display name safety ────────────────────────────────────────
// Profiles with no full_name on file fall back to the raw email elsewhere in
// the app, which can silently leak into printed fields. Never let a bare
// email reach a name shown on paper — it confuses iOS's QR reader.
export function safeDisplayName(name: string | null | undefined, fallback: string): string {
  if (!name || !name.trim()) return fallback;
  return name.includes('@') ? fallback : name;
}

// ── CSV export (unchanged — all call-sites work) ──────────────
export const exportToCSV = (data: any[], headers: string[], fileName: string) => {
  const csvRows: string[] = [];
  csvRows.push(headers.map(h => `"${h.toUpperCase()}"`).join(','));
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] !== undefined && row[header] !== null ? row[header] : '';
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${strVal.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ── Internal helpers ───────────────────────────────────────────
function slugFileName(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
}

function cellText(val: any): string {
  if (val === undefined || val === null) return '';
  return typeof val === 'object' ? JSON.stringify(val) : String(val);
}

function colCellText(col: ExportColumn, row: any): string {
  if (col.render) return col.render(row);
  return cellText(row[col.key]);
}

// ── Branded letterhead (legacy, used by exportToPDF / downloadRowPDF) ──
function drawLetterhead(doc: jsPDF, title: string) {
  doc.setFillColor(2, 152, 208);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 3, 'F');
  doc.setFontSize(16);
  doc.setTextColor(6, 78, 41);
  doc.setFont('helvetica', 'bold');
  doc.text('REMBA IMPEX GHANA LIMITED', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`${title} Report - Confidential Internal Document`, 14, 25);
  const now = new Date();
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, doc.internal.pageSize.getWidth() - 14, 18, { align: 'right' });
  doc.setDrawColor(2, 152, 208);
  doc.setLineWidth(0.5);
  doc.line(14, 30, doc.internal.pageSize.getWidth() - 14, 30);
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'REMBA IMPEX GHANA LIMITED Enterprise Resource Planning. This document is system-generated and confidential.',
      doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' }
    );
  }
}

// ── Legacy PDF export (preserved — call-sites still work) ─────
export const exportToPDF = (title: string, data: any[], headers: string[]) => {
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
  drawLetterhead(doc, title);
  autoTable(doc, {
    startY: 36,
    head: [headers.map(h => h.replace(/([A-Z])/g, ' $1').trim())],
    body: data.map(row => headers.map(h => cellText(row[h]))),
    headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  drawFooter(doc);
  doc.save(`${slugFileName(title)}.pdf`);
};

// ── Legacy single-record PDF ───────────────────────────────────
export const downloadRowPDF = (title: string, fields: Record<string, any>) => {
  const doc = new jsPDF();
  drawLetterhead(doc, title);
  autoTable(doc, {
    startY: 36,
    head: [['Field', 'Value']],
    body: Object.entries(fields).map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').trim(), cellText(v)]),
    headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });
  drawFooter(doc);
  doc.save(`${slugFileName(title)}.pdf`);
};

// ── NEW: Branded PDF with dynamic template + diagonal watermark ─
// Used by UniversalExportModal when the user picks "PDF".
export async function exportToPDFWithWatermark(
  title: string,
  data: any[],
  columns: ExportColumn[],
  template: DocumentTemplate
) {
  const landscape = columns.length > 6;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait' });
  const W = doc.internal.pageSize.getWidth();

  const t = template;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Try loading logo as base64 data URL
  let logoDataUrl: string | null = null;
  try {
    const logoSrc = t.logoUrl.startsWith('http') || t.logoUrl.startsWith('data:')
      ? t.logoUrl
      : window.location.origin + t.logoUrl;
    const resp = await fetch(logoSrc);
    const blob = await resp.blob();
    logoDataUrl = await new Promise<string>(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch { logoDataUrl = null; }

  // ── Draw letterhead ──────────────────────────────────────────
  // Top gradient stripe (simulated with two rects)
  doc.setFillColor(...BRAND.green); doc.rect(0, 0, W * 0.4, 3, 'F');
  doc.setFillColor(...BRAND.blue); doc.rect(W * 0.4, 0, W * 0.35, 3, 'F');
  doc.setFillColor(...BRAND.lime); doc.rect(W * 0.75, 0, W * 0.25, 3, 'F');

  let y = 10;

  // Logo
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', 14, y, 16, 16); } catch { /* skip */ }
  }

  // Company name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.green);
  doc.text(t.companyName, logoDataUrl ? 34 : 14, y + 6);

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND.blue);
  doc.text((t.subtitle || 'Official Report').toUpperCase(), logoDataUrl ? 34 : 14, y + 12);

  // Address
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const addrLine = [t.companyAddress, t.companyPhone ? `Tel: ${t.companyPhone}` : '', t.companyEmail].filter(Boolean).join(' · ');
  doc.text(addrLine, logoDataUrl ? 34 : 14, y + 17);

  // Report title (right-aligned)
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.green);
  doc.text(title, W - 14, y + 6, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${dateStr} ${timeStr}`, W - 14, y + 12, { align: 'right' });
  doc.text(`${data.length} record${data.length !== 1 ? 's' : ''}`, W - 14, y + 17, { align: 'right' });

  y += 22;

  // Divider
  doc.setDrawColor(...BRAND.green);
  doc.setLineWidth(0.4);
  doc.line(14, y, W - 14, y);
  y += 4;

  // ── Table ────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [columns.map(c => c.label)],
    body: data.map((row, idx) => [String(idx + 1), ...columns.map(c => colCellText(c, row))]),
    headStyles: {
      fillColor: [240, 253, 244] as [number, number, number],
      textColor: BRAND.green,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    styles: { fontSize: 7.5, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    columnStyles: { 0: { cellWidth: 8, textColor: [148, 163, 184] as [number, number, number] } },
    didDrawPage: (hookData) => {
      // Watermark on every page
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      doc.saveGraphicsState?.();
      doc.setFontSize(48);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 92, 50);
      // Use GState for opacity if available; fallback to very light colour
      try {
        // @ts-ignore — jsPDF internal
        const gs = new doc.GState({ opacity: 0.04 });
        // @ts-ignore
        doc.setGState(gs);
      } catch { doc.setTextColor(230, 240, 234); }
      doc.text('REBMA IMPEX', pageW / 2, pageH / 2, {
        align: 'center', angle: 30
      });
      doc.restoreGraphicsState?.();
      doc.setTextColor(0, 0, 0);

      // Page number
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${hookData.pageNumber}`, pageW - 14, pageH - 8, { align: 'right' });
    },
  });

  // ── Footer on all pages ──────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pH = doc.internal.pageSize.getHeight();
    const pW = doc.internal.pageSize.getWidth();

    // Footer gradient line
    doc.setDrawColor(...BRAND.green);
    doc.setLineWidth(0.3);
    doc.line(14, pH - 14, pW - 14, pH - 14);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(t.footerNote || `${t.companyName} Ghana Limited — Confidential`, pW / 2, pH - 8, { align: 'center' });
    doc.setTextColor(...BRAND.green);
    doc.text(t.website || 'rebmaimpex.com', 14, pH - 8);
  }

  doc.save(`${slugFileName(title)}.pdf`);
}

// ── NEW: Word DOC export ──────────────────────────────────────
// Generates a standalone .docx-compatible HTML file that Word/LibreOffice
// opens natively. No server dependency — pure blob download.
export function exportToDOC(
  title: string,
  data: any[],
  columns: ExportColumn[],
  template: DocumentTemplate
) {
  const t = template;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const logoSrc = t.logoUrl.startsWith('http') || t.logoUrl.startsWith('data:')
    ? t.logoUrl
    : window.location.origin + t.logoUrl;

  const addrLine = [t.companyAddress, t.companyPhone ? `Tel: ${t.companyPhone}` : '', t.companyEmail].filter(Boolean).join(' · ');

  const tableRows = data.map((row, idx) => `
    <tr style="${idx % 2 === 0 ? 'background:#fff' : 'background:#f8fafc'}">
      <td style="padding:5px 8px;color:#94a3b8;font-size:9pt;border-bottom:1px solid #f1f5f9">${idx + 1}</td>
      ${columns.map(col => `<td style="padding:5px 8px;font-size:9pt;color:#1e293b;border-bottom:1px solid #f1f5f9">${colCellText(col, row).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}
    </tr>`).join('');

  const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<meta name="ProgId" content="Word.Document"/>
<title>${title} — ${t.companyName}</title>
<style>
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; margin: 0; padding: 0; }
  .page { max-width: 900px; margin: 32px auto; padding: 0 32px 32px; }
  .stripe { height: 6px; background: linear-gradient(90deg,#1a5c32,#29a9dc,#7fc241); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 0 12px; }
  .brand-name { font-size: 18pt; font-weight: 900; color: #1a5c32; }
  .brand-sub { font-size: 8pt; font-weight: 700; color: #29a9dc; letter-spacing: 2px; text-transform: uppercase; margin-top: 3px; }
  .brand-addr { font-size: 8pt; color: #64748b; margin-top: 4px; }
  .report-meta { text-align: right; }
  .report-title { font-size: 15pt; font-weight: 900; color: #1a5c32; }
  .report-date { font-size: 8pt; color: #64748b; margin-top: 3px; }
  .divider { height: 1.5px; background: linear-gradient(90deg,#1a5c32,#29a9dc,transparent); margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #f0fdf4; color: #1a5c32; font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 8px; text-align: left; border-bottom: 2px solid rgba(22,101,52,0.2); }
  .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; }
  .watermark-note { color: #1a5c32; font-weight: 700; }
  @page { margin: 2cm; }
</style>
</head>
<body>
<div class="page">
  <div class="stripe"></div>
  <div class="header">
    <div>
      <img src="${logoSrc}" width="48" height="48" style="float:left;margin-right:12px;object-fit:contain" onerror="this.style.display='none'"/>
      <div class="brand-name">${t.companyName}</div>
      <div class="brand-sub">${(t.subtitle || 'Official Report').toUpperCase()}</div>
      <div class="brand-addr">${addrLine}</div>
    </div>
    <div class="report-meta">
      <div class="report-title">${title}</div>
      <div class="report-date">${dateStr} ${timeStr}</div>
      <div class="report-date">${data.length} record${data.length !== 1 ? 's' : ''}</div>
    </div>
  </div>
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        ${columns.map(col => `<th>${col.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="footer">
    <span>${t.footerNote || `${t.companyName} Ghana Limited — Confidential internal document.`}</span>
    <span class="watermark-note">${t.website || 'rebmaimpex.com'}</span>
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/msword;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${slugFileName(title)}.doc`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
