// rebma-mobile/components/ui/SectionHeader.tsx
// Ports: rebma-web/src/components/mobile/MobileSectionHeader.tsx
import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
}

export default function SectionHeader({ title, subtitle, icon, badge, action }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: t.spacing.sm, marginBottom: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
      {/* flex: 1 + minWidth: 0 — without minWidth: 0, a flex child never
          shrinks below its text's natural width (a well-known flexbox
          default), so a long title/subtitle would overflow straight
          through the trailing `action`, rendering on top of it instead
          of wrapping/truncating beside it. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flex: 1, minWidth: 0 }}>
        {icon}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{title}</Text>
            {badge}
          </View>
          {subtitle ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 1 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {action ? <View style={{ flexShrink: 0, marginLeft: t.spacing.sm }}>{action}</View> : null}
    </View>
  );
}
