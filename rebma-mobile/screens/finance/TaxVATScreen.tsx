// rebma-mobile/screens/finance/TaxVATScreen.tsx
// Ports: rebma-web/src/views/finance/TaxVATView.tsx — reads
// `finance_vat_periods` (pre-aggregated rows, not computed live from
// orders/finance_payments — confirmed by reading the source) + the real
// server-side RPC `get_vat_aging_summary()` for aging buckets. Tax rates
// are manually editable and persisted via a `finance_settings` upsert
// (key: 'tax_rates').
//
// Export (Gap-Closure Backlog, Item 1): one of the 6 UniversalExportModal
// screens — CSV+PDF+DOC, branded, columns verbatim from TaxVATView.tsx:50-57.
// Web's own second, redundant "quick PDF" trigger (a bare legacy
// exportToPDF button, same underlying VAT entry data as the modal) is
// consolidated into this one ExportSheet — one less UI entry point, not
// a content change (D102).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

interface VATEntry {
  period: string;
  invoiceCount: number;
  grossSales: number;
  vatAmount: number;
  netSales: number;
  status: string;
}

interface AgingRow {
  label: string;
  invoices: number;
  amount: number;
}

export default function TaxVATScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [vatData, setVatData] = useState<VATEntry[]>([]);
  const [agingData, setAgingData] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState({ vat: '15', nhil: '2.5', getfund: '2.5', covid: '1' });
  const [savingRates, setSavingRates] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('finance_vat_periods').select('*').order('period', { ascending: false }).limit(500);
    setVatData((data as any) || []);

    const { data: agingRows } = await supabase.rpc('get_vat_aging_summary');
    if (agingRows) {
      setAgingData((agingRows as any[]).map((r) => ({ label: r.bucket.replace('-', '–'), invoices: Number(r.invoices || 0), amount: Number(r.amount || 0) })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = vatData[0];
  const totalVatCollected = vatData.filter((v) => v.status === 'Filed').reduce((s, v) => s + v.vatAmount, 0);
  const totalRatePct = (parseFloat(rates.vat) || 0) + (parseFloat(rates.nhil) || 0) + (parseFloat(rates.getfund) || 0) + (parseFloat(rates.covid) || 0);
  const totalTaxLiability = current ? current.grossSales * (totalRatePct / 100) : 0;

  const saveRates = async () => {
    setSavingRates(true);
    const { error } = await supabase.from('finance_settings').upsert([{
      key: 'tax_rates',
      value: JSON.stringify({ vat: parseFloat(rates.vat), nhil: parseFloat(rates.nhil), getfund: parseFloat(rates.getfund), covid: parseFloat(rates.covid) }),
      updated_by: profile?.fullName || 'Finance', updated_at: new Date().toISOString(),
    }]);
    setSavingRates(false);
    if (error) {
      Alert.alert('Save Failed', error.message);
      return;
    }
    Alert.alert('Saved', 'Tax rates updated.');
  };

  const periodColumns: DataColumn<VATEntry>[] = [
    { key: 'period', label: 'Period', primary: true },
    { key: 'status', label: 'Status', status: true, render: (v) => <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textSecondary }}>{v.status}</Text> },
    { key: 'grossSales', label: 'Gross Sales', render: (v) => `GHS ${v.grossSales.toLocaleString()}` },
    { key: 'vatAmount', label: 'VAT', render: (v) => `GHS ${v.vatAmount.toLocaleString()}` },
    { key: 'netSales', label: 'Net Sales', render: (v) => `GHS ${v.netSales.toLocaleString()}` },
  ];

  const agingColumns: DataColumn<AgingRow>[] = [
    { key: 'label', label: 'Bucket', primary: true },
    { key: 'amount', label: 'Amount', status: true, render: (r) => <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {r.amount.toLocaleString()}</Text> },
    { key: 'invoices', label: 'Invoices' },
  ];

  const exportColumns: ExportColumn[] = [
    { key: 'period', label: 'Period' },
    { key: 'invoiceCount', label: 'Invoices' },
    { key: 'grossSales', label: 'Gross Sales (GHS)', render: (v) => v.grossSales.toLocaleString() },
    { key: 'vatAmount', label: 'VAT Amount (GHS)', render: (v) => v.vatAmount.toLocaleString() },
    { key: 'netSales', label: 'Net Sales (GHS)', render: (v) => v.netSales.toLocaleString() },
    { key: 'status', label: 'Status' },
  ];

  return (
    <Screen refreshing={false}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label="Export" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="VAT Collected (MTD)" value={loading ? '—' : `GHS ${(current?.vatAmount || 0).toLocaleString()}`} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total VAT Filed" value={loading ? '—' : `GHS ${totalVatCollected.toLocaleString()}`} /></View>
          <View style={{ width: '100%' }}><MetricCard label="Est. Total Tax Liability" value={loading ? '—' : `GHS ${totalTaxLiability.toLocaleString()}`} tone="warning" /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Tax Rates</Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}><Field label="VAT %"><Input value={rates.vat} onChangeText={(v) => setRates((r) => ({ ...r, vat: v }))} keyboardType="decimal-pad" /></Field></View>
            <View style={{ flex: 1 }}><Field label="NHIL %"><Input value={rates.nhil} onChangeText={(v) => setRates((r) => ({ ...r, nhil: v }))} keyboardType="decimal-pad" /></Field></View>
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}><Field label="GETFund %"><Input value={rates.getfund} onChangeText={(v) => setRates((r) => ({ ...r, getfund: v }))} keyboardType="decimal-pad" /></Field></View>
            <View style={{ flex: 1 }}><Field label="COVID Levy %"><Input value={rates.covid} onChangeText={(v) => setRates((r) => ({ ...r, covid: v }))} keyboardType="decimal-pad" /></Field></View>
          </View>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.accent, marginBottom: t.spacing.md }}>Total: {totalRatePct.toFixed(2)}%</Text>
          <Button label={savingRates ? 'Saving…' : 'Save Tax Rates'} onPress={saveRates} loading={savingRates} disabled={savingRates} fullWidth />
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>VAT Periods</Text>
          <DataList columns={periodColumns} data={vatData} rowKey={(v) => v.period} loading={loading} emptyTitle="No VAT periods on file" />
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Invoice Aging</Text>
          <DataList columns={agingColumns} data={agingData} rowKey={(r) => r.label} loading={loading} emptyTitle="No aging data" />
        </Card>
      </View>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="VAT Report"
        data={vatData}
        columns={exportColumns}
        formats={['csv', 'pdf', 'doc']}
        letterhead="branded"
      />
    </Screen>
  );
}
