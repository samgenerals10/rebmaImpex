// rebma-mobile/hooks/usePaginatedQuery.ts
//
// Phase 7.7, D49. Ported verbatim from rebma-web/src/hooks/usePaginatedQuery.ts
// — pure, dependency-free React hook with no DOM dependency. Pulls a page
// at a time via .range() instead of an unbounded select, so a list is
// either loaded or clearly not-yet-loaded ("Load more") rather than
// silently missing rows past a hard cap. `total` (Postgres's exact count)
// is what a "Showing X of Y" label should render from — never trust
// rows.length alone once a table can exceed one page. Used by
// StaffScreen and AttendanceScreen, matching web's own two real
// consumers of this hook exactly.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UsePaginatedQueryOptions<T> {
  table: string;
  select?: string;
  pageSize?: number;
  orderColumn?: string;
  ascending?: boolean;
  applyFilters?: (query: any) => any;
  map?: (row: any) => T;
  auto?: boolean;
}

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
      setRows((prev) => (reset ? mapped : [...prev, ...mapped]));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  return { rows, setRows, loading, hasMore, total, reload, loadMore };
}
