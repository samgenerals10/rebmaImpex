// rebma-mobile/screens/management/LedgerScreen.tsx
// Ports: rebma-web/src/components/global/ActivityFeed.tsx (read in full) —
// the REAL Ledger sub-tab (views/ManagementDashboard.tsx:1014 routes
// activeSubTab==='Ledger' to <ActivityFeed>, not the dead
// 'Ledger_DISABLED_ORIGINAL' table UI still sitting unreachable in the
// same file — confirmed no activeSubTab value ever matches that branch).
// Org-wide (not one-department) audit feed, gated by the CEO's
// audit_log_access setting via the new lib/ceoSetting.ts (D41). No
// realtime subscription (D34 precedent) — reload on mount/refresh.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Activity, Lock } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import SearchablePicker from '../../components/ui/SearchablePicker';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

interface AuditEntry {
  id: string;
  action: string;
  department: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

const DEPT_DOT: Record<string, string> = {
  OPERATIONS: '#16a34a', FINANCE: '#3b82f6', MARKETING: '#f59e0b', MANAGEMENT: '#9333ea',
  DISPATCH: '#ea580c', PRODUCTION: '#0284c7', HR: '#db2777', CEO: '#334155', RISK: '#dc2626',
  ADMIN_WAREHOUSE: '#16a34a',
};

function fmtAgo(iso: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function LedgerScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [accessLevel, setAccessLevel] = useState('management_and_above');

  const load = useCallback(async () => {
    const level = await getCeoSetting('audit_log_access', 'management_and_above');
    setAccessLevel(level);
    const isManagementOrAbove = profile?.department === 'MANAGEMENT' || profile?.department === 'CEO';
    const allowed = !!profile?.isAdmin || level === 'all_staff' || (level === 'management_and_above' && isManagementOrAbove);
    setAccessAllowed(allowed);
    if (!allowed) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data } = await supabase.from('global_audit_history').select('*').order('timestamp', { ascending: false }).limit(60);
    setEntries((data || []).map((r: any) => ({
      id: String(r.id), action: r.action || '', department: r.department || 'SYSTEM',
      performedBy: r.performed_by || 'Unknown', details: r.details || '', timestamp: r.timestamp || '',
    })));
    setLoading(false);
    setRefreshing(false);
  }, [profile?.department, profile?.isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!loading && !accessAllowed) {
    return (
      <Screen>
        <Card>
          <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.lg }}>
            <Lock size={20} color={t.colors.textMuted} />
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center' }}>
              The audit log is currently restricted by the CEO to {accessLevel === 'ceo_only' ? 'the CEO only' : 'Management and above'}.
            </Text>
          </View>
        </Card>
      </Screen>
    );
  }

  const allDepts = ['ALL', ...Array.from(new Set(entries.map((e) => e.department))).sort()];
  const filtered = entries.filter((e) => deptFilter === 'ALL' || e.department === deptFilter);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Activity size={16} color={t.colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Live Audit Log, All Departments</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{filtered.length} entries</Text>
          </View>
        </View>

        <SearchablePicker value={deptFilter} onChange={setDeptFilter} options={allDepts.map((d) => ({ value: d, label: d === 'ALL' ? 'All Departments' : d }))} />

        {loading ? (
          <SkeletonList rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Activity size={20} color={t.colors.textMuted} />} title="No activity recorded yet" />
        ) : (
          <View style={{ gap: t.spacing.sm }}>
            {filtered.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', gap: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DEPT_DOT[e.department] || t.colors.textMuted, marginTop: 5 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: t.spacing.xs, marginBottom: 2 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: DEPT_DOT[e.department] || t.colors.textMuted }}>{e.department}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{fmtAgo(e.timestamp)}</Text>
                  </View>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{e.action.replace(/_/g, ' ')}</Text>
                  {e.details ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginTop: 2 }}>{e.details}</Text> : null}
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>{e.performedBy}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
