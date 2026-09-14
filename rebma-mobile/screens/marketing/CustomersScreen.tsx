// rebma-mobile/screens/marketing/CustomersScreen.tsx
// Ports: rebma-web/src/views/marketing/CustomersView.tsx (825 lines) — full
// CRUD + a rich detail/profile view. See the plan's §2 for the verified
// field list, upload mechanism, and detail-view contents. Only `name` and
// `phone` are enforced (matches web); editing a RETURNED_FOR_CORRECTION
// customer implicitly flips status back to PENDING on save (no separate
// resubmit button, matches web).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import { Camera as CameraIcon, FileText } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { pickOrCaptureImageAsset } from '../../lib/media';
import { uploadToPrivateBucket, getSignedUrl } from '../../lib/storage';
import { computeCustomerRating, ordersForCustomerRow, outstandingCreditFor, type OrderLike } from '../../utils/customerRating';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import RatingBadge from '../../components/ui/RatingBadge';
import Avatar from '../../components/ui/Avatar';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import LocationPicker, { type LocationValue } from '../../components/shared/LocationPicker';

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  company_name: string | null;
  ghana_card_id: string | null;
  ghana_card_id_2: string | null;
  partner_name: string | null;
  house_address: string | null;
  company_address: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  business_certificate_url: string | null;
  customer_photo: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  is_special_customer: boolean | null;
  discount_percent: number | null;
  credit_limit: number | null;
  credit_status: string | null;
}

const VERIFICATION_TONE: Record<string, 'warning' | 'success' | 'danger' | 'muted'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', RETURNED_FOR_CORRECTION: 'muted',
};

const emptyForm = {
  name: '', phone: '', companyName: '', location: '', email: '', ghanaCard: '', ghanaCard2: '',
  partnerName: '', houseAddress: '', companyAddress: '', notes: '', isSpecial: false,
};

export default function CustomersScreen() {
  const t = useTheme();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerRow | null>(null);
  const [detail, setDetail] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [gps, setGps] = useState<LocationValue | null>(null);
  const [certUrl, setCertUrl] = useState<string | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [custRes, ordersRes] = await Promise.all([
      supabase.from('customers').select('*').order('registered_at', { ascending: false }).limit(200),
      supabase.from('orders').select('id, customer_id, client_name, total_amount, amount_paid, payment_mode, status, created_at').order('created_at', { ascending: false }).limit(300),
    ]);
    if (custRes.data) setCustomers(custRes.data as any);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const locations = useMemo(() => Array.from(new Set(customers.map((c) => c.location).filter(Boolean))) as string[], [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.company_name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
      const matchesLocation = locationFilter === 'ALL' || c.location === locationFilter;
      return matchesSearch && matchesLocation;
    });
  }, [customers, search, locationFilter]);

  const totalCredit = customers.reduce((s, c) => s + outstandingCreditFor(orders, c), 0);
  const newThisMonth = customers.filter((c) => {
    const d = new Date((c as any).registered_at || 0);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const activeCount = customers.filter((c) => ordersForCustomerRow(orders, c).length > 0).length;

  const closeForm = () => {
    setShowAdd(false);
    setEditTarget(null);
    setForm(emptyForm);
    setGps(null);
    setCertUrl(null);
  };

  const openAdd = () => {
    setForm(emptyForm);
    setGps(null);
    setCertUrl(null);
    setShowAdd(true);
  };

  const openEdit = (c: CustomerRow) => {
    setForm({
      name: c.name, phone: c.phone || '', companyName: c.company_name || '', location: c.location || '',
      email: c.email || '', ghanaCard: c.ghana_card_id || '', ghanaCard2: c.ghana_card_id_2 || '',
      partnerName: c.partner_name || '', houseAddress: c.house_address || '', companyAddress: c.company_address || '',
      notes: c.notes || '', isSpecial: !!c.is_special_customer,
    });
    setGps(c.gps_lat != null && c.gps_lng != null ? { address: `${c.gps_lat}, ${c.gps_lng}`, lat: c.gps_lat, lng: c.gps_lng } : null);
    setCertUrl(c.business_certificate_url);
    setDetail(null);
    setEditTarget(c);
  };

  // business_certificate_url now holds a private-bucket PATH, not a
  // directly-openable URL — a fresh signed URL is resolved on demand each
  // time "View Certificate" is tapped, matching web's equivalent.
  const viewBusinessCertificate = async (path: string) => {
    const url = await getSignedUrl('business-certificates', path);
    if (!url) { Alert.alert('Unavailable', 'Could not open certificate. It may have been removed.'); return; }
    Linking.openURL(url);
  };

  const uploadCertificate = async () => {
    const asset = await pickOrCaptureImageAsset();
    if (!asset) return;
    setUploadingCert(true);
    try {
      // Private bucket — stores the raw storage path, not a public URL.
      const path = await uploadToPrivateBucket(asset.uri, 'business-certificates', editTarget?.id || `new-${Date.now()}`, asset.mimeType);
      if (!path) throw new Error('Upload failed.');
      setCertUrl(path);
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message || 'Could not upload the certificate.');
    } finally {
      setUploadingCert(false);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert('Missing Info', 'Full name and phone are required.');
      return;
    }
    setSubmitting(true);
    const basePayload: Record<string, any> = {
      name: form.name.trim(), phone: form.phone.trim(), company_name: form.companyName.trim() || null,
      location: form.location.trim() || null, email: form.email.trim() || null,
      ghana_card_id: form.ghanaCard.trim() || null, ghana_card_id_2: form.ghanaCard2.trim() || null,
      partner_name: form.partnerName.trim() || null, house_address: form.houseAddress.trim() || null,
      company_address: form.companyAddress.trim() || null, notes: form.notes.trim() || null,
      is_special_customer: form.isSpecial, gps_lat: gps?.lat ?? null, gps_lng: gps?.lng ?? null,
      business_certificate_url: certUrl,
    };
    if (editTarget) {
      if (editTarget.status === 'RETURNED_FOR_CORRECTION') basePayload.status = 'PENDING';
      const { error } = await supabase.from('customers').update(basePayload).eq('id', editTarget.id);
      setSubmitting(false);
      if (error) {
        Alert.alert('Update Failed', error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('customers').insert([{ ...basePayload, status: 'PENDING', registered_at: new Date().toISOString() }]);
      setSubmitting(false);
      if (error) {
        Alert.alert('Add Failed', error.message);
        return;
      }
    }
    closeForm();
    load();
  };

  const openDetail = (c: CustomerRow) => {
    setEditTarget(null);
    setDetail(c);
  };

  const detailOrders = detail ? ordersForCustomerRow(orders, detail) : [];
  const detailRating = computeCustomerRating(detailOrders);
  const detailOutstanding = detail ? outstandingCreditFor(orders, detail) : 0;
  const detailTotalSpend = detailOrders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + (o.total_amount || 0), 0);
  const detailCreditOrders = detailOrders.filter((o) => (o.payment_mode || '').toUpperCase() === 'CREDIT');

  const columns: DataColumn<CustomerRow>[] = [
    { key: 'name', label: 'Customer', primary: true },
    { key: 'status', label: 'Status', status: true, render: (c) => <Badge tone={VERIFICATION_TONE[c.status] || 'muted'} label={c.status.replace(/_/g, ' ')} /> },
    { key: 'company_name', label: 'Company', render: (c) => c.company_name || '—' },
    { key: 'phone', label: 'Phone', render: (c) => c.phone || '—' },
    { key: 'rating', label: 'Rating', render: (c) => <RatingBadge rating={computeCustomerRating(ordersForCustomerRow(orders, c))} size="xs" /> },
  ];

  const orderColumns: DataColumn<OrderLike>[] = [
    { key: 'client_name', label: 'Order', primary: true, render: (o) => o.id || '—' },
    { key: 'status', label: 'Status', status: true, render: (o) => <Badge tone="muted" label={(o.status || '').replace(/_/g, ' ')} /> },
    { key: 'total_amount', label: 'Amount', render: (o) => `GHS ${Number(o.total_amount || 0).toLocaleString()}` },
    { key: 'created_at', label: 'Date', render: (o) => (o.created_at ? new Date(o.created_at).toLocaleDateString() : '—') },
  ];

  const creditColumns: DataColumn<OrderLike>[] = [
    { key: 'client_name', label: 'Order', primary: true, render: (o) => o.id || '—' },
    {
      key: 'paid', label: 'Status', status: true,
      render: (o) => {
        const paid = o.amount_paid || 0;
        const total = o.total_amount || 0;
        const tone = paid >= total ? 'success' : paid > 0 ? 'warning' : 'danger';
        const label = paid >= total ? 'PAID' : paid > 0 ? 'PART PAID' : 'UNPAID';
        return <Badge tone={tone} label={label} />;
      },
    },
    { key: 'total_amount', label: 'Amount', render: (o) => `GHS ${Number(o.total_amount || 0).toLocaleString()}` },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Register Customer" onPress={openAdd} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Customers" value={loading ? '—' : customers.length} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Active (with Orders)" value={loading ? '—' : activeCount} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="New This Month" value={loading ? '—' : newThisMonth} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Credit Outstanding" value={loading ? '—' : `GHS ${totalCredit.toLocaleString()}`} tone="warning" /></View>
        </View>

        <Input value={search} onChangeText={setSearch} placeholder="Search customers…" />
        {locations.length > 0 && (
          <SearchablePicker
            label="Location"
            value={locationFilter}
            onChange={setLocationFilter}
            options={[{ value: 'ALL', label: 'All Locations' }, ...locations.map((l) => ({ value: l, label: l }))]}
          />
        )}

        <DataList columns={columns} data={filtered} rowKey={(c) => c.id} loading={loading} emptyTitle="No customers found" onRowPress={openDetail} />
      </View>

      {/* Add / Edit form */}
      <Sheet
        open={showAdd || !!editTarget}
        onClose={closeForm}
        title={editTarget ? 'Edit Customer' : 'Register Customer'}
        side="bottom"
        maxHeight={680}
        footer={<Button label={submitting ? 'Saving…' : 'Save Customer'} onPress={save} loading={submitting} disabled={submitting} fullWidth />}
      >
        <SheetSection label="Contact">
          <Field label="Full Name *"><Input value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Customer name" /></Field>
          <Field label="Phone *"><Input value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="Phone number" keyboardType="phone-pad" /></Field>
          <Field label="Email" hint="Optional"><Input value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" /></Field>
          <Field label="Company Name" hint="Optional"><Input value={form.companyName} onChangeText={(v) => setForm((f) => ({ ...f, companyName: v }))} placeholder="Company name" /></Field>
          <Field label="Location" hint="Optional"><Input value={form.location} onChangeText={(v) => setForm((f) => ({ ...f, location: v }))} placeholder="City/area" /></Field>
        </SheetSection>

        <SheetSection label="Identification">
          <Field label="Ghana Card" hint="Optional"><Input value={form.ghanaCard} onChangeText={(v) => setForm((f) => ({ ...f, ghanaCard: v }))} placeholder="GHA-000000000-0" /></Field>
          <Field label="Second Ghana Card" hint="Optional"><Input value={form.ghanaCard2} onChangeText={(v) => setForm((f) => ({ ...f, ghanaCard2: v }))} placeholder="GHA-000000000-0" /></Field>
          <Field label="Partner / Second Customer Name" hint="Optional"><Input value={form.partnerName} onChangeText={(v) => setForm((f) => ({ ...f, partnerName: v }))} placeholder="Partner name" /></Field>
        </SheetSection>

        <SheetSection label="Address & Location">
          <Field label="House / Residential Address" hint="Optional"><Input value={form.houseAddress} onChangeText={(v) => setForm((f) => ({ ...f, houseAddress: v }))} placeholder="Residential address" /></Field>
          <Field label="Company Address" hint="Optional"><Input value={form.companyAddress} onChangeText={(v) => setForm((f) => ({ ...f, companyAddress: v }))} placeholder="Company address" /></Field>
          <Field label="GPS Location" hint="Optional"><LocationPicker value={gps} onChange={setGps} /></Field>
        </SheetSection>

        <SheetSection label="Documents">
          <Field label="Business Certificate" hint="Optional">
            <Button
              variant="ghost"
              icon={<CameraIcon size={14} color={t.colors.textSecondary} />}
              label={uploadingCert ? 'Uploading…' : certUrl ? 'Change Certificate' : 'Add Certificate'}
              onPress={uploadCertificate}
              loading={uploadingCert}
              disabled={uploadingCert}
            />
          </Field>
        </SheetSection>

        <SheetSection label="Notes">
          <Field label="Customer Notes" hint="Optional"><Input value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Internal notes" /></Field>
        </SheetSection>
      </Sheet>

      {/* Detail / profile */}
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name} side="bottom" maxHeight={680}
        footer={detail ? <Button label="Edit Customer" size="sm" onPress={() => openEdit(detail)} /> : undefined}
      >
        {detail && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.lg }}>
              <Avatar name={detail.name} photo={detail.customer_photo} isSpecial={!!detail.is_special_customer} size={56} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
                  <Badge tone={VERIFICATION_TONE[detail.status] || 'muted'} label={detail.status.replace(/_/g, ' ')} />
                  <RatingBadge rating={detailRating} />
                  {detail.credit_status === 'ON_HOLD' && <Badge tone="danger" label="ON CREDIT HOLD" />}
                </View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
                  Credit: {detail.credit_limit != null ? `GHS ${detail.credit_limit.toLocaleString()} limit` : 'No limit set'} · GHS {detailOutstanding.toLocaleString()} outstanding
                </Text>
              </View>
            </View>

            {(detail.status === 'REJECTED' || detail.status === 'RETURNED_FOR_CORRECTION') && detail.rejection_reason && (
              <Card tone="inset" style={{ marginBottom: t.spacing.md }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.status.danger.text }}>Risk's reason: {detail.rejection_reason}</Text>
              </Card>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
              <View style={{ width: '47%' }}><MetricCard label="Total Orders" value={detailRating.orderCount} /></View>
              <View style={{ width: '47%' }}><MetricCard label="Total Spend" value={`GHS ${detailTotalSpend.toLocaleString()}`} /></View>
            </View>

            <SheetSection label="Contact">
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{detail.phone || '—'} · {detail.email || '—'}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginTop: 4 }}>{detail.company_name || '—'} · {detail.location || '—'}</Text>
            </SheetSection>

            {detail.gps_lat != null && detail.gps_lng != null && (
              <SheetSection label="Location">
                <Text
                  onPress={() => Linking.openURL(`https://www.google.com/maps?q=${detail.gps_lat},${detail.gps_lng}`)}
                  style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.accent }}
                >
                  View on map →
                </Text>
              </SheetSection>
            )}

            {detail.business_certificate_url && (
              <SheetSection label="Business Certificate">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <FileText size={12} color={t.colors.accent} />
                  <Text
                    onPress={() => viewBusinessCertificate(detail.business_certificate_url!)}
                    style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.accent }}
                  >
                    View Certificate →
                  </Text>
                </View>
              </SheetSection>
            )}

            {detail.notes && (
              <SheetSection label="Notes">
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{detail.notes}</Text>
              </SheetSection>
            )}

            <SheetSection label={`Order History (${detailOrders.length})`}>
              <DataList columns={orderColumns} data={detailOrders} rowKey={(o) => o.id || Math.random().toString()} emptyTitle="No orders yet" />
            </SheetSection>

            {detailCreditOrders.length > 0 && (
              <SheetSection label="Credit / Payment History">
                <DataList columns={creditColumns} data={detailCreditOrders} rowKey={(o) => o.id || Math.random().toString()} emptyTitle="No credit orders" />
              </SheetSection>
            )}
          </>
        )}
      </Sheet>
    </Screen>
  );
}
