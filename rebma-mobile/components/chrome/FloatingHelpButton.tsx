// rebma-mobile/components/chrome/FloatingHelpButton.tsx
//
// Direct instruction: the Help Assistant needed to be more visible than
// one item buried at the end of a ~15-item tab list. Confirmed directly:
// a fixed, animated chat icon on the screen edge (right by default),
// above the bottom nav on mobile, draggable by long-press but always
// snapping back to an edge, remembered across app opens, and visible
// EVERYWHERE the CEO/admin is logged in — not just while viewing the
// CEO department's own screens, since a CEO switches departments
// constantly and should still be able to reach it.
//
// Rendered as a sibling of Tab.Navigator (see AppShell.tsx, same level
// PersistentIconRow already uses) so it survives every screen and
// department switch. Gated internally on `profile.isAdmin` — renders
// nothing at all for anyone else, matching the standing "CEO-only, no
// one and nowhere else" rule for this feature.
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { navigationRef, navigateToSubTab } from '../../navigation/navigationRef';
import { useBlink } from '../../hooks/useBlink';

const SIZE = 52;
const EDGE_MARGIN = 8;
const TAB_BAR_H = 68;
const STORAGE_KEY = 'floating-help-button-position-v1';
// A real drag vs. a tap: under this much movement and this much time,
// it's a tap (open the Assistant) even if PanResponder technically saw
// a tiny move — without this, almost every tap would register as a
// zero-distance "drag" and never actually open anything.
const TAP_MAX_DISTANCE = 8;
const TAP_MAX_DURATION_MS = 350;

function openAssistant() {
  useUIStore.getState().setActiveDepartment('CEO');
  if (navigationRef.isReady()) {
    (navigationRef.navigate as (name: string, params?: object) => void)('HomeTab');
  }
  // Same deferred-navigate pattern as HelpAssistantScreen.tsx's own
  // goToEntry() — the department stack remounts fresh on a department
  // switch (Phase 7.1, D13), so the subtab push needs a moment after
  // setActiveDepartment before 'HelpAssistant' exists as a valid route.
  setTimeout(() => navigateToSubTab('HelpAssistant'), 80);
}

export default function FloatingHelpButton() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = !!profile?.isAdmin;

  const screen = Dimensions.get('window');
  const defaultX = screen.width - SIZE - EDGE_MARGIN;
  const defaultY = screen.height - insets.bottom - TAB_BAR_H - SIZE - 16;

  const pan = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;
  // The button's actual current position, tracked explicitly rather than
  // read back out of the Animated.Value (which has no public synchronous
  // getter) — updated directly inside the gesture handlers below, so it's
  // always known precisely at release time for the tap-vs-drag decision
  // and the edge-snap math.
  const posRef = useRef({ x: defaultX, y: defaultY });
  const dragStartRef = useRef({ x: defaultX, y: defaultY, t: 0, moved: 0 });
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const blink = useBlink(isAdmin && !dragging, [0.6, 1]);

  // Restore the last saved position once on mount — before this
  // resolves the button sits at the computed default, which is fine
  // (no flash of an obviously-wrong spot).
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { side: 'left' | 'right'; y: number };
          const x = saved.side === 'left' ? EDGE_MARGIN : screen.width - SIZE - EDGE_MARGIN;
          posRef.current = { x, y: saved.y };
          pan.setValue({ x, y: saved.y });
        }
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current = { x: posRef.current.x, y: posRef.current.y, t: Date.now(), moved: 0 };
        setDragging(true);
      },
      onPanResponderMove: (_evt, gesture) => {
        const nextX = dragStartRef.current.x + gesture.dx;
        const nextY = dragStartRef.current.y + gesture.dy;
        dragStartRef.current.moved = Math.max(dragStartRef.current.moved, Math.abs(gesture.dx) + Math.abs(gesture.dy));
        posRef.current = { x: nextX, y: nextY };
        pan.setValue({ x: nextX, y: nextY });
      },
      onPanResponderRelease: () => {
        setDragging(false);
        const elapsed = Date.now() - dragStartRef.current.t;
        const isTap = dragStartRef.current.moved < TAP_MAX_DISTANCE && elapsed < TAP_MAX_DURATION_MS;
        if (isTap) {
          // Snap back to the exact resting spot it was at before this
          // tap-sized wiggle, so a tap can never leave it a few pixels
          // off from where it started.
          pan.setValue(posRef.current);
          openAssistant();
          return;
        }
        // Snap to whichever edge is closer, clamp Y to stay fully
        // on-screen and clear of the bottom nav — "should be only on
        // the edges" per direct instruction, not free-floating.
        const goLeft = posRef.current.x < screen.width / 2;
        const snappedX = goLeft ? EDGE_MARGIN : screen.width - SIZE - EDGE_MARGIN;
        const minY = insets.top + 8;
        const maxY = screen.height - insets.bottom - TAB_BAR_H - SIZE - 8;
        const clampedY = Math.min(Math.max(posRef.current.y, minY), maxY);
        posRef.current = { x: snappedX, y: clampedY };
        Animated.spring(pan, { toValue: { x: snappedX, y: clampedY }, useNativeDriver: false, friction: 8 }).start();
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ side: goLeft ? 'left' : 'right', y: clampedY })).catch(() => {});
      },
    })
  ).current;

  if (!isAdmin || !loaded) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        width: SIZE,
        height: SIZE,
        zIndex: 20,
        transform: pan.getTranslateTransform(),
        opacity: dragging ? 1 : blink,
      }}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: t.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          ...t.shadow('raised'),
        }}
      >
        <Bot size={24} color={t.colors.onAccent} />
      </View>
    </Animated.View>
  );
}
