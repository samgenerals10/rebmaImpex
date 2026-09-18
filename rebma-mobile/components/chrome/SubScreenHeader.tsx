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

const SIDE_SLOT = 36;

export default function SubScreenHeader({ navigation, options, back }: NativeStackHeaderProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

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
          height: 52,
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

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: t.font.bold,
            fontSize: t.type.base16.size,
            color: t.colors.textPrimary,
          }}
        >
          {title}
        </Text>

        {headerRight ?? <View style={{ width: SIDE_SLOT }} />}
      </View>
    </View>
  );
}
