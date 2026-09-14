// rebma-mobile/screens/risk/CustomerCreditScreen.tsx
// Ports: rebma-web/src/views/risk/CustomerCreditView.tsx (read in full) —
// search + DataList of every customer: verification badge, RatingBadge,
// live outstanding, editable credit-limit input + Save, computed headroom,
// ACTIVE/ON_HOLD toggle pill. Writes via management.setCustomerCreditTerms
// on web; mobile writes the same shape directly (customers.credit_limit/
// credit_status/credit_terms_set_by/credit_terms_set_at) since there's no
// service-layer equivalent to call, same "small local write, no new lib
// file needed for one shape" call this project has made before.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { CreditCard, ShieldAlert } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import RatingBadge from '../../components/ui/RatingBadge';
import { computeCustomerRating, ordersForCustomerRow, outstandingCreditFor, type OrderLike } from '../../utils/customerRating';

const VERIFICATION_TONE: Record<string, 'warning' | 'success' | 'danger' | 'purple'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', RETURNED_FOR_CORRECTION: 'purple',
};
const VERIFICATION_LABEL: Record<string, string> = {
  PENDING: 'Pending Review', APPROVED: 'Verified', REJECTED: 'Rejected', RETURNED_FOR_CORRECTION: 'Returned',
};

interface CustomerRow {
  id: string;
  name: string;
  companyName: string;
  status: string;
  creditLimit: number | null;
  creditStatus: 'ACTIVE' | 'ON_HOLD';
}

export default function CustomerCreditScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [limitDraft, setLimitDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: custRows }, { data: orderRows }] = await Promise.all([
      supabase.from('customers').select('*').order('name', { ascending: true }),
      supabase.from('orders').select('id, customer_id, client_name, total_amount, amount_paid, payment_mode, status, created_at'),
    ]);
    setCustomers((custRows || []).map((r: any) => ({
      id: r.id,
      name: r.name || 'Unnamed customer',
      companyName: r.company_name || '',
      status: r.status || 'PENDING',
      creditLimit: r.credit_limit != null ? Number(r.credit_limit) : null,
      creditStatus: r.credit_status || 'ACTIVE',
    })));
    setOrders(orderRows || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // credit_terms_set_by is now looked up server-side from the live
  // profiles row for the caller's own session, not taken from client
  // state — security/gap audit fix: profile.fullName is just local React
  // state, forgeable by a client calling this update directly with any
  // string.
  const writeCreditTerms = async (customerId: string, creditLimit: number | null, creditStatus: 'ACTIVE' | 'ON_HOLD') => {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
    const performedBy = performers?.[0]?.full_name || 'Risk';
    await supabase.from('customers').update({
      credit_limit: creditLimit,
      credit_status: creditStatus,
      credit_terms_set_by: performedBy,
      credit_terms_set_at: new Date().toISOString(),
    }).eq('id', customerId);
  };

  const logCreditTermsAudit = async (customerId: string, customerName: string, details: string) => {
    await supabase.from('global_audit_history').insert({
      action: `CREDIT_TERMS: CUST-${customerId.slice(-6).toUpperCase()} — ${customerName}`,
      department: 'RISK',
      performed_by: profile?.fullName || 'Risk',
      reference_id: customerId,
      details,
      timestamp: new Date().toISOString(),
    });
  };

  const saveCreditLimit = async (c: CustomerRow) => {
    const raw = limitDraft[c.id];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    const limit = trimmed === '' ? null : Math.max(0, Number(trimmed));
    if (trimmed !== '' && Number.isNaN(limit)) return;
    setSavingId(c.id);
    try {
      await writeCreditTerms(c.id, limit, c.creditStatus);
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, creditLimit: limit } : x)));
      setLimitDraft((prev) => { const next = { ...prev }; delete next[c.id]; return next; });
      await logCreditTermsAudit(c.id, c.name, limit === null ? 'Credit limit cleared, so the global cap applies' : `Credit limit set to GHS ${limit.toLocaleString()}`);
    } finally {
      setSavingId(null);
    }
  };

  const toggleCreditStatus = async (c: CustomerRow) => {
    const next: 'ACTIVE' | 'ON_HOLD' = c.creditStatus === 'ON_HOLD' ? 'ACTIVE' : 'ON_HOLD';
    setTogglingId(c.id);
    try {
      await writeCreditTerms(c.id, c.creditLimit, next);
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, creditStatus: next } : x)));
      await logCreditTermsAudit(c.id, c.name, next === 'ON_HOLD' ? 'Credit placed ON HOLD, new credit orders blocked' : 'Credit hold lifted');
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.companyName.toLowerCase().includes(search.toLowerCase())
  );
  const onHoldCount = customers.filter((c) => c.creditStatus === 'ON_HOLD').length;
  const overLimitCount = customers.filter((c) => c.creditLimit != null && outstandingCreditFor(orders, c) >= c.creditLimit).length;

  const columns: DataColumn<CustomerRow>[] = [
    { key: 'name', label: 'Customer', primary: true },
    {
      key: 'status', label: 'Verification', status: true,
      render: (c) => (
        <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: t.radius.pill, backgroundColor: t.colors.status[VERIFICATION_TONE[c.status] || 'muted'].bg }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status[VERIFICATION_TONE[c.status] || 'muted'].text }}>{VERIFICATION_LABEL[c.status] || c.status}</Text>
        </View>
      ),
    },
    { key: 'rating', label: 'Rating', render: (c) => <RatingBadge rating={computeCustomerRating(ordersForCustomerRow(orders, c))} size="xs" /> },
    { key: 'outstanding', label: 'Outstanding', render: (c) => `GHS ${outstandingCreditFor(orders, c).toLocaleString()}` },
    {
      key: 'limit', label: 'Credit Limit',
      render: (c) => {
        const draft = limitDraft[c.id];
        const current = draft !== undefined ? draft : (c.creditLimit != null ? String(c.creditLimit) : '');
        return <Input value={current} onChangeText={(v) => setLimitDraft((prev) => ({ ...prev, [c.id]: v }))} placeholder="No limit" keyboardType="numeric" style={{ width: 100 }} />;
      },
    },
    {
      key: 'headroom', label: 'Headroom',
      render: (c) => {
        if (c.creditLimit == null) return 'Global cap applies';
        const headroom = c.creditLimit - outstandingCreditFor(orders, c);
        return `GHS ${headroom.toLocaleString()}`;
      },
    },
    {
      key: 'creditStatus', label: 'Status',
      render: (c) => (
        <Text
          onPress={() => toggleCreditStatus(c)}
          style={{
            fontFamily: t.font.bold, fontSize: t.type.meta10.size, overflow: 'hidden',
            paddingVertical: 2, paddingHorizontal: 8, borderRadius: t.radius.pill,
            color: c.creditStatus === 'ON_HOLD' ? t.colors.status.danger.text : t.colors.status.success.text,
            backgroundColor: c.creditStatus === 'ON_HOLD' ? t.colors.status.danger.bg : t.colors.status.success.bg,
            opacity: togglingId === c.id ? 0.5 : 1,
          }}
        >
          {togglingId === c.id ? '…' : c.creditStatus === 'ON_HOLD' ? 'ON HOLD' : 'Active'}
        </Text>
      ),
    },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
            <CreditCard size={16} color={t.colors.textPrimary} />
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Customer Credit</Text>
          </View>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 2 }}>
            A blank limit falls back to the CEO's global credit cap.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <View style={{ flex: 1 }}><MetricCard label="On Credit Hold" value={onHoldCount} tone="danger" icon={<ShieldAlert size={16} color={t.colors.status.danger.text} />} /></View>
          <View style={{ flex: 1 }}><MetricCard label="At/Over Limit" value={overLimitCount} tone="warning" /></View>
        </View>

        <Input value={search} onChangeText={setSearch} placeholder="Search customers..." />

        <DataList
          columns={columns}
          data={filtered}
          rowKey={(c) => c.id}
          loading={loading}
          emptyTitle="No customers found"
          renderActions={(c) => {
            const draft = limitDraft[c.id];
            const currentLimitStr = c.creditLimit != null ? String(c.creditLimit) : '';
            const dirty = draft !== undefined && draft.trim() !== currentLimitStr;
            if (!dirty) return null;
            return <Button label={savingId === c.id ? 'Saving…' : 'Save'} size="sm" onPress={() => saveCreditLimit(c)} loading={savingId === c.id} />;
          }}
        />
      </View>
    </Screen>
  );
}
