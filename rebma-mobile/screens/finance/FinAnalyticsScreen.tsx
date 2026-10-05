// rebma-mobile/screens/finance/FinAnalyticsScreen.tsx
//
// New — step 4 of the tab-bar rebuild. The Accounts Department
// (FINANCE) had no Analytics screen before this. Built against real
// finance_payments/finance_expenses columns already verified elsewhere
// in this app (MobileMoneyScreen, ExpensesScreen), condensed to KPI
// tiles + BarChart, matching every other Analytics screen's shape.
// Deliberately shows a payment-mode breakdown rather than repeating
// OverviewScreen's own pending-queue tiles.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

const MODE_COLORS: Record<string, string> = {
  cash: '#10b981', mobile_money: '#0ea5e9', cheque: '#f59e0b', credit: '#8b5cf6',
};

export default function FinAnalyticsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [paymentCount, setPaymentCount] = useState(0);
  const [byMode, setByMode] = useState<{ label: string; value: number; formattedValue: string; color: string }[]>([]);

  const load = useCallback(async () => {
    const [paymentsRes, expensesRes] = await Promise.all([
      supabase.from('finance_payments').select('amount, payment_mode').limit(2000),
      supabase.from('finance_expenses').select('amount').eq('status', 'Approved').limit(2000),
    ]);
    const payments = paymentsRes.data || [];
    const expenses = expensesRes.data || [];

    const collected = payments.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const expensesTotal = expenses.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const byModeMap: Record<string, number> = {};
    payments.forEach((r: any) => {
      const mode = (r.payment_mode || 'other').toLowerCase();
      byModeMap[mode] = (byModeMap[mode] || 0) + Number(r.amount || 0);
    });
    const modeData = Object.entries(byModeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([mode, amount]) => ({
        label: mode.replace(/_/g, ' '),
        value: amount,
        formattedValue: `GHS ${amount.toLocaleString()}`,
        color: MODE_COLORS[mode] || t.colors.accent,
      }));

    setTotalCollected(collected);
    setTotalExpenses(expensesTotal);
    setPaymentCount(payments.length);
    setByMode(modeData);
    setLoading(false);
    setRefreshing(false);
  }, [t.colors.accent]);

  useEffect(() => { load(); }, [load]);

  const net = totalCollected - totalExpenses;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Total Collected" value={loading ? 'Not set' : `GHS ${totalCollected.toLocaleString()}`} tone="accent" /></View><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Approved Expenses" value={loading ? 'Not set' : `GHS ${totalExpenses.toLocaleString()}`} tone="warning" /></View><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Net" value={loading ? 'Not set' : `GHS ${net.toLocaleString()}`} tone={net >= 0 ? 'success' : 'danger'} /></View><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Payment Records" value={loading ? 'Not set' : paymentCount} /></View></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Collections by Payment Mode</Text>
          {byMode.length > 0 ? (
            <BarChart data={byMode} />
          ) : (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>No payment data yet</Text>
          )}
        </Card>
      </View>
    </Screen>
  );
}
