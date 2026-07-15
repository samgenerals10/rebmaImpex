// rebma-web/src/utils/export.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToCSV = (data: any[], headers: string[], fileName: string) => {
  const csvRows = [];
  // Header row
  csvRows.push(headers.map(h => `"${h.toUpperCase()}"`).join(','));
  
  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] !== undefined && row[header] !== null ? row[header] : '';
      let strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      // Escape double quotes
      const escaped = strVal.replace(/"/g, '""');
      return `"${escaped}"`;
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

function slugFileName(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
}

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

function cellText(val: any): string {
  if (val === undefined || val === null) return '';
  return typeof val === 'object' ? JSON.stringify(val) : String(val);
}

// Real downloadable PDF (replaces the old print-window trick) — same
// signature as before, so every existing call site works unmodified.
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

// Single-record export (order detail, receipt, ticket, etc.) — a labeled
// field list instead of a table, for row/modal-level PDF downloads.
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
