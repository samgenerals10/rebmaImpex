// rebma-mobile/components/shared/DepartmentChangesPanel.tsx
//
// Requests to move to another department, waiting for the CEO (approved
// rule: the CEO approves first, nothing changes before that). Shown in the
// CEO's Approvals. Web twin: rebma-web/src/components/hr/DepartmentChangesPanel.tsx.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { ArrowLeftRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../ui/Card';
import Button from '../ui/Button';
import PasswordConfirmSheet from './PasswordConfirmSheet';
import { ApiNotConfiguredError } from '../../lib/apiBase';
import { listPendingDepartmentChanges, departmentChangeApi, deptLabel, type DepartmentChangeRequest } from '../../lib/staffDirectory';

export default function DepartmentChangesPanel({ refreshKey }: { refreshKey?: number }) {
  const t = useTheme();
  const [rows, setRows] = useState<DepartmentChangeRequest[]>([]);
  const [decision, setDecision] = useState<{ request: DepartmentChangeRequest; action: 'approve' | 'reject' } | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listPendingDepartmentChanges()); } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (rows.length === 0) return null;

  const run = async (password: string) => {
    if (!decision) return;
    try {
      const res = decision.action === 'approve'
        ? await departmentChangeApi.approve(decision.request.id, password)
        : await departmentChangeApi.reject(decision.request.id, password);
      setDecision(null);
      Alert.alert(decision.action === 'approve' ? 'Moved' : 'Rejected', res.message);
      load();
    } catch (e: any) {
      throw new Error(e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'That did not work.'));
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.xs }}>
        <ArrowLeftRight size={16} color={t.colors.accent} />
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Department Change Requests</Text>
      </View>
      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
        Staff asking to move department. Nothing changes until you approve.
      </Text>
      {rows.map((r) => (
        <View key={r.id} style={{ paddingVertical: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border, gap: 6 }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>
            {r.fullName}: {deptLabel(r.fromDepartment) || 'no department'} to {deptLabel(r.toDepartment)}{r.toRole ? ` as ${r.toRole}` : ''}
          </Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
            Asked on {new Date(r.createdAt).toLocaleDateString()}. Reason: {r.reason}
          </Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label="Approve" size="sm" onPress={() => setDecision({ request: r, action: 'approve' })} />
            <Button label="Reject" size="sm" variant="ghost" onPress={() => setDecision({ request: r, action: 'reject' })} />
          </View>
        </View>
      ))}
      <PasswordConfirmSheet
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? 'Approve Department Change' : 'Reject Department Change'}
        description={decision
          ? decision.action === 'approve'
            ? `Move ${decision.request.fullName} to ${deptLabel(decision.request.toDepartment)}${decision.request.toRole ? ` as ${decision.request.toRole}` : ''}? Their past work stays where they did it. Type your password to confirm it is you.`
            : `Reject ${decision.request.fullName}'s request? They stay where they are. Type your password to confirm it is you.`
          : ''}
        confirmLabel={decision?.action === 'approve' ? 'Approve' : 'Reject'}
        onConfirm={run}
      />
    </Card>
  );
}
