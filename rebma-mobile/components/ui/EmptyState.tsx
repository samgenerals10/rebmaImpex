// rebma-mobile/components/ui/EmptyState.tsx
// Ports: rebma-web/src/components/mobile/MobileEmptyState.tsx
import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Button from './Button';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}

export default function EmptyState({ icon, title, description, action }: Props) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: t.spacing.xxxl, paddingHorizontal: t.spacing.xl }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.bgInput, alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.md }}>
        {icon}
      </View>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, textAlign: 'center' }}>{title}</Text>
      {description ? (
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', marginTop: t.spacing.xs, maxWidth: 260 }}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: t.spacing.lg }}><Button label={action.label} onPress={action.onPress} size="sm" /></View> : null}
    </View>
  );
}
