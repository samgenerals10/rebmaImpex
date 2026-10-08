// rebma-mobile/components/ui/Toggle.tsx
//
// A real sliding pill switch (track + circular knob), matching the
// on/off rows from the components-kit reference image exactly. Every
// settings row in this app (Control Center's ~50 keys chief among them)
// previously faked this with a `Button` reading "On"/"Off" — a real,
// visible gap next to what the reference actually shows. This replaces
// that everywhere it's used.
import { useRef } from 'react';
import { Pressable, Animated, Easing } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Overrides the "on" track color — every existing call site keeps
   * the app's own accent unchanged; only Login's brand-green screen
   * passes this, so the switch doesn't read as a different app's
   * purple sitting on an otherwise all-green page. */
  color?: string;
}

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const KNOB_SIZE = 22;
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - 4; // 2px inset each side

export default function Toggle({ value, onChange, disabled, color }: Props) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const toggle = () => {
    if (disabled) return;
    const next = !value;
    // Smooth ease-in-out, the same feel as the web switch (no bounce).
    Animated.timing(anim, { toValue: next ? 1 : 0, duration: 200, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }).start();
    onChange(next);
  };

  // Keep the knob in sync when `value` changes from outside (e.g. a
  // parent reloading settings after a save), not just from local taps.
  if ((anim as any)._value !== (value ? 1 : 0) && !(anim as any)._animation) {
    anim.setValue(value ? 1 : 0);
  }

  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [t.darkMode ? '#333333' : '#cbd5e1', color || '#02afd9'] });
  const knobTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 2 + KNOB_TRAVEL] });

  return (
    <Pressable onPress={toggle} disabled={disabled} hitSlop={8} style={{ opacity: disabled ? 0.5 : 1 }}>
      <Animated.View
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          borderRadius: t.radius.pill,
          backgroundColor: trackColor as any,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: KNOB_SIZE / 2,
            backgroundColor: '#ffffff',
            transform: [{ translateX: knobTranslate }],
            ...t.shadow('card'),
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
