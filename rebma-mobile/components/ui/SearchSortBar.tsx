// rebma-mobile/components/ui/SearchSortBar.tsx
//
// Direct correction: every table's plain "Search..." box should carry
// the same sliders icon the app header's own search pill already uses
// (AppHeader.tsx) — tapping it opens sort/filter/date-range controls in
// a themed Sheet, instead of a bare text box with no way to sort or
// filter at all. One shared component so every table gets this for
// free going forward, not a one-off per screen.
import { useState, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SlidersHorizontal, Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Sheet from './Sheet';
import CalendarPicker from './CalendarPicker';
import { rangeLabel } from '../../lib/dateRange';

export interface SortOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;

  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (v: string) => void;

  filterOptions?: SortOption[];
  filterValue?: string;
  onFilterChange?: (v: string) => void;
  filterLabel?: string;

  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (v: string) => void;
  onDateToChange?: (v: string) => void;

  /** Extra controls rendered inside the sheet, below the built-in ones. */
  children?: ReactNode;
}

export default function SearchSortBar({
  value, onChangeText, placeholder = 'Search…',
  sortOptions, sortValue, onSortChange,
  filterOptions, filterValue, onFilterChange, filterLabel = 'Filter',
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  children,
}: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(() => (dateFrom ? new Date(`${dateFrom}T12:00:00`) : new Date()));

  const hasControls = !!(sortOptions?.length || filterOptions?.length || onDateFromChange || children);
  const activeCount = (sortValue && sortValue !== sortOptions?.[0]?.value ? 1 : 0) + (filterValue && filterValue !== 'All' && filterValue !== filterOptions?.[0]?.value ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: focused ? (t.darkMode ? '#1E293B' : '#FFFFFF') : t.colors.bgInput,
          borderWidth: focused ? 1.5 : 1,
          borderColor: focused ? t.colors.accent : t.colors.border,
          borderRadius: 16,
          paddingLeft: t.spacing.lg,
          paddingRight: 6,
          ...(focused ? t.shadow('card') : {}),
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            paddingVertical: 14,
            fontFamily: t.font.medium,
            fontSize: t.type.body14.size,
            color: t.colors.textPrimary,
          }}
        />
        {hasControls && (
          <Pressable
            onPress={() => setOpen(true)}
            hitSlop={8}
            style={{
              width: 32, height: 32, borderRadius: 16,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: activeCount > 0 ? t.colors.accentSoft : 'transparent',
            }}
          >
            <SlidersHorizontal size={16} color={activeCount > 0 ? t.colors.accent : t.colors.textMuted} />
          </Pressable>
        )}
      </View>

      <Sheet open={open} onClose={() => setOpen(false)} title="Sort & Filter" side="bottom" maxHeight={560}>
        <View style={{ gap: t.spacing.lg }}>
          {sortOptions && sortOptions.length > 0 && (
            <View>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
                Sort By
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {sortOptions.map((o) => {
                  const selected = sortValue === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => onSortChange?.(o.value)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingVertical: 8, paddingHorizontal: 14, borderRadius: t.radius.pill,
                        borderWidth: 1, borderColor: selected ? t.colors.accent : t.colors.border,
                        backgroundColor: selected ? t.colors.accentSoft : t.colors.bgCard,
                      }}
                    >
                      {selected && <Check size={12} color={t.colors.accent} strokeWidth={2.5} />}
                      <Text style={{ fontFamily: selected ? t.font.bold : t.font.medium, fontSize: t.type.meta11.size, color: selected ? t.colors.accent : t.colors.textSecondary }}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {filterOptions && filterOptions.length > 0 && (
            <View>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
                {filterLabel}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {filterOptions.map((o) => {
                  const selected = filterValue === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => onFilterChange?.(o.value)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingVertical: 8, paddingHorizontal: 14, borderRadius: t.radius.pill,
                        borderWidth: 1, borderColor: selected ? t.colors.accent : t.colors.border,
                        backgroundColor: selected ? t.colors.accentSoft : t.colors.bgCard,
                      }}
                    >
                      {selected && <Check size={12} color={t.colors.accent} strokeWidth={2.5} />}
                      <Text style={{ fontFamily: selected ? t.font.bold : t.font.medium, fontSize: t.type.meta11.size, color: selected ? t.colors.accent : t.colors.textSecondary }}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {(onDateFromChange || onDateToChange) && (
            <View>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
                Date Range
              </Text>
              {/* Calendar instead of typed dates (approved Part C): tap one day,
                  or a start day and then an end day. */}
              <CalendarPicker
                month={calMonth}
                onMonthChange={setCalMonth}
                mode="range"
                value={{ start: dateFrom || null, end: dateTo || dateFrom || null }}
                onChange={(v) => { onDateFromChange?.(v.start || ''); onDateToChange?.(v.end || ''); }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textSecondary }}>
                  {rangeLabel({ start: dateFrom || null, end: dateTo || null }, 'All dates')}
                </Text>
                {(dateFrom || dateTo) ? (
                  <Pressable onPress={() => { onDateFromChange?.(''); onDateToChange?.(''); }} hitSlop={8}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.accent }}>Clear dates</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}

          {children}
        </View>
      </Sheet>
    </View>
  );
}
