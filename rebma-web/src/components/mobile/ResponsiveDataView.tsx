import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Download } from 'lucide-react';
import { openExportPreview } from '../../utils/exportPreview';
import { MobileSkeletonList } from './MobileSkeleton';
import MobileEmptyState from './MobileEmptyState';

export interface DataColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Used as the mobile card's title. Exactly one column should set this. */
  primary?: boolean;
  /** Status-like columns render as a small pill on the mobile card instead of a label:value row. */
  status?: boolean;
  /** Omit from the mobile card entirely (desktop-only column, e.g. an internal ID). */
  mobileHidden?: boolean;
  align?: 'left' | 'right' | 'center';
}

interface ResponsiveDataViewProps<T> {
  columns: DataColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Full override for the mobile card body — use when the auto layout from columns isn't enough. */
  renderCard?: (row: T) => ReactNode;
  /** Row actions — rendered as the last desktop column and as a footer row on mobile cards. */
  renderActions?: (row: T) => ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  /** Shows an Export button above the list. Opens the branded preview
   *  (PDF, Word or CSV) with exactly what the table shows; nothing
   *  downloads until the person confirms. The title heads the document. */
  exportTitle?: string;
}

// The text a cell shows on screen, for the export: formatted amounts,
// dates and status names, not the raw database values.
function cellToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  try {
    const html = renderToStaticMarkup(isValidElement(node) ? node : <>{node}</>);
    const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, ' '), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

// Desktop keeps the existing .erp-table; mobile gets a genuinely
// redesigned card list built from the same column definitions, not a
// shrunk table. Renders only the tree that matches the viewport (no
// double-mount) since a data table can be large enough that duplicating
// it in the DOM the way the rest of the app does is wasteful.
export default function ResponsiveDataView<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  renderCard,
  renderActions,
  loading = false,
  skeletonRows = 5,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  exportTitle,
}: ResponsiveDataViewProps<T>) {
  const primaryCol = columns.find(c => c.primary) ?? columns[0];
  const cardCols = columns.filter(c => c !== primaryCol && !c.mobileHidden);

  const cellValue = (col: DataColumn<T>, row: T): ReactNode =>
    col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? 'Not set');

  const openExport = () => {
    const cols = columns.filter(c => c.label && c.label.trim());
    openExportPreview({
      title: exportTitle || 'Report',
      data: data.map(row => Object.fromEntries(cols.map(c => [c.key, cellToText(cellValue(c, row))]))),
      columns: cols.map(c => ({ key: c.key, label: c.label })),
    });
  };

  return (
    <>
      {exportTitle && !loading && data.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={openExport}
            title={`Export ${exportTitle}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      )}
      {/* ── Mobile: card list ── */}
      <div className="lg:hidden">
        {loading ? (
          <MobileSkeletonList rows={skeletonRows} />
        ) : data.length === 0 ? (
          <MobileEmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="space-y-2">
            {data.map(row => {
              const key = rowKey(row);
              if (renderCard) return <div key={key}>{renderCard(row)}</div>;
              return (
                <div
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 ${onRowClick ? 'cursor-pointer active:bg-[var(--accent-light)] transition-colors' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[var(--text-primary)] min-w-0 truncate">{cellValue(primaryCol, row)}</p>
                    {(() => {
                      const statusCol = cardCols.find(c => c.status);
                      return statusCol ? <div className="shrink-0">{cellValue(statusCol, row)}</div> : null;
                    })()}
                  </div>
                  {cardCols.filter(c => !c.status).length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {cardCols.filter(c => !c.status).map(col => (
                        <div key={col.key} className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{col.label}</p>
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{cellValue(col, row)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {renderActions && (
                    <div className="mt-3 pt-2 border-t border-[var(--border)] flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {renderActions(row)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Desktop: existing table pattern, unchanged ── */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} style={{ textAlign: col.align ?? 'left' }}>{col.label}</th>
                ))}
                {renderActions && <th />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + (renderActions ? 1 : 0)} className="text-center py-8 text-[var(--text-muted)]">Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={columns.length + (renderActions ? 1 : 0)} className="text-center py-8 text-[var(--text-muted)]">{emptyTitle}</td></tr>
              ) : (
                data.map(row => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={onRowClick ? 'cursor-pointer' : ''}
                  >
                    {columns.map(col => (
                      <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>{cellValue(col, row)}</td>
                    ))}
                    {renderActions && (
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">{renderActions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
