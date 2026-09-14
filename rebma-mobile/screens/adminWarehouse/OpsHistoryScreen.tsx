// rebma-mobile/screens/adminWarehouse/OpsHistoryScreen.tsx
// Ports: rebma-web/src/views/OperationsDashboard.tsx's `OpsHistory`
// (Discrepancy Reports) sub-tab (~L1783) AND its hidden `LoggedCargo`
// sub-tab (~L1543, reachable only via Overview's "View All", not in
// Sidebar.tsx's tab list — same shape as the fulfillment ticket queue).
// Both are views over the same `cargo_intake` table with heavily
// overlapping columns; rather than build two near-duplicate mobile
// screens, this one screen covers both: full record list with search +
// status filter (LoggedCargo's contribution) plus the rejection-reason
// column (OpsHistory's contribution, Phase 6).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { History, Copy, Share2, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import Sheet from '../../components/ui/Sheet';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';

interface CargoRow {
  id: string;
  product_name: string | null;
  goods_code: string | null;
  country: string | null;
  company: string | null;
  destination: string | null;
  status: string;
  rejection_reason: string | null;
  discrepancies: string | null;
  unit_price: number | null;
  quantity: number | null;
  weight: number | null;
  created_at: string;
}

interface DiscrepancyRow {
  id: string;
  goodsCode: string;
  productName: string;
  company: string;
  originalQty: number;
  damagedCount: number;
  unitCost: number;
  costLoss: number;
  notes: string;
}

// Mirrors OperationsDashboard.tsx's own cargoDiscrepancies derivation exactly:
// discrepancies is either a JSON blob written by Risk's damage write-off
// (originalQty/damagedCount/unitCost/costLoss/notes) or, on older rows, a
// plain "Confirmed: N" string. Rows with zero confirmed damage are dropped.
function deriveDiscrepancies(rows: CargoRow[]): DiscrepancyRow[] {
  return rows
    .map((c) => {
      let originalQty = c.quantity || 0;
      let damagedCount = 0;
      let unitCost = Number(c.unit_price || 0);
      let costLoss = 0;
      let notes = c.discrepancies || '';
      try {
        if (c.discrepancies && c.discrepancies.trim().startsWith('{')) {
          const parsed = JSON.parse(c.discrepancies);
          originalQty = parsed.originalQty ?? originalQty;
          damagedCount = parsed.damagedCount ?? 0;
          unitCost = parsed.unitCost ?? unitCost;
          costLoss = parsed.costLoss ?? (damagedCount * unitCost);
          notes = parsed.notes ?? '';
        } else if (c.discrepancies && c.discrepancies !== 'None') {
          const m = c.discrepancies.match(/Confirmed:\s*(\d+)/i);
          if (m) { damagedCount = parseInt(m[1], 10); costLoss = damagedCount * unitCost; }
        }
      } catch {
        // Unparseable discrepancies text — treated as zero damage, matching web.
      }
      return {
        id: c.id, goodsCode: c.goods_code || c.id, productName: c.product_name || 'Unknown',
        company: c.company || 'N/A', originalQty, damagedCount, unitCost, costLoss, notes,
      };
    })
    .filter((d) => d.damagedCount > 0);
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'PENDING_RISK_APPROVAL', label: 'Pending Risk Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'RETURNED_FOR_CORRECTION', label: 'Returned for Correction' },
];

export default function OpsHistoryScreen() {
  const t = useTheme();
  const [rows, setRows] = useState<CargoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [menuTarget, setMenuTarget] = useState<CargoRow | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);

  const load = useCallback(async () => {
    // rejection_reason is a Phase 6 migration column (supabase_marketing_credit_polish.sql,
    // written but not yet run as of this phase — see project memory). Selecting
    // it here is correct against the target schema; it will read null/error
    // until that migration is applied, same testability caveat as elsewhere.
    const { data, error } = await supabase
      .from('cargo_intake')
      .select('id, product_name, goods_code, country, company, destination, status, rejection_reason, discrepancies, unit_price, quantity, weight, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) setRows(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Local-only, matching web's own handleDuplicateCargo exactly — it never
  // inserts into cargo_intake either, just prepends a copy to the in-memory
  // list. A real functional gap would be adding a genuine DB insert here
  // that web doesn't actually do.
  const duplicateLog = (r: CargoRow) => {
    const dup: CargoRow = { ...r, id: `${Math.floor(100 + Math.random() * 900)}`, goods_code: `GC-${Math.floor(100000 + Math.random() * 900000)}`, created_at: new Date().toISOString() };
    setRows((prev) => [dup, ...prev]);
    setMenuTarget(null);
    Alert.alert('Duplicated', `Duplicated cargo record CARGO-${r.id}.`);
  };

  const shareLog = async (r: CargoRow) => {
    const text = `Rebma Cargo Record: ${r.goods_code || r.id}, ${r.product_name || 'Unnamed'}, Qty: ${r.quantity ?? '—'}, Origin: ${r.country || '—'}`;
    await Clipboard.setStringAsync(text);
    setMenuTarget(null);
    Alert.alert('Copied', 'Cargo record details copied to clipboard.');
  };

  const deleteLog = (r: CargoRow) => {
    setMenuTarget(null);
    Alert.alert('Delete Cargo Record', `Delete cargo intake record CARGO-${r.id}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('cargo_intake').delete().eq('id', r.id);
          if (error) { Alert.alert('Delete Failed', error.message); return; }
          setRows((prev) => prev.filter((x) => x.id !== r.id));
        },
      },
    ]);
  };

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || (r.product_name || '').toLowerCase().includes(q) || (r.goods_code || '').toLowerCase().includes(q) || (r.company || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const discrepancies = useMemo(() => deriveDiscrepancies(rows), [rows]);
  const totalDamaged = discrepancies.reduce((s, d) => s + d.damagedCount, 0);
  const totalLoss = discrepancies.reduce((s, d) => s + d.costLoss, 0);

  const columns: DataColumn<CargoRow>[] = [
    { key: 'product_name', label: 'Product', primary: true, render: (r) => r.product_name || '—' },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={statusTone(r.status)} label={r.status.replace(/_/g, ' ')} /> },
    { key: 'goods_code', label: 'Code', render: (r) => r.goods_code || `CARGO-${r.id.slice(-6).toUpperCase()}` },
    { key: 'origin', label: 'Origin', render: (r) => `${r.country || '—'} / ${r.company || '—'}` },
    { key: 'destination', label: 'Destination', render: (r) => r.destination || '—' },
    { key: 'created_at', label: 'Logged At', render: (r) => r.created_at ? new Date(r.created_at).toLocaleString() : 'N/A' },
    {
      key: 'rejection_reason', label: 'Reason',
      render: (r) => ((r.status === 'REJECTED' || r.status === 'RETURNED_FOR_CORRECTION') && r.rejection_reason)
        ? <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.status.danger.text }}>{r.rejection_reason}</Text>
        : '—',
    },
    { key: 'unit_price', label: 'Unit Price', align: 'right', render: (r) => r.unit_price ? `GHS ${r.unit_price}` : '—' },
  ];

  const discrepancyColumns: DataColumn<DiscrepancyRow>[] = [
    { key: 'productName', label: 'Product', primary: true },
    { key: 'id', label: 'Cargo ID', render: (d) => d.id.slice(0, 8).toUpperCase() },
    { key: 'company', label: 'Supplier' },
    { key: 'originalQty', label: 'Original Qty', align: 'center' },
    { key: 'damagedCount', label: 'Damaged Qty', align: 'center', render: (d) => <Text style={{ fontFamily: t.font.bold, color: t.colors.status.danger.text }}>{d.damagedCount}</Text> },
    { key: 'unitCost', label: 'Unit Cost (GHS)', align: 'right', render: (d) => d.unitCost.toLocaleString() },
    { key: 'costLoss', label: 'Financial Loss (GHS)', align: 'right', render: (d) => <Text style={{ fontFamily: t.font.extrabold, color: t.colors.status.danger.text }}>GHS {d.costLoss.toLocaleString()}</Text> },
    { key: 'notes', label: 'Notes', render: (d) => d.notes || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.md }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search cargo…" />
        <SearchablePicker value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} label="Filter by Status" />
        <DataList
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          loading={loading}
          emptyTitle="No cargo intake records"
          renderActions={(r) => <Button label="Actions" size="sm" variant="ghost" onPress={() => setMenuTarget(r)} />}
        />
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, textAlign: 'right' }}>
          Showing {filtered.length} of {rows.length} logs
        </Text>

        {discrepancies.length > 0 && (
          <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Cargo Discrepancy Statement</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                  Confirmed inventory damages, write-offs, and resulting financial losses at cost
                </Text>
              </View>
              <Badge tone="danger" label={`${totalDamaged} units`} />
            </View>
            <DataList columns={discrepancyColumns} data={discrepancies} rowKey={(d) => d.id} emptyTitle="No approved cargo discrepancies or damages logged" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm, backgroundColor: t.colors.status.danger.bg, borderRadius: t.radius.sm }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Total Loss (At Cost)</Text>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.status.danger.text }}>GHS {totalLoss.toLocaleString()}</Text>
            </View>
          </View>
        )}
      </View>

      <Sheet open={!!menuTarget} onClose={() => setMenuTarget(null)} title="Cargo Record" subtitle={menuTarget ? (menuTarget.goods_code || `CARGO-${menuTarget.id.slice(-6).toUpperCase()}`) : undefined} side="bottom">
        {menuTarget && (
          <View style={{ gap: t.spacing.sm }}>
            <Button label="View Timeline" variant="ghost" icon={<History size={14} color={t.colors.textSecondary} />} onPress={() => { setTimelineId(menuTarget.id); setMenuTarget(null); }} fullWidth />
            <Button label="Duplicate Log" variant="ghost" icon={<Copy size={14} color={t.colors.textSecondary} />} onPress={() => duplicateLog(menuTarget)} fullWidth />
            <Button label="Share Link" variant="ghost" icon={<Share2 size={14} color={t.colors.textSecondary} />} onPress={() => shareLog(menuTarget)} fullWidth />
            <Button label="Delete" variant="danger" icon={<Trash2 size={14} color={t.colors.onAccent} />} onPress={() => deleteLog(menuTarget)} fullWidth />
          </View>
        )}
      </Sheet>

      <RequestTimelineSheet open={!!timelineId} onClose={() => setTimelineId(null)} referenceId={timelineId || ''} />
    </Screen>
  );
}
