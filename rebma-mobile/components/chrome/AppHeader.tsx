// rebma-mobile/components/chrome/AppHeader.tsx
//
// The department dashboard header — sixth iteration, after five rounds
// of live correction (see mobileUI.md's Design Decisions Log, entry 1,
// for the full history):
//   1. Fully fixed header, content rises over it, icons fade on scroll
//      — rejected: icons shrinking/hiding read as poor UX.
//   2. Whole header scrolls away with the page — rejected: greeting
//      should stay part of the header.
//   3. Collapse-then-pin — rejected, same reason as 2.
//   4. Entire header fixed, content scrolls IN FRONT of it and covers
//      it — matched what was asked at the time, but hit a real,
//      confirmed technical wall on the web preview: the ScrollView's
//      own content-container intercepts clicks across its FULL
//      scrollable height (not just where its opaque content visually
//      sits), so even a `pointerEvents="none"` spacer couldn't let
//      taps reach the header underneath — confirmed via direct DOM
//      inspection (elementsFromPoint), not assumed.
//   5. Reverted to header-scrolls-with-the-page (round 2's model) to
//      guarantee correctness while other pieces were fixed.
//   6. The header stays FIXED and ALWAYS ON TOP (highest z-order, never
//      covered), so it's always the thing that receives taps — no
//      ambiguity, no stacking conflict, because content never gets to
//      be in front of it. Content scrolls BEHIND/UNDER the header
//      instead. Per direct correction, the header does NOT dim or fade
//      from scrolling alone — it only darkens when something is
//      genuinely on top of it, i.e. a Sheet's own modal backdrop (see
//      Sheet.tsx), which already covers the whole screen including the
//      header whenever one is open. Nothing extra is needed here for
//      that — an RN Modal always renders above this header's zIndex
//      regardless.
//   7. The icon row (logo/switcher, chat, bell, avatar) moved OUT of
//      this component entirely, into PersistentIconRow.tsx, rendered
//      once in AppShell.tsx above everything (every tab, every pushed
//      sub-page) — per direct correction, "nothing should go above the
//      icons" means the icons themselves must never disappear, not just
//      never be covered on the one screen that used to own them. This
//      component now only owns the greeting + search block, and
//      positions itself starting right below where the persistent icon
//      row ends (AppShell's adjusted SafeAreaInsetsContext means
//      `insets.top` here already accounts for that row's height).
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

export const CONTENT_SHEET_RADIUS = 20;
const GREETING_ROW_H = 40;
const SEARCH_BLOCK_H = 62;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function usePinnedHeaderHeight() {
  const insets = useSafeAreaInsets();
  return insets.top + GREETING_ROW_H + SEARCH_BLOCK_H;
}

/** The greeting + search block — fixed at the top, directly below the
 * always-on-top PersistentIconRow (see AppShell.tsx), dimming... no —
 * per round 6 above, it does NOT dim. Rendered by Screen.tsx's
 * dashboard mode as an absolute sibling of the ScrollView, not inside
 * it. Only present on dashboard-mode screens (the department's own
 * Overview screen); every other screen just gets the persistent icon
 * row with nothing below it here. */
export default function DashboardHeader() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const openSearch = useUIStore((s) => s.openSearch);

  if (!profile) return null;
  const firstName = profile.fullName?.split(' ')[0] || 'there';

  return (
    <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 10 }}>
        <LinearGradient
          colors={t.darkMode ? [t.colors.bgHeader, t.colors.bgHeader] : [t.colors.accent, t.colors.accentPressed]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={{ borderBottomLeftRadius: CONTENT_SHEET_RADIUS, borderBottomRightRadius: CONTENT_SHEET_RADIUS, ...(t.darkMode ? { borderBottomWidth: 1, borderColor: t.colors.border } : {}) }}
        >
          <View style={{ paddingHorizontal: t.spacing.lg, height: GREETING_ROW_H, justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>
              {getGreeting()}
            </Text>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: '#FFFFFF', marginTop: 1 }} numberOfLines={1}>
              {firstName} 👋
            </Text>
          </View>

          <View style={{ paddingHorizontal: t.spacing.lg, height: SEARCH_BLOCK_H, justifyContent: 'center' }}>
            <Pressable
              onPress={openSearch}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.darkMode ? t.colors.bgInput : '#FFFFFF',
                borderRadius: t.radius.pill,
                height: 46,
                paddingHorizontal: 14,
              }}
            >
              <Search size={16} color={t.colors.textMuted} />
              <Text
                numberOfLines={1}
                style={{ flex: 1, marginLeft: 8, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textMuted }}
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
      </View>
  );
}
