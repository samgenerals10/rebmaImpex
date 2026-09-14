// rebma-mobile/screens/finance/MobileMoneyScreen.tsx
// Ports: rebma-web/src/views/finance/MobileMoneyView.tsx — reads/edits
// `finance_payments` filtered `payment_mode ilike 'mobile_money'` (rows
// originate from OrdersQueue/RecordPayment, not created here — confirmed
// no "Add" flow exists on web, only view/edit/verify/delete). "Verify"
// sets status='Verified'. Web's realtime subscription is dropped (same
// plain-fetch-on-refresh convention as every other mobile screen).
//
// Export (Gap-Closure Backlog, Item 1): one of the 6 UniversalExportModal
// screens — CSV+PDF+DOC, branded, columns verbatim from MobileMoneyView.tsx:50-59.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import BarChart from '../../components/ui/BarChart';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

interface MomoRow {
  id: string;
  transaction_id: string | null;
  network: string;
  client_name: string | null;
  momo_number: string | null;
  amount: number;
  created_at: string;
  status: string;
  order_id: string | null;
}

const NETWORK_COLOR: Record<string, string> = { MTN: '#ffcc00', Vodafone: '#e60000', AirtelTigo: '#0072ce' };
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = { Verified: 'success', Pending: 'warning', Failed: 'danger' };

export default function MobileMoneyScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [txns, setTxns] = useState<MomoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState('All');
  const [detail, setDetail] = useState<MomoRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MomoRow | null>(null);
  const [editForm, setEditForm] = useState({ transactionId: '', network: 'MTN', customerName: '', momoNumber: '', amount: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('finance_payments').select('id, transaction_id, network, client_name, momo_number, amount, created_at, status, order_id').ilike('payment_mode', 'mobile_money').order('created_at', { ascending: false });
    if (!error && data) setTxns(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txns.filter((tx) => {
      const matchesSearch = !q || (tx.client_name || '').toLowerCase().includes(q) || (tx.transaction_id || '').toLowerCase().includes(q);
      const matchesNetwork = networkFilter === 'All' || tx.network === networkFilter;
      return matchesSearch && matchesNetwork;
    });
  }, [txns, search, networkFilter]);

  const byNetwork = ['MTN', 'Vodafone', 'AirtelTigo'].map((n) => ({
    label: n, value: txns.filter((t) => t.network === n).reduce((s, t) => s + Number(t.amount || 0), 0), color: NETWORK_COLOR[n],
  }));
  const totalAmount = txns.reduce((s, t) => s + Number(t.amount || 0), 0);

  const openEdit = (tx: MomoRow) => {
    setEditForm({ transactionId: tx.transaction_id || '', network: tx.network, customerName: tx.client_name || '', momoNumber: tx.momo_number || '', amount: String(tx.amount) });
    setEditTarget(tx);
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm.transactionId.trim() || !editForm.customerName.trim() || !editForm.amount) return;
    setSavingEdit(true);
    const { error } = await supabase.from('finance_payments').update({
      transaction_id: editForm.transactionId.trim(), network: editForm.network, client_name: editForm.customerName.trim(),
      momo_number: editForm.momoNumber.trim() || null, amount: parseFloat(editForm.amount) || 0,
    }).eq('id', editTarget.id);
    setSavingEdit(false);
    if (error) { Alert.alert('Update Failed', error.message); return; }
    await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `MoMo transaction ${editTarget.id} updated`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    setEditTarget(null);
    load();
  };

  const verify = async (tx: MomoRow) => {
    const { error } = await supabase.from('finance_payments').update({ status: 'Verified' }).eq('id', tx.id);
    if (error) {
      Alert.alert('Verify Failed', error.message);
      return;
    }
    await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `MoMo transaction ${tx.id} verified — ${tx.transaction_id}`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    setDetail(null);
    load();
  };

  const remove = (tx: MomoRow) => {
    Alert.alert('Delete Transaction', `Remove this ${tx.client_name || 'MoMo'} transaction?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('finance_payments').delete().eq('id', tx.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `MoMo transaction ${tx.id} deleted`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
          setDetail(null);
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<MomoRow>[] = [
    { key: 'client_name', label: 'Customer', primary: true, render: (tx) => tx.client_name || '—' },
    { key: 'status', label: 'Status', status: true, render: (tx) => <Badge tone={STATUS_TONE[tx.status] || 'warning'} label={tx.status || 'Verified'} /> },
    { key: 'network', label: 'Network' },
    { key: 'amount', label: 'Amount', render: (tx) => `GHS ${Number(tx.amount || 0).toLocaleString()}` },
    { key: 'momo_number', label: 'MoMo #', render: (tx) => tx.momo_number || 'N/A' },
  ];

  const exportColumns: ExportColumn[] = [
    { key: 'transaction_id', label: 'Transaction ID', render: (tx) => tx.transaction_id || '' },
    { key: 'network', label: 'Network' },
    { key: 'client_name', label: 'Customer', render: (tx) => tx.client_name || '' },
    { key: 'momo_number', label: 'MoMo Number', render: (tx) => tx.momo_number || '' },
    { key: 'amount', label: 'Amount (GHS)', render: (tx) => Number(tx.amount).toLocaleString() },
    { key: 'created_at', label: 'Date' },
    { key: 'status', label: 'Status' },
    { key: 'order_id', label: 'Order Ref', render: (tx) => tx.order_id || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label="Export" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          <View style={{ width: '47%' }}><MetricCard label="Total MoMo" value={loading ? '—' : `GHS ${totalAmount.toLocaleString()}`} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="MTN" value={loading ? '—' : `GHS ${byNetwork[0].value.toLocaleString()}`} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Vodafone" value={loading ? '—' : `GHS ${byNetwork[1].value.toLocaleString()}`} /></View>
          <View style={{ width: '47%' }}><MetricCard label="AirtelTigo" value={loading ? '—' : `GHS ${byNetwork[2].value.toLocaleString()}`} /></View>
        </View>
        {!loading && byNetwork.some((n) => n.value > 0) && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>By Network</Text>
            <BarChart data={byNetwork.map((n) => ({ ...n, formattedValue: `GHS ${n.value.toLocaleString()}` }))} />
          </Card>
        )}
        <Input value={search} onChangeText={setSearch} placeholder="Search transactions…" />
        <SearchablePicker label="Network" value={networkFilter} onChange={setNetworkFilter} options={[{ value: 'All', label: 'All Networks' }, { value: 'MTN', label: 'MTN' }, { value: 'Vodafone', label: 'Vodafone' }, { value: 'AirtelTigo', label: 'AirtelTigo' }]} />
        <DataList columns={columns} data={filtered} rowKey={(tx) => tx.id} loading={loading} emptyTitle="No mobile money transactions" onRowPress={setDetail} />
      </View>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.client_name || 'Transaction'} subtitle={detail?.transaction_id || undefined} side="bottom">
        {detail && (
          <>
            <SheetSection label="Details">
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.accent, marginBottom: t.spacing.sm }}>GHS {Number(detail.amount || 0).toLocaleString()}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Network: {detail.network}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>MoMo Number: {detail.momo_number || 'N/A'}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Date: {new Date(detail.created_at).toLocaleString()}</Text>
            </SheetSection>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {detail.status !== 'Verified' && <Button label="Verify" size="sm" onPress={() => verify(detail)} />}
              <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(detail)} />
              <Button label="Delete" size="sm" variant="danger" onPress={() => remove(detail)} />
            </View>
          </>
        )}
      </Sheet>

      <Sheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Transaction"
        side="bottom"
        footer={<Button label={savingEdit ? 'Saving…' : 'Save Changes'} onPress={saveEdit} loading={savingEdit} disabled={savingEdit} fullWidth />}
      >
        <Field label="Transaction ID *"><Input value={editForm.transactionId} onChangeText={(v) => setEditForm((f) => ({ ...f, transactionId: v }))} /></Field>
        <Field label="Network">
          <SearchablePicker value={editForm.network} onChange={(v) => setEditForm((f) => ({ ...f, network: v }))} options={[{ value: 'MTN', label: 'MTN' }, { value: 'Vodafone', label: 'Vodafone' }, { value: 'AirtelTigo', label: 'AirtelTigo' }]} />
        </Field>
        <Field label="Customer Name *"><Input value={editForm.customerName} onChangeText={(v) => setEditForm((f) => ({ ...f, customerName: v }))} /></Field>
        <Field label="MoMo Number" hint="Optional"><Input value={editForm.momoNumber} onChangeText={(v) => setEditForm((f) => ({ ...f, momoNumber: v }))} /></Field>
        <Field label="Amount (GHS) *"><Input value={editForm.amount} onChangeText={(v) => setEditForm((f) => ({ ...f, amount: v }))} keyboardType="decimal-pad" /></Field>
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Mobile Money Transactions"
        data={filtered}
        columns={exportColumns}
        formats={['csv', 'pdf', 'doc']}
        letterhead="branded"
      />
    </Screen>
  );
}
