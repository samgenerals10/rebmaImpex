// rebma-mobile/components/shared/DeptActivityGrid.tsx
//
// Phase 7.5, D32. Ports rebma-web/src/views/management/DeptActivityView.tsx
// — confirmed reused verbatim across ≥3 department routes on web
// (including Risk), so this is built once here as shared infra
// (`{ department }` prop only used to resolve the current viewer's own
// department for the delete-permission check — the feed itself is never
// department-scoped, by design), ready for Management's 7.6 dashboards to
// reuse unmodified.
//
// Ported: department-scoped-nothing audit feed (all departments, CEO rows
// excluded unless the viewer IS CEO — web's extra "ceo_activity_visible_to_
// others" org-wide toggle isn't ported since no CeoSettingsContext exists
// in mobile yet; a documented simplification, not a silent one), filter
// pills, search, paginated "Load More", department summary tiles, detail
// Sheet with a role-gated Delete (isCeo || item.user === currentUser's own
// name, identical to web).
//
// CSV/PDF export added (Gap-Closure Backlog, Item 1, D101): CSV keeps
// id/refId, PDF drops them — verbatim from DeptActivityView.tsx:194/:198.
// The clipboard "Share" action is still dropped — no real capability
// behind it beyond copying formatted text, and a new expo-clipboard
// dependency for one convenience action doesn't clear the bar this
// project's minimal-dependency stance has held elsewhere (D1/D5/D9).
//
// BASE_DEPTS below is replicated verbatim from web, staleness included —
// it predates both the Risk department (web Phase 1) and the Admin &
// Warehouse merge (web Phase 5), so it has no RISK/ADMIN_WAREHOUSE/
// MANAGEMENT filter tiles even though rows tagged with those departments
// exist in the data and still surface via search and the unfiltered feed —
// exactly as on web today. Per the standing full-literal-parity mandate
// this is an inherited gap, not one this port introduces (D33).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import {
  Activity, RefreshCw, Building2, Package, DollarSign,
  Truck, Users, ShoppingCart, Factory, UserCheck, Trash2, Download,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Sheet from '../ui/Sheet';
import { SkeletonList } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import ExportSheet from './ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

interface ActivityItem {
  id: string;
  department: string;
  user: string;
  action: string;
  details: string | null;
  timestamp: string;
  refId?: string;
}

const DEPT_COLOR: Record<string, string> = {
  OPERATIONS: '#3b82f6', FINANCE: '#10b981', MARKETING: '#a855f7', DISPATCH: '#f97316',
  HR: '#14b8a6', RECEPTION: '#ec4899', PRODUCTION: '#f59e0b', LOGISTICS: '#6366f1', CEO: '#f43f5e',
};
const DEPT_ICON: Record<string, typeof Package> = {
  OPERATIONS: Package, FINANCE: DollarSign, MARKETING: ShoppingCart, DISPATCH: Truck,
  HR: Users, RECEPTION: UserCheck, PRODUCTION: Factory, LOGISTICS: Truck,
};
const BASE_DEPTS = ['OPERATIONS', 'FINANCE', 'MARKETING', 'DISPATCH', 'HR', 'RECEPTION', 'PRODUCTION', 'LOGISTICS'];

function timeAgo(iso: string): string {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? 's' : ''} ago`;
}

interface Props {
  department: string;
}

export default function DeptActivityGrid({ department }: Props) {
  const t = useTheme();
  const { profile } = useAuthStore();
  const isCeo = profile?.department === 'CEO';
  const showCeoEntries = isCeo;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [detailItem, setDetailItem] = useState<ActivityItem | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      let query = supabase.from('global_audit_history').select('*').order('timestamp', { ascending: false }).limit(200);
      if (!showCeoEntries) query = query.not('department', 'eq', 'CEO');
      const { data } = await query;
      setActivities((data || []).map((d: any) => ({
        id: d.id, department: d.department, user: d.performed_by || 'System',
        action: d.action, details: d.details, timestamp: d.timestamp, refId: d.reference_id,
      })));
    } catch {
      setActivities([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [showCeoEntries]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (item: ActivityItem) => {
    const canDelete = isCeo || item.user === (profile?.fullName ?? '');
    if (!canDelete) return;
    Alert.alert('Delete Entry', 'Remove this activity record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('global_audit_history').delete().eq('id', item.id);
          setActivities((prev) => prev.filter((a) => a.id !== item.id));
          setDetailItem(null);
        },
      },
    ]);
  };

  const filtered = activities.filter((a) => {
    const matchDept = filter === 'All' || a.department === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || a.user.toLowerCase().includes(q) || a.action.toLowerCase().includes(q)
      || (a.details || '').toLowerCase().includes(q) || (a.refId || '').toLowerCase().includes(q);
    return matchDept && matchSearch;
  });
  const visible = filtered.slice(0, visibleCount);

  // Verbatim from DeptActivityView.tsx:194 (CSV) / :198 (PDF) — CSV keeps
  // id/refId, PDF drops them.
  const csvColumns: ExportColumn[] = [
    { key: 'id', label: 'id' },
    { key: 'department', label: 'department' },
    { key: 'user', label: 'user' },
    { key: 'action', label: 'action' },
    { key: 'details', label: 'details' },
    { key: 'timestamp', label: 'timestamp' },
    { key: 'refId', label: 'refId' },
  ];
  const pdfColumns: ExportColumn[] = [
    { key: 'department', label: 'department' },
    { key: 'user', label: 'user' },
    { key: 'action', label: 'action' },
    { key: 'details', label: 'details' },
    { key: 'timestamp', label: 'timestamp' },
  ];

  const allDeptKeys = showCeoEntries ? [...BASE_DEPTS, 'CEO'] : BASE_DEPTS;
  const allDepts = ['All', ...allDeptKeys];
  const deptStats = allDeptKeys.map((dept) => {
    const deptActivities = activities.filter((a) => a.department === dept);
    return { dept, count: deptActivities.length };
  });

  return (
    <View style={{ gap: t.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, flex: 1 }}>
          {isCeo ? 'All departments including CEO' : 'All departments (CEO excluded)'}
        </Text>
        <Pressable onPress={() => setExportOpen(true)} style={{ padding: t.spacing.xs }}>
          <Download size={16} color={t.colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => { setRefreshing(true); load(); }} style={{ padding: t.spacing.xs }}>
          <RefreshCw size={16} color={t.colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {deptStats.map((ds) => {
            const Icon = DEPT_ICON[ds.dept] || Building2;
            const color = DEPT_COLOR[ds.dept] || '#64748b';
            return (
              <Pressable
                key={ds.dept}
                onPress={() => setFilter(filter === ds.dept ? 'All' : ds.dept)}
                style={{
                  width: 84, alignItems: 'center', gap: 4, padding: t.spacing.sm, borderRadius: t.radius.md,
                  borderWidth: 1, borderColor: filter === ds.dept ? color : t.colors.border,
                  backgroundColor: filter === ds.dept ? `${color}15` : t.colors.bgCard,
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${color}20`, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={14} color={color} />
                </View>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.textPrimary }}>{ds.count}</Text>
                <Text style={{ fontFamily: t.font.medium, fontSize: 8, color: t.colors.textMuted, textAlign: 'center' }} numberOfLines={1}>{ds.dept}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Input value={search} onChangeText={setSearch} placeholder="Search activity…" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
          {allDepts.map((d) => (
            <Pressable
              key={d}
              onPress={() => setFilter(d)}
              style={{
                paddingVertical: 6, paddingHorizontal: 12, borderRadius: t.radius.pill,
                backgroundColor: filter === d ? t.colors.accent : t.colors.bgCard,
                borderWidth: 1, borderColor: filter === d ? t.colors.accent : t.colors.border,
              }}
            >
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: filter === d ? t.colors.onAccent : t.colors.textSecondary }}>{d}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <SkeletonList rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Activity size={20} color={t.colors.textMuted} />} title="No activity found" />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {visible.map((item) => {
            const isReject = /reject/i.test(item.action);
            const color = DEPT_COLOR[item.department] || '#64748b';
            return (
              <Pressable key={item.id} onPress={() => setDetailItem(item)}>
                <Card>
                  <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isReject ? t.colors.status.danger.text : color, marginTop: 5 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={2}>{item.action}</Text>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                        {item.department} · {item.user} · {timeAgo(item.timestamp)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          {filtered.length > visibleCount && (
            <Button label={`Load More (${filtered.length - visibleCount} remaining)`} variant="ghost" onPress={() => setVisibleCount((v) => v + 10)} fullWidth />
          )}
        </View>
      )}

      <Sheet
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={detailItem?.department}
        subtitle={detailItem ? timeAgo(detailItem.timestamp) : undefined}
        side="bottom"
        maxHeight={480}
      >
        {detailItem && (
          <View style={{ gap: t.spacing.md }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{detailItem.action}</Text>
            {detailItem.details ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{detailItem.details}</Text> : null}
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
              By {detailItem.user} · {new Date(detailItem.timestamp).toLocaleString()}
              {detailItem.refId ? ` · Ref: ${detailItem.refId}` : ''}
            </Text>
            {(isCeo || detailItem.user === (profile?.fullName ?? '')) && (
              <Button label="Delete Entry" variant="danger" icon={<Trash2 size={14} color="#fff" />} onPress={() => handleDelete(detailItem)} />
            )}
          </View>
        )}
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Department Activity"
        data={filtered}
        columns={csvColumns}
        pdfColumns={pdfColumns}
      />
    </View>
  );
}
