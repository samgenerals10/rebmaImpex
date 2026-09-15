// rebma-mobile/components/ui/Skeleton.tsx
// Ports: rebma-web/src/components/mobile/MobileSkeleton.tsx — CSS
// `animate-pulse` becomes a looping Animated opacity tween.
import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

function usePulse() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return opacity;
}

export function SkeletonCard() {
  const t = useTheme();
  const opacity = usePulse();
  return (
    <Animated.View style={[{ opacity, backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: t.spacing.md, gap: t.spacing.sm }, t.shadow('card')]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: t.radius.lg, backgroundColor: t.colors.bgInput }} />
        <View style={{ flex: 1, gap: t.spacing.xs }}>
          <View style={{ height: 14, width: '60%', borderRadius: 4, backgroundColor: t.colors.bgInput }} />
          <View style={{ height: 10, width: '85%', borderRadius: 4, backgroundColor: t.colors.bgInput }} />
        </View>
      </View>
    </Animated.View>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.sm }}>
      {Array.from({ length: rows }).map((_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}

export function SkeletonMetric() {
  const t = useTheme();
  const opacity = usePulse();
  return (
    <Animated.View style={{ opacity, backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, height: 88 }} />
  );
}
