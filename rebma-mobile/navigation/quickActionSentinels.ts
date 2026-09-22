// rebma-mobile/navigation/quickActionSentinels.ts
//
// Special, non-navigable `subTab` values a QuickAction entry can carry
// (see departmentRegistry.ts). Kept in their own zero-dependency file
// so both departmentRegistry.ts and QuickActionsSheet.tsx can import it
// without creating a require cycle between them (departmentRegistry.ts
// already gets imported by nearly every screen; QuickActionsSheet.tsx
// itself imports getDepartmentEntry from departmentRegistry.ts).

/** "View All Depts" opens the department switcher sheet instead of
 * navigating to a subTab screen — there's no single subTab that IS the
 * switcher. */
export const OPEN_DEPARTMENT_SWITCHER = '__OPEN_DEPARTMENT_SWITCHER__';
