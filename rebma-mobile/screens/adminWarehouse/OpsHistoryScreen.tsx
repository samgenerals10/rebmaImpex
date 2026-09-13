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
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

interface CargoRow {
  id: string;
  product_name: string | null;
  goods_code: string | null;
  country: string | null;
  company: string | null;
  destination: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
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

  const load = useCallback(async () => {
    // rejection_reason is a Phase 6 migration column (supabase_marketing_credit_polish.sql,
    // written but not yet run as of this phase — see project memory). Selecting
    // it here is correct against the target schema; it will read null/error
    // until that migration is applied, same testability caveat as elsewhere.
    const { data, error } = await supabase
      .from('cargo_intake')
      .select('id, product_name, goods_code, country, company, destination, status, rejection_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) setRows(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

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

  const columns: DataColumn<CargoRow>[] = [
    { key: 'product_name', label: 'Product', primary: true, render: (r) => r.product_name || '—' },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={statusTone(r.status)} label={r.status.replace(/_/g, ' ')} /> },
    { key: 'goods_code', label: 'Code', render: (r) => r.goods_code || `CARGO-${r.id.slice(-6).toUpperCase()}` },
    { key: 'origin', label: 'Origin', render: (r) => `${r.country || '—'} / ${r.company || '—'}` },
    { key: 'destination', label: 'Destination', render: (r) => r.destination || '—' },
    {
      key: 'rejection_reason', label: 'Reason',
      render: (r) => ((r.status === 'REJECTED' || r.status === 'RETURNED_FOR_CORRECTION') && r.rejection_reason)
        ? <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.status.danger.text }}>{r.rejection_reason}</Text>
        : '—',
    },
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
        />
      </View>
    </Screen>
  );
}
