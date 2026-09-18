// rebma-mobile/components/shared/ExportSheet.tsx
//
// Gap-Closure Backlog, Item 1 (D105). Mobile equivalent of
// rebma-web/src/components/common/UniversalExportModal.tsx +
// `<ExportButton>` — the shared UI, mirroring that component's own prop
// contract (`title`, `data`, `columns`) so a screen's wiring is mechanical.
// The mechanism (CSV/PDF/DOC generation) lives in lib/exportEngine.ts;
// this component only picks a format and calls it.
//
// `formats` and `letterhead` default to the "legacy" 2-format
// (CSV+PDF)/plain-letterhead experience, matching every screen on web
// EXCEPT the 6 that used UniversalExportModal — those pass
// `formats={['csv','pdf','doc']} letterhead="branded"` explicitly. Never
// offer DOC to a screen web never offered it to, and never skip it for one
// web did (D102).
//
// Step 5 of the tab-bar rebuild plan added a preview step, per the user's
// direct instruction: nothing exports until they've seen exactly what's
// going out and approved it. "Edit" is scoped to excluding rows/fields
// before export, not editing individual cell values — every screen that
// uses this component supplies a different, arbitrary column shape (many
// via a custom `render()` that only ever returns a display string, not
// an editable value with a known type), so row/field-level exclusion is
// the one edit capability that's honestly buildable the same way for
// every one of the ~15 screens wired to this component, without a
// bespoke cell editor per screen. Flagged as a scoping choice, not
// silently assumed to be the only possible reading of "edit."
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Download, FileText, FileSpreadsheet, FileType, Check, Square, CheckSquare } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import {
  exportCsv,
  exportTableDocument,
  exportFieldValueDocument,
  fetchBrandedTemplate,
  type ExportColumn,
  type ExportFormat,
  type Letterhead,
  type DocTemplate,
} from '../../lib/exportEngine';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Table export: rows + the CSV column set. Omit both `data`/`columns` and pass `fields` for a single-record export instead. */
  data?: any[];
  columns?: ExportColumn[];
  /** Only when the web source used a different column set for PDF than CSV (D101) — e.g. DeptActivity/Transactions. Defaults to `columns`. */
  pdfColumns?: ExportColumn[];
  /** Single-record "Field / Value" export (mirrors downloadRowPDF) — pass instead of data/columns. CSV is never offered for this shape, matching web. */
  fields?: Record<string, any>;
  formats?: ExportFormat[];
  letterhead?: Letterhead;
}

const FORMAT_META: Record<ExportFormat, { label: string; icon: any }> = {
  csv: { label: 'CSV', icon: FileSpreadsheet },
  pdf: { label: 'PDF', icon: FileText },
  doc: { label: 'Word DOC', icon: FileType },
};

function cellText(col: ExportColumn, row: any): string {
  if (col.render) return col.render(row);
  const v = row?.[col.key];
  return v == null ? '' : String(v);
}

export default function ExportSheet({ open, onClose, title, subtitle, data, columns, pdfColumns, fields, formats, letterhead = 'legacy' }: Props) {
  const t = useTheme();
  const isFieldValue = !!fields;
  const availableFormats: ExportFormat[] = formats || (isFieldValue ? ['pdf'] : ['csv', 'pdf']);
  const [format, setFormat] = useState<ExportFormat>(availableFormats[0]);
  const [template, setTemplate] = useState<DocTemplate | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'format' | 'preview'>('format');
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [excludedFields, setExcludedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setFormat(availableFormats[0]);
    setStep('format');
    setExcludedRows(new Set());
    setExcludedFields(new Set());
    if (letterhead === 'branded') {
      fetchBrandedTemplate().then(setTemplate);
    }
  }, [open]);

  const previewColumns = format === 'pdf' && pdfColumns ? pdfColumns : columns;
  const includedData = (data || []).filter((_, i) => !excludedRows.has(i));
  const includedFields = fields
    ? Object.fromEntries(Object.entries(fields).filter(([k]) => !excludedFields.has(k)))
    : undefined;
  const recordCount = isFieldValue ? Object.keys(includedFields || {}).length : includedData.length;

  const toggleRow = (i: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleField = (k: string) => {
    setExcludedFields((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      if (isFieldValue && includedFields) {
        if (format === 'csv') throw new Error('CSV is not available for this export.');
        await exportFieldValueDocument(format as 'pdf' | 'doc', title, includedFields, letterhead, template);
      } else if (columns) {
        if (format === 'csv') {
          await exportCsv(columns, includedData, title);
        } else {
          await exportTableDocument(format, title, pdfColumns || columns, includedData, letterhead, template);
        }
      }
      onClose();
    } catch (e: any) {
      setBusy(false);
      Alert.alert('Export Failed', e.message || 'Could not generate the export.');
      return;
    }
    setBusy(false);
  };

  if (step === 'format') {
    return (
      <Sheet open={open} onClose={onClose} title="Export" subtitle={`${title}${!isFieldValue ? ` · ${data?.length ?? 0} record${(data?.length ?? 0) !== 1 ? 's' : ''}` : ''}`} side="bottom" maxHeight={420}
        footer={<Button label="Preview" icon={<Check size={14} color="#fff" />} onPress={() => setStep('preview')} fullWidth />}
      >
        <View style={{ gap: t.spacing.md }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, textTransform: 'uppercase', color: t.colors.textMuted }}>Format</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {availableFormats.map((fmt) => {
              const meta = FORMAT_META[fmt];
              const Icon = meta.icon;
              return (
                <Button key={fmt} label={meta.label} size="sm" variant={format === fmt ? 'primary' : 'ghost'} icon={<Icon size={13} color={format === fmt ? '#fff' : t.colors.textSecondary} />} onPress={() => setFormat(fmt)} />
              );
            })}
          </View>
          {subtitle ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{subtitle}</Text> : null}
        </View>
      </Sheet>
    );
  }

  // Preview step — nothing exports from here except through the explicit
  // "Export" button below; "Back" returns to format selection with no
  // file generated. Rows/fields can be unchecked to leave them out.
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Review Before Export"
      subtitle={`${title} · ${FORMAT_META[format].label} · ${recordCount} of ${isFieldValue ? Object.keys(fields || {}).length : (data?.length ?? 0)} included`}
      side="full"
      footer={
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Button label="Back" variant="ghost" onPress={() => setStep('format')} fullWidth /></View>
          <View style={{ flex: 2 }}>
            <Button
              label={busy ? 'Exporting…' : `Approve & Export ${FORMAT_META[format].label}`}
              icon={<Download size={14} color="#fff" />}
              onPress={handleExport}
              loading={busy}
              disabled={busy || recordCount === 0}
              fullWidth
            />
          </View>
        </View>
      }
    >
      <View style={{ gap: t.spacing.sm }}>
        {isFieldValue
          ? Object.entries(fields || {}).map(([k, v]) => {
              const excluded = excludedFields.has(k);
              return (
                <Pressable
                  key={k}
                  onPress={() => toggleField(k)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm,
                    padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: 1,
                    borderColor: t.colors.border, backgroundColor: excluded ? t.colors.bgPage : t.colors.bgCard,
                    opacity: excluded ? 0.5 : 1,
                  }}
                >
                  {excluded ? <Square size={18} color={t.colors.textMuted} /> : <CheckSquare size={18} color={t.colors.accent} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{k}</Text>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={2}>{v == null ? '—' : String(v)}</Text>
                  </View>
                </Pressable>
              );
            })
          : (data || []).map((row, i) => {
              const excluded = excludedRows.has(i);
              return (
                <Pressable
                  key={i}
                  onPress={() => toggleRow(i)}
                  style={{
                    flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm,
                    padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: 1,
                    borderColor: t.colors.border, backgroundColor: excluded ? t.colors.bgPage : t.colors.bgCard,
                    opacity: excluded ? 0.5 : 1,
                  }}
                >
                  {excluded ? <Square size={18} color={t.colors.textMuted} /> : <CheckSquare size={18} color={t.colors.accent} />}
                  <View style={{ flex: 1, gap: 2 }}>
                    {(previewColumns || []).map((col) => (
                      <View key={col.key} style={{ flexDirection: 'row', gap: t.spacing.xs }}>
                        <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textMuted, minWidth: 90 }}>{col.label}</Text>
                        <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textPrimary }} numberOfLines={1}>{cellText(col, row)}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
        {!isFieldValue && (data?.length ?? 0) === 0 && (
          <Text style={{ textAlign: 'center', fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textMuted, paddingVertical: t.spacing.xl }}>
            Nothing to export.
          </Text>
        )}
      </View>
    </Sheet>
  );
}
