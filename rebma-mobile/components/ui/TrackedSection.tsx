// rebma-mobile/components/ui/TrackedSection.tsx
//
// Wrap any "piece" of a dashboard-mode screen (a hero card, a metric
// grid, a list card, a ModuleLauncher block) in this instead of a plain
// <View> to make it a stop on the floating scroll-quick-nav rail
// (see SectionQuickNavRail.tsx / useScrollSections.ts). Purely additive —
// renders its own measured <View>, nothing else changes.
//
// Registers its own ref (not a one-off onLayout measurement) so the
// registry can re-measure it directly whenever content elsewhere on the
// screen changes shape — onLayout alone doesn't reliably refire for a
// section that only *moved* because an earlier sibling resized (e.g. a
// card that mounts late once loading finishes), which was a real,
// confirmed bug in an earlier version of this component.
import { useEffect, useRef, type ReactNode, type ComponentType } from 'react';
import { View } from 'react-native';
import { useScrollSectionsRegistry } from '../../context/ScrollSectionsContext';

interface Props {
  id: string;
  title: string;
  icon: ComponentType<any>;
  children: ReactNode;
}

export default function TrackedSection({ id, title, icon, children }: Props) {
  const registry = useScrollSectionsRegistry();
  const viewRef = useRef<View>(null);

  useEffect(() => {
    return () => registry?.unregisterSection(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!registry) return <View>{children}</View>;

  return (
    <View
      ref={viewRef}
      onLayout={(e) => {
        if (viewRef.current) {
          registry.registerSection({ id, title, icon }, viewRef.current, e.nativeEvent.layout.height);
        }
        // Any layout pass anywhere can mean earlier siblings shifted too —
        // ask the registry to re-measure everything it knows about, not
        // just this section.
        registry.scheduleRemeasure();
      }}
    >
      {children}
    </View>
  );
}
