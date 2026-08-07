import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

interface TableWatch {
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  filter?: string;
}

type WatchSpec = string | TableWatch;
type ChangeHandler = (table: string, payload: any) => void;

interface ChannelEntry {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
  listeners: Set<ChangeHandler>;
}

// Module-level registry, not component state — this is what lets a
// deterministic channel name be genuinely shared across every component
// instance that asks for it, for the lifetime of the page, independent of
// any single component's mount/unmount cycle.
const registry = new Map<string, ChannelEntry>();

// Every call site used to build its channel name as
// `'<name>-' + Math.random().toString(36)...`, so every mount opened a
// brand-new, uniquely-named Realtime subscription instead of sharing one —
// undebuggable (no stable name to find in Supabase's dashboard) and, if
// two instances of the same view were ever mounted at once, wasteful (two
// live subscriptions doing the same job). This hook fixes both: pass a
// stable name and the tables to watch, and every instance sharing that
// name fans out from ONE underlying channel — first subscriber creates it,
// each additional one just registers a listener, and it's only torn down
// when the last one unmounts.
//
// onChange receives (table, payload) — most call sites just want "something
// changed, reload" and can ignore both args; a few (App.tsx) branch on the
// table name and inspect payload.new/payload.old directly.
export function useRealtimeChannel(name: string, watch: WatchSpec[], onChange: ChangeHandler) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let entry = registry.get(name);
    if (!entry) {
      const channel = supabase.channel(name);
      const newEntry: ChannelEntry = { channel, refCount: 0, listeners: new Set() };
      for (const w of watch) {
        const spec: TableWatch = typeof w === 'string' ? { table: w } : w;
        channel.on(
          'postgres_changes',
          { event: spec.event ?? '*', schema: spec.schema ?? 'public', table: spec.table, ...(spec.filter ? { filter: spec.filter } : {}) },
          (payload) => { newEntry.listeners.forEach(cb => cb(spec.table, payload)); }
        );
      }
      channel.subscribe();
      entry = newEntry;
      registry.set(name, entry);
    }
    const listener: ChangeHandler = (table, payload) => onChangeRef.current(table, payload);
    entry.listeners.add(listener);
    entry.refCount++;

    return () => {
      const e = registry.get(name);
      if (!e) return;
      e.listeners.delete(listener);
      e.refCount--;
      if (e.refCount <= 0) {
        supabase.removeChannel(e.channel);
        registry.delete(name);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}
