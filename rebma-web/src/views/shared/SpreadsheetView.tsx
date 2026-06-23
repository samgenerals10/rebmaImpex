/*
 * SpreadsheetView.tsx — Spreadsheet tool available in every department
 *
 * REQUIRED SUPABASE TABLES (run in Supabase SQL editor):
 *
 * create table if not exists spreadsheets (
 *   id           uuid primary key default gen_random_uuid(),
 *   title        text not null,
 *   mode         text not null,          -- 'FREE' | 'DATA'
 *   department   text not null,
 *   data_table   text,                   -- DATA mode: which table
 *   cell_data    jsonb default '{}',     -- FREE mode: { "A1": "=SUM(B1:B3)" }
 *   created_by_id   text,
 *   created_by_name text,
 *   created_at   timestamptz default now(),
 *   updated_at   timestamptz default now()
 * );
 *
 * create table if not exists ceo_feature_exceptions (
 *   id           uuid primary key default gen_random_uuid(),
 *   feature_key  text not null,
 *   user_email   text not null,
 *   allowed      boolean not null default false,
 *   created_at   timestamptz default now(),
 *   unique (feature_key, user_email)
 * );
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { HyperFormula } from 'hyperformula';
import { supabase } from '../../lib/supabaseClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import {
  FileSpreadsheet, Plus, Trash2, Save, ArrowLeft, RefreshCw,
  Table, Download, X, ChevronDown, Edit2, Lock,
} from 'lucide-react';
import type { CurrentUser } from '../../types/erp';

// ── Department → allowed Data Sheet tables ───────────────────────────────────

const DEPT_TABLES: Record<string, Array<{ id: string; label: string }>> = {
  CEO:        [{ id: 'orders', label: 'Customer Orders' }, { id: 'finance_payments', label: 'Finance Payments' }, { id: 'delivery_logs', label: 'Delivery Logs' }, { id: 'global_audit_history', label: 'Audit History' }, { id: 'stock', label: 'Stock Inventory' }, { id: 'cargo_intake', label: 'Cargo Intake' }],
  FINANCE:    [{ id: 'finance_payments', label: 'Finance Payments' }, { id: 'orders', label: 'Customer Orders' }, { id: 'stock', label: 'Stock Inventory' }],
  MANAGEMENT: [{ id: 'cargo_intake', label: 'Cargo Intake' }, { id: 'orders', label: 'Customer Orders' }, { id: 'production_requests', label: 'Production Requests' }, { id: 'general_purchases', label: 'General Purchases' }],
  MARKETING:  [{ id: 'orders', label: 'Customer Orders' }],
  OPERATIONS: [{ id: 'cargo_intake', label: 'Cargo Intake' }, { id: 'stock', label: 'Stock Inventory' }, { id: 'stock_ledger', label: 'Stock Ledger' }],
  DISPATCH:   [{ id: 'delivery_logs', label: 'Delivery Logs' }],
  HR:         [{ id: 'profiles', label: 'Staff Profiles' }, { id: 'attendance_logs', label: 'Attendance Logs' }],
  RECEPTION:  [{ id: 'visitors', label: 'Visitor Log' }, { id: 'attendance_logs', label: 'Attendance Logs' }],
  PRODUCTION: [{ id: 'production_requests', label: 'Production Requests' }, { id: 'production_output', label: 'Production Output' }, { id: 'wip_stock', label: 'WIP Stock' }],
  LOGISTICS:  [{ id: 'delivery_logs', label: 'Delivery Logs' }, { id: 'drivers', label: 'Drivers' }],
};

const NON_EDITABLE_COLS = new Set(['id', 'created_at', 'updated_at', 'last_updated', 'read']);

// ── Grid helpers ──────────────────────────────────────────────────────────────

const COLS = 26;
const ROWS = 50;

const colToLetter = (c: number): string => String.fromCharCode(65 + c);

const toAddress = (row: number, col: number): string => `${colToLetter(col)}${row + 1}`;

const parseAddress = (addr: string): { row: number; col: number } => {
  const m = addr.match(/^([A-Z])(\d+)$/);
  if (!m) return { row: 0, col: 0 };
  return { row: parseInt(m[2]) - 1, col: m[1].charCodeAt(0) - 65 };
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface SheetRecord {
  id: string;
  title: string;
  mode: 'FREE' | 'DATA';
  department: string;
  data_table?: string;
  cell_data?: Record<string, string>;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  currentUser: CurrentUser | null;
  department: string;
  addNotification?: (msg: string) => void;
}

// ── Free Sheet Editor ─────────────────────────────────────────────────────────

function FreeSheetEditor({ sheet, onSave, onBack, currentUser }: {
  sheet: SheetRecord | null;
  onSave: (title: string, cells: Record<string, string>, id?: string) => void;
  onBack: () => void;
  currentUser: CurrentUser | null;
}) {
  const [cells, setCells] = useState<Record<string, string>>(sheet?.cell_data || {});
  const [computed, setComputed] = useState<Record<string, CellVal>>({});
  const [selected, setSelected] = useState<string>('A1');
  const [editAddr, setEditAddr] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [title, setTitle] = useState(sheet?.title || 'Untitled Sheet');
  const [saving, setSaving] = useState(false);
  const [numCols, setNumCols] = useState(10); // visible cols (A-J initially)
  const [numRows, setNumRows] = useState(30);
  const hfRef = useRef<HyperFormula | null>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Initialize HyperFormula
  useEffect(() => {
    const hf = HyperFormula.buildFromSheets(
      { Sheet1: buildSheetData(cells) },
      { licenseKey: 'gpl-v3' }
    );
    hfRef.current = hf;
    recomputeAll(cells, hf);
    return () => hf.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recomputeAll = (currentCells: Record<string, string>, hf: HyperFormula) => {
    const result: Record<string, CellVal> = {};
    Object.keys(currentCells).forEach(addr => {
      if (!currentCells[addr]) return;
      const { row, col } = parseAddress(addr);
      const val = hf.getCellValue({ sheet: 0, row, col });
      if (val === null || val === undefined) { result[addr] = ''; return; }
      if (typeof val === 'object' && 'type' in val) {
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
    if (trimmed === '') {
      delete newCells[addr];
    } else {
      newCells[addr] = trimmed;
    }
    setCells(newCells);
    setEditAddr(null);
    if (hfRef.current) {
      const { row, col } = parseAddress(addr);
      const toSet = trimmed === '' ? null
        : trimmed.startsWith('=') ? trimmed
        : (isNaN(Number(trimmed)) ? trimmed : Number(trimmed));
      hfRef.current.setCellContents({ sheet: 0, row, col }, [[toSet]]);
      recomputeAll(newCells, hfRef.current);
    }
  }, [cells]);

  const startEdit = (addr: string) => {
    setSelected(addr);
    setEditAddr(addr);
    setEditValue(cells[addr] || '');
    setTimeout(() => cellInputRef.current?.focus(), 0);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, addr: string) => {
    const { row, col } = parseAddress(addr);
    if (e.key === 'Enter') {
      commitEdit(addr, editValue);
      const nextAddr = toAddress(Math.min(row + 1, numRows - 1), col);
      setSelected(nextAddr);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(addr, editValue);
      const nextAddr = toAddress(row, Math.min(col + 1, numCols - 1));
      setSelected(nextAddr);
    } else if (e.key === 'Escape') {
      setEditAddr(null);
      setEditValue('');
    }
  };

  const handleFormulaBarKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitEdit(selected, editValue);
      const { row, col } = parseAddress(selected);
      setSelected(toAddress(Math.min(row + 1, numRows - 1), col));
    } else if (e.key === 'Escape') {
      setEditAddr(null);
      setEditValue(cells[selected] || '');
    }
  };

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editAddr) return;
    const { row, col } = parseAddress(selected);
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSelected(toAddress(Math.min(row+1, numRows-1), col)); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSelected(toAddress(Math.max(row-1, 0), col)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setSelected(toAddress(row, Math.min(col+1, numCols-1))); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setSelected(toAddress(row, Math.max(col-1, 0))); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      commitEdit(selected, '');
    }
    if (e.key === 'F2') { startEdit(selected); }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      setEditValue(e.key);
      startEdit(selected);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(title, cells, sheet?.id);
    setSaving(false);
  };

  const displayVal = (addr: string): string => {
    if (addr === editAddr) return editValue;
    const c = computed[addr];
    if (c === null || c === undefined || c === '') return '';
    return String(c);
  };

  const rawVal = (addr: string): string => cells[addr] || '';

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-card)] flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="h-4 w-px bg-[var(--border)]" />
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] min-w-[120px] max-w-[280px]"
        />
        <div className="flex-1" />
        <button
          onClick={() => setNumCols(c => Math.min(c + 5, COLS))}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] px-2 py-1 rounded border border-[var(--border)] cursor-pointer">
          + Cols
        </button>
        <button
          onClick={() => setNumRows(r => Math.min(r + 20, ROWS))}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] px-2 py-1 rounded border border-[var(--border)] cursor-pointer">
          + Rows
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          <Save size={13} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--bg)] flex-shrink-0">
        <div className="w-12 text-center text-xs font-mono font-semibold text-[var(--accent)] bg-[var(--accent-light)] rounded px-1.5 py-0.5">
          {selected}
        </div>
        <div className="h-4 w-px bg-[var(--border)]" />
        <input
          value={editAddr ? editValue : (rawVal(selected))}
          onChange={e => { setEditValue(e.target.value); if (!editAddr) startEdit(selected); }}
          onKeyDown={handleFormulaBarKeyDown}
          onFocus={() => { if (!editAddr) { setEditValue(rawVal(selected)); setEditAddr(selected); } }}
          onBlur={() => { if (editAddr) { commitEdit(editAddr, editValue); } }}
          placeholder="Enter value or formula (e.g. =SUM(A1:A5))"
          className="flex-1 text-xs font-mono bg-transparent focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto"
        onKeyDown={handleGridKeyDown}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: `${40 + numCols * 100}px` }}>
          <thead>
            <tr>
              <th style={{ width: 40, position: 'sticky', top: 0, left: 0, zIndex: 3, background: 'var(--bg-input)', border: '1px solid var(--border)' }} />
              {Array.from({ length: numCols }, (_, c) => (
                <th key={c} style={{ width: 100, position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-input)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', padding: '3px 0' }}>
                  {colToLetter(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numRows }, (_, r) => (
              <tr key={r}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', padding: '0 4px', fontWeight: 600 }}>
                  {r + 1}
                </td>
                {Array.from({ length: numCols }, (_, c) => {
                  const addr = toAddress(r, c);
                  const isSelected = selected === addr;
                  const isEditing = editAddr === addr;
                  const val = displayVal(addr);
                  return (
                    <td
                      key={c}
                      onClick={() => { if (editAddr && editAddr !== addr) commitEdit(editAddr, editValue); setSelected(addr); if (!editAddr) { /* don't start edit on single click */ } }}
                      onDoubleClick={() => startEdit(addr)}
                      style={{
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-light)' : 'var(--bg-card)',
                        padding: 0,
                        position: 'relative',
                        height: 22,
                        minWidth: 100,
                        cursor: 'cell',
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={cellInputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => handleCellKeyDown(e, addr)}
                          onBlur={() => { commitEdit(addr, editValue); }}
                          style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 12, padding: '0 4px', fontFamily: 'inherit', color: 'var(--text-primary)' }}
                        />
                      ) : (
                        <span style={{ display: 'block', padding: '2px 4px', fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {val}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Data Sheet Editor ─────────────────────────────────────────────────────────

function DataSheetEditor({ tableName, tableLabel, onBack, addNotification }: {
  tableName: string;
  tableLabel: string;
  onBack: () => void;
  addNotification?: (msg: string) => void;
}) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState<{ rowId: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (err) { setError(`Cannot load table "${tableName}": ${err.message}`); setLoading(false); return; }
      const rows = data || [];
      if (rows.length > 0) {
        setColumns(Object.keys(rows[0]));
      } else {
        // Try to get at least column names from an empty result
        setColumns([]);
      }
      setRows(rows);
    } catch {
      setError(`Table "${tableName}" is not accessible.`);
    }
    setLoading(false);
  }, [tableName]);

  useEffect(() => { loadData(); }, [loadData]);

  const startEdit = (rowId: string, col: string, currentVal: unknown) => {
    if (NON_EDITABLE_COLS.has(col)) return;
    setEditCell({ rowId, col });
    setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal));
  };

  const commitEdit = async () => {
    if (!editCell) return;
    const { rowId, col } = editCell;
    const originalRow = rows.find(r => r.id === rowId);
    const originalVal = originalRow?.[col];
    const parseVal = (): unknown => {
      if (typeof originalVal === 'number') return parseFloat(editValue) || 0;
      if (typeof originalVal === 'boolean') return editValue.toLowerCase() === 'true';
      return editValue;
    };
    const newVal = parseVal();
    // Optimistic update
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [col]: newVal } : r));
    setEditCell(null);
    setSaving(rowId);
    const { error: err } = await supabase
      .from(tableName)
      .update({ [col]: newVal })
      .eq('id', rowId);
    setSaving(null);
    if (err) {
      addNotification?.(`Update failed: ${err.message}`);
      // Revert
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, [col]: originalVal } : r));
    } else {
      addNotification?.(`Updated ${col} in ${tableLabel}.`);
    }
  };

  const cancelEdit = () => { setEditCell(null); };

  const exportCSV = () => {
    const header = columns.join(',');
    const dataRows = rows.map(r => columns.map(c => JSON.stringify(r[c] ?? '')).join(','));
    const csv = [header, ...dataRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-card)] flex-shrink-0 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="h-4 w-px bg-[var(--border)]" />
        <div className="flex items-center gap-1.5">
          <Table size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{tableLabel}</span>
          <span className="text-xs text-[var(--text-muted)]">({rows.length} rows)</span>
        </div>
        <div className="flex-1" />
        <button onClick={loadData} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] px-2 py-1.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-input)] cursor-pointer">
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] px-2 py-1.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-input)] cursor-pointer">
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Info bar */}
      <div className="px-4 py-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg)] border-b border-[var(--border)] flex-shrink-0">
        Double-click any cell to edit. Grey columns are read-only. Changes write immediately to the real database.
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-200">{error}</div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 bg-[var(--bg-input)] rounded animate-pulse" />
            ))}
          </div>
        ) : columns.length === 0 ? (
          <div className="p-10 text-center text-[var(--text-muted)] text-sm">
            {error ? error : `No data found in "${tableLabel}".`}
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col} style={{
                    position: 'sticky', top: 0, zIndex: 2,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    padding: '6px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: NON_EDITABLE_COLS.has(col) ? 'var(--text-muted)' : 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    minWidth: col === 'id' ? 80 : 130,
                    textAlign: 'left',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {NON_EDITABLE_COLS.has(col) && <Lock size={9} />}
                      {col}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} style={{ background: saving === row.id ? 'var(--accent-light)' : undefined }}>
                  {columns.map(col => {
                    const isEdit = editCell?.rowId === row.id && editCell?.col === col;
                    const isReadOnly = NON_EDITABLE_COLS.has(col);
                    const val = row[col];
                    const displayVal = val === null || val === undefined ? '' : String(val);
                    return (
                      <td
                        key={col}
                        onDoubleClick={() => !isReadOnly && startEdit(row.id, col, val)}
                        style={{
                          border: '1px solid var(--border)',
                          padding: 0,
                          background: isReadOnly ? 'var(--bg-input)' : isEdit ? 'var(--accent-light)' : 'var(--bg-card)',
                          minWidth: col === 'id' ? 80 : 130,
                          cursor: isReadOnly ? 'default' : 'cell',
                        }}
                      >
                        {isEdit ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                            style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 12, padding: '3px 6px', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                          />
                        ) : (
                          <span style={{ display: 'block', padding: '3px 6px', fontSize: 12, color: isReadOnly ? 'var(--text-muted)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {displayVal.length > 50 ? displayVal.slice(0, 50) + '…' : displayVal}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main SpreadsheetView ──────────────────────────────────────────────────────

type View = 'list' | 'free-editor' | 'data-editor';

export default function SpreadsheetView({ currentUser, department, addNotification }: Props) {
  const { getSetting } = useCeoSettings();
  const masterEnabled = getSetting('spreadsheets_enabled', true);

  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null); // null = loading
  const [view, setView] = useState<View>('list');
  const [sheets, setSheets] = useState<SheetRecord[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(true);
  const [activeSheet, setActiveSheet] = useState<SheetRecord | null>(null);
  const [activeTable, setActiveTable] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const deptTables = DEPT_TABLES[department] || DEPT_TABLES['CEO'];

  // Check per-user exception
  useEffect(() => {
    const userEmail = currentUser?.email?.toLowerCase();
    if (!userEmail) { setAccessAllowed(masterEnabled); return; }

    supabase
      .from('ceo_feature_exceptions')
      .select('allowed')
      .eq('feature_key', 'spreadsheets_enabled')
      .eq('user_email', userEmail)
      .maybeSingle()
      .then(({ data }) => {
        if (data !== null) {
          setAccessAllowed(Boolean(data.allowed));
        } else {
          setAccessAllowed(masterEnabled);
        }
      }, () => {
        setAccessAllowed(masterEnabled);
      });
  }, [currentUser?.email, masterEnabled]);

  // Load saved sheets for this user + dept
  const loadSheets = useCallback(async () => {
    setLoadingSheets(true);
    const { data } = await supabase
      .from('spreadsheets')
      .select('id, title, mode, department, data_table, created_by_name, created_at, updated_at')
      .eq('department', department)
      .eq('created_by_id', currentUser?.id || '')
      .order('updated_at', { ascending: false });
    setSheets((data as SheetRecord[]) || []);
    setLoadingSheets(false);
  }, [department, currentUser?.id]);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  // Save a free sheet
  const saveSheet = async (title: string, cells: Record<string, string>, id?: string) => {
    const now = new Date().toISOString();
    if (id) {
      await supabase
        .from('spreadsheets')
        .update({ title, cell_data: cells, updated_at: now })
        .eq('id', id);
    } else {
      const { data } = await supabase
        .from('spreadsheets')
        .insert([{
          title,
          mode: 'FREE',
          department,
          cell_data: cells,
          created_by_id: currentUser?.id,
          created_by_name: currentUser?.fullName,
          created_at: now,
          updated_at: now,
        }])
        .select('id')
        .single();
      if (data && activeSheet === null) {
        setActiveSheet(prev => prev ? { ...prev, id: data.id } : null);
      }
    }
    addNotification?.(`Saved "${title}"`);
    loadSheets();
  };

  // Delete a sheet
  const deleteSheet = async (id: string) => {
    if (!confirm('Delete this sheet? This cannot be undone.')) return;
    await supabase.from('spreadsheets').delete().eq('id', id);
    setSheets(prev => prev.filter(s => s.id !== id));
    addNotification?.('Sheet deleted.');
  };

  // Create new free sheet from modal
  const createNewSheet = () => {
    if (!newTitle.trim()) return;
    const tempSheet: SheetRecord = {
      id: '',
      title: newTitle.trim(),
      mode: 'FREE',
      department,
      cell_data: {},
      created_by_name: currentUser?.fullName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setActiveSheet(tempSheet);
    setView('free-editor');
    setShowNewModal(false);
    setNewTitle('');
  };

  // Open data sheet
  const openDataSheet = () => {
    const tableId = selectedTableId || deptTables[0]?.id || '';
    if (!tableId) return;
    setActiveTable(tableId);
    setView('data-editor');
  };

  const freeSheets = sheets.filter(s => s.mode === 'FREE');

  const formatDate = (ts?: string): string => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // ── Access check loading ──────────────────────────────────────────────────
  if (accessAllowed === null) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">
        <RefreshCw size={16} className="animate-spin mr-2" /> Checking access…
      </div>
    );
  }

  // ── Access blocked ────────────────────────────────────────────────────────
  if (!accessAllowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-8">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Lock size={24} className="text-red-500" />
        </div>
        <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Spreadsheets Disabled</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          The CEO has disabled Spreadsheets for your account or all users. Contact the CEO or administrator to request access.
        </p>
      </div>
    );
  }

  // ── Free Sheet Editor ─────────────────────────────────────────────────────
  if (view === 'free-editor') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <FreeSheetEditor
          sheet={activeSheet}
          onSave={saveSheet}
          onBack={() => { setView('list'); setActiveSheet(null); loadSheets(); }}
          currentUser={currentUser}
        />
      </div>
    );
  }

  // ── Data Sheet Editor ─────────────────────────────────────────────────────
  if (view === 'data-editor') {
    const tableEntry = deptTables.find(t => t.id === activeTable);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <DataSheetEditor
          tableName={activeTable}
          tableLabel={tableEntry?.label || activeTable}
          onBack={() => setView('list')}
          addNotification={addNotification}
        />
      </div>
    );
  }

  // ── Sheet List (default view) ─────────────────────────────────────────────
  return (
    <div className="p-5 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileSpreadsheet size={22} style={{ color: 'var(--accent)' }} />
            Spreadsheets
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Your Free Sheets and live Data Sheets</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: 'var(--accent)' }}>
          <Plus size={15} /> New Free Sheet
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Free Sheets */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Edit2 size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Free Sheets</h2>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Blank spreadsheets with full formula support — SUM, AVERAGE, COUNT, IF, VLOOKUP and more.
          </p>

          {loadingSheets ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl animate-pulse" />
            ))
          ) : freeSheets.length === 0 ? (
            <div
              onClick={() => setShowNewModal(true)}
              className="flex flex-col items-center py-10 border-2 border-dashed border-[var(--border)] rounded-2xl cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors">
              <Plus size={24} className="text-[var(--text-muted)] mb-2" />
              <p className="text-sm text-[var(--text-muted)]">Create your first sheet</p>
            </div>
          ) : (
            freeSheets.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl hover:shadow-md transition-all cursor-pointer group"
                onClick={() => { setActiveSheet(s); setView('free-editor'); }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-light)' }}>
                  <FileSpreadsheet size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{s.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {s.created_by_name || 'You'} · Last edited {formatDate(s.updated_at)}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteSheet(s.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 text-[var(--text-muted)] hover:text-red-500 cursor-pointer transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Data Sheet Opener */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Table size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">Data Sheet</h2>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Open a live database table as an editable grid. Edits write directly to the real database.
          </p>

          <div className="p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl space-y-3">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Select a table to open</label>
            <div className="relative">
              <select
                value={selectedTableId || deptTables[0]?.id || ''}
                onChange={e => setSelectedTableId(e.target.value)}
                className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
              >
                {deptTables.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>
            <div className="text-xs text-[var(--text-muted)] bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5">
              Edits respect all existing validation rules enforced by the database. Invalid changes will be rejected and reverted.
            </div>
            <button
              onClick={openDataSheet}
              disabled={deptTables.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>
              <Table size={15} /> Open Data Sheet
            </button>
          </div>
        </div>
      </div>

      {/* New Sheet Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowNewModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileSpreadsheet size={16} style={{ color: 'var(--accent)' }} /> New Free Sheet
              </h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:bg-[var(--accent-light)] rounded cursor-pointer">
                <X size={14} className="text-[var(--text-muted)]" />
              </button>
            </div>
            <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">Sheet Name</label>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createNewSheet()}
              placeholder="e.g. Q3 Budget, Sales Model, Inventory Check…"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">Cancel</button>
              <button
                onClick={createNewSheet}
                disabled={!newTitle.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: 'var(--accent)' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
