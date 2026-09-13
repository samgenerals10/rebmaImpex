// rebma-mobile/screens/hr/RegistrationsScreen.tsx
// Ports: rebma-web/src/views/hr/RegistrationsView.tsx (455 lines, read in
// full) — D51. List/edit/delete are plain, unblocked `profiles` writes.
// Approve/Deny call the privileged approve-user API via lib/apiBase.ts
// (D53), same gated-until-configured pattern as StaffScreen's Add Staff.
// Queried the same way web's getPendingUsers() does: profiles where
// status='PENDING_APPROVAL', excluding MANAGEMENT/HR (those need the
// CEO specifically, not HR — confirmed via RegistrationsView.tsx's own
// CEO_ONLY_DEPARTMENTS filter). Approved/denied items are removed from
// the local list on success — matching web's actual behavior exactly
// (a re-fetch of getPendingUsers() would no longer include them either,
// since their status has moved off PENDING_APPROVAL).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { CheckCircle, XCircle, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { callPrivilegedApi, ApiNotConfiguredError } from '../../lib/apiBase';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';

const CEO_ONLY_DEPARTMENTS = ['MANAGEMENT', 'HR'];

interface Registration {
  id: string; fullName: string; email: string; department: string; ghanaCard: string; phone: string; submittedAt: string;
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function RegistrationsScreen() {
  const t = useTheme();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Registration | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [credPopup, setCredPopup] = useState<{ email: string; password: string } | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [showDeny, setShowDeny] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('status', 'PENDING_APPROVAL').order('created_at', { ascending: false });
    setRegistrations((data || [])
      .filter((r: any) => !CEO_ONLY_DEPARTMENTS.includes(String(r.role || '').toUpperCase()))
      .map((r: any) => ({
        id: r.id, fullName: r.full_name || '', email: r.email || '', department: r.role || '',
        ghanaCard: r.ghana_card_id || 'N/A', phone: r.phone || '', submittedAt: r.created_at ? new Date(r.created_at).toLocaleString() : '',
      })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = registrations.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.fullName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.ghanaCard.toLowerCase().includes(q);
  });

  const approve = async (reg: Registration) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const pw = generatePassword();
      await callPrivilegedApi('/api/approve-user', { userId: reg.id, approve: true, generatedPassword: pw });
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
      setSelected(null);
      setCredPopup({ email: reg.email, password: pw });
    } catch (e: any) {
      if (e instanceof ApiNotConfiguredError) Alert.alert('Not Configured', e.message);
      else Alert.alert('Approval Failed', e.message || 'Could not approve this registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const deny = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await callPrivilegedApi('/api/approve-user', { userId: selected.id, approve: false, remark: denyReason || undefined });
      setRegistrations((prev) => prev.filter((r) => r.id !== selected.id));
      setSelected(null);
      setShowDeny(false);
      setDenyReason('');
    } catch (e: any) {
      if (e instanceof ApiNotConfiguredError) Alert.alert('Not Configured', e.message);
      else Alert.alert('Denial Failed', e.message || 'Could not deny this registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Registration', 'Are you sure you want to delete this registration request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) { Alert.alert('Error', error.message); return; }
        setRegistrations((prev) => prev.filter((r) => r.id !== id));
        setSelected(null);
      } },
    ]);
  };

  const columns: DataColumn<Registration>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'department', label: 'Department', status: true, render: (r) => <Badge tone="warning" label={r.department} size="xs" /> },
    { key: 'email', label: 'Email' },
    { key: 'submittedAt', label: 'Submitted' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search by name, email, or Ghana Card..." />
        <DataList columns={columns} data={filtered} rowKey={(r) => r.id} loading={loading} emptyTitle="No pending registrations" onRowPress={setSelected} />
      </View>

      <Sheet open={!!selected && !showDeny} onClose={() => setSelected(null)} title={selected?.fullName} subtitle={selected?.department} side="bottom" maxHeight={520}>
        {selected && (
          <View style={{ gap: t.spacing.lg }}>
            <SheetSection label="Details">
              <View style={{ gap: t.spacing.sm }}>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Email: {selected.email}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Phone: {selected.phone || '—'}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Ghana Card: {selected.ghanaCard}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Submitted: {selected.submittedAt}</Text>
              </View>
            </SheetSection>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              <Button label="Approve" size="sm" icon={<CheckCircle size={13} color="#fff" />} onPress={() => approve(selected)} loading={submitting} disabled={submitting} />
              <Button label="Deny" size="sm" variant="danger" icon={<XCircle size={13} color="#fff" />} onPress={() => setShowDeny(true)} disabled={submitting} />
              <Button label="Delete" size="sm" variant="ghost" icon={<Trash2 size={13} color={t.colors.textSecondary} />} onPress={() => handleDelete(selected.id)} disabled={submitting} />
            </View>
          </View>
        )}
      </Sheet>

      <Sheet open={showDeny} onClose={() => setShowDeny(false)} title="Deny Registration" subtitle={selected?.fullName} side="bottom" maxHeight={360}
        footer={<Button label={submitting ? 'Denying…' : 'Confirm Deny'} variant="danger" onPress={deny} loading={submitting} disabled={submitting} fullWidth />}>
        <Field label="Reason (optional)"><Input value={denyReason} onChangeText={setDenyReason} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} /></Field>
      </Sheet>

      <Sheet open={!!credPopup} onClose={() => setCredPopup(null)} title="User Approved" side="bottom" maxHeight={320}
        footer={<Button label="Done" onPress={() => setCredPopup(null)} fullWidth />}>
        {credPopup && (
          <View style={{ gap: t.spacing.sm }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Share these credentials now — the password won't be shown again.</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Email: {credPopup.email}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Password: {credPopup.password}</Text>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
