// rebma-mobile/components/shared/WalletsGrid.tsx
//
// Phase 7.4, D27. Ports rebma-web/src/views/ceo/WalletsView.tsx — headline
// totals come from the role-guarded `get_finance_wallet_totals()` RPC
// (Phase 6 added an internal finance/management/admin guard; a
// non-privileged caller gets a clean Postgres exception, surfaced here as
// a plain error state rather than a crash), payment-mode wallet tiles are
// re-normalized client-side from the RPC's `mode_breakdown` (variant
// spellings like "momo" vs "MOBILE_MONEY" collapse to one bucket, matching
// web exactly), the 6-month bar chart and recent-activity feed are built
// from real `finance_payments`/`finance_expenses`/`general_purchases`
// rows. Web re-exports this same component verbatim for both CEO and
// Finance — this shared component does the same for mobile, ready for a
// future CEO phase to reuse unmodified.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import BarChart from '../ui/BarChart';
import { SkeletonList } from '../ui/Skeleton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MODE_LABEL: Record<string, string> = { CASH: 'Cash', MOBILE_MONEY: 'Mobile Money', CHEQUE: 'Cheque', BANK_TRANSFER: 'Bank Transfer', CREDIT: 'Credit' };
const MODE_COLOR: Record<string, string> = { CASH: '#16a34a', MOBILE_MONEY: '#7c3aed', CHEQUE: '#f59e0b', BANK_TRANSFER: '#0284c7', CREDIT: '#e11d48' };

function normalMode(raw: string): string {
  if (!raw) return 'CASH';
  const m = raw.toUpperCase().replace(/[\s_-]/g, '');
  if (m === 'MOBILEMONEY' || m === 'MOMO') return 'MOBILE_MONEY';
  if (m === 'CHEQUE' || m === 'CHECK') return 'CHEQUE';
  if (m === 'BANKTRANSFER' || m === 'BANK') return 'BANK_TRANSFER';
  if (m === 'CREDIT') return 'CREDIT';
  return 'CASH';
}

interface ActivityRow {
  id: string;
  label: string;
  sub: string;
  amount: number;
  type: 'in' | 'out';
  date: string;
}

export default function WalletsGrid() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [wallets, setWallets] = useState<{ mode: string; amount: number; count: number }[]>([]);
  const [trend, setTrend] = useState<{ label: string; value: number }[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [paymentsRes, expensesRes, purchasesRes, totalsRes] = await Promise.all([
      supabase.from('finance_payments').select('id, client_name, amount, payment_mode, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('finance_expenses').select('id, category, description, amount, created_at, status').order('created_at', { ascending: false }).limit(500),
      supabase.from('general_purchases').select('id, item_name, cost, created_at, status').order('created_at', { ascending: false }).limit(200),
      supabase.rpc('get_finance_wallet_totals').single(),
    ]);

    if (totalsRes.error) {
      setError(totalsRes.error.message || 'Not authorized to view company financial totals.');
      setLoading(false);
      return;
    }

    const pays = paymentsRes.data || [];
    const exps = expensesRes.data || [];
    const purch = purchasesRes.data || [];
    const totals: any = totalsRes.data || {};
    setTotalIn(Number(totals.total_in || 0));
    setTotalOut(Number(totals.total_out || 0));

    const normalizedModes: Record<string, { amount: number; count: number }> = {};
    for (const m of totals.mode_breakdown || []) {
      const key = normalMode(m.mode);
      if (!normalizedModes[key]) normalizedModes[key] = { amount: 0, count: 0 };
      normalizedModes[key].amount += Number(m.amount || 0);
      normalizedModes[key].count += Number(m.count || 0);
    }
    setWallets(Object.entries(normalizedModes).map(([mode, v]) => ({ mode, ...v })).sort((a, b) => b.amount - a.amount));

    const monthInMap: Record<string, number> = {};
    const monthOutMap: Record<string, number> = {};
    for (const p of pays) {
      const k = MONTHS[new Date(p.created_at).getMonth()];
      monthInMap[k] = (monthInMap[k] || 0) + Number(p.amount || 0);
    }
    for (const e of exps) {
      if (e.status !== 'Rejected') {
        const k = MONTHS[new Date(e.created_at).getMonth()];
        monthOutMap[k] = (monthOutMap[k] || 0) + Number(e.amount || 0);
      }
    }
    for (const p of purch) {
      if (p.status === 'APPROVED') {
        const k = MONTHS[new Date(p.created_at).getMonth()];
        monthOutMap[k] = (monthOutMap[k] || 0) + Number(p.cost || 0);
      }
    }
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const k = MONTHS[d.getMonth()];
      return { label: k, value: (monthInMap[k] || 0) - (monthOutMap[k] || 0) };
    });
    setTrend(last6);

    const feed: ActivityRow[] = [
      ...pays.slice(0, 10).map((p: any) => ({ id: `pay-${p.id}`, label: p.client_name || 'Payment', sub: (p.payment_mode || 'CASH').replace(/_/g, ' '), amount: Number(p.amount || 0), type: 'in' as const, date: p.created_at })),
      ...exps.slice(0, 6).map((e: any) => ({ id: `exp-${e.id}`, label: e.description || e.category || 'Expense', sub: e.category || 'Expense', amount: Number(e.amount || 0), type: 'out' as const, date: e.created_at })),
      ...purch.slice(0, 4).map((p: any) => ({ id: `gp-${p.id}`, label: `Purchase: ${p.item_name || 'Item'}`, sub: 'General Purchase', amount: Number(p.cost || 0), type: 'out' as const, date: p.created_at })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 14);
    setActivity(feed);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Card>
        <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.status.danger.text }}>{error}</Text>
      </Card>
    );
  }

  const net = totalIn - totalOut;

  return (
    <View style={{ gap: t.spacing.xl }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
        <View style={{ width: '100%' }}><MetricCard label="Net Balance" value={loading ? '—' : `GHS ${net.toLocaleString()}`} emphasis="primary" tone={net >= 0 ? 'accent' : 'danger'} /></View>
        <View style={{ width: '47%' }}><MetricCard label="Total In" value={loading ? '—' : `GHS ${totalIn.toLocaleString()}`} tone="accent" /></View>
        <View style={{ width: '47%' }}><MetricCard label="Total Out" value={loading ? '—' : `GHS ${totalOut.toLocaleString()}`} tone="warning" /></View>
      </View>

      {loading ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Wallets by Payment Mode</Text>
            <View style={{ gap: t.spacing.sm }}>
              {wallets.map((w) => (
                <View key={w.mode} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.spacing.xs, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MODE_COLOR[w.mode] || t.colors.accent }} />
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{MODE_LABEL[w.mode] || w.mode} ({w.count})</Text>
                  </View>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {w.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </Card>

          {trend.length > 0 && (
            <Card>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Net Trend (6 Months)</Text>
              <BarChart data={trend.map((m) => ({ ...m, formattedValue: `GHS ${m.value.toLocaleString()}`, color: m.value >= 0 ? t.colors.accent : t.colors.status.danger.text }))} />
            </Card>
          )}

          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Recent Activity</Text>
            <View style={{ gap: t.spacing.sm }}>
              {activity.map((a) => (
                <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: t.spacing.xs }}>
                  <View style={{ flex: 1, marginRight: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{a.label}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{a.sub}</Text>
                  </View>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: a.type === 'in' ? t.colors.status.success.text : t.colors.status.danger.text }}>
                    {a.type === 'in' ? '+' : '−'}GHS {a.amount.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </View>
  );
}
