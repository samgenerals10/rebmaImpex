// rebma-mobile/components/chrome/AppHeader.tsx
// Ports: rebma-web/src/components/layout/Header.tsx's lg:hidden block — the
// header a phone actually sees on rebma-web today. Chat and dark-mode
// toggle are deferred (7.10 / 7.12), left out rather than stubbed.
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, MessageSquare, MoreVertical, Search } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNotificationsStore } from '../../store/notificationsStore';
import { useMessengerUnreadStore } from '../../store/messengerUnreadStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import { navigationRef } from '../../navigation/navigationRef';
import Avatar from '../ui/Avatar';
import Sheet from '../ui/Sheet';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props {
  onNavigateProfile: () => void;
  onNavigateAlerts: () => void;
}

export default function AppHeader({ onNavigateProfile, onNavigateAlerts }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const openDepartmentSwitcher = useUIStore((s) => s.openDepartmentSwitcher);
  const openSearch = useUIStore((s) => s.openSearch);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const refreshUnreadCount = useNotificationsStore((s) => s.refreshUnreadCount);
  const chatUnreadCount = useMessengerUnreadStore((s) => s.unreadCount);
  const refreshChatUnreadCount = useMessengerUnreadStore((s) => s.refreshUnreadCount);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    refreshChatUnreadCount();
    const iv = setInterval(refreshChatUnreadCount, 30000);
    return () => clearInterval(iv);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    refreshUnreadCount(profile.id, profile.department);
    const iv = setInterval(() => refreshUnreadCount(profile.id, profile.department), 30000);
    return () => clearInterval(iv);
  }, [profile?.id, profile?.department]);

  if (!profile) return null;
  const dept = getDepartmentEntry(profile.department);
  const firstName = profile.fullName?.split(' ')[0] || 'there';

  return (
    <View style={{ backgroundColor: t.colors.bgHeader, borderBottomWidth: 1, borderBottomColor: t.colors.border, paddingTop: insets.top + t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md }}>
        <Pressable onPress={openDepartmentSwitcher}>
          <Avatar name={profile.fullName} photo={profile.photo} size={40} />
        </Pressable>
        <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.base16.size, letterSpacing: 1, color: t.colors.textPrimary }}>REBMA IMPEX</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Pressable hitSlop={8} onPress={() => navigationRef.isReady() && navigationRef.navigate('Messenger' as never)} style={{ position: 'relative' }}>
            <MessageSquare size={20} color={t.colors.textSecondary} />
            {chatUnreadCount > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.status.danger.text }} />
            )}
          </Pressable>
          <Pressable hitSlop={8} onPress={onNavigateAlerts} style={{ position: 'relative' }}>
            <Bell size={20} color={t.colors.textSecondary} />
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.status.danger.text }} />
            )}
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
            <MoreVertical size={20} color={t.colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.accent }} />
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.page24.size, color: t.colors.textPrimary }}>{getGreeting()}, {firstName}</Text>
        </View>
        <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, letterSpacing: 0.4, textTransform: 'uppercase', color: t.colors.textSecondary, marginTop: 2 }}>
          {dept.label}
        </Text>
      </View>

      <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md }}>
        <Pressable
          onPress={openSearch}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.bgInput, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd }}
        >
          <Search size={16} color={t.colors.textMuted} />
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textMuted }}>Search…</Text>
        </Pressable>
      </View>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" side="bottom">
        <MenuRow label="Profile" onPress={() => { setMenuOpen(false); onNavigateProfile(); }} />
        <MenuRow label="Switch Department" onPress={() => { setMenuOpen(false); openDepartmentSwitcher(); }} />
        <MenuRow label="Messages" onPress={() => { setMenuOpen(false); navigationRef.isReady() && navigationRef.navigate('Messenger' as never); }} />
        <MenuRow label="Notifications" onPress={() => { setMenuOpen(false); onNavigateAlerts(); }} />
        <MenuRow label="Sign Out" danger onPress={() => { setMenuOpen(false); signOut(); }} />
      </Sheet>
    </View>
  );
}

function MenuRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: t.spacing.md }}>
      <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: danger ? t.colors.status.danger.text : t.colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}
