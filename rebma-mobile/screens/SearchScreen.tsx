// rebma-mobile/screens/SearchScreen.tsx
// Ports: rebma-web/src/components/layout/MobileSearch.tsx — full-screen
// overlay, pill input + Cancel. Wiring real cross-department search
// results is department-sub-phase work (7.1+); this phase ships the
// shell — but per direct correction, the sliders icon next to the
// search pill isn't decorative: with no query typed, this screen now
// shows the current department's own real searchable areas as a 2-per-
// row button grid (reusing departmentRegistry's own subTabs — every
// department sees its own, automatically, no new per-department data to
// maintain), so it actually takes you somewhere instead of sitting empty.
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Search as SearchIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { getDepartmentEntry } from '../navigation/departmentRegistry';
import { navigationRef } from '../navigation/navigationRef';
import Screen from '../components/ui/Screen';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';

export default function SearchScreen({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const profile = useAuthStore((s) => s.profile);
  const dept = getDepartmentEntry(activeDepartment || profile?.department || '');
  const targets = dept.subTabs.filter((s) => s.id !== dept.defaultSubTab);

  const goTo = (subTabId: string) => {
    onClose();
    if (navigationRef.isReady()) {
      (navigationRef.navigate as any)('HomeTab', { screen: subTabId });
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.lg }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search orders, customers, cargo…"
          autoFocus
          style={{ flex: 1, borderRadius: t.radius.pill }}
        />
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.accent }}>Cancel</Text>
        </Pressable>
      </View>

      {query ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            icon={<SearchIcon size={22} color={t.colors.textMuted} />}
            title="No results yet"
            description="Cross-department search results land here as each department is brought to mobile."
          />
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: t.spacing.lg }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textMuted, marginBottom: t.spacing.md }}>
            Search within {dept.label}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {targets.map((sub) => {
              const Icon = sub.icon;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => goTo(sub.id)}
                  style={({ pressed }) => [
                    {
                      width: '47%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: t.spacing.sm,
                      padding: t.spacing.md,
                      borderRadius: t.radius.lg,
                      backgroundColor: pressed ? t.colors.accentSoft : t.colors.bgCard,
                      borderWidth: 1,
                      borderColor: t.colors.border,
                    },
                    !pressed && t.shadow('card'),
                  ]}
                >
                  <View style={{ width: 32, height: 32, borderRadius: t.radius.sm, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={t.colors.accent} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>
                    {sub.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </Screen>
  );
}
