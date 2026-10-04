// rebma-mobile/components/ui/DateRangeField.tsx
// The date filter used on every list and report filtered by date (approved
// Part C). Shows the chosen day or range; tapping it opens the shared
// CalendarPicker in a bottom sheet. Replaces "Today / This Week / This
// Month" and "7D / 30D" buttons.
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Sheet from './Sheet';
import Button from './Button';
import CalendarPicker, { type CalendarValue } from './CalendarPicker';
import { rangeLabel } from '../../lib/dateRange';

interface Props {
  value: CalendarValue;
  onChange: (value: CalendarValue) => void;
  mode?: 'single' | 'range';
  emptyLabel?: string;
  allowClear?: boolean;
  title?: string;
  /** Dots under days that have something, keyed 'YYYY-MM-DD'. */
  marks?: Record<string, { color?: string }>;
  /** Told whenever the calendar shows a different month, to load its marks. */
  onVisibleMonthChange?: (month: Date) => void;
}

export default function DateRangeField({ value, onChange, mode = 'range', emptyLabel = 'All dates', allowClear = false, title, marks, onVisibleMonthChange }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => (value.start ? new Date(`${value.start}T12:00:00`) : new Date()));

  return (
    <>
      <Pressable
        onPress={() => { setOpen(true); onVisibleMonthChange?.(month); }}
        accessibilityRole="button"
        accessibilityLabel={`Dates: ${rangeLabel(value, emptyLabel)}`}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, alignSelf: 'flex-start',
          paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md, borderRadius: t.radius.pill,
          backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: t.colors.border,
        }}
      >
        <CalendarDays size={15} color={t.colors.accent} />
        <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{rangeLabel(value, emptyLabel)}</Text>
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title={title || (mode === 'range' ? 'Pick dates' : 'Pick a day')} side="bottom" maxHeight={620}
        footer={
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {allowClear && (value.start || value.end) ? (
              <View style={{ flex: 1 }}><Button label="Clear" variant="ghost" onPress={() => { onChange({ start: null, end: null }); setOpen(false); }} fullWidth /></View>
            ) : null}
            <View style={{ flex: 1 }}><Button label="Done" onPress={() => setOpen(false)} fullWidth /></View>
          </View>
        }>
        <CalendarPicker month={month} onMonthChange={(m) => { setMonth(m); onVisibleMonthChange?.(m); }} mode={mode} value={value} onChange={onChange} marks={marks} />
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: t.spacing.sm }}>
          {mode === 'range' ? 'Tap one day, or a start day and then an end day.' : 'Tap a day.'}
        </Text>
      </Sheet>
    </>
  );
}
