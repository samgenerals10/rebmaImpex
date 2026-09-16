// rebma-mobile/components/ui/SegmentedPillTabs.tsx
//
// Horizontal pill tab bar for department hub navigation.
// Renders a ScrollView of pill buttons with animated indicator.
// Usage:
//   <SegmentedPillTabs
//     tabs={[{ id: 'all', label: 'All' }, { id: 'ops', label: 'Operations' }]}
//     active="all"
//     onChange={(id) => setActiveTab(id)}
//   />
import { useRef, useState, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface PillTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface Props {
  tabs: PillTab[];
  active: string;
  onChange: (id: string) => void;
}

export default function SegmentedPillTabs({ tabs, active, onChange }: Props) {
  const t = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.sm,
        gap: 8,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: t.radius.pill,
              backgroundColor: isActive
                ? t.colors.accent
                : t.darkMode
                ? '#1E293B'
                : '#FFFFFF',
              borderWidth: isActive ? 0 : 1,
              borderColor: t.colors.border,
              opacity: pressed ? 0.8 : 1,
              // Subtle card shadow on inactive pills
              ...(isActive ? {} : (t.shadow('card') as object)),
            })}
          >
            {tab.icon && (
              <View style={{ opacity: isActive ? 1 : 0.6 }}>
                {tab.icon}
              </View>
            )}
            <Text
              style={{
                fontFamily: isActive ? t.font.bold : t.font.medium,
                fontSize: t.type.body12.size,
                color: isActive ? '#FFFFFF' : t.colors.textSecondary,
                letterSpacing: 0.1,
              }}
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: isActive
                    ? 'rgba(255,255,255,0.3)'
                    : t.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: t.font.bold,
                    fontSize: 10,
                    color: isActive ? '#FFFFFF' : t.colors.accent,
                  }}
                >
                  {tab.badge > 99 ? '99+' : tab.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
