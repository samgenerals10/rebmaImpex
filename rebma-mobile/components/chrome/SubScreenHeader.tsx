// rebma-mobile/components/chrome/SubScreenHeader.tsx
//
// The shared header for every pushed sub-screen in the app — every
// department sub-tab (Stock Intake, Orders Queue, Staff Directory, etc.),
// Messenger threads, Boardroom/Viber screens, and Profile's Design
// System/Feedback/Payslips (main app and driver variants alike).
//
// Matches AppHeader.tsx's own "Aczone Header v2" visual language rather
// than inventing a second style: bgHeader background, a hairline
// bottom border (not a floating shadow), bold textPrimary title — and
// the back control is the exact same 36x36 accentSoft circular chip
// AppHeader.tsx already uses for its Chat/Bell buttons, just holding a
// chevron-left instead. This is what makes every sub-screen in the app
// read as one consistent header, not a plain system default.
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';

const SIDE_SLOT = 36;

export default function SubScreenHeader({ navigation, options, back }: NativeStackHeaderProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const profile = useAuthStore((s) => s.profile);
  // Breadcrumb above the title — Department name only (the title below it
  // already IS the sub-tab name, so "Department › Sub-tab" would repeat
  // itself). Falls back to the profile's own department when no explicit
  // switch has happened yet, matching AppShell/DepartmentStackScreen's own
  // effectiveDepartment fallback.
  const dept = getDepartmentEntry(activeDepartment || profile?.department || '');
  const breadcrumb = dept.label;

  const title =
    (typeof options.headerTitle === 'string' ? options.headerTitle : undefined) ??
    options.title ??
    '';

  const headerRight =
    typeof options.headerRight === 'function'
      ? options.headerRight({ tintColor: t.colors.accent, canGoBack: !!back })
      : null;

  return (
    <View
      style={{
        backgroundColor: t.colors.bgHeader,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.border,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: t.spacing.lg,
          minHeight: 52,
          paddingVertical: t.spacing.xs,
          gap: t.spacing.sm,
        }}
      >
        {back ? (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={{
              width: SIDE_SLOT,
              height: SIDE_SLOT,
              borderRadius: SIDE_SLOT / 2,
              backgroundColor: t.colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft size={19} color={t.colors.accent} />
          </Pressable>
        ) : (
          <View style={{ width: SIDE_SLOT }} />
        )}

        <View style={{ flex: 1 }}>
          {!!breadcrumb && (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: t.font.semibold,
                fontSize: t.type.meta10.size,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: t.colors.textMuted,
                marginBottom: 1,
              }}
            >
              {breadcrumb}
            </Text>
          )}
          <Text
            numberOfLines={1}
            style={{
              fontFamily: t.font.bold,
              fontSize: t.type.base16.size,
              color: t.colors.textPrimary,
            }}
          >
            {title}
          </Text>
        </View>

        {headerRight ?? <View style={{ width: SIDE_SLOT }} />}
      </View>
    </View>
  );
}
