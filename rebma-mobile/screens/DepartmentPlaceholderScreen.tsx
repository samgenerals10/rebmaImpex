// rebma-mobile/screens/DepartmentPlaceholderScreen.tsx
// Replaces the old ComingSoonScreen.tsx (Phase 7.0 §7). Rendered INSIDE the
// tab shell (header + tab bar stay visible) so the app never dead-ends.
// Disappears department-by-department as each 7.x sub-phase lands.
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { getDepartmentEntry } from '../navigation/departmentRegistry';
import Screen from '../components/ui/Screen';
import EmptyState from '../components/ui/EmptyState';
import SectionHeader from '../components/ui/SectionHeader';

interface Props {
  department: string;
  reason?: string;
}

export default function DepartmentPlaceholderScreen({ department, reason }: Props) {
  const t = useTheme();
  const dept = getDepartmentEntry(department);
  const Icon = dept.icon;

  return (
    <Screen>
      <EmptyState
        icon={<Icon size={22} color={t.colors.accent} />}
        title={`${dept.label} isn't fully on mobile yet`}
        description={reason || `${dept.label}'s screens are on the roadmap — more departments land here every phase.`}
      />

      {dept.subTabs.length > 0 && (
        <View style={{ marginTop: t.spacing.xl, opacity: 0.5 }}>
          <SectionHeader title="Coming to this department" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {dept.subTabs.map((s) => {
              const SIcon = s.icon;
              return (
                <View key={s.id} style={{ width: '30%', alignItems: 'center', gap: t.spacing.xs, padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}>
                  <SIcon size={16} color={t.colors.textMuted} />
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, textAlign: 'center' }} numberOfLines={2}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Screen>
  );
}
