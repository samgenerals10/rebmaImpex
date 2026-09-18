// rebma-mobile/components/chrome/AppHeader.tsx
//
// The accepted Top Nav Bar design, per DESIGN_DECISIONS.md's "ACCEPTED —
// Top Nav Bar (Header)" section — built to that spec exactly, not to an
// earlier or different implementation:
//   - Solid purple gradient (#5B4DFF → #4F46E5, 160deg), full-bleed,
//     rounded bottom corners (28px).
//   - Left: real logo (assets/logo.png) in a white circular chip +
//     chevron-down, opens the department switcher.
//   - Right, in exact order: Chat → Bell → Avatar → vertical ⋮ overflow,
//     bare icons (no circle backdrop), white.
//   - Greeting block: bold white greeting, green dot + "Active Session",
//     department pill.
//   - Search bar: one white pill — magnifying glass, placeholder, a
//     divider, then a filter/sliders icon inside the same input.
//   - No day/night toggle (Settings → Appearance already has the real one).
//
// Scroll behavior (the piece that took several correction rounds
// originally, so it's rebuilt exactly as specified, not simplified):
// the header never shrinks, resizes, or moves. It's two fixed,
// independently z-indexed layers — the purple background+greeting+search
// (behind everything, DashboardHeaderBackground) and the icon row (in
// front of everything, always reachable, DashboardIconRow) — with the
// actual screen content rendered between them as normal scrollable
// content (Screen.tsx's dashboard mode). Because that content starts
// with a transparent spacer exactly HEADER_H tall, then an opaque
// rounded-top white sheet, scrolling the page is what makes the sheet
// rise and cover the header — no transform/animation needed for that
// part, it's just where the content naturally sits. The one thing that
// IS scroll-driven is the icon row's Chat/Bell fade (mid-scroll onward,
// both tuck away — reachable via the ⋮ menu instead). The content
// sheet's own top-corner radius (20) is deliberately smaller than the
// header's bottom-corner radius (28), so a sliver of purple always
// peeks out at the very edges once the sheet has scrolled up to cover
// the header's rounded corners.
//
// Both pieces are rendered once, inside DepartmentHomeScreen.tsx (not
// as a permanent AppShell-level sibling) — so they're naturally only
// visible while the department's own Home/dashboard screen is the
// active route. Once a sub-tab screen is pushed on top (native-stack),
// it's a genuinely separate, opaque, full-screen native view, so this
// header can't double up behind that screen's own SubScreenHeader.
import { useState } from 'react';
import { View, Text, Pressable, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, MessageSquare, Search, ChevronDown, MoreVertical, SlidersHorizontal } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNotificationsStore } from '../../store/notificationsStore';
import { useMessengerUnreadStore } from '../../store/messengerUnreadStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import { navigationRef } from '../../navigation/navigationRef';
import Avatar from '../ui/Avatar';
import Sheet from '../ui/Sheet';

export const DASHBOARD_ICON_ROW_H = 52;
export const DASHBOARD_HEADER_CONTENT_H = 176;
export const HEADER_RADIUS = 28;
export const CONTENT_SHEET_RADIUS = 20;
const ICON_FADE_END = 40; // px scrolled before Chat/Bell are fully faded

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Layer 0 (back): the fixed purple gradient + greeting + search. Never moves, never resizes — the scrolling content sheet (Screen.tsx dashboard mode) rises to cover it from the front. */
export function DashboardHeaderBackground() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const openSearch = useUIStore((s) => s.openSearch);
  const openDepartmentSwitcher = useUIStore((s) => s.openDepartmentSwitcher);

  if (!profile) return null;
  const dept = getDepartmentEntry(profile.department);
  const firstName = profile.fullName?.split(' ')[0] || 'there';

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 0 }}>
      <LinearGradient
        colors={['#5B4DFF', '#4F46E5']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{
          height: insets.top + DASHBOARD_ICON_ROW_H + DASHBOARD_HEADER_CONTENT_H,
          borderBottomLeftRadius: HEADER_RADIUS,
          borderBottomRightRadius: HEADER_RADIUS,
          paddingTop: insets.top + DASHBOARD_ICON_ROW_H,
        }}
      >
        <View style={{ paddingHorizontal: t.spacing.lg }}>
          <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.page24.size, color: '#FFFFFF' }}>
            {getGreeting()}, {firstName} 👋
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' }} />
            <Text
              style={{
                fontFamily: t.font.medium,
                fontSize: t.type.label9.size,
                letterSpacing: 0.6,
                color: 'rgba(255,255,255,0.85)',
                textTransform: 'uppercase',
              }}
            >
              Active Session
            </Text>
          </View>
          <Pressable
            onPress={openDepartmentSwitcher}
            hitSlop={6}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginTop: 10,
              backgroundColor: 'rgba(255,255,255,0.16)',
              borderRadius: t.radius.pill,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: '#FFFFFF' }}>
              {dept.label}
            </Text>
            <ChevronDown size={13} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: t.spacing.lg, marginTop: 16 }}>
          <Pressable
            onPress={openSearch}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: t.radius.pill,
              height: 46,
              paddingHorizontal: 14,
            }}
          >
            <Search size={16} color={t.colors.textMuted} />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                marginLeft: 8,
                fontFamily: t.font.medium,
                fontSize: t.type.body14.size,
                color: t.colors.textMuted,
              }}
            >
              Search subjects, topics, records…
            </Text>
            <View style={{ width: 1, height: 18, backgroundColor: t.colors.border, marginHorizontal: 10 }} />
            <SlidersHorizontal size={16} color={t.colors.accent} />
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

interface IconRowProps {
  /** 0 at rest, increases with scroll offset — used only to fade Chat/Bell. */
  scrollAnim?: Animated.Value;
}

/** Layer 2 (front): logo+chevron left, Chat/Bell (fade on scroll)/Avatar/⋮ right. Always on top, bare icons, no scroll-driven size change. */
export function DashboardIconRow({ scrollAnim }: IconRowProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const openDepartmentSwitcher = useUIStore((s) => s.openDepartmentSwitcher);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const chatUnreadCount = useMessengerUnreadStore((s) => s.unreadCount);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!profile) return null;
  const dept = getDepartmentEntry(profile.department);

  const fadeOpacity = scrollAnim
    ? scrollAnim.interpolate({ inputRange: [0, ICON_FADE_END], outputRange: [1, 0], extrapolate: 'clamp' })
    : 1;
  const fadeWidth = scrollAnim
    ? scrollAnim.interpolate({ inputRange: [0, ICON_FADE_END], outputRange: [64, 0], extrapolate: 'clamp' })
    : 64;

  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          paddingTop: insets.top,
          height: insets.top + DASHBOARD_ICON_ROW_H,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: t.spacing.lg,
        }}
      >
        <Pressable onPress={openDepartmentSwitcher} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Image source={require('../../assets/logo.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
          </View>
          <ChevronDown size={16} color="#FFFFFF" />
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, opacity: fadeOpacity, width: fadeWidth, overflow: 'hidden' }}>
            <Pressable
              hitSlop={8}
              onPress={() => navigationRef.isReady() && navigationRef.navigate('Messenger' as never)}
            >
              <MessageSquare size={20} color="#FFFFFF" />
              {chatUnreadCount > 0 && <View style={dotStyle} />}
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => navigationRef.isReady() && navigationRef.navigate('AlertsTab' as never)}
            >
              <Bell size={20} color="#FFFFFF" />
              {unreadCount > 0 && <View style={dotStyle} />}
            </Pressable>
          </Animated.View>

          <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
            <Avatar name={profile.fullName} photo={profile.photo} size={32} />
          </Pressable>

          <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
            <MoreVertical size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Account" side="bottom">
        <View style={{ paddingBottom: 8 }}>
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
          <MenuRow
            label="Profile & Preferences"
            onPress={() => { setMenuOpen(false); navigationRef.isReady() && navigationRef.navigate('ProfileTab' as never); }}
          />
          <MenuRow label="Switch Department" onPress={() => { setMenuOpen(false); openDepartmentSwitcher(); }} />
          <MenuRow
            label="Team Messages"
            onPress={() => { setMenuOpen(false); navigationRef.isReady() && navigationRef.navigate('Messenger' as never); }}
          />
          <MenuRow
            label="Notifications & Alerts"
            onPress={() => { setMenuOpen(false); navigationRef.isReady() && navigationRef.navigate('AlertsTab' as never); }}
          />
          <MenuRow label="Sign Out" danger onPress={() => { setMenuOpen(false); signOut(); }} />
        </View>
      </Sheet>
    </>
  );
}

const dotStyle = {
  position: 'absolute' as const,
  top: -2,
  right: -2,
  width: 9,
  height: 9,
  borderRadius: 4.5,
  backgroundColor: '#EF4444',
  borderWidth: 1.5,
  borderColor: '#4F46E5',
};

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
