// rebma-mobile/screens/SearchScreen.tsx
// Ports: rebma-web/src/components/layout/MobileSearch.tsx — full-screen
// overlay, pill input + Cancel. Wiring real cross-department search results
// is department-sub-phase work (7.1+); this phase ships the shell.
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Search as SearchIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import Screen from '../components/ui/Screen';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';

export default function SearchScreen({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [query, setQuery] = useState('');

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
      <View style={{ flex: 1 }}>
        <EmptyState
          icon={<SearchIcon size={22} color={t.colors.textMuted} />}
          title={query ? 'No results yet' : 'Search across your department'}
          description={query ? 'Cross-department search results land here as each department is brought to mobile.' : 'Type to search orders, customers, cargo and more.'}
        />
      </View>
    </Screen>
  );
}
