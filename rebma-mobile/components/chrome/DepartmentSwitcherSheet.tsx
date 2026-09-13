// rebma-mobile/components/chrome/DepartmentSwitcherSheet.tsx
// Ports: rebma-web/src/components/layout/Sidebar.tsx's lg:hidden mobile
// drawer (logo header / user row / #-prefixed channel list / Settings +
// Sign Out footer) — implemented as a left-side Sheet rather than a real
// drawer navigator (Design Decision D5: avoids react-native-reanimated +
// react-native-gesture-handler for a list that's one channel + Settings for
// every non-CEO user anyway).
import { View, Text, Pressable } from 'react-native';
import { Settings, LogOut } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { availableDepartments } from '../../navigation/departmentRegistry';
import Sheet from '../ui/Sheet';
import Avatar from '../ui/Avatar';

interface Props {
  onSelectDepartment: (code: string) => void;
  onOpenSettings: () => void;
}

export default function DepartmentSwitcherSheet({ onSelectDepartment, onOpenSettings }: Props) {
  const t = useTheme();
  const open = useUIStore((s) => s.departmentSwitcherOpen);
  const close = useUIStore((s) => s.closeDepartmentSwitcher);
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  if (!profile) return null;
  const depts = availableDepartments(profile.department, profile.isAdmin);

  return (
    <Sheet open={open} onClose={close} side="left">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.xl }}>
        <Avatar name={profile.fullName} photo={profile.photo} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>{profile.fullName}</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }} numberOfLines={1}>{profile.email}</Text>
        </View>
      </View>

      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: t.type.label9.letterSpacing, textTransform: 'uppercase', color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
        Channels
      </Text>
      <View style={{ gap: 2 }}>
        {depts.map((d) => {
          const isSelected = d.code === activeDepartment;
          return (
            <Pressable
              key={d.code}
              onPress={() => { onSelectDepartment(d.code); close(); }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm,
                paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.smd,
                borderRadius: t.radius.md,
                backgroundColor: isSelected ? t.colors.accent : 'transparent',
              }}
            >
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: isSelected ? t.colors.onAccent : t.colors.textSecondary }}>
                #
              </Text>
              <Text style={{ flex: 1, fontFamily: isSelected ? t.font.bold : t.font.medium, fontSize: t.type.body14.size, color: isSelected ? t.colors.onAccent : t.colors.textSecondary }} numberOfLines={1}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: t.spacing.xl, paddingTop: t.spacing.lg, borderTopWidth: 1, borderTopColor: t.colors.border, gap: t.spacing.xs }}>
        <Pressable onPress={() => { close(); onOpenSettings(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
          <Settings size={16} color={t.colors.textSecondary} />
          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textSecondary }}>Settings</Text>
        </Pressable>
        <Pressable onPress={() => { close(); signOut(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
          <LogOut size={16} color={t.colors.status.danger.text} />
          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.status.danger.text }}>Sign Out</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
