import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UsePaginatedQueryOptions<T> {
  table: string;
  select?: string;
  pageSize?: number;
  orderColumn?: string;
  ascending?: boolean;
  // Attach .eq()/.gte()/.ilike()/etc — receives the base query, returns it
  // with filters applied. Read fresh on every fetch via a ref, so passing
  // a new inline function each render never re-triggers the auto-load
  // effect below — only an explicit reload()/loadMore() call re-queries.
  applyFilters?: (query: any) => any;
  map?: (row: any) => T;
  // False skips the automatic initial load (e.g. waiting on a required
  // filter value like a selected date) — call reload() yourself once ready.
  auto?: boolean;
}

// Pulls a page at a time via .range() instead of an unbounded select, so a
// list is either loaded or clearly not-yet-loaded ("Load more") rather than
// silently missing rows past a hard cap. total (from Postgres's exact
// count) is what a "Showing X of Y" label should render — never trust
// rows.length alone once a table can exceed one page.
export function usePaginatedQuery<T = any>({
  table, select = '*', pageSize = 100, orderColumn = 'created_at', ascending = false, applyFilters, map, auto = true,
}: UsePaginatedQueryOptions<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const pageRef = useRef(0);
  const filtersRef = useRef(applyFilters);
  const mapRef = useRef(map);
  filtersRef.current = applyFilters;
  mapRef.current = map;

  const fetchPage = useCallback(async (reset: boolean) => {
    setLoading(true);
    const page = reset ? 0 : pageRef.current;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from(table).select(select, { count: 'exact' }) as any;
    if (filtersRef.current) query = filtersRef.current(query);
    query = query.order(orderColumn, { ascending }).range(from, to);

    const { data, error, count } = await query;
    if (!error) {
      const mapped = mapRef.current ? (data || []).map(mapRef.current) : ((data || []) as T[]);
      setRows(prev => (reset ? mapped : [...prev, ...mapped]));
      if (typeof count === 'number') setTotal(count);
      setHasMore((data || []).length === pageSize);
      pageRef.current = page + 1;
    }
    setLoading(false);
    return { data, error };
  }, [table, select, pageSize, orderColumn, ascending]);

  const reload = useCallback(() => fetchPage(true), [fetchPage]);
  const loadMore = useCallback(() => fetchPage(false), [fetchPage]);

  useEffect(() => {
    if (auto) reload();
    // Only re-triggers on table changes — filter/map updates go through
    // reload() explicitly, called by the consuming view's own effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  return { rows, setRows, loading, hasMore, total, reload, loadMore };
}
