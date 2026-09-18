// rebma-mobile/components/chrome/AppHeader.tsx
//
// The department dashboard header. Renders as normal, non-fixed
// scrollable content — the very first thing inside the dashboard's
// ScrollView (see Screen.tsx's dashboard mode) — so it scrolls away
// naturally with the rest of the page: the top of the content sheet
// meets the bottom of the header, and scrolling pushes the whole thing
// up and off-screen together, like any other content. No fixed/absolute
// layers, no z-index trick, no scroll-driven animation on the icons —
// all of that was tried and explicitly rejected after seeing it live:
// icons shifting/disappearing on scroll and content sliding up behind
// the header read as poor UX in practice, not a good tradeoff for the
// "always-visible chrome" it bought.
//
// Structure (still matches the original accepted spec's static look):
//   - Solid purple gradient (#5B4DFF → #4F46E5), full-bleed, rounded
//     bottom corners.
//   - Left: real logo (assets/logo.png) in a white circular chip +
//     chevron-down, opens the Department Switcher.
//   - Right, exact order: Chat → Bell → Avatar → vertical ⋮ overflow,
//     bare white icons, no circle backdrop, always all visible.
//   - Greeting block: bold white greeting, green dot + "Active
//     Session", a separate department pill.
//   - Search bar: white pill — magnifying glass, placeholder, a
//     divider, then a filter/sliders icon inside the same input.
import { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
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

export const HEADER_RADIUS = 28;
export const CONTENT_SHEET_RADIUS = 20;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHeader() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const openSearch = useUIStore((s) => s.openSearch);
  const openDepartmentSwitcher = useUIStore((s) => s.openDepartmentSwitcher);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const chatUnreadCount = useMessengerUnreadStore((s) => s.unreadCount);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!profile) return null;
  const dept = getDepartmentEntry(profile.department);
  const firstName = profile.fullName?.split(' ')[0] || 'there';

  return (
    <>
      <LinearGradient
        colors={['#5B4DFF', '#4F46E5']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{
          borderBottomLeftRadius: HEADER_RADIUS,
          borderBottomRightRadius: HEADER_RADIUS,
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: t.spacing.lg,
            height: 52,
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
              <Image source={require('../../assets/logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
            <ChevronDown size={16} color="#FFFFFF" />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable hitSlop={8} onPress={() => navigationRef.isReady() && navigationRef.navigate('Messenger' as never)}>
              <MessageSquare size={20} color="#FFFFFF" />
              {chatUnreadCount > 0 && <View style={dotStyle} />}
            </Pressable>
            <Pressable hitSlop={8} onPress={() => navigationRef.isReady() && navigationRef.navigate('AlertsTab' as never)}>
              <Bell size={20} color="#FFFFFF" />
              {unreadCount > 0 && <View style={dotStyle} />}
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
              <Avatar name={profile.fullName} photo={profile.photo} size={32} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
              <MoreVertical size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

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

        <View style={{ paddingHorizontal: t.spacing.lg, marginTop: 16, paddingBottom: 20 }}>
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
            <Pressable onPress={openSearch} hitSlop={8}>
              <SlidersHorizontal size={16} color={t.colors.accent} />
            </Pressable>
          </Pressable>
        </View>
      </LinearGradient>

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
