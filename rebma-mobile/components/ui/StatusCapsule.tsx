// rebma-mobile/components/ui/StatusCapsule.tsx
//
// A small, self-contained dark pill carrying one live fact — recording
// in progress, low battery, someone joined, an incoming call — matching
// the iOS Dynamic Island widget reference exactly. Distinct from a
// Badge (an inline status tag inside a row) and from ConnectivityBanner
// (a full-width persistent bar): a capsule is transient, floats over
// content, and stands alone even when several appear together.
import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  /** Tint behind the icon — defaults to a neutral white-on-dark dot, pass
   * a status color (t.colors.status.danger.text, etc.) for a live/alert one. */
  dotColor?: string;
  wide?: boolean;
}

export default function StatusCapsule({ icon, label, sublabel, dotColor, wide }: Props) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        backgroundColor: '#0b0b0f',
        borderRadius: t.radius.pill,
        paddingVertical: 10,
        paddingHorizontal: 14,
        alignSelf: wide ? 'stretch' : 'flex-start',
        ...t.shadow('raised'),
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dotColor ? `${dotColor}33` : 'rgba(255,255,255,0.15)',
        }}
      >
        {icon}
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: '#ffffff' }} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ fontFamily: t.font.medium, fontSize: 9, color: 'rgba(255,255,255,0.5)' }} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
