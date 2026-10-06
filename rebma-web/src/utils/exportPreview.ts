// rebma-web/src/utils/exportPreview.ts
//
// One way to export anything: open the branded preview, pick PDF, Word or
// CSV, look at it, then confirm. Nothing downloads without that confirm.
// Every export button in the app comes through here (utils/export.ts's
// exportToCSV / exportToPDF / downloadRowPDF just call openExportPreview),
// and <ExportPreviewHost /> (mounted once in App.tsx) shows the window.
// Plain logic only (no component imports) so utils/export.ts can use it
// without a circular import. The window itself: components/common/ExportPreviewHost.tsx.
export interface ExportColumn {
  key: string;
  label: string;
  render?: (row: any) => string;
}

export interface ExportRequest {
  title: string;
  data: any[];
  columns: ExportColumn[];
  subtitle?: string;
}

let current: ExportRequest | null = null;
const listeners = new Set<(r: ExportRequest | null) => void>();
const emit = () => listeners.forEach((l) => l(current));

export function openExportPreview(request: ExportRequest) {
  current = request;
  emit();
}

export function closeExportPreview() {
  current = null;
  emit();
}

/** "clientName" → "Client Name", "total_amount" → "Total Amount", "id" → "ID". */
export function prettyLabel(key: string): string {
  const spaced = String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced
    .split(/\s+/)
    .map((w) => (/^(id|vat|gps|pod|ghs|po|sku)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** A file name like "sales_history_2026.csv" → "Sales History 2026". */
export function prettyTitle(fileName: string): string {
  return prettyLabel(String(fileName).replace(/\.(csv|pdf|docx?)$/i, '')) || 'Report';
}

export function subscribeExportPreview(fn: (r: ExportRequest | null) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => { listeners.delete(fn); };
}
