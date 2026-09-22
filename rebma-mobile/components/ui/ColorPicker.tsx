// rebma-mobile/components/ui/ColorPicker.tsx
//
// A real color picker — direct correction: the Appearance screen only
// offered a fixed row of ~8 preset swatches for accent and 5 for
// background; the user wants to be able to pick ANY color, for both.
// No color-picker library exists in this app and none is added here —
// this is three HSL gradient sliders (Hue / Saturation / Lightness) each
// built from react-native-svg's LinearGradient (already a dependency,
// used by ProgressRing/GroupCallSheet) + RN core's own PanResponder for
// drag-and-tap (no gesture-handler dependency needed), plus a hex text
// field for exact entry. Together the three sliders reach every RGB
// color, which is what "a color picker" means here — not just more
// preset chips.
import { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, PanResponder, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToHsl, hslToHex, isValidHex, normalizeHex } from '../../lib/color';

const TRACK_HEIGHT = 14;
const THUMB_SIZE = 22;
const SCREEN_W = Dimensions.get('window').width;

interface SliderProps {
  value: number; // 0-1 ratio
  onChange: (ratio: number) => void;
  stops: { offset: string; color: string }[];
  trackWidth: number;
}

function GradientSlider({ value, onChange, stops, trackWidth }: SliderProps) {
  const startRef = useRef(value);
  const gradId = useMemo(() => `g${Math.random().toString(36).slice(2)}`, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = evt.nativeEvent.locationX;
          const ratio = Math.max(0, Math.min(1, x / trackWidth));
          startRef.current = ratio;
          onChange(ratio);
        },
        onPanResponderMove: (_evt, gesture) => {
          const x = startRef.current * trackWidth + gesture.dx;
          const ratio = Math.max(0, Math.min(1, x / trackWidth));
          onChange(ratio);
        },
      }),
    [trackWidth, onChange]
  );

  const thumbLeft = value * trackWidth - THUMB_SIZE / 2;

  return (
    <View style={{ height: THUMB_SIZE, justifyContent: 'center' }} {...responder.panHandlers}>
      <Svg width={trackWidth} height={TRACK_HEIGHT} style={{ borderRadius: TRACK_HEIGHT / 2 }}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            {stops.map((s, i) => (
              <Stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={trackWidth} height={TRACK_HEIGHT} rx={TRACK_HEIGHT / 2} fill={`url(#${gradId})`} />
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: Math.max(0, Math.min(trackWidth - THUMB_SIZE, thumbLeft)),
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: THUMB_SIZE / 2,
          backgroundColor: '#fff',
          borderWidth: 3,
          borderColor: '#1E1B4B',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 2,
          elevation: 3,
        }}
      />
    </View>
  );
}

interface Props {
  initialHex: string;
  onChange?: (hex: string) => void;
}

export interface ColorPickerHandle {
  getHex: () => string;
}

export default function ColorPicker({ initialHex, onChange }: Props) {
  const t = useTheme();
  const initial = hexToHsl(initialHex);
  const [h, setH] = useState(initial.h);
  const [s, setS] = useState(initial.s);
  const [l, setL] = useState(Math.min(Math.max(initial.l, 15), 85));
  const [hexInput, setHexInput] = useState(normalizeHex(initialHex));

  const hex = hslToHex(h, s, l);
  const trackWidth = SCREEN_W - t.spacing.xl * 2 - 32;

  useEffect(() => {
    setHexInput(normalizeHex(hex));
    onChange?.(hex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  const commitHexInput = (text: string) => {
    setHexInput(text);
    if (isValidHex(text)) {
      const parsed = hexToHsl(normalizeHex(text));
      setH(parsed.h);
      setS(parsed.s);
      setL(parsed.l);
    }
  };

  const hueStops = [0, 60, 120, 180, 240, 300, 360].map((deg) => ({
    offset: `${(deg / 360) * 100}%`,
    color: hslToHex(deg, 100, 50),
  }));
  const satStops = [
    { offset: '0%', color: hslToHex(h, 0, l) },
    { offset: '100%', color: hslToHex(h, 100, l) },
  ];
  const lightStops = [
    { offset: '0%', color: '#000000' },
    { offset: '50%', color: hslToHex(h, s, 50) },
    { offset: '100%', color: '#FFFFFF' },
  ];

  return (
    <View style={{ gap: t.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: t.radius.lg,
            backgroundColor: hex,
            borderWidth: 1,
            borderColor: t.colors.border,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted, marginBottom: 4 }}>
            Hex Color
          </Text>
          <TextInput
            value={hexInput}
            onChangeText={commitHexInput}
            autoCapitalize="characters"
            maxLength={7}
            placeholder="#000000"
            placeholderTextColor={t.colors.textMuted}
            style={{
              fontFamily: t.font.semibold,
              fontSize: t.type.body14.size,
              color: t.colors.textPrimary,
              backgroundColor: t.colors.bgInput,
              borderWidth: 1,
              borderColor: t.colors.border,
              borderRadius: t.radius.sm,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          />
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted }}>
          Hue
        </Text>
        <GradientSlider value={h / 360} onChange={(r) => setH(r * 360)} stops={hueStops} trackWidth={trackWidth} />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted }}>
          Saturation
        </Text>
        <GradientSlider value={s / 100} onChange={(r) => setS(r * 100)} stops={satStops} trackWidth={trackWidth} />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted }}>
          Lightness
        </Text>
        <GradientSlider value={l / 100} onChange={(r) => setL(r * 100)} stops={lightStops} trackWidth={trackWidth} />
      </View>
    </View>
  );
}
