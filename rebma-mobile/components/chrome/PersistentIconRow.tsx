// rebma-mobile/components/chrome/PersistentIconRow.tsx
//
// Per direct correction: "nothing should go above the icons" — the icon
// row (logo/department-switcher, chat, bell, avatar) must stay visible
// on EVERY screen, not just the department dashboard's own Overview
// screen. Previously it only existed inside AppHeader.tsx's
// DashboardHeader, which Screen.tsx only renders in "dashboard mode" —
// so it vanished completely on every pushed sub-page (Transactions,
// Approvals, ...), every Viber screen, Settings, Quick Links' own
// sub-pages, etc.
//
// Rendered once, here, as a fixed top overlay OUTSIDE AppShell's
// Tab.Navigator — always on top (zIndex above DashboardHeader's 10),
// always visible, everywhere. AppShell.tsx also re-provides
// SafeAreaInsetsContext with `top` inflated by this row's own height, so
// every descendant screen (SafeAreaView, useSafeAreaInsets(),
// SubScreenHeader's own insets.top padding) automatically renders below
// it with zero changes needed per-screen.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer } from 'expo-audio';
import { Bell, MessageSquare, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNotificationsStore } from '../../store/notificationsStore';
import { useMessengerUnreadStore } from '../../store/messengerUnreadStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import { navigationRef } from '../../navigation/navigationRef';
import { useBlink } from '../../hooks/useBlink';
import { NOTIFICATION_SOUNDS } from '../../lib/notificationSounds';
import Avatar from '../ui/Avatar';
import LivePresenceIcon from './LivePresenceIcon';
import Sheet from '../ui/Sheet';
import { setActiveInterval } from '../../lib/activeInterval';

// Direct instruction: "when the alert comes, the icon beside the
// message should blink and it should work with the notification sound
// in the system" — the bell (which sits beside the chat/message icon,
// confirmed by the JSX order below) both blinks and plays the user's
// chosen sound the moment `unreadCount` genuinely increases, not just
// whenever it's > 0 (which would replay the sound every render).
// `refreshUnreadCount` was previously only ever called from
// NotificationsScreen.tsx when a user manually opened it — this is the
// always-mounted component that finally polls it live, mirroring
// usePendingApprovalsBadge's own 30s-interval pattern just above.
function useUnreadNotifications(userId: string | undefined, department: string | undefined) {
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const refreshUnreadCount = useNotificationsStore((s) => s.refreshUnreadCount);

  useEffect(() => {
    if (!userId && !department) return;
    let active = true;
    const load = () => { if (active) refreshUnreadCount(userId || '', department || ''); };
    load();
    const stop = setActiveInterval(load, 30000);
    return () => { active = false; stop(); };
  }, [userId, department, refreshUnreadCount]);

  return unreadCount;
}

// Preloads all 10 named sound assets exactly once (expo-audio's
// useAudioPlayer only works against a static, literal require() per
// call — the same constraint NotificationSoundPicker.tsx already works
// around by calling it once per row) and exposes a single `play(id)`
// that fires whichever one matches the currently-selected sound.
function useNotificationSoundPlayer() {
  // Unrolled, not `.map()`'d, so this stays 10 literal useAudioPlayer
  // calls in a fixed order every render — NOTIFICATION_SOUNDS' length
  // never changes, but a loop-called hook is still worth avoiding.
  const p0 = useAudioPlayer(NOTIFICATION_SOUNDS[0].asset);
  const p1 = useAudioPlayer(NOTIFICATION_SOUNDS[1].asset);
  const p2 = useAudioPlayer(NOTIFICATION_SOUNDS[2].asset);
  const p3 = useAudioPlayer(NOTIFICATION_SOUNDS[3].asset);
  const p4 = useAudioPlayer(NOTIFICATION_SOUNDS[4].asset);
  const p5 = useAudioPlayer(NOTIFICATION_SOUNDS[5].asset);
  const p6 = useAudioPlayer(NOTIFICATION_SOUNDS[6].asset);
  const p7 = useAudioPlayer(NOTIFICATION_SOUNDS[7].asset);
  const p8 = useAudioPlayer(NOTIFICATION_SOUNDS[8].asset);
  const p9 = useAudioPlayer(NOTIFICATION_SOUNDS[9].asset);
  const players = [p0, p1, p2, p3, p4, p5, p6, p7, p8, p9];

  return (soundId: string) => {
    const idx = NOTIFICATION_SOUNDS.findIndex((s) => s.id === soundId);
    const player = players[idx] ?? players[0];
    if (!player) return;
    player.seekTo(0);
    player.play();
  };
}

// Direct correction: the separate pending-approvals clipboard icon
// that used to sit here (its own button, its own dot) is removed —
// "needs attention" now lives solely on the bell, which blinks and
// carries a real numeric count instead of a plain dot. A department's
// own pending-approvals queue is still reachable from inside that
// department (Overview's needs-attention list / PendingApprovalsAlertCard,
// unaffected by this — only this header shortcut is gone).

export const ICON_ROW_H = 52;

interface Props {
  topInset: number;
}

export default function PersistentIconRow({ topInset }: Props) {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const openDepartmentSwitcher = useUIStore((s) => s.openDepartmentSwitcher);
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const unreadCount = useUnreadNotifications(profile?.id, activeDepartment || profile?.department);
  const chatUnreadCount = useMessengerUnreadStore((s) => s.unreadCount);
  const [menuOpen, setMenuOpen] = useState(false);

  const playNotificationSound = useNotificationSoundPlayer();
  const bellBlink = useBlink(unreadCount > 0);
  const prevUnreadRef = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      playNotificationSound(t.notificationSound);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  if (!profile) return null;
  const dept = getDepartmentEntry(profile.department);

  return (
    <>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11 }}>
        <LinearGradient
          colors={t.darkMode ? [t.colors.bgHeader, t.colors.bgHeader] : [t.colors.accent, t.colors.accentPressed]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={{ paddingTop: topInset }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: t.spacing.lg,
              height: ICON_ROW_H,
            }}
          >
            {t.darkMode ? (
              // Dark mode: the logo in a round white badge with the name beside
              // it in a subtle pill, as on the web sidebar. (The logo file has
              // a white background, which looks like a stray square on black.)
              <Pressable onPress={openDepartmentSwitcher} hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#171717', borderRadius: t.radius.pill, paddingVertical: 4, paddingLeft: 4, paddingRight: 10 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <Image source={require('../../assets/logo-mark.png')} style={{ height: 15, width: 15 * 398 / 237 }} resizeMode="contain" />
                </View>
                <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>Rebma Impex</Text>
                <ChevronDown size={16} color={t.colors.textSecondary} />
              </Pressable>
            ) : (
              <Pressable onPress={openDepartmentSwitcher} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {/* The cropped logo, as on the sign-in pages, on a white backing the logo's own shape so it reads on the teal bar */}
                <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FFFFFF' }}>
                  <Image source={require('../../assets/logo-mark.png')} style={{ height: 24, width: 24 * 398 / 237 }} resizeMode="contain" />
                </View>
                <ChevronDown size={16} color="#FFFFFF" />
              </Pressable>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {/* How many people are online, and who */}
              <LivePresenceIcon iconStyle={iconBgStyle} badgeStyle={badgeStyle} badgeTextStyle={badgeTextStyle} borderColor={t.colors.accentPressed} />
              <Pressable hitSlop={8} onPress={() => navigationRef.isReady() && navigationRef.navigate('Messenger' as never)} style={iconBgStyle}>
                <MessageSquare size={18} color="#FFFFFF" />
                {chatUnreadCount > 0 && <View style={[dotStyle, { borderColor: t.colors.accentPressed }]} />}
              </Pressable>
              <Pressable hitSlop={8} onPress={() => navigationRef.isReady() && navigationRef.navigate('AlertsTab' as never)} style={iconBgStyle}>
                <Animated.View style={{ opacity: bellBlink }}>
                  <Bell size={18} color="#FFFFFF" />
                </Animated.View>
                {/* Direct correction: solely the bell carries "needs
                    attention" now, a real count, not a plain dot. "1"
                    on the first notification, going up from there;
                    capped at "9+" past single digits so it never breaks
                    the circle's own layout. */}
                {unreadCount > 0 && (
                  <View style={[badgeStyle, { borderColor: t.colors.accentPressed }]}>
                    <Text style={badgeTextStyle} numberOfLines={1}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setMenuOpen(true)}>
                <Avatar name={profile.fullName} photo={profile.photo} size={34} />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Account" side="bottom">
        <View style={{ paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
            <Avatar name={profile.fullName} photo={profile.photo} size={48} isSpecial />
            <View>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{profile.fullName}</Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginTop: 2 }}>{dept.label}</Text>
            </View>
          </View>
          <MenuRow label="Profile & Preferences" onPress={() => { setMenuOpen(false); navigationRef.isReady() && navigationRef.navigate('ProfileTab' as never); }} />
          <MenuRow label="Switch Department" onPress={() => { setMenuOpen(false); openDepartmentSwitcher(); }} />
          <MenuRow label="Team Messages" onPress={() => { setMenuOpen(false); navigationRef.isReady() && navigationRef.navigate('Messenger' as never); }} />
          <MenuRow label="Notifications & Alerts" onPress={() => { setMenuOpen(false); navigationRef.isReady() && navigationRef.navigate('AlertsTab' as never); }} />
          <MenuRow label="Sign Out" danger onPress={() => { setMenuOpen(false); signOut(); }} />
        </View>
      </Sheet>
    </>
  );
}

const iconBgStyle = {
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: 'rgba(255,255,255,0.18)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const dotStyle = {
  position: 'absolute' as const,
  top: 2,
  right: 2,
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: '#EF4444',
  borderWidth: 1.5,
};

const badgeStyle = {
  position: 'absolute' as const,
  top: -4,
  right: -4,
  minWidth: 17,
  height: 17,
  borderRadius: 8.5,
  paddingHorizontal: 3,
  backgroundColor: '#EF4444',
  borderWidth: 1.5,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const badgeTextStyle = {
  color: '#FFFFFF',
  fontSize: 10,
  fontWeight: '700' as const,
  lineHeight: 12,
};

function MenuRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ paddingVertical: 13, borderRadius: 10, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: danger ? t.colors.status.danger.text : t.colors.textPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
}
