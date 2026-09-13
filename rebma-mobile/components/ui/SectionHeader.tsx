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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexShrink: 1 }}>
        {icon}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{title}</Text>
            {badge}
          </View>
          {subtitle ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 1 }}>{subtitle}</Text> : null}
        </View>
      </View>
      {action}
    </View>
  );
}
