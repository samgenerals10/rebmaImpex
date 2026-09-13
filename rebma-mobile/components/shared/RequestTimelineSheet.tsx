// rebma-mobile/components/shared/RequestTimelineSheet.tsx
//
// Phase 7.5, D34. Ports rebma-web/src/components/global/RequestTimelinePanel.tsx
// — a different question than ApprovalHistoryPanel: "what happened to THIS
// ONE request" (filtered by reference_id, no department filter, ascending),
// so one cargo intake's row can carry Operations' submission, Risk's
// return, Operations' resubmission, and Risk's approval on one connected
// list even though those decisions were made by different departments.
// No realtime subscription (see ApprovalHistoryPanel.tsx's comment — no
// screen in this codebase uses one yet); reloads on open instead, which
// covers the actual use case (opened after navigating to a detail view).
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { History, CheckCircle, XCircle, RotateCcw, ArrowUpCircle, Clock } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Sheet from '../ui/Sheet';
import { SkeletonList } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';

interface TimelineRow {
  id: string;
  action: string;
  department: string;
  performed_by: string | null;
  details: string | null;
  timestamp: string;
}

function iconFor(action: string): { Icon: typeof CheckCircle; colorKey: 'danger' | 'warning' | 'info' | 'success' | 'muted' } {
  if (/reject/i.test(action)) return { Icon: XCircle, colorKey: 'danger' };
  if (/return/i.test(action)) return { Icon: RotateCcw, colorKey: 'warning' };
  if (/escalate/i.test(action)) return { Icon: ArrowUpCircle, colorKey: 'info' };
  if (/approve/i.test(action)) return { Icon: CheckCircle, colorKey: 'success' };
  return { Icon: Clock, colorKey: 'muted' };
}

interface Props {
  open: boolean;
  onClose: () => void;
  referenceId: string;
  displayId?: string;
}

export default function RequestTimelineSheet({ open, onClose, referenceId, displayId }: Props) {
  const t = useTheme();
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!referenceId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('global_audit_history')
        .select('*')
        .eq('reference_id', referenceId)
        .order('timestamp', { ascending: true });
      setRows(data || []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [referenceId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  return (
    <Sheet open={open} onClose={onClose} title="Request Timeline" subtitle={displayId} side="bottom" maxHeight={640}>
      {loading ? (
        <SkeletonList rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<History size={20} color={t.colors.textMuted} />}
          title="No timeline entries yet"
          description="Decisions recorded before this feature shipped are not linked."
        />
      ) : (
        <View style={{ gap: t.spacing.lg }}>
          {rows.map((row) => {
            const { Icon, colorKey } = iconFor(row.action);
            const color = t.colors.status[colorKey].text;
            return (
              <View key={row.id} style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${color}20`, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Icon size={12} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{row.action}</Text>
                  {row.details ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginTop: 2 }}>{row.details}</Text> : null}
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                    {row.performed_by || 'System'} · {row.department} · {row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
