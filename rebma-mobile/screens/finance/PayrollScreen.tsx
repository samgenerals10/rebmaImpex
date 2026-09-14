// rebma-mobile/screens/finance/PayrollScreen.tsx
// Ports: rebma-web/src/views/PayrollPanel.tsx's Finance-visible branch
// ONLY (D29). Web's own role gate, verified exactly: `canManage = isHR`,
// `canViewTotals = isFinance || isAdmin` — Finance gets `canViewTotals &&
// !canManage`, i.e. batch-level totals only, no individual payslip
// amounts, no create/edit/approve/pay controls. Individual `payroll_items`
// are never queried here at all; that's HR's own future phase.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import MetricCard from '../../components/ui/MetricCard';

interface BatchRow {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: string;
  total_amount: number;
  item_count: number;
}

const STATUS_TONE: Record<string, 'muted' | 'warning' | 'success'> = { draft: 'muted', approved: 'warning', paid: 'success' };

export default function PayrollScreen() {
  const t = useTheme();
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('payroll_batches').select('id, name, period_start, period_end, status, total_amount, item_count').order('period_start', { ascending: false }).limit(50);
    if (!error && data) setBatches(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusTotals = (['draft', 'approved', 'paid'] as const).map((s) => ({
    status: s,
    total: batches.filter((b) => b.status === s).reduce((sum, b) => sum + Number(b.total_amount || 0), 0),
    count: batches.filter((b) => b.status === s).length,
  }));

  const columns: DataColumn<BatchRow>[] = [
    { key: 'name', label: 'Batch', primary: true },
    { key: 'status', label: 'Status', status: true, render: (b) => <Badge tone={STATUS_TONE[b.status] || 'muted'} label={b.status} /> },
    { key: 'period', label: 'Period', render: (b) => `${b.period_start} to ${b.period_end}` },
    { key: 'total_amount', label: 'Total', render: (b) => `GHS ${Number(b.total_amount || 0).toLocaleString()}` },
    { key: 'item_count', label: 'Staff', render: (b) => String(b.item_count || 0) },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>Summary totals only, individual amounts are confidential</Text>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {statusTotals.map((s) => (
            <View key={s.status} style={{ flex: 1 }}>
              <MetricCard
                label={s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                value={loading ? '—' : `GHS ${s.total.toLocaleString()}`}
                sublabel={loading ? undefined : `${s.count} batch${s.count !== 1 ? 'es' : ''}`}
                tone={s.status === 'paid' ? 'accent' : undefined}
              />
            </View>
          ))}
        </View>
        <DataList columns={columns} data={batches} rowKey={(b) => b.id} loading={loading} emptyTitle="No payroll batches yet" />
      </View>
    </Screen>
  );
}
