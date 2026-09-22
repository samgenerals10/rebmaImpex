// rebma-mobile/screens/DashboardScreen.tsx
//
// The new bottom-tab "Dashboard" screen — replaces Profile's slot in
// AppTabBar (Profile itself stays fully reachable via the header
// Avatar's Account sheet, "Profile & Preferences" row, and the
// still-registered ProfileTab route, same pattern already established
// for AlertsTab losing its own bottom-tab button in an earlier round).
//
// Deliberately NOT a duplicate of Home (which already opens the
// department's own full Overview/dashboard screen) — this is a
// compact, faster-glance hub: a small identity header, a quick-links
// grid into the department's own sub-pages, and a real recent-activity
// feed. No fabricated per-department KPI numbers — PendingApprovalsAlertCard
// only has real branches for Risk/Management today (every other
// department's own Overview screen already shows its own real KPIs
// inline), so a generic "key numbers" tile here would mean either
// faking data or an empty card for 9 of 11 departments. Recent Activity
// (global_audit_history, department-scoped) is real for every department.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { getDepartmentEntry } from '../navigation/departmentRegistry';
import { navigateToSubTab } from '../navigation/navigationRef';
import { supabase } from '../lib/supabaseClient';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import BarChart from '../components/ui/BarChart';
import ApprovalHistoryPanel from '../components/shared/ApprovalHistoryPanel';
import { useCollapsibleHeader } from '../hooks/useCollapsibleHeader';

// Direct correction: the "Operations KPI Snapshot" chart used to sit on
// Admin & Warehouse's own Overview screen — moved here instead, as a card
// at the top of Quick Links, since the same 5 numbers are now visible as
// individual KPI tiles on Overview and didn't need to live in two places.
// Local to this file (not a shared component) since it's specific to one
// department's own figures, mirroring adminWarehouse/OverviewScreen.tsx's
// own query/calculation exactly so the two screens never disagree.
function AdminWarehouseKpiSnapshot() {
  const t = useTheme();
  const [totalTons, setTotalTons] = useState(0);
  const [pendingRelease, setPendingRelease] = useState(0);
  const [pendingApproval, setPendingApproval] = useState(0);
  const [discrepancies, setDiscrepancies] = useState(0);
  const [stockQty, setStockQty] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [cargoRes, ordersRes, stockRes] = await Promise.all([
        supabase.from('cargo_intake').select('weight, status, discrepancies'),
        supabase.from('orders').select('status'),
        supabase.from('stock').select('quantity'),
      ]);
      if (!active) return;
      const cargo = (cargoRes.data as any[]) || [];
      const orders = (ordersRes.data as any[]) || [];
      const stock = (stockRes.data as any[]) || [];
      setTotalTons(cargo.reduce((acc, c) => acc + (Number(c.weight) || 0), 0));
      setPendingRelease(orders.filter((o) => o.status === 'PROCESSING').length);
      setPendingApproval(cargo.filter((c) => c.status === 'PENDING_RISK_APPROVAL').length);
      setDiscrepancies(cargo.filter((c) => c.discrepancies && c.discrepancies !== 'None').length);
      setStockQty(stock.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0));
      setLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  if (!loaded) return null;

  return (
    <Card>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>
        Operations KPI Snapshot
      </Text>
      <BarChart
        data={[
          { label: 'Cargo Weight (T)', value: totalTons, color: t.colors.action.blue },
          { label: 'Awaiting Release', value: pendingRelease, color: t.colors.action.emerald },
          { label: 'Pending Approval', value: pendingApproval, color: t.colors.action.amber },
          { label: 'Discrepancy Notes', value: discrepancies, color: t.colors.action.rose },
          { label: 'Total Stock Qty', value: stockQty, color: t.colors.action.violet },
        ]}
      />
    </Card>
  );
}

export default function DashboardScreen() {
  const t = useTheme();
  const { scrollHandler } = useCollapsibleHeader();
  const profile = useAuthStore((s) => s.profile);
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!profile) return null;
  const effectiveDepartment = activeDepartment || profile.department;
  const dept = getDepartmentEntry(effectiveDepartment);
  const quickLinks = dept.subTabs.filter((s) => s.id !== 'home' && s.id !== dept.defaultSubTab).slice(0, 6);

  return (
    <Screen refreshing={false} onRefresh={() => setRefreshKey((k) => k + 1)} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        <View>
          {/* No greeting here — the fixed header above already greets the
              user ("Good morning, {firstName}") on every dashboard-mode
              screen; repeating it made this page read as two headers
              stacked on top of each other. This is just "Quick Links." */}
          <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.page24.size, color: t.colors.textPrimary }}>
            Quick Links
          </Text>
          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginTop: 4 }}>
            {dept.label}
          </Text>
        </View>

        {effectiveDepartment === 'ADMIN_WAREHOUSE' && <AdminWarehouseKpiSnapshot />}

        <View style={{ gap: t.spacing.sm }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>
            Department Pages
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {quickLinks.length === 0 ? (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
                No other sub-pages in this department yet.
              </Text>
            ) : (
              quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Pressable
                    key={link.id}
                    onPress={() => navigateToSubTab(link.id)}
                    style={({ pressed }) => [
                      {
                        width: '31%',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: t.spacing.md,
                        borderRadius: t.radius.lg,
                        backgroundColor: pressed ? (t.darkMode ? '#2D3748' : '#F8F7FF') : t.colors.bgCard,
                        borderWidth: 1,
                        borderColor: t.colors.border,
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: t.radius.md,
                        backgroundColor: t.colors.accentSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={18} color={t.colors.accent} />
                    </View>
                    <Text
                      style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textPrimary, textAlign: 'center' }}
                      numberOfLines={2}
                    >
                      {link.label}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>

        <ApprovalHistoryPanel key={refreshKey} department={effectiveDepartment} title="Recent Activity" limit={6} />
      </View>
    </Screen>
  );
}
