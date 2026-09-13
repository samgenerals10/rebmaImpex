// rebma-mobile/screens/PayslipsScreen.tsx
//
// Gap-Closure Backlog, Item 4 (D112-D115). Ports rebma-web/src/views/PayrollPanel.tsx's
// self-service branch (canManage=false && canViewTotals=false) — the view
// every non-HR/non-Finance/non-admin staff member sees of their own
// payroll: batch name, pay period, net pay only. Read-only, no actions,
// matching web exactly (the download/print controls in that file only
// render in the canManage/canViewTotals branches).
//
// ⚠️ D112 — a genuine, unresolved authorization ambiguity was found before
// building this: web's own query filters `.eq('employee_id', currentUser.id)`
// (PayrollPanel.tsx:75), but the live RLS policy's own comment insists the
// real column is `staff_id` (supabase_rls_overhaul.sql:306-311), and no
// committed CREATE TABLE for payroll_items exists anywhere in this repo to
// settle it. Rather than guess, this screen's read relies ENTIRELY on RLS
// to scope rows to the caller — no client-side .eq() filter at all — which
// is correct under either column name since Postgres enforces it
// server-side. Worst case if RLS were ever misconfigured is an empty
// screen, not a data leak (the policy's own `current_role() = 'hr' or
// is_admin()` branch is what would leak, not this unprivileged read).
//
// D113 — payroll_batches SELECT is hr/admin-only with no "my own batch"
// carve-out, so this screen's own batches query returns zero rows under
// RLS for a real self-service caller — batch name/period fall back to
// blank/'Payroll Batch', EXACTLY matching PayrollPanel.tsx:171-186's own
// rendering. Not fixed — widening that policy would be an actual
// authorization change beyond this backlog's mandate.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Banknote } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import PageTitle from '../components/ui/PageTitle';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';

interface PayrollItemRow {
  id: string;
  batch_id: string;
  net_amount: number;
}
interface PayrollBatchRow {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
}

export default function PayslipsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [items, setItems] = useState<PayrollItemRow[]>([]);
  const [batches, setBatches] = useState<PayrollBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // No client-side .eq() filter — see D112. RLS alone scopes this to
    // the caller's own rows regardless of which column name is real.
    const [{ data: itemData }, { data: batchData }] = await Promise.all([
      supabase.from('payroll_items').select('id, batch_id, net_amount'),
      supabase.from('payroll_batches').select('id, name, period_start, period_end'),
    ]);
    setItems((itemData as any) || []);
    setBatches((batchData as any) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const batchFor = (batchId: string) => batches.find((b) => b.id === batchId);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <PageTitle title="My Payslips" subtitle={profile?.fullName} />
      {loading ? (
        <SkeletonList rows={3} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Banknote size={20} color={t.colors.textMuted} />} title="No payslips yet" description="Payslips linked to your account will show up here once HR adds you to a payroll batch." />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {items.map((item) => {
            const batch = batchFor(item.batch_id);
            return (
              <Card key={item.id}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{batch?.name || 'Payroll Batch'}</Text>
                {batch ? (
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 2 }}>{batch.period_start} — {batch.period_end}</Text>
                ) : null}
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: t.spacing.sm }}>Net pay</Text>
                <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: t.colors.accent }}>GHS {Number(item.net_amount || 0).toLocaleString()}</Text>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
