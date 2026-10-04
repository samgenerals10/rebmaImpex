// rebma-mobile/components/shared/DeletionRequestsPanel.tsx
//
// "Delete Account" requests waiting to be confirmed (approved rule: the
// person asks, HR confirms, then the account is closed). HR confirms
// ordinary staff; requests from HR or Management staff are the CEO's.
// Closing an account deletes nothing: all their work stays in the system.
// Shown on HR's Staff screen and the CEO's Approvals.
//
// Web twin: rebma-web/src/components/hr/DeletionRequestsPanel.tsx.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { UserMinus } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../ui/Card';
import Button from '../ui/Button';
import PasswordConfirmSheet from './PasswordConfirmSheet';
import { ApiNotConfiguredError } from '../../lib/apiBase';
import { listPendingDeletionRequests, deletionApi, deptLabel, type DeletionRequest } from '../../lib/staffDirectory';

interface Props {
  callerIsCeo: boolean;
  callerId?: string;
  onChanged?: () => void;
  refreshKey?: number;
}

export default function DeletionRequestsPanel({ callerIsCeo, callerId, onChanged, refreshKey }: Props) {
  const t = useTheme();
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [decision, setDecision] = useState<{ request: DeletionRequest; action: 'approve' | 'reject' } | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listPendingDeletionRequests()); } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const mine = rows.filter((r) => r.userId !== callerId && (callerIsCeo || r.confirmer === 'HR'));
  if (mine.length === 0) return null;

  const run = async (password: string) => {
    if (!decision) return;
    try {
      const res = decision.action === 'approve'
        ? await deletionApi.approve(decision.request.id, password)
        : await deletionApi.reject(decision.request.id, password);
      setDecision(null);
      Alert.alert(decision.action === 'approve' ? 'Account closed' : 'Request rejected', res.message);
      load();
      onChanged?.();
    } catch (e: any) {
      throw new Error(e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'That did not work.'));
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.xs }}>
        <UserMinus size={16} color={t.colors.status.danger.text} />
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Account Deletion Requests</Text>
      </View>
      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
        Staff asking to delete their account. Confirming closes the account; all their work stays in the system.
      </Text>
      {mine.map((r) => (
        <View key={r.id} style={{ paddingVertical: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border, gap: 6 }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>
            {r.fullName}{r.department ? `, ${deptLabel(r.department)}` : ''}
          </Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
            Asked on {new Date(r.createdAt).toLocaleDateString()}. Reason: {r.reason}
          </Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label="Confirm" size="sm" variant="danger" onPress={() => setDecision({ request: r, action: 'approve' })} />
            <Button label="Reject" size="sm" variant="ghost" onPress={() => setDecision({ request: r, action: 'reject' })} />
          </View>
        </View>
      ))}
      <PasswordConfirmSheet
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? 'Close Account' : 'Reject Request'}
        description={decision
          ? decision.action === 'approve'
            ? `Close ${decision.request.fullName}'s account? They can no longer sign in. All their work stays in the system. Type your password to confirm it is you.`
            : `Reject ${decision.request.fullName}'s request? Their account stays open. Type your password to confirm it is you.`
          : ''}
        confirmLabel={decision?.action === 'approve' ? 'Close account' : 'Reject'}
        danger={decision?.action === 'approve'}
        onConfirm={run}
      />
    </Card>
  );
}
