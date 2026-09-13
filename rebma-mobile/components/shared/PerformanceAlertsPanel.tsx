// rebma-mobile/components/shared/PerformanceAlertsPanel.tsx
//
// Phase 7.6, D44. Ports rebma-web/src/views/PerformanceAlertsPanel.tsx —
// dept-agnostic, built as shared infra now since HR's 7.7 phase needs the
// identical thing (HrPerformanceAlertsView wraps the same underlying panel
// on web). Unresolved/All filter + manual "Run Check" (inserts fresh
// alerts via runPerformanceAlerts()) + per-alert Resolve. No 30-minute
// auto-poll (see utils/performanceAlerts.ts's header comment).
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { AlertCircle, AlertTriangle, RefreshCw, Check, Info } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { fetchPerformanceAlerts, runPerformanceAlerts, resolveAlert, type PerformanceAlert } from '../../utils/performanceAlerts';
import Button from '../ui/Button';
import { SkeletonList } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import type { StatusTone } from '../../theme/tokens';

const SEV_TONE: Record<PerformanceAlert['severity'], StatusTone> = {
  critical: 'danger', high: 'warning', medium: 'warning', low: 'info',
};
const SEV_ICON: Record<PerformanceAlert['severity'], typeof AlertCircle> = {
  critical: AlertCircle, high: AlertTriangle, medium: AlertTriangle, low: Info,
};

export default function PerformanceAlertsPanel() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'unresolved' | 'all'>('unresolved');

  const load = async () => {
    setLoading(true);
    setAlerts(await fetchPerformanceAlerts());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const run = async () => {
    setRunning(true);
    await runPerformanceAlerts();
    await load();
    setRunning(false);
  };

  const resolve = async (id?: string) => {
    if (!id) return;
    await resolveAlert(id, profile?.fullName);
    await load();
  };

  const isResolved = (a: PerformanceAlert) => a.status === 'resolved';
  const visible = alerts.filter((a) => filter === 'all' || !isResolved(a));
  const unresolvedCount = alerts.filter((a) => !isResolved(a)).length;

  return (
    <View style={{ gap: t.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
          {(['unresolved', 'all'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setFilter(v)}
              style={{
                paddingVertical: 6, paddingHorizontal: 12, borderRadius: t.radius.pill,
                backgroundColor: filter === v ? t.colors.accent : t.colors.bgCard,
                borderWidth: 1, borderColor: filter === v ? t.colors.accent : t.colors.border,
              }}
            >
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: filter === v ? t.colors.onAccent : t.colors.textSecondary }}>
                {v === 'unresolved' ? `Unresolved${unresolvedCount > 0 ? ` (${unresolvedCount})` : ''}` : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button label="Run Check" size="sm" variant="ghost" icon={<RefreshCw size={13} color={t.colors.textSecondary} />} onPress={run} loading={running} disabled={running} />
      </View>

      {loading ? (
        <SkeletonList rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Check size={20} color={t.colors.status.success.text} />} title="All clear" description={`No ${filter === 'unresolved' ? 'unresolved ' : ''}alerts. Run a check to refresh.`} />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {visible.map((alert, i) => {
            const tone = SEV_TONE[alert.severity];
            const c = t.colors.status[tone];
            const Icon = SEV_ICON[alert.severity];
            const resolved = isResolved(alert);
            return (
              <View key={alert.id || i} style={{ flexDirection: 'row', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radius.lg, borderWidth: 1, borderColor: c.bg, backgroundColor: c.bg, opacity: resolved ? 0.5 : 1 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.bgCard, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: t.spacing.xs, marginBottom: 2 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: c.text, textTransform: 'capitalize' }}>{alert.severity}</Text>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>· {alert.department}</Text>
                  </View>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{alert.description}</Text>
                </View>
                {!resolved && alert.id ? (
                  <Pressable onPress={() => resolve(alert.id)} style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, borderRadius: t.radius.sm, backgroundColor: t.colors.status.success.text }}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: '#fff' }}>Resolve</Text>
                  </Pressable>
                ) : resolved ? (
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.success.text, alignSelf: 'flex-start' }}>Resolved</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
