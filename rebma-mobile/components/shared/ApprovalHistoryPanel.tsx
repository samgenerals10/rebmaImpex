// rebma-mobile/components/shared/ApprovalHistoryPanel.tsx
//
// Phase 7.5, D34. Ports rebma-web/src/components/global/ApprovalHistoryPanel.tsx
// — a department-scoped "previous approvals" list sourced from
// global_audit_history, department-agnostic (`{ department, title? }`), used
// by Risk now and ready for Management's 7.6 dashboards to reuse unmodified.
// Web auto-refreshes via a Supabase realtime channel on INSERT; nothing in
// this codebase uses realtime yet (confirmed — no other mobile screen
// subscribes to a channel), so this ports a plain reload-on-mount +
// pull-to-refresh instead, matching every other screen's own convention.
// No capability is lost — the list is current on open and after every
// action any screen embedding this panel takes.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { CheckCircle, XCircle, History } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../ui/Card';
import { SkeletonList } from '../ui/Skeleton';

interface HistoryRow {
  id: string;
  action: string;
  details: string | null;
  performed_by: string | null;
  timestamp: string;
}

interface Props {
  department: string;
  title?: string;
  limit?: number;
}

export default function ApprovalHistoryPanel({ department, title = 'Previous Approvals', limit = 5 }: Props) {
  const t = useTheme();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('global_audit_history')
        .select('*')
        .eq('department', department)
        .order('timestamp', { ascending: false })
        .limit(30);
      setRows(data || []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [department]);

  useEffect(() => { load(); }, [load]);

  if (!loading && rows.length === 0) return null;

  const visible = rows.slice(0, limit);

  return (
    <Card padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
        <History size={15} color={t.colors.textMuted} />
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{title}</Text>
      </View>
      {loading ? (
        <View style={{ padding: t.spacing.lg }}><SkeletonList rows={3} /></View>
      ) : (
        visible.map((row) => {
          const isReject = /reject/i.test(row.action);
          return (
            <View key={row.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm, padding: t.spacing.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
              {isReject ? <XCircle size={14} color={t.colors.status.danger.text} style={{ marginTop: 2 }} /> : <CheckCircle size={14} color={t.colors.status.success.text} style={{ marginTop: 2 }} />}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{row.action}</Text>
                {row.details ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 2 }}>{row.details}</Text> : null}
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                  {row.performed_by || 'System'} · {row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}
