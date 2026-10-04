// rebma-mobile/components/shared/SpeedGauge.tsx
//
// A real, live circular speedometer — one shared component used in both
// places a driver's current speed needs to be very visible: Risk's own
// map (the selected-driver panel in FleetMap.tsx) and the driver's own
// phone (DispatchHomeScreen.tsx's live status screen). Built once here
// rather than duplicated, matching this app's own standing rule against
// re-implementing the same small piece of UI in more than one place.
//
// The ring fills as a live fraction of Risk's configured fleet limit
// (not some arbitrary max), and its color is the actual enforcement
// signal: green while comfortably under the limit, amber approaching it,
// red the moment it's exceeded — the same three-state logic already
// used to color a driver's marker on the map itself.
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

interface SpeedGaugeProps {
  /** Real device GPS speed in km/h, or null when unavailable — never a
   * fabricated placeholder number. */
  speedKmh: number | null;
  /** Risk's live configured fleet speed limit, km/h. */
  limitKmh: number;
  size?: number;
}

export default function SpeedGauge({ speedKmh, limitKmh, size = 96 }: SpeedGaugeProps) {
  const t = useTheme();
  const overLimit = speedKmh != null && speedKmh > limitKmh;
  const nearLimit = speedKmh != null && speedKmh >= limitKmh * 0.85 && !overLimit;
  const color = overLimit ? t.colors.status.danger.text : nearLimit ? t.colors.status.warning.text : t.colors.accent;

  // The ring reads as "how close to the limit," not "how close to some
  // arbitrary max speed" — it fills to 100% exactly at the fleet limit,
  // and clamps there once over (the number in the center keeps climbing,
  // the ring itself just stays a full red circle rather than implying
  // there's more room past the limit).
  const fraction = speedKmh != null && limitKmh > 0 ? Math.min(1, speedKmh / limitKmh) : 0;

  const strokeWidth = Math.max(4, Math.round(size * 0.09));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - fraction);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Rotate the whole SVG (a plain RN style transform, not the raw
          SVG `rotation`/`origin` props — those two don't translate
          cleanly to a real DOM attribute on react-native-svg's web
          renderer and throw a console warning there) so the fill starts
          at 12 o'clock instead of 3 o'clock. */}
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={center} cy={center} r={radius} stroke={t.colors.border} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontFamily: t.font.extrabold, fontSize: size * 0.28, color: overLimit ? color : t.colors.textPrimary, lineHeight: size * 0.3 }}>
        {speedKmh != null ? Math.round(speedKmh) : '—'}
      </Text>
      <Text style={{ fontFamily: t.font.semibold, fontSize: Math.max(8, size * 0.11), color: t.colors.textMuted }}>
        km/h
      </Text>
    </View>
  );
}
