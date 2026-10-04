// rebma-mobile/components/shared/DepartmentChangeCard.tsx
//
// "Change department" on the person's own profile (approved rule): the
// request goes to the CEO, and nothing changes until the CEO approves it
// (api/department-change.ts). Shows the latest request and lets the person
// withdraw one that is still waiting.
// Web twin: rebma-web/src/components/hr/DepartmentChangeCard.tsx.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { useTheme } from '../../theme/ThemeProvider';
import { ApiNotConfiguredError } from '../../lib/apiBase';
import {
  getMyDepartmentChange, departmentChangeApi, MOVABLE_DEPARTMENTS, deptLabel, type DepartmentChangeRequest,
} from '../../lib/staffDirectory';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input, { Field } from '../ui/Input';
import SearchablePicker from '../ui/SearchablePicker';

const STATUS_TEXT: Record<DepartmentChangeRequest['status'], string> = {
  pending: 'Waiting for the CEO', approved: 'Approved', rejected: 'Not approved', cancelled: 'Cancelled',
};

export default function DepartmentChangeCard({ userId, currentDepartment }: { userId: string; currentDepartment: string }) {
  const t = useTheme();
  const [latest, setLatest] = useState<DepartmentChangeRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [toDepartment, setToDepartment] = useState('');
  const [toRole, setToRole] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setLatest(await getMyDepartmentChange(userId)), [userId]);
  useEffect(() => { load(); }, [load]);

  const errorText = (e: any) => (e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'That did not work.'));
  const options = MOVABLE_DEPARTMENTS.filter((d) => d.label !== currentDepartment);

  const submit = async () => {
    if (!toDepartment) { Alert.alert('Missing Info', 'Pick the department you want to move to.'); return; }
    if (!reason.trim()) { Alert.alert('Missing Info', 'Tell the CEO why you want to move.'); return; }
    setBusy(true);
    try {
      const res = await departmentChangeApi.request(toDepartment, toRole.trim(), reason.trim());
      setOpen(false); setToDepartment(''); setToRole(''); setReason('');
      Alert.alert('Request sent', res.message);
      load();
    } catch (e: any) {
      Alert.alert('Could not send', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (!latest) return;
    Alert.alert('Cancel request', 'Withdraw your department change request?', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Withdraw', onPress: async () => {
        try { Alert.alert('Withdrawn', (await departmentChangeApi.cancel(latest.id)).message); load(); } catch (e: any) { Alert.alert('Failed', errorText(e)); }
      } },
    ]);
  };

  const pending = latest?.status === 'pending';

  return (
    <Card>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: 4 }}>Change department</Text>
      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
        Ask to move to another department. The CEO approves it first; nothing changes before that.
      </Text>
      {latest && (
        <View style={{ marginBottom: t.spacing.sm, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>
              Last request: {deptLabel(latest.toDepartment)}{latest.toRole ? ` as ${latest.toRole}` : ''}
            </Text>
            <Badge tone={pending ? 'warning' : latest.status === 'approved' ? 'success' : 'muted'} label={STATUS_TEXT[latest.status]} size="xs" />
          </View>
          {!!latest.note && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>Note: {latest.note}</Text>}
          {pending && <View style={{ alignItems: 'flex-start' }}><Button label="Withdraw request" size="sm" variant="ghost" onPress={cancel} /></View>}
        </View>
      )}
      {!pending && !open && <View style={{ alignItems: 'flex-start' }}><Button label="Request a move" size="sm" variant="ghost" onPress={() => setOpen(true)} /></View>}
      {!pending && open && (
        <View style={{ gap: t.spacing.sm }}>
          <Field label="Move to">
            <SearchablePicker value={toDepartment} onChange={setToDepartment} placeholder="Pick a department" options={options.map((d) => ({ value: d.code, label: d.label }))} />
          </Field>
          <Field label="Role there (optional)"><Input value={toRole} onChangeText={setToRole} placeholder="e.g. Sales Officer" /></Field>
          <Field label="Reason">
            <Input value={reason} onChangeText={setReason} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} placeholder="Why do you want to move?" />
          </Field>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label="Cancel" size="sm" variant="ghost" onPress={() => setOpen(false)} />
            <Button label={busy ? 'Sending…' : 'Send to CEO'} size="sm" onPress={submit} loading={busy} disabled={busy} />
          </View>
        </View>
      )}
    </Card>
  );
}
