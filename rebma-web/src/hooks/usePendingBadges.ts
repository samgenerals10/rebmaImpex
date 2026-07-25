import { useEffect, useState } from 'react';
import { fetchPendingForDept } from '../components/global/PendingApprovalsAlert';

const POLL_MS = 30000;

/**
 * Real "N things pending right now" counts (not an event-since-last-visit
 * counter). navBadges keys are sidebar page ids within `activeDepartment`;
 * deptBadges keys are department values, only populated when the caller can
 * see more than one department (i.e. their switcher already lists more than
 * just their own) — for everyone else it's just their single department.
 */
export function usePendingBadges(activeDepartment: string, visibleDepartments: string[]) {
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const [deptBadges, setDeptBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;

    const load = async () => {
      const items = await fetchPendingForDept(activeDepartment);
      if (!active) return;
      const byTab: Record<string, number> = {};
      for (const item of items) byTab[item.tab] = (byTab[item.tab] ?? 0) + item.count;
      setNavBadges(byTab);
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { active = false; clearInterval(iv); };
  }, [activeDepartment]);

  useEffect(() => {
    if (visibleDepartments.length <= 1) {
      setDeptBadges({});
      return;
    }
    let active = true;

    const load = async () => {
      const results = await Promise.all(
        visibleDepartments.map(async dept => {
          const items = await fetchPendingForDept(dept);
          return [dept, items.reduce((sum, item) => sum + item.count, 0)] as const;
        })
      );
      if (!active) return;
      const totals: Record<string, number> = {};
      for (const [dept, total] of results) if (total > 0) totals[dept] = total;
      setDeptBadges(totals);
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { active = false; clearInterval(iv); };
  }, [visibleDepartments.join(',')]);

  return { navBadges, deptBadges };
}
