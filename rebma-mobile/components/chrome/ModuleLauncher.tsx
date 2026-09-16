// rebma-mobile/components/chrome/ModuleLauncher.tsx
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { DepartmentEntry, SubTab } from '../../navigation/departmentRegistry';
import SectionHeader from '../ui/SectionHeader';

interface Props {
  dept: DepartmentEntry;
  onSelect: (subTabId: string) => void;
  exclude?: string[];
}

export default function ModuleLauncher({ dept, onSelect, exclude = [] }: Props) {
  const t = useTheme();
  const visible = dept.subTabs.filter((s) => !exclude.includes(s.id));

  if (visible.length === 0) return null;

  if (!dept.sections || dept.sections.length === 0) {
    return (
      <View style={{ gap: t.spacing.sm }}>
        <SectionHeader title="Department Modules & Actions" subtitle="Select a module to view records and manage operations" />
        <ActionListGroup tabs={visible} onSelect={onSelect} />
      </View>
    );
  }

  const byId = new Map(visible.map((s) => [s.id, s]));

  return (
    <View style={{ gap: t.spacing.xl }}>
      {dept.sections.map((section) => {
        const tabs = section.tabIds.map((id) => byId.get(id)).filter((s): s is SubTab => !!s);
        if (tabs.length === 0) return null;
        return (
          <View key={section.title} style={{ gap: t.spacing.sm }}>
            <SectionHeader title={section.title} />
            <ActionListGroup tabs={tabs} onSelect={onSelect} />
          </View>
        );
      })}
    </View>
  );
}

const ACTION_TINTS = [
  '#3B82F6', '#10B981', '#6366F1', '#F59E0B', '#F43F5E', '#14B8A6', '#8B5CF6', '#0EA5E9',
];

function ActionListGroup({ tabs, onSelect }: { tabs: SubTab[]; onSelect: (id: string) => void }) {
  const t = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: t.colors.bgCard,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.colors.border,
          overflow: 'hidden',
        },
        t.shadow('card'),
      ]}
    >
      {tabs.map((tab, idx) => {
        const Icon = tab.icon;
        const tint = ACTION_TINTS[idx % ACTION_TINTS.length];
        const isLast = idx === tabs.length - 1;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.md,
                paddingVertical: 14,
                paddingHorizontal: t.spacing.lg,
                backgroundColor: pressed ? (t.darkMode ? '#2D3748' : '#F8F7FF') : 'transparent',
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: t.colors.border,
              },
            ]}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: `${tint}18`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={20} color={tint} strokeWidth={2.2} />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: t.font.bold,
                  fontSize: t.type.body14.size,
                  color: t.colors.textPrimary,
                }}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              <Text
                style={{
                  fontFamily: t.font.regular,
                  fontSize: t.type.meta10.size,
                  color: t.colors.textMuted,
                  letterSpacing: 0.2,
                }}
              >
                Tap to manage & view data
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ChevronRight size={18} color={t.colors.textMuted} strokeWidth={2} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
