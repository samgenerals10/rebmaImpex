// rebma-mobile/context/ScrollSectionsContext.tsx
//
// Lets <TrackedSection> (deep inside a screen's own JSX) register itself
// with the <useScrollSections> instance Screen.tsx owns, without prop
// drilling a registrar through every screen. Provided fresh per-screen by
// Screen.tsx's dashboard mode; screens that don't scroll (no onScroll
// prop) simply never get a provider, and <TrackedSection> is a no-op
// passthrough when it can't find one.
import { createContext, useContext, type ComponentType } from 'react';
import type { View } from 'react-native';

export interface ScrollSectionsRegistry {
  registerSection: (meta: { id: string; title: string; icon: ComponentType<any> }, ref: View, initialHeight: number) => void;
  unregisterSection: (id: string) => void;
  scheduleRemeasure: () => void;
}

export const ScrollSectionsContext = createContext<ScrollSectionsRegistry | null>(null);

export function useScrollSectionsRegistry() {
  return useContext(ScrollSectionsContext);
}
