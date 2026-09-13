// Phase 5 (Admin & Warehouse merge): a single place to normalize legacy
// department codes so Sidebar/Header/BreadcrumbBar/QuickActions/etc. each
// only need one ADMIN_WAREHOUSE entry instead of three. See the "normalization
// boundary" section of the Phase 5 plan for why only apiClient.ts's
// mapProfileToFrontend() and App.tsx's setActiveDepartment()/initialSessionDeptRef
// call this — everything else consumes an already-normalized value.

export const LEGACY_DEPT_ALIASES: Record<string, string> = {
  OPERATIONS: 'ADMIN_WAREHOUSE',
  DISPATCH: 'ADMIN_WAREHOUSE',
  LOGISTICS: 'ADMIN_WAREHOUSE',
  'HUMAN RESOURCES': 'HR',
};

export function normalizeDeptCode(raw: string | null | undefined): string {
  const up = (raw || '').trim().toUpperCase();
  return LEGACY_DEPT_ALIASES[up] || up;
}

// For querying rows written before the merge, which still carry the legacy
// department string (audit history, attendance, notifications, etc).
export function deptAliasGroup(code: string): string[] {
  return code === 'ADMIN_WAREHOUSE'
    ? ['ADMIN_WAREHOUSE', 'OPERATIONS', 'DISPATCH', 'LOGISTICS']
    : [code];
}

export const DEFAULT_SUBTAB: Record<string, string> = {
  CEO: 'Overview',
  RISK: 'RiskOverview',
  MANAGEMENT: 'CargoApproval',
  HR: 'Employees',
  MARKETING: 'CreateOrder',
  ADMIN_WAREHOUSE: 'Overview',
  FINANCE: 'Evaluation',
  PRODUCTION: 'Requisition',
  RECEPTION: 'VisitorLog',
  BOARDROOM: 'VideoConf',
  SETTINGS: 'Appearance',
};

export const ADMIN_WAREHOUSE_LABEL = 'Admin & Warehouse';
export const ADMIN_WAREHOUSE_ROLE = 'admin_warehouse';
