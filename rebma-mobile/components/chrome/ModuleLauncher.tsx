// rebma-mobile/components/chrome/ModuleLauncher.tsx
//
// Phase 7.1, D13 — the module-launcher grid Phase 7.0's plan deferred:
// "DepartmentHome renders... then a module launcher: a 2-column grid of
// subTabs from the registry, each an icon tile + label, pushing onto
// DepartmentStack." Every future department's Overview/home screen renders
// this once, at the bottom of its own dashboard content, so this file is
// built once here and never touched again by 7.2-7.9.
//
// Sectioned (via dept.sections) for departments with many sub-tabs — today
// that's ADMIN_WAREHOUSE and FINANCE — flat otherwise.
import { View, Text, Pressable } from 'react-native';
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
      <View style={{ gap: t.spacing.md }}>
        <SectionHeader title="More" />
        <Grid tabs={visible} onSelect={onSelect} />
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
          <View key={section.title} style={{ gap: t.spacing.md }}>
            <SectionHeader title={section.title} />
            <Grid tabs={tabs} onSelect={onSelect} />
          </View>
        );
      })}
    </View>
  );
}

function Grid({ tabs, onSelect }: { tabs: SubTab[]; onSelect: (id: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={{
              width: '47%',
              alignItems: 'center',
              gap: t.spacing.sm,
              paddingVertical: t.spacing.lg,
              paddingHorizontal: t.spacing.sm,
              borderRadius: t.radius.lg,
              borderWidth: 1,
              borderColor: t.colors.border,
              backgroundColor: t.colors.bgCard,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: t.colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={18} color={t.colors.accentPressed} />
            </View>
            <Text
              style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary, textAlign: 'center' }}
              numberOfLines={2}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
