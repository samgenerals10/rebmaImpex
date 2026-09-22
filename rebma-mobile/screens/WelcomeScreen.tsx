// rebma-mobile/screens/WelcomeScreen.tsx
//
// The logged-out home page — a real onboarding carousel, not just a style
// reference. Shown every time the app has no signed-in session: first
// launch AND every time after signing out, per the explicit instruction
// this was built against (not tied to invite registration, not a
// one-time-only dismissal).
//
// Restyled per direct correction to be visually consistent with the
// Login/Register screens right after it: the same real logo-mark.png
// crop, and the same turquoise (AuthGradientButton's TURQUOISE,
// sampled from the logo itself) for the icon tiles, active pagination
// dot, and the Next/Get Started button — not the app's own indigo
// theme accent, which reads as a different app entirely against the
// turquoise auth screens that immediately follow it.
import { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions, Image, StatusBar, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, MapPinned, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import AuthGradientButton, { TURQUOISE } from '../components/auth/AuthGradientButton';

const TURQUOISE_SOFT = 'rgba(2, 175, 217, 0.12)';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    icon: LayoutDashboard,
    title: 'Everything in one place',
    body: 'Orders, stock, deliveries and approvals for every department, all in one app.',
  },
  {
    icon: MapPinned,
    title: 'Real-time tracking',
    body: 'Follow deliveries and stock movements as they happen, wherever you are.',
  },
  {
    icon: ShieldCheck,
    title: 'Built for your whole team',
    body: 'Every department, every approval, every update, synced and secure.',
  },
];

export default function WelcomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setPage(next);
  };

  // `navigate`, not `replace` — Welcome needs to stay in the stack so
  // Login's new back button (AuthBackButton) has somewhere real to go.
  const goToLogin = () => navigation.navigate('Login');

  const isLast = page === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm }}>
        <Pressable onPress={goToLogin} hitSlop={8}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => {
          const Icon = slide.icon;
          return (
            <View key={i} style={{ width: SCREEN_W, paddingHorizontal: t.spacing.xxxl, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                width: 140, height: 140, borderRadius: t.radius.card, backgroundColor: TURQUOISE_SOFT,
                alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.xxxl,
              }}>
                <View style={{
                  width: 88, height: 88, borderRadius: t.radius.lg, backgroundColor: TURQUOISE,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={40} color="#ffffff" />
                </View>
              </View>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.page24.size, color: t.colors.textPrimary, textAlign: 'center' }}>
                {slide.title}
              </Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textSecondary, textAlign: 'center', marginTop: t.spacing.md, maxWidth: 280 }}>
                {slide.body}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: t.spacing.xxxl, paddingBottom: insets.bottom + t.spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing.xs, marginBottom: t.spacing.xxl }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 20 : 6, height: 6, borderRadius: t.radius.pill,
                backgroundColor: i === page ? TURQUOISE : t.colors.border,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
          <Image source={require('../assets/logo-mark.png')} style={{ width: 24, height: 24 * (237 / 398) }} resizeMode="contain" />
          <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.body12.size, color: t.colors.textPrimary, letterSpacing: 0.5 }}>REBMA IMPEX</Text>
        </View>

        <AuthGradientButton
          label={isLast ? 'Get Started' : 'Next'}
          onPress={() => {
            if (isLast) {
              goToLogin();
            } else {
              scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_W, animated: true });
              setPage(page + 1);
            }
          }}
        />
      </View>
    </View>
  );
}
