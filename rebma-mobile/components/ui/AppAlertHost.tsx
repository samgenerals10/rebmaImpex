// rebma-mobile/components/ui/AppAlertHost.tsx
//
// The themed replacement for the native Alert.alert()/action-sheet popup
// (direct correction — the OS dialog rendered plain and unstyled, out of
// step with the rest of the app). Mounted once at the root in App.tsx;
// every screen's `Alert.alert(...)` call now routes here via
// lib/appAlert.ts instead of the OS dialog, with no change to any call
// site's own logic (same title/message/buttons/options signature).
//
// Layout mirrors the two real shapes Alert.alert is used for in this app:
// a 1-2 button confirm/error dialog renders its buttons side by side
// (matching the native iOS convention this app's users already expect),
// and a 3+ button prompt (e.g. "Add Image": Capture / Photo / Cancel)
// renders them stacked, matching a native action sheet.
import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { registerAppAlertListener, type AppAlertState, type AppAlertButton } from '../../lib/appAlert';

export default function AppAlertHost() {
  const t = useTheme();
  const [state, setState] = useState<AppAlertState | null>(null);
  const [opacity] = useState(new Animated.Value(0));
  const [scale] = useState(new Animated.Value(0.94));

  useEffect(() => {
    registerAppAlertListener((next) => {
      if (next) {
        setState(next);
      } else {
        close();
      }
    });
    return () => registerAppAlertListener(null);
  }, []);

  useEffect(() => {
    if (!state) return;
    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 4 }),
    ]).start();
  }, [state]);

  const close = () => {
    Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setState(null));
  };

  if (!state) return null;

  const handlePress = (btn: AppAlertButton) => {
    close();
    btn.onPress?.();
  };

  const handleBackdrop = () => {
    if (!state.cancelable) return;
    close();
    state.onDismiss?.();
  };

  const stacked = state.buttons.length > 2;

  const buttonTextStyle = (btn: AppAlertButton) => {
    if (btn.style === 'cancel') return { color: t.colors.textMuted, fontFamily: t.font.medium };
    if (btn.style === 'destructive') return { color: t.colors.status.danger.text, fontFamily: t.font.bold };
    return { color: t.colors.accent, fontFamily: t.font.bold };
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={handleBackdrop}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdrop} />
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: t.colors.bgCard,
              borderRadius: t.radius.card,
              transform: [{ scale }],
              ...t.shadow('raised'),
            },
          ]}
        >
          <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.xl, paddingBottom: t.spacing.lg }}>
            <Text
              style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.textPrimary, textAlign: 'center' }}
            >
              {state.title}
            </Text>
            {state.message ? (
              <Text
                style={{
                  fontFamily: t.font.regular,
                  fontSize: t.type.body14.size,
                  lineHeight: t.type.body14.lineHeight,
                  color: t.colors.textSecondary,
                  textAlign: 'center',
                  marginTop: t.spacing.sm,
                }}
              >
                {state.message}
              </Text>
            ) : null}
          </View>

          <View style={[stacked ? styles.colWrap : styles.rowWrap, { borderTopColor: t.colors.border }]}>
            {state.buttons.map((btn, i) => (
              <Pressable
                key={i}
                onPress={() => handlePress(btn)}
                style={({ pressed }) => [
                  stacked ? styles.colBtn : styles.rowBtn,
                  {
                    backgroundColor: pressed ? t.colors.bgInput : 'transparent',
                    borderTopColor: t.colors.border,
                    borderTopWidth: stacked ? (i > 0 ? 1 : 0) : 0,
                    borderLeftColor: t.colors.border,
                    borderLeftWidth: !stacked && i > 0 ? 1 : 0,
                  },
                ]}
              >
                <Text style={[{ fontSize: t.type.body14.size }, buttonTextStyle(btn)]} numberOfLines={1}>
                  {btn.text || 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  rowWrap: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  colWrap: {
    flexDirection: 'column',
    borderTopWidth: 1,
  },
  rowBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
