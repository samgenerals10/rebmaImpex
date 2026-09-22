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
  /** Shown as a small pill count on 'chips' only — the one capability SegmentedPillTabs had that this didn't, absorbed here so that component could retire. */
  badge?: number;
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
      <View style={{ flexDirection: 'row', backgroundColor: t.darkMode ? '#1E293B' : '#F1F0FB', borderRadius: t.radius.pill, padding: 4, gap: 4 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                // minWidth: 0 is load-bearing: without it a flex:1 child
                // never shrinks below its text's natural width (a
                // well-known flexbox default), so numberOfLines={1}
                // never gets the chance to ellipsize — the label just
                // overflows past its own pill into the next tab instead.
                flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center',
                paddingVertical: t.spacing.sm, paddingHorizontal: 2, borderRadius: t.radius.pill,
                backgroundColor: active ? (t.darkMode ? t.colors.accent : '#FFFFFF') : 'transparent',
                ...(active && !t.darkMode ? t.shadow('card') : {}),
              }}
            >
              <Text
                style={{ fontFamily: active ? t.font.bold : t.font.medium, fontSize: t.type.meta11.size, color: active ? (t.darkMode ? '#FFFFFF' : t.colors.accent) : t.colors.textSecondary, textAlign: 'center' }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
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
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingVertical: 8, paddingHorizontal: 16,
                borderRadius: t.radius.pill,
                backgroundColor: active ? t.colors.accent : (t.darkMode ? '#1E293B' : '#FFFFFF'),
                borderWidth: active ? 0 : 1,
                borderColor: t.colors.border,
                ...(active ? t.shadow('fab') : t.shadow('card')),
              }}
            >
              <Text style={{ fontFamily: active ? t.font.bold : t.font.medium, fontSize: t.type.body12.size, color: active ? t.colors.onAccent : t.colors.textSecondary }}>
                {opt.label}
              </Text>
              {opt.badge !== undefined && opt.badge > 0 && (
                <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: active ? 'rgba(255,255,255,0.3)' : t.colors.accentSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: 10, color: active ? t.colors.onAccent : t.colors.accent }}>
                    {opt.badge > 99 ? '99+' : opt.badge}
                  </Text>
                </View>
              )}
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
