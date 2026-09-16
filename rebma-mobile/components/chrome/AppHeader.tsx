// rebma-mobile/components/chrome/AppHeader.tsx
//
// Aczone Header v2:
//   LEFT  → REBMA IMPEX wordmark logo (taps to open Department Switcher)
//   RIGHT → Avatar (taps to profile) + Bell (taps to alerts) + Chat icon
//   BELOW → Greeting line + department status pill
//   BELOW → Aczone pill search bar
//
// The greeting/search section collapses smoothly on scroll via the
// collapsedHeader prop driven by AppShell's Animated.Value listener.
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, MessageSquare, Search, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNotificationsStore } from '../../store/notificationsStore';
import { useMessengerUnreadStore } from '../../store/messengerUnreadStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import { navigationRef } from '../../navigation/navigationRef';
import Avatar from '../ui/Avatar';
import Sheet from '../ui/Sheet';
import { useState } from 'react';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props {
  onNavigateProfile: () => void;
  onNavigateAlerts: () => void;
  /** Pass an Animated.Value (0=expanded, 1=collapsed) from the parent scroll handler */
  collapseAnim?: Animated.Value;
}

export default function AppHeader({ onNavigateProfile, onNavigateAlerts, collapseAnim }: Props) {
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

  // Default to always-expanded if no external anim value provided
  const localAnim = useRef(new Animated.Value(0)).current;
  const anim = collapseAnim ?? localAnim;

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

  // Animated styles for the collapsible greeting+search block
  const greetingHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
  const greetingOpacity = anim.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View
      style={{
        backgroundColor: t.colors.bgHeader,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.border,
        paddingTop: insets.top,
      }}
    >
      {/* ── Top Bar: Logo Left | Avatar + Icons Right ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.sm,
          height: 54,
        }}
      >
        {/* LEFT: Logo → opens Department Switcher */}
        <Pressable
          onPress={openDepartmentSwitcher}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          {/* Aczone Wordmark Pill */}
          <View
            style={{
              backgroundColor: t.colors.accent,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text
              style={{
                fontFamily: t.font.extrabold,
                fontSize: 13,
                color: '#FFFFFF',
                letterSpacing: 0.8,
              }}
            >
              REBMA
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text
              style={{
                fontFamily: t.font.bold,
                fontSize: 11,
                color: t.colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {dept.label}
            </Text>
            <ChevronDown size={12} color={t.colors.textMuted} />
          </View>
        </Pressable>

        {/* RIGHT: Chat + Bell + Avatar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Team Messages */}
          <Pressable
            hitSlop={8}
            onPress={() => navigationRef.isReady() && navigationRef.navigate('Messenger' as never)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageSquare size={17} color={t.colors.accent} />
            {chatUnreadCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 9,
                  height: 9,
                  borderRadius: 4.5,
                  backgroundColor: t.colors.status.danger.text,
                  borderWidth: 1.5,
                  borderColor: t.colors.bgHeader,
                }}
              />
            )}
          </Pressable>

          {/* Notifications Bell */}
          <Pressable
            hitSlop={8}
            onPress={onNavigateAlerts}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={17} color={t.colors.accent} />
            {unreadCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 9,
                  height: 9,
                  borderRadius: 4.5,
                  backgroundColor: t.colors.status.danger.text,
                  borderWidth: 1.5,
                  borderColor: t.colors.bgHeader,
                }}
              />
            )}
          </Pressable>

          {/* Profile Avatar */}
          <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
            <Avatar name={profile.fullName} photo={profile.photo} size={36} isSpecial />
          </Pressable>
        </View>
      </View>

      {/* ── Collapsible Greeting + Search ── */}
      <Animated.View
        style={{
          overflow: 'hidden',
          height: greetingHeight,
          opacity: greetingOpacity,
        }}
      >
        {/* Greeting Row */}
        <View
          style={{
            paddingHorizontal: t.spacing.lg,
            paddingTop: 2,
            paddingBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: t.font.extrabold,
                fontSize: t.type.page24.size,
                color: t.colors.textPrimary,
                lineHeight: 30,
              }}
            >
              {getGreeting()}, {firstName} 👋
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: t.colors.status.success.text,
                }}
              />
              <Text
                style={{
                  fontFamily: t.font.medium,
                  fontSize: t.type.label9.size,
                  letterSpacing: 0.5,
                  color: t.colors.accent,
                  textTransform: 'uppercase',
                }}
              >
                {dept.label} · Active Session
              </Text>
            </View>
          </View>
        </View>

        {/* Pill Search Bar */}
        <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md }}>
          <Pressable
            onPress={openSearch}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.darkMode ? '#1E293B' : '#FFFFFF',
                borderRadius: t.radius.pill,
                paddingHorizontal: t.spacing.lg,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: t.colors.border,
              },
              t.shadow('card'),
            ]}
          >
            <Search size={16} color={t.colors.accent} />
            <Text
              style={{
                flex: 1,
                fontFamily: t.font.medium,
                fontSize: t.type.body14.size,
                color: t.colors.textMuted,
                marginLeft: t.spacing.sm,
              }}
            >
              Search subjects, topics, records…
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Profile / Quick Menu Sheet */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Account" side="bottom">
        <View style={{ paddingBottom: 8 }}>
          {/* User identity card inside sheet */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: t.colors.border,
            }}
          >
            <Avatar name={profile.fullName} photo={profile.photo} size={48} isSpecial />
            <View>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
                {profile.fullName}
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginTop: 2 }}>
                {dept.label}
              </Text>
            </View>
          </View>
          <MenuRow label="Profile & Preferences" onPress={() => { setMenuOpen(false); onNavigateProfile(); }} />
          <MenuRow label="Switch Department" onPress={() => { setMenuOpen(false); openDepartmentSwitcher(); }} />
          <MenuRow label="Team Messages" onPress={() => { setMenuOpen(false); navigationRef.isReady() && navigationRef.navigate('Messenger' as never); }} />
          <MenuRow label="Notifications & Alerts" onPress={() => { setMenuOpen(false); onNavigateAlerts(); }} />
          <MenuRow label="Sign Out" danger onPress={() => { setMenuOpen(false); signOut(); }} />
        </View>
      </Sheet>
    </View>
  );
}

function MenuRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 13,
        borderRadius: 10,
        paddingHorizontal: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: t.font.medium,
          fontSize: t.type.body14.size,
          color: danger ? t.colors.status.danger.text : t.colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
