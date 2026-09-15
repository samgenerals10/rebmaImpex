// rebma-mobile/components/ui/Tabs.tsx
// New primitive (mobile-ui-fluidity skill): no shared tab component existed
// before this, so every screen that needed tabs hand-rolled its own,
// inconsistently. Three variants, chosen by what's actually being switched:
//
//   'segmented' — mutually exclusive full views of the same entity
//                 (an approval queue's status tabs, a profile's
//                 Attendance/Leave/Performance tabs). Solid pill fill on
//                 the active tab, all tabs equal width.
//   'chips'     — a quick filter row over an existing list (date range,
//                 status quick-filter). Only the active chip gets a pill
//                 background; the rest are unstyled text.
//   'underline' — document/record-category switching (Spreadsheets' Data
//                 vs Free mode, a notes-style category list). Bold text
//                 plus a 2px accent bottom border, no pill at all.
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface TabOption {
  value: string;
  label: string;
}

interface Props {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  variant?: 'segmented' | 'chips' | 'underline';
}

export default function Tabs({ options, value, onChange, variant = 'segmented' }: Props) {
  const t = useTheme();

  if (variant === 'segmented') {
    return (
      <View style={{ flexDirection: 'row', backgroundColor: t.colors.bgInput, borderRadius: t.radius.pill, padding: 3, gap: 2 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                flex: 1, alignItems: 'center', justifyContent: 'center',
                paddingVertical: t.spacing.sm, borderRadius: t.radius.pill,
                backgroundColor: active ? t.colors.accent : 'transparent',
              }}
            >
              <Text style={{ fontFamily: active ? t.font.bold : t.font.medium, fontSize: t.type.body12.size, color: active ? t.colors.onAccent : t.colors.textSecondary }} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (variant === 'chips') {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.sm }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.md,
                borderRadius: t.radius.pill,
                backgroundColor: active ? t.colors.accent : 'transparent',
                borderWidth: active ? 0 : 1,
                borderColor: t.colors.border,
              }}
            >
              <Text style={{ fontFamily: active ? t.font.bold : t.font.medium, fontSize: t.type.body12.size, color: active ? t.colors.onAccent : t.colors.textSecondary }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  // underline
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md,
              borderBottomWidth: 2, borderBottomColor: active ? t.colors.accent : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text style={{ fontFamily: active ? t.font.bold : t.font.medium, fontSize: t.type.body14.size, color: active ? t.colors.textPrimary : t.colors.textMuted }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
