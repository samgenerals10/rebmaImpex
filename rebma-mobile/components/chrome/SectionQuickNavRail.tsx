// rebma-mobile/components/chrome/SectionQuickNavRail.tsx
//
// The floating right-edge quick-nav: collapsed by default (per direct
// correction — a full stack of icons sitting on screen all the time
// reads as distracting) to just a small chevron hint. Long-press it
// (~1s, not a tap — deliberate, so it can't be triggered by accident)
// to reveal the icon list for every TrackedSection that's scrolled
// past. Tap the chevron again to collapse it back down. Tapping an
// icon jumps to that section (Screen.tsx's scrollTargetFor) and
// collapses the rail back to its default state.
import { useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { TrackedSectionMeta } from '../../hooks/useScrollSections';

interface Props {
  sections: TrackedSectionMeta[];
  onJump: (id: string) => void;
}

const LONG_PRESS_MS = 900;

export default function SectionQuickNavRail({ sections, onJump }: Props) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (sections.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 10,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'flex-end',
        zIndex: 9,
      }}
    >
      {expanded ? (
        // No cap on how many sections show here — every TrackedSection
        // a screen registers gets a spot, now and for any screen with
        // more sections added later. Once there are more than fit on
        // screen, the list scrolls instead of silently dropping the
        // rest, so the rail can never appear to "lose" a section.
        <View style={{ alignItems: 'flex-end', maxHeight: '85%' }}>
          <Pressable
            onPress={() => setExpanded(false)}
            hitSlop={6}
            style={({ pressed }) => [
              {
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: t.colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
                marginBottom: 8,
              },
            ]}
          >
            <ChevronRight size={16} color={t.colors.accent} strokeWidth={2.4} />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ gap: 8, alignItems: 'flex-end' }}
            style={{ flexGrow: 0 }}
          >
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    onJump(s.id);
                    setExpanded(false);
                  }}
                  hitSlop={6}
                  style={({ pressed }) => [
                    {
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: t.colors.bgCard,
                      borderWidth: 1,
                      borderColor: t.colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    },
                    t.shadow('raised'),
                  ]}
                >
                  <Icon size={17} color={t.colors.accent} strokeWidth={2.2} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <Pressable
          onLongPress={() => setExpanded(true)}
          delayLongPress={LONG_PRESS_MS}
          hitSlop={10}
          style={({ pressed }) => [
            {
              width: 22,
              height: 44,
              borderTopLeftRadius: 22,
              borderBottomLeftRadius: 22,
              backgroundColor: t.colors.bgCard,
              borderWidth: 1,
              borderColor: t.colors.border,
              borderRightWidth: 0,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 0.9,
            },
            t.shadow('card'),
          ]}
        >
          <ChevronLeft size={14} color={t.colors.textMuted} strokeWidth={2.4} />
        </Pressable>
      )}
    </View>
  );
}
