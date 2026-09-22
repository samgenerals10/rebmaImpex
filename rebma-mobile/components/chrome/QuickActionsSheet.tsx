// rebma-mobile/components/chrome/QuickActionsSheet.tsx
// Ports: rebma-web/src/components/layout/QuickActions.tsx
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import { OPEN_DEPARTMENT_SWITCHER } from '../../navigation/quickActionSentinels';
import Sheet from '../ui/Sheet';
import { colors } from '../../theme/tokens';

interface Props {
  onNavigateSubTab: (subTab: string) => void;
}

export default function QuickActionsSheet({ onNavigateSubTab }: Props) {
  const t = useTheme();
  const open = useUIStore((s) => s.quickActionsOpen);
  const close = useUIStore((s) => s.closeQuickActions);
  const profile = useAuthStore((s) => s.profile);

  const activeDepartment = useUIStore((s) => s.activeDepartment);

  if (!profile) return null;
  // The currently viewed department, not always the user's own — a
  // CEO/admin who's switched into another department (via the header's
  // department switcher) should see THAT department's quick actions, not
  // their own profile department's, same "effective department" pattern
  // every screen in this app already follows.
  const dept = getDepartmentEntry(activeDepartment || profile.department);

  return (
    <Sheet open={open} onClose={close} title={`Quick Actions (${dept.label})`} side="bottom">
      {dept.quickActions.length === 0 ? (
        <Text style={{ textAlign: 'center', fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textMuted, paddingVertical: t.spacing.xl }}>
          No quick actions available.
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          {dept.quickActions.map((a) => {
            const Icon = a.icon;
            const circleColor = (colors.action as any)[a.actionColor] || t.colors.accent;
            return (
              <Pressable
                key={a.label}
                onPress={() => {
                  close();
                  if (a.subTab === OPEN_DEPARTMENT_SWITCHER) {
                    useUIStore.getState().openDepartmentSwitcher();
                  } else {
                    onNavigateSubTab(a.subTab);
                  }
                }}
                style={{
                  width: '47%',
                  alignItems: 'center',
                  gap: t.spacing.sm,
                  padding: t.spacing.lg,
                  borderRadius: t.radius.lg,
                  borderWidth: 1,
                  borderColor: t.colors.border,
                  backgroundColor: t.colors.bgPage,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: circleColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color="#ffffff" />
                </View>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.textPrimary, textAlign: 'center' }}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
