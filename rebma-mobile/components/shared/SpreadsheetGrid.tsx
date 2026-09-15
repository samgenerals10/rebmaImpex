// rebma-mobile/components/shared/SpreadsheetGrid.tsx
// Ports: rebma-web/src/views/shared/SpreadsheetView.tsx's `DataSheetEditor`
// (DATA mode) AND, as of the Gap-Closure Backlog Item 3, `FreeSheetEditor`
// (FREE/formula mode, D108-D111).
//
// DATA mode has NO "saved sheet" concept at all — `openDataSheet()` just
// picks a table id from `DEPT_TABLES[department]` and opens a live,
// directly-editable view of that table's real rows. There's nothing in
// the `spreadsheets` table involved in this mode; it's a live browser over
// whichever operational table the department is allowed to see.
//
// FREE mode IS a saved artifact — real rows in `spreadsheets`
// (mode='FREE', cell_data jsonb), listed per department+creator (D110),
// each backed by an in-memory `hyperformula` instance (pure JS, no DOM
// dependency — confirmed by direct read of web's usage, D108). Desktop's
// double-click-a-cell-and-type-in-place interaction has no touch
// equivalent — this mirrors DATA mode's own tap-to-select pattern: tap a
// cell to select it, edit its raw content in a persistent formula bar
// above the grid (web has one too, this isn't invented), "Set" commits
// (D109). The 26x50 hard cap, 10x30 initial visible window, and
// add-only (no remove) row/col expansion are all ported verbatim.
//
// Desktop's double-click-a-cell-in-a-huge-grid interaction has no touch
// equivalent — this mirrors Phase 7.0's SearchablePicker precedent (a
// desktop popover interaction becomes a bottom Sheet): tap a row to open
// it, tap a field inside to edit it. Full read/edit capability over every
// column is preserved; only the spreadsheet-grid arrangement is adapted.
//
// A shared, data-aware composite (owns its own Supabase calls), not a
// components/ui/ prop-only primitive — deliberately built once here so
// every department phase can render <SpreadsheetGrid department="X" />
// unmodified for its own Spreadsheets sub-tab.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Alert, ScrollView, Pressable } from 'react-native';
import { HyperFormula } from 'hyperformula';
import { Table, ArrowLeft, FileSpreadsheet, Plus, Trash2, Lock, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Tabs from '../ui/Tabs';
import DataList, { type DataColumn } from '../ui/DataList';
import Sheet, { SheetSection } from '../ui/Sheet';
import Input, { Field } from '../ui/Input';
import { SkeletonList } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';

const NON_EDITABLE_COLS = new Set(['id', 'created_at', 'updated_at', 'last_updated', 'read']);

// Verbatim from rebma-web/src/views/shared/SpreadsheetView.tsx's DEPT_TABLES.
const DEPT_TABLES: Record<string, Array<{ id: string; label: string }>> = {
  CEO: [{ id: 'orders', label: 'Customer Orders' }, { id: 'finance_payments', label: 'Finance Payments' }, { id: 'delivery_logs', label: 'Delivery Logs' }, { id: 'global_audit_history', label: 'Audit History' }, { id: 'stock', label: 'Stock Inventory' }, { id: 'cargo_intake', label: 'Cargo Intake' }],
  FINANCE: [{ id: 'finance_payments', label: 'Finance Payments' }, { id: 'orders', label: 'Customer Orders' }, { id: 'stock', label: 'Stock Inventory' }],
  MANAGEMENT: [{ id: 'cargo_intake', label: 'Cargo Intake' }, { id: 'orders', label: 'Customer Orders' }, { id: 'production_requests', label: 'Production Requests' }, { id: 'general_purchases', label: 'General Purchases' }],
  MARKETING: [{ id: 'orders', label: 'Customer Orders' }],
  ADMIN_WAREHOUSE: [{ id: 'cargo_intake', label: 'Cargo Intake' }, { id: 'stock', label: 'Stock Inventory' }, { id: 'stock_ledger', label: 'Stock Ledger' }, { id: 'delivery_logs', label: 'Delivery Logs' }, { id: 'drivers', label: 'Drivers' }],
  HR: [{ id: 'profiles', label: 'Staff Profiles' }, { id: 'attendance', label: 'Attendance Logs' }],
  RECEPTION: [{ id: 'visitors', label: 'Visitor Log' }, { id: 'attendance', label: 'Attendance Logs' }],
  PRODUCTION: [{ id: 'production_requests', label: 'Production Requests' }, { id: 'production_logs', label: 'Production Output' }, { id: 'wip_stock', label: 'WIP Stock' }],
};

interface Props {
  department: string;
}

export default function SpreadsheetGrid({ department }: Props) {
  const t = useTheme();
  const { profile } = useAuthStore();
  const tables = DEPT_TABLES[department] || [];
  const [tab, setTab] = useState<'data' | 'free'>('data');
  const [activeTable, setActiveTable] = useState<{ id: string; label: string } | null>(null);
  const [activeFreeSheet, setActiveFreeSheet] = useState<FreeSheetRecord | { id: null } | null>(null);
  const [freeListVersion, setFreeListVersion] = useState(0);

  // CEO kill-switch: spreadsheets_enabled, with a per-user
  // ceo_feature_exceptions override checked first — matching
  // SpreadsheetView.tsx's own access check exactly. Only the read side is
  // ported (does an exception apply to me); managing exceptions stays a
  // web-only admin surface, per the Control Center scope note.
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const masterEnabled = await getCeoSetting('spreadsheets_enabled', true);
      const userEmail = profile?.email?.toLowerCase();
      if (!userEmail) { if (!cancelled) setAccessAllowed(masterEnabled); return; }
      const { data } = await supabase
        .from('ceo_feature_exceptions')
        .select('allowed')
        .eq('feature_key', 'spreadsheets_enabled')
        .eq('user_email', userEmail)
        .maybeSingle();
      if (cancelled) return;
      setAccessAllowed(data !== null && data !== undefined ? Boolean(data.allowed) : masterEnabled);
    })();
    return () => { cancelled = true; };
  }, [profile?.email]);

  if (accessAllowed === null) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: t.spacing.xxxl, flexDirection: 'row', gap: t.spacing.sm }}>
        <RefreshCw size={16} color={t.colors.textMuted} />
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textMuted }}>Checking access…</Text>
      </View>
    );
  }
  if (!accessAllowed) {
    return (
      <EmptyState
        icon={<Lock size={22} color={t.colors.status.danger.text} />}
        title="Spreadsheets Disabled"
        description="The CEO has disabled Spreadsheets for your account or all users. Contact the CEO or administrator to request access."
      />
    );
  }

  if (activeTable) {
    return <TableEditor table={activeTable} onBack={() => setActiveTable(null)} />;
  }
  if (activeFreeSheet) {
    return (
      <FreeSheetEditor
        sheet={activeFreeSheet.id ? (activeFreeSheet as FreeSheetRecord) : null}
        department={department}
        onBack={() => { setActiveFreeSheet(null); setFreeListVersion((v) => v + 1); }}
      />
    );
  }

  return (
    <View style={{ gap: t.spacing.lg }}>
      <Tabs
        variant="segmented"
        value={tab}
        onChange={(v) => setTab(v as 'data' | 'free')}
        options={[{ value: 'data', label: 'Data Sheets' }, { value: 'free', label: 'Free Sheets' }]}
      />

      {tab === 'data' ? (
        tables.length === 0 ? (
          <Card>
            <Text>No data tables are configured for this department.</Text>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
            {tables.map((tbl, i) => <TablePickerCard key={tbl.id} table={tbl} index={i} onPress={() => setActiveTable(tbl)} />)}
          </View>
        )
      ) : (
        <FreeSheetPicker department={department} refreshKey={freeListVersion} onOpen={setActiveFreeSheet} />
      )}
    </View>
  );
}

const TABLE_TILE_COLORS = ['blue', 'emerald', 'violet', 'amber', 'rose', 'teal', 'sky', 'indigo'] as const;

function TablePickerCard({ table, index, onPress }: { table: { id: string; label: string }; index: number; onPress: () => void }) {
  const t = useTheme();
  const tileColor = t.colors.action[TABLE_TILE_COLORS[index % TABLE_TILE_COLORS.length]];
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '47%', minWidth: 140, flexGrow: 1, gap: t.spacing.sm,
        padding: t.spacing.lg, backgroundColor: t.colors.bgCard, borderRadius: t.radius.card,
        ...t.shadow('card'),
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: t.radius.lg, backgroundColor: `${tileColor}1f`, alignItems: 'center', justifyContent: 'center' }}>
        <Table size={20} color={tileColor} />
      </View>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={2}>{table.label}</Text>
    </Pressable>
  );
}

function TableEditor({ table, onBack }: { table: { id: string; label: string }; onBack: () => void }) {
  const t = useTheme();
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editRow, setEditRow] = useState<Record<string, any> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingCol, setSavingCol] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from(table.id).select('*').order('created_at', { ascending: false }).limit(200);
    if (err) {
      setError(`Cannot load table "${table.id}": ${err.message}`);
      setLoading(false);
      return;
    }
    const list = data || [];
    setColumns(list.length > 0 ? Object.keys(list[0]) : []);
    setRows(list);
    setLoading(false);
  }, [table.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openRow = (row: Record<string, any>) => {
    setEditRow(row);
    const d: Record<string, string> = {};
    for (const c of columns) d[c] = row[c] == null ? '' : String(row[c]);
    setDraft(d);
  };

  const saveField = async (col: string) => {
    if (!editRow) return;
    const originalVal = editRow[col];
    const newVal: unknown =
      typeof originalVal === 'number' ? (parseFloat(draft[col]) || 0)
      : typeof originalVal === 'boolean' ? draft[col].toLowerCase() === 'true'
      : draft[col];

    setSavingCol(col);
    const { error: err } = await supabase.from(table.id).update({ [col]: newVal }).eq('id', editRow.id);
    setSavingCol(null);
    if (err) {
      Alert.alert('Update Failed', err.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === editRow.id ? { ...r, [col]: newVal } : r)));
    setEditRow((r) => (r ? { ...r, [col]: newVal } : r));
  };

  const columnsForList: DataColumn<Record<string, any>>[] = columns.slice(0, 6).map((c, idx) => ({
    key: c,
    label: c,
    primary: idx === 0,
    render: (row) => (row[c] == null ? '—' : String(row[c])),
  }));

  return (
    <View style={{ gap: t.spacing.md }}>
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} color={t.colors.textSecondary} />} label={`Back · ${table.label}`} onPress={onBack} />

      {error ? (
        <Card><Text style={{ color: t.colors.status.danger.text, fontFamily: t.font.medium, fontSize: t.type.body12.size }}>{error}</Text></Card>
      ) : loading ? (
        <SkeletonList rows={5} />
      ) : (
        <DataList
          columns={columnsForList}
          data={rows}
          rowKey={(r) => String(r.id)}
          onRowPress={openRow}
          emptyTitle={`No rows in ${table.label}`}
        />
      )}

      <Sheet open={!!editRow} onClose={() => setEditRow(null)} title={table.label} subtitle="Tap Save on any field to write it back" side="bottom" maxHeight={640}>
        {editRow && (
          <SheetSection label="Fields">
            {columns.map((c) => {
              const readOnly = NON_EDITABLE_COLS.has(c);
              return (
                <Field key={c} label={c + (readOnly ? ' (read-only)' : '')}>
                  <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={draft[c] ?? ''}
                        onChangeText={(v) => setDraft((d) => ({ ...d, [c]: v }))}
                        editable={!readOnly}
                        style={readOnly ? { backgroundColor: t.colors.bgInput, opacity: 0.6 } : undefined}
                      />
                    </View>
                    {!readOnly && (
                      <Button label="Save" size="sm" onPress={() => saveField(c)} loading={savingCol === c} disabled={savingCol === c} />
                    )}
                  </View>
                </Field>
              );
            })}
          </SheetSection>
        )}
      </Sheet>
    </View>
  );
}

// ── FREE (formula) mode — Gap-Closure Backlog, Item 3 ─────────────────

interface FreeSheetRecord {
  id: string;
  title: string;
  created_by_name?: string;
  updated_at?: string;
  cell_data?: Record<string, string>;
}

function FreeSheetPicker({ department, refreshKey, onOpen }: { department: string; refreshKey: number; onOpen: (s: FreeSheetRecord | { id: null }) => void }) {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [sheets, setSheets] = useState<FreeSheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('spreadsheets')
      .select('id, title, created_by_name, updated_at')
      .eq('department', department)
      .eq('mode', 'FREE')
      .eq('created_by_id', profile.id)
      .order('updated_at', { ascending: false });
    setSheets((data as any) || []);
    setLoading(false);
  }, [department, profile?.id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const remove = (s: FreeSheetRecord) => {
    Alert.alert('Delete Sheet', `Delete "${s.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('spreadsheets').delete().eq('id', s.id); load(); } },
    ]);
  };

  const createNew = () => {
    if (!newTitle.trim()) return;
    setShowNew(false);
    onOpen({ id: null, title: newTitle.trim() } as any);
    setNewTitle('');
  };

  return (
    <View style={{ gap: t.spacing.md }}>
      <Button label="New Free Sheet" size="sm" icon={<Plus size={13} color="#fff" />} onPress={() => setShowNew(true)} />
      {loading ? (
        <SkeletonList rows={3} />
      ) : sheets.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet size={20} color={t.colors.textMuted} />} title="No free sheets yet" description="Create one to build a formula-driven spreadsheet, e.g. =SUM(A1:A5)." />
      ) : (
        sheets.map((s) => (
          <Card key={s.id}>
            <Pressable onPress={() => onOpen(s)} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <FileSpreadsheet size={16} color={t.colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{s.title}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
                  {s.created_by_name || '—'}{s.updated_at ? ` · ${new Date(s.updated_at).toLocaleDateString()} ${new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => remove(s)} hitSlop={8}><Trash2 size={15} color={t.colors.status.danger.text} /></Pressable>
            </Pressable>
          </Card>
        ))
      )}

      <Sheet open={showNew} onClose={() => setShowNew(false)} title="New Free Sheet" side="bottom" maxHeight={280}
        footer={<Button label="Create" onPress={createNew} disabled={!newTitle.trim()} fullWidth />}
      >
        <Field label="Title"><Input value={newTitle} onChangeText={setNewTitle} placeholder="Untitled Sheet" autoFocus /></Field>
      </Sheet>
    </View>
  );
}

// Verbatim grid helpers from SpreadsheetView.tsx:56-84.
const COLS = 26;
const ROWS = 50;
const colToLetter = (c: number): string => String.fromCharCode(65 + c);
const toAddress = (row: number, col: number): string => `${colToLetter(col)}${row + 1}`;
const parseAddress = (addr: string): { row: number; col: number } => {
  const m = addr.match(/^([A-Z])(\d+)$/);
  if (!m) return { row: 0, col: 0 };
  return { row: parseInt(m[2], 10) - 1, col: m[1].charCodeAt(0) - 65 };
};
const buildSheetData = (cells: Record<string, string>): (string | number | null)[][] => {
  const data: (string | number | null)[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: (string | number | null)[] = [];
    for (let c = 0; c < COLS; c++) {
      const addr = toAddress(r, c);
      const v = cells[addr];
      if (!v) { row.push(null); continue; }
      if (v.startsWith('=')) { row.push(v); continue; }
      const n = Number(v);
      row.push(isNaN(n) || v.trim() === '' ? v : n);
    }
    data.push(row);
  }
  return data;
};

type CellVal = string | number | null;
const CELL_W = 76;
const CELL_H = 34;

function FreeSheetEditor({ sheet, department, onBack }: { sheet: FreeSheetRecord | null; department: string; onBack: () => void }) {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [cells, setCells] = useState<Record<string, string>>(sheet?.cell_data || {});
  const [computed, setComputed] = useState<Record<string, CellVal>>({});
  const [selected, setSelected] = useState('A1');
  const [formulaValue, setFormulaValue] = useState('');
  const [title, setTitle] = useState(sheet?.title || 'Untitled Sheet');
  const [saving, setSaving] = useState(false);
  const [numCols, setNumCols] = useState(10);
  const [numRows, setNumRows] = useState(30);
  const hfRef = useRef<HyperFormula | null>(null);

  useEffect(() => {
    const hf = HyperFormula.buildFromSheets({ Sheet1: buildSheetData(cells) }, { licenseKey: 'gpl-v3' });
    hfRef.current = hf;
    recomputeAll(cells, hf);
    return () => hf.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFormulaValue(cells[selected] || '');
  }, [selected]);

  const recomputeAll = (currentCells: Record<string, string>, hf: HyperFormula) => {
    const result: Record<string, CellVal> = {};
    Object.keys(currentCells).forEach((addr) => {
      if (!currentCells[addr]) return;
      const { row, col } = parseAddress(addr);
      const val = hf.getCellValue({ sheet: 0, row, col });
      if (val === null || val === undefined) { result[addr] = ''; return; }
      if (typeof val === 'object' && 'type' in (val as any)) {
        result[addr] = `#${(val as any).type}`;
      } else {
        result[addr] = val as CellVal;
      }
    });
    setComputed(result);
  };

  const commitEdit = useCallback((addr: string, rawValue: string) => {
    const trimmed = rawValue;
    const newCells = { ...cells };
    if (trimmed === '') delete newCells[addr];
    else newCells[addr] = trimmed;
    setCells(newCells);
    if (hfRef.current) {
      const { row, col } = parseAddress(addr);
      const toSet = trimmed === '' ? null : trimmed.startsWith('=') ? trimmed : (isNaN(Number(trimmed)) ? trimmed : Number(trimmed));
      hfRef.current.setCellContents({ sheet: 0, row, col }, [[toSet]]);
      recomputeAll(newCells, hfRef.current);
    }
  }, [cells]);

  const setFormula = () => commitEdit(selected, formulaValue);

  const displayVal = (addr: string): string => {
    const c = computed[addr];
    if (c === null || c === undefined || c === '') return '';
    return String(c);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (sheet?.id) {
        await supabase.from('spreadsheets').update({ title, cell_data: cells, updated_at: now }).eq('id', sheet.id);
      } else {
        await supabase.from('spreadsheets').insert([{
          title, mode: 'FREE', department, cell_data: cells,
          created_by_id: profile?.id, created_by_name: profile?.fullName,
          created_at: now, updated_at: now,
        }]);
      }
      onBack();
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not save this sheet.');
    } finally {
      setSaving(false);
    }
  };

  const rowIndices = useMemo(() => Array.from({ length: numRows }, (_, i) => i), [numRows]);
  const colIndices = useMemo(() => Array.from({ length: numCols }, (_, i) => i), [numCols]);

  return (
    <View style={{ gap: t.spacing.md }}>
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} color={t.colors.textSecondary} />} label="Back · Free Sheets" onPress={onBack} />

      <Input value={title} onChangeText={setTitle} placeholder="Sheet title" style={{ fontFamily: t.font.bold }} />

      <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
        <View style={{ paddingHorizontal: t.spacing.sm, paddingVertical: 6, borderRadius: t.radius.sm, backgroundColor: t.colors.accentSoft }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.accentPressed }}>{selected}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Input value={formulaValue} onChangeText={setFormulaValue} placeholder="Enter value or formula (e.g. =SUM(A1:A5))" onSubmitEditing={setFormula} />
        </View>
        <Button label="Set" size="sm" onPress={setFormula} />
      </View>

      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <Button label="+ Cols" size="sm" variant="ghost" onPress={() => setNumCols((c) => Math.min(COLS, c + 5))} disabled={numCols >= COLS} />
        <Button label="+ Rows" size="sm" variant="ghost" onPress={() => setNumRows((r) => Math.min(ROWS, r + 20))} disabled={numRows >= ROWS} />
      </View>

      <ScrollView horizontal>
        <View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 40, height: CELL_H, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgInput }} />
            {colIndices.map((c) => (
              <View key={c} style={{ width: CELL_W, height: CELL_H, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgInput, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{colToLetter(c)}</Text>
              </View>
            ))}
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            {rowIndices.map((r) => (
              <View key={r} style={{ flexDirection: 'row' }}>
                <View style={{ width: 40, height: CELL_H, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgInput, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{r + 1}</Text>
                </View>
                {colIndices.map((c) => {
                  const addr = toAddress(r, c);
                  const isSelected = addr === selected;
                  return (
                    <Pressable key={c} onPress={() => setSelected(addr)} style={{ width: CELL_W, height: CELL_H, borderWidth: 1, borderColor: isSelected ? t.colors.accent : t.colors.border, backgroundColor: isSelected ? t.colors.accentSoft : t.colors.bgCard, justifyContent: 'center', paddingHorizontal: 6 }}>
                      <Text numberOfLines={1} style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{displayVal(addr)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <Button label={saving ? 'Saving…' : 'Save Sheet'} onPress={handleSave} loading={saving} disabled={saving || !title.trim()} fullWidth />
    </View>
  );
}
