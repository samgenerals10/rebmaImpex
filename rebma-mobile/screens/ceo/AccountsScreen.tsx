// rebma-mobile/screens/ceo/AccountsScreen.tsx
// Ports: rebma-web/src/views/ceo/AccountsView.tsx (303 lines, read in
// full) — D72. Condensed to a KPI strip + payment-mode/expense-category
// breakdown lists + one BarChart (Net Balance trend, 6 months), reading
// the same two RPCs web itself treats as ground truth for headline
// figures: get_finance_wallet_totals() and get_orders_financial_summary()
// — web's own comment documents that a capped-window client sum was
// "silently wrong" past 500/500/200 rows, so these RPCs (not a client
// sum) are the only correct source. Drops the 3-series stacked bar chart
// and the expense pie chart in favor of the single-series BarChart
// primitive already established for every prior condensed
// Analytics-style screen (same real numbers, one fewer chart type).
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { CreditCard } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';
import { SkeletonList } from '../../components/ui/Skeleton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MODE_COLOR: Record<string, string> = { CASH: '#16a34a', 'MOBILE MONEY': '#7c3aed', CHEQUE: '#f59e0b', 'BANK TRANSFER': '#0284c7', CREDIT: '#e11d48' };

interface ModeBreak { mode: string; amount: number; count: number }
interface ExpenseCat { name: string; value: number }

export default function AccountsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [creditOutstanding, setCreditOutstanding] = useState(0);
  const [modeBreaks, setModeBreaks] = useState<ModeBreak[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCat[]>([]);
  const [monthlyNet, setMonthlyNet] = useState<{ label: string; value: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [paymentsRes, expensesRes, purchasesRes, totalsRes, ordersSummaryRes] = await Promise.all([
      supabase.from('finance_payments').select('amount, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('finance_expenses').select('amount, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('general_purchases').select('cost, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.rpc('get_finance_wallet_totals').single(),
      supabase.rpc('get_orders_financial_summary').single(),
    ]);

    if (totalsRes.error) {
      setError(totalsRes.error.message || 'Not authorized to view company financial totals.');
      setLoading(false);
      return;
    }

    const payments = paymentsRes.data || [];
    const expenses = expensesRes.data || [];
    const purchases = purchasesRes.data || [];
    const totals: any = totalsRes.data || {};
    const ordersSummary: any = ordersSummaryRes.data || {};

    setTotalIn(Number(totals.total_in || 0));
    setTotalOut(Number(totals.total_out || 0));
    setTotalPurchases(Number(totals.total_purchases || 0));
    setTotalRevenue(Number(ordersSummary.total_revenue || 0));
    setPendingOrders(Number(ordersSummary.pending_orders_count || 0));
    setCreditOutstanding(Number(ordersSummary.credit_outstanding || 0));

    setModeBreaks(((totals.mode_breakdown || []) as any[]).map((m) => ({ mode: String(m.mode).replace(/_/g, ' '), amount: Number(m.amount), count: Number(m.count) })));
    setExpenseCategories(((totals.expense_categories || []) as any[]).map((c) => ({ name: c.name, value: Number(c.value) })));

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (5 - i));
      return { key: MONTHS[d.getMonth()], income: 0, expenses: 0 };
    });
    const monthKey = (iso: string) => MONTHS[new Date(iso).getMonth()];
    for (const p of payments) { const m = months.find((x) => x.key === monthKey(p.created_at)); if (m) m.income += Number(p.amount || 0); }
    for (const e of expenses) { const m = months.find((x) => x.key === monthKey(e.created_at)); if (m) m.expenses += Number(e.amount || 0); }
    for (const p of purchases) { const m = months.find((x) => x.key === monthKey(p.created_at)); if (m) m.expenses += Number(p.cost || 0); }
    setMonthlyNet(months.map((m) => ({ label: m.key, value: m.income - m.expenses })));

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Screen>
        <Card>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.status.danger.text }}>{error}</Text>
        </Card>
      </Screen>
    );
  }

  const net = totalIn - totalOut - totalPurchases;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Received" value={loading ? '—' : `GHS ${totalIn.toLocaleString()}`} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Expenses" value={loading ? '—' : `GHS ${(totalOut + totalPurchases).toLocaleString()}`} tone="danger" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Net Balance" value={loading ? '—' : `GHS ${Math.abs(net).toLocaleString()}`} tone={net >= 0 ? 'accent' : 'danger'} sublabel={net >= 0 ? 'Surplus' : 'Deficit'} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Order Revenue" value={loading ? '—' : `GHS ${totalRevenue.toLocaleString()}`} sublabel={`${pendingOrders} pending review`} /></View>
        </View>

        {creditOutstanding > 0 && (
          <Card tone="inset">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <CreditCard size={16} color={t.colors.status.warning.text} />
              <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.warning.text }}>
                Credit outstanding: GHS {creditOutstanding.toLocaleString()} from credit orders not yet delivered
              </Text>
            </View>
          </Card>
        )}

        {loading ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <Card>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Net Balance Trend (6 Months)</Text>
              <BarChart data={monthlyNet.map((m) => ({ ...m, formattedValue: `GHS ${m.value.toLocaleString()}`, color: m.value >= 0 ? t.colors.status.success.text : t.colors.status.danger.text }))} />
            </Card>

            <Card>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Payment Mode Breakdown</Text>
              {modeBreaks.length === 0 ? (
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.md }}>No payments recorded yet</Text>
              ) : (
                <View style={{ gap: t.spacing.sm }}>
                  {modeBreaks.map((m) => {
                    const pct = totalIn > 0 ? Math.round((m.amount / totalIn) * 100) : 0;
                    return (
                      <View key={m.mode} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.spacing.xs, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MODE_COLOR[m.mode] || t.colors.accent }} />
                          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{m.mode} ({m.count}) · {pct}%</Text>
                        </View>
                        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {m.amount.toLocaleString()}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            <Card>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Expense Categories</Text>
              {expenseCategories.length === 0 ? (
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.md }}>No expense records yet</Text>
              ) : (
                <View style={{ gap: t.spacing.sm }}>
                  {expenseCategories.map((c) => (
                    <View key={c.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: t.spacing.xs }}>
                      <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{c.name}</Text>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {c.value.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}
