// rebma-mobile/components/ui/CalendarPicker.tsx
//
// The one calendar used everywhere a list is filtered by date (approved
// rule: no "Today / This Week / This Month" buttons; a calendar instead).
//
//  * mode 'single': tap a day.
//  * mode 'range':  tap a start day, then an end day; everything between is
//                   highlighted. Tapping again starts a new range.
//  * Swipe left/right or use the arrows to change month; the grid slides
//    and fades. "Today" jumps back to the current month.
//  * `marks` puts a small dot under days that have something (e.g. a
//    birthday), so past and future months can be browsed by eye.
//
// Dates are plain 'YYYY-MM-DD' strings in local time, so there's no
// timezone drift between what's tapped and what's filtered.
import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, Animated, PanResponder } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type CalendarValue = { start: string | null; end: string | null };

interface Props {
  month: Date;                       // any day in the month shown
  onMonthChange: (month: Date) => void;
  mode?: 'single' | 'range';
  value: CalendarValue;
  onChange: (value: CalendarValue) => void;
  marks?: Record<string, { color?: string }>;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarPicker({ month, onMonthChange, mode = 'single', value, onChange, marks }: Props) {
  const t = useTheme();
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const todayKey = toKey(new Date());

  const days = useMemo(() => {
    const first = new Date(year, monthIndex, 1);
    const count = new Date(year, monthIndex + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= count; d++) cells.push(toKey(new Date(year, monthIndex, d)));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [year, monthIndex]);

  const go = (delta: number, target?: Date) => {
    Animated.parallel([
      Animated.timing(slide, { toValue: -delta * 40, duration: 120, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      onMonthChange(target || new Date(year, monthIndex + delta, 1));
      slide.setValue(delta * 40);
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    });
  };

  // Keep the latest `go` reachable from the gesture handler.
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; });
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => { if (g.dx < -40) goRef.current(1); else if (g.dx > 40) goRef.current(-1); },
  })).current;

  // Range mode: the first tap picks one day; a second tap on a different
  // day turns it into a range (in either order); the next tap starts over.
  const tap = (key: string) => {
    if (mode === 'range' && value.start && value.start === value.end && key !== value.start) {
      const [a, b] = key < value.start ? [key, value.start] : [value.start, key];
      onChange({ start: a, end: b });
      return;
    }
    onChange({ start: key, end: key });
  };

  const inRange = (key: string) => !!value.start && !!value.end && key >= value.start && key <= value.end;
  const isEdge = (key: string) => key === value.start || key === value.end;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
        <Pressable onPress={() => go(-1)} hitSlop={10} accessibilityLabel="Previous month" style={{ padding: 6 }}>
          <ChevronLeft size={20} color={t.colors.textSecondary} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{MONTHS[monthIndex]} {year}</Text>
          {(year !== new Date().getFullYear() || monthIndex !== new Date().getMonth()) && (
            <Pressable onPress={() => { const now = new Date(); go(now.getFullYear() * 12 + now.getMonth() > year * 12 + monthIndex ? 1 : -1, now); }} hitSlop={6}>
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.accent }}>Back to this month</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => go(1)} hitSlop={10} accessibilityLabel="Next month" style={{ padding: 6 }}>
          <ChevronRight size={20} color={t.colors.textSecondary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{w}</Text>
        ))}
      </View>

      <Animated.View {...pan.panHandlers} style={{ flexDirection: 'row', flexWrap: 'wrap', opacity: fade, transform: [{ translateX: slide }] }}>
        {days.map((key, i) => {
          if (!key) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const selected = isEdge(key);
          const between = inRange(key) && !selected;
          const mark = marks?.[key];
          return (
            <DayCell
              key={key}
              label={Number(key.slice(8))}
              selected={selected}
              between={between}
              isToday={key === todayKey}
              markColor={mark ? (mark.color || t.colors.accent) : undefined}
              onPress={() => tap(key)}
              accessibilityLabel={key}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

// One day in the grid. Shrinks slightly under the finger and pops when it
// becomes selected, so picking a date feels physical.
function DayCell({ label, selected, between, isToday, markColor, onPress, accessibilityLabel }: {
  label: number; selected: boolean; between: boolean; isToday: boolean;
  markColor?: string; onPress: () => void; accessibilityLabel: string;
}) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (selected && !wasSelected.current) {
      scale.setValue(0.8);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }).start();
    }
    wasSelected.current = selected;
  }, [selected, scale]);

  const pressTo = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => pressTo(0.88)}
      onPressOut={() => pressTo(1)}
      style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.md,
        backgroundColor: selected ? t.colors.accent : between ? t.colors.accentSoft : 'transparent',
        borderWidth: isToday && !selected ? 1 : 0, borderColor: t.colors.accent,
        transform: [{ scale }],
      }}>
        <Text style={{ fontFamily: selected ? t.font.bold : t.font.medium, fontSize: t.type.body12.size, color: selected ? '#fff' : t.colors.textPrimary }}>
          {label}
        </Text>
        {markColor && <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: selected ? '#fff' : markColor }} />}
      </Animated.View>
    </Pressable>
  );
}
