// rebma-mobile/components/ui/SearchablePicker.tsx
// Ports: rebma-web/src/components/ui/SearchableDropdown.tsx. On a phone the
// floating panel becomes a bottom Sheet (an absolutely-positioned popover
// under a finger is the one place a literal port would be worse than the
// pattern web itself already uses on mobile).
import { useState, useMemo, type ReactNode } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { ChevronDown, Search, Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Sheet from './Sheet';
import Input from './Input';

export interface PickerOption {
  value: string;
  label: string;
  icon?: ReactNode;
  sublabel?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder?: string;
  disabled?: boolean;
  searchThreshold?: number;
  label?: string;
}

export default function SearchablePicker({ value, onChange, options, placeholder = 'Select...', disabled, searchThreshold = 7, label }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find(o => o.value === value);
  const showSearch = options.length > searchThreshold;
  const filtered = useMemo(() => {
    if (!showSearch || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query, showSearch]);

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: t.colors.border,
          borderRadius: t.radius.sm, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexShrink: 1 }}>
          {selected?.icon}
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: selected ? t.colors.textPrimary : t.colors.textMuted }} numberOfLines={1}>
            {selected?.label || placeholder}
          </Text>
        </View>
        <ChevronDown size={16} color={t.colors.textMuted} />
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title={label || placeholder} side="bottom" maxHeight={520}>
        {showSearch ? (
          <View style={{ marginBottom: t.spacing.md }}>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <Input value={query} onChangeText={setQuery} placeholder="Search..." style={{ paddingLeft: 36 }} autoFocus />
              <View style={{ position: 'absolute', left: 12 }}>
                <Search size={14} color={t.colors.textMuted} />
              </View>
            </View>
          </View>
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.value}
          style={{ maxHeight: 320 }}
          renderItem={({ item }) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                onPress={() => { onChange(item.value); setOpen(false); setQuery(''); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm,
                  paddingVertical: t.spacing.smd, paddingHorizontal: t.spacing.sm,
                  borderRadius: t.radius.sm,
                  backgroundColor: isSelected ? t.colors.accentSoft : 'transparent',
                }}
              >
                {item.icon}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{item.label}</Text>
                  {item.sublabel ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{item.sublabel}</Text> : null}
                </View>
                {isSelected ? <Check size={16} color={t.colors.accent} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.xl }}>No matches.</Text>}
        />
      </Sheet>
    </>
  );
}
