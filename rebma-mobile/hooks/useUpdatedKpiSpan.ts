// rebma-mobile/hooks/useUpdatedKpiSpan.ts
//
// Direct instruction: on a KPI dashboard's bento layout (1 wide card +
// several regular ones), the wide slot isn't fixed to one KPI — it's
// whichever KPI's number actually changed since the user last viewed
// this screen. Remembers each KPI's value from the last visit
// (AsyncStorage, keyed per screen) and diffs against it on this visit.
//
// Tie-break / default, both per direct instruction: `priorityOrder` is
// given highest-priority-first: if more than one KPI changed, the one
// earliest in that list wins. If none changed (including the very
// first-ever visit, when there's no prior snapshot to compare against),
// the LAST entry in `priorityOrder` is the default span target — pass
// the always-safe fallback KPI last.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useUpdatedKpiSpan(
  storageKey: string,
  current: Record<string, number> | null,
  priorityOrder: string[]
): string | null {
  const [spanKey, setSpanKey] = useState<string | null>(null);
  const currentJson = current ? JSON.stringify(current) : null;

  useEffect(() => {
    if (!current || !currentJson) return;
    let active = true;
    (async () => {
      const raw = await AsyncStorage.getItem(storageKey);
      const prev: Record<string, number> = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(storageKey, currentJson);
      if (!active) return;
      const changedKey = priorityOrder.find((k) => prev[k] !== undefined && prev[k] !== current[k]);
      setSpanKey(changedKey || priorityOrder[priorityOrder.length - 1]);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, currentJson]);

  return spanKey;
}
