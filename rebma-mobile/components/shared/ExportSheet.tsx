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
import { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Download, FileText, FileSpreadsheet, FileType } from 'lucide-react-native';
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

export default function ExportSheet({ open, onClose, title, subtitle, data, columns, pdfColumns, fields, formats, letterhead = 'legacy' }: Props) {
  const t = useTheme();
  const isFieldValue = !!fields;
  const availableFormats: ExportFormat[] = formats || (isFieldValue ? ['pdf'] : ['csv', 'pdf']);
  const [format, setFormat] = useState<ExportFormat>(availableFormats[0]);
  const [template, setTemplate] = useState<DocTemplate | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormat(availableFormats[0]);
    if (letterhead === 'branded') {
      fetchBrandedTemplate().then(setTemplate);
    }
  }, [open]);

  const recordCount = isFieldValue ? 1 : data?.length ?? 0;

  const handleExport = async () => {
    setBusy(true);
    try {
      if (isFieldValue && fields) {
        if (format === 'csv') throw new Error('CSV is not available for this export.');
        await exportFieldValueDocument(format as 'pdf' | 'doc', title, fields, letterhead, template);
      } else if (data && columns) {
        if (format === 'csv') {
          await exportCsv(columns, data, title);
        } else {
          await exportTableDocument(format, title, pdfColumns || columns, data, letterhead, template);
        }
      }
      onClose();
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Could not generate the export.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Export" subtitle={`${title}${!isFieldValue ? ` · ${recordCount} record${recordCount !== 1 ? 's' : ''}` : ''}`} side="bottom" maxHeight={420}
      footer={<Button label={busy ? 'Preparing…' : `Export ${FORMAT_META[format].label}`} icon={<Download size={14} color="#fff" />} onPress={handleExport} loading={busy} disabled={busy} fullWidth />}
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
