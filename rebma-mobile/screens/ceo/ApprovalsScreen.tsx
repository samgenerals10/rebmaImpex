// rebma-mobile/screens/ceo/ApprovalsScreen.tsx
// Ports: rebma-web/src/views/ceo/ApprovalsView.tsx (327 lines, read in
// full) — D73. A single live lane (Registration; credit/cargo moved to
// Risk in web's own Phase 1, payment never had a row-producing query —
// both confirmed dead, not ported). Approve/Reject both reuse
// lib/apiBase.ts's callPrivilegedApi('/api/approve-user', ...), the exact
// helper HR's RegistrationsScreen already established (Phase 7.7, D53).
// Query is deliberately UNFILTERED by department — unlike HR's own screen,
// which explicitly excludes MANAGEMENT/HR-role registrants because those
// are CEO's decision (confirmed via HR's CEO_ONLY_DEPARTMENTS filter).
// Reject notifies HR via the same supplier_order_notifications row web
// writes. Timeline reuses RequestTimelineSheet (Phase 7.5, D34). The
// temp-password reveal is ported faithfully; the one-tap clipboard-copy
// convenience is dropped (no expo-clipboard dependency exists yet) — the
// password stays fully visible/selectable on-screen either way.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { CheckCircle, XCircle, History } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { callPrivilegedApi, ApiNotConfiguredError } from '../../lib/apiBase';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface Approval {
  id: string;
  fullName: string;
  department: string;
  description: string;
  dateSubmitted: string;
}

export default function ApprovalsScreen() {
  const t = useTheme();
  const [rows, setRows] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [credPopup, setCredPopup] = useState<{ fullName: string; password: string } | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ item: Approval; action: 'approve' | 'reject' } | null>(null);
  const [remark, setRemark] = useState('');
  const [timelineId, setTimelineId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id,full_name,role,created_at,status').eq('status', 'PENDING_APPROVAL').limit(50);
    setRows((data || []).map((p: any) => ({
      id: p.id,
      fullName: p.full_name || 'New Employee',
      department: (p.role || 'STAFF').toUpperCase(),
      description: `Sign-up approval for role: ${p.role}`,
      dateSubmitted: p.created_at ? p.created_at.split('T')[0] : '',
    })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDecision = () => {
    if (!decisionModal) return;
    const { item, action } = decisionModal;
    setDecisionModal(null);
    if (action === 'approve') approve(item, remark.trim() || undefined);
    else reject(item, remark.trim() || undefined);
  };

  const approve = async (item: Approval, note?: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const pw = generateTempPassword();
      await callPrivilegedApi('/api/approve-user', { userId: item.id, approve: true, generatedPassword: pw, remark: note });
      setRows((prev) => prev.filter((r) => r.id !== item.id));
      setSelected(null);
      setCredPopup({ fullName: item.fullName, password: pw });
    } catch (e: any) {
      if (e instanceof ApiNotConfiguredError) Alert.alert('Not Configured', e.message);
      else Alert.alert('Approval Failed', e.message || 'Could not approve this registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async (item: Approval, note?: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await callPrivilegedApi('/api/approve-user', { userId: item.id, approve: false, remark: note });
      await supabase.from('supplier_order_notifications').insert({
        message: `Registration REJECTED by CEO: ${item.fullName} (${item.department})${note ? ` — ${note}` : ''}`,
        notified_department: 'HR',
        read: false,
      });
      setRows((prev) => prev.filter((r) => r.id !== item.id));
      setSelected(null);
    } catch (e: any) {
      if (e instanceof ApiNotConfiguredError) Alert.alert('Not Configured', e.message);
      else Alert.alert('Rejection Failed', e.message || 'Could not reject this registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: DataColumn<Approval>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'department', label: 'Department', status: true, render: (r) => <Badge tone="purple" label={r.department} size="xs" /> },
    { key: 'description', label: 'Request' },
    { key: 'dateSubmitted', label: 'Submitted' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.md }}>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
          {rows.length} pending approval{rows.length !== 1 ? 's' : ''}
        </Text>
        <DataList
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          loading={loading}
          onRowPress={setSelected}
          emptyIcon={<CheckCircle size={28} color={t.colors.status.success.text} />}
          emptyTitle="All clear!"
          emptyDescription="No pending approvals right now."
        />
      </View>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.fullName} subtitle={selected?.department} side="bottom" maxHeight={480}>
        {selected && (
          <View style={{ gap: t.spacing.lg }}>
            <SheetSection label="Details">
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{selected.description}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginTop: 4 }}>Submitted: {selected.dateSubmitted}</Text>
            </SheetSection>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              <Button label="View Timeline" size="sm" variant="ghost" icon={<History size={13} color={t.colors.textSecondary} />} onPress={() => setTimelineId(selected.id)} />
              <Button label="Approve" size="sm" icon={<CheckCircle size={13} color="#fff" />} onPress={() => { setRemark(''); setDecisionModal({ item: selected, action: 'approve' }); }} disabled={submitting} />
              <Button label="Reject" size="sm" variant="danger" icon={<XCircle size={13} color="#fff" />} onPress={() => { setRemark(''); setDecisionModal({ item: selected, action: 'reject' }); }} disabled={submitting} />
            </View>
          </View>
        )}
      </Sheet>

      <Sheet
        open={!!decisionModal}
        onClose={() => setDecisionModal(null)}
        title={decisionModal?.action === 'approve' ? 'Approve Registration' : 'Reject Registration'}
        side="bottom"
        maxHeight={360}
        footer={
          <Button
            label={decisionModal?.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            variant={decisionModal?.action === 'approve' ? 'primary' : 'danger'}
            onPress={confirmDecision}
            disabled={decisionModal?.action === 'reject' && !remark.trim()}
            loading={submitting}
            fullWidth
          />
        }
      >
        <Field label={`Remark ${decisionModal?.action === 'reject' ? '(required)' : '(optional)'}`}>
          <Input
            value={remark}
            onChangeText={setRemark}
            multiline
            numberOfLines={4}
            placeholder={decisionModal?.action === 'reject' ? 'Why is this registration being rejected?' : 'Optional note...'}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
        </Field>
      </Sheet>

      <Sheet open={!!credPopup} onClose={() => setCredPopup(null)} title="Account Approved" side="bottom" maxHeight={320} footer={<Button label="Done" onPress={() => setCredPopup(null)} fullWidth />}>
        {credPopup && (
          <View style={{ gap: t.spacing.sm }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
              Share this temporary password with {credPopup.fullName}. They'll be asked to change it on first login.
            </Text>
            <Text selectable style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.status.success.text }}>{credPopup.password}</Text>
          </View>
        )}
      </Sheet>

      <RequestTimelineSheet open={!!timelineId} onClose={() => setTimelineId(null)} referenceId={timelineId || ''} />
    </Screen>
  );
}
