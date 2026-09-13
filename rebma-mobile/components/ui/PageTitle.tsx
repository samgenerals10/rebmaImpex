// rebma-mobile/components/ui/PageTitle.tsx
// Ports: rebma-web/src/index.css .erp-page-title / -subtitle
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export default function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.spacing.lg }}>
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.page24.size, lineHeight: t.type.page24.lineHeight, color: t.colors.textPrimary }}>{title}</Text>
      {subtitle ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textSecondary, marginTop: 2 }}>{subtitle}</Text> : null}
    </View>
  );
}
