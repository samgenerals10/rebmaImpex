// rebma-mobile/screens/WelcomeScreen.tsx
//
// The logged-out home page — a real onboarding carousel, not just a style
// reference. Shown every time the app has no signed-in session: first
// launch AND every time after signing out, per the explicit instruction
// this was built against (not tied to invite registration, not a
// one-time-only dismissal). Icons only, no custom illustration assets,
// per the mobile-ui-fluidity skill — Rebma's own green identity and logo,
// not a copy of the reference app's purple palette.
import { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions, Image, StatusBar, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, MapPinned, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';

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

  const goToLogin = () => navigation.replace('Login');

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
                width: 140, height: 140, borderRadius: t.radius.card, backgroundColor: t.colors.accentSoft,
                alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.xxxl,
              }}>
                <View style={{
                  width: 88, height: 88, borderRadius: t.radius.lg, backgroundColor: t.colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={40} color={t.colors.onAccent} />
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
                backgroundColor: i === page ? t.colors.accent : t.colors.border,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <Image source={require('../assets/logo.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.body12.size, color: t.colors.textPrimary, letterSpacing: 0.5 }}>REBMA IMPEX</Text>
          </View>
        </View>

        <Button
          label={isLast ? 'Get Started' : 'Next'}
          onPress={() => {
            if (isLast) {
              goToLogin();
            } else {
              scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_W, animated: true });
              setPage(page + 1);
            }
          }}
          fullWidth
          style={{ marginTop: t.spacing.lg }}
        />
      </View>
    </View>
  );
}
