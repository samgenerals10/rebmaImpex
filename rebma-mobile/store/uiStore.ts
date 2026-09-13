// rebma-mobile/store/uiStore.ts
//
// Drives the three chrome overlays (department switcher, search, quick
// actions) as Sheet/Modal state rather than as React Navigation routes —
// they're rendered as siblings of the tab shell and toggled from here.
// This keeps the navigator itself simple (no transparentModal route group)
// while still matching the plan's UX: FAB -> QuickActions, header avatar ->
// DepartmentSwitcher, header search pill -> full-screen Search.
import { create } from 'zustand';

interface UIState {
  departmentSwitcherOpen: boolean;
  searchOpen: boolean;
  quickActionsOpen: boolean;
  activeDepartment: string;
  openDepartmentSwitcher: () => void;
  closeDepartmentSwitcher: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openQuickActions: () => void;
  closeQuickActions: () => void;
  setActiveDepartment: (dept: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  departmentSwitcherOpen: false,
  searchOpen: false,
  quickActionsOpen: false,
  activeDepartment: '',
  openDepartmentSwitcher: () => set({ departmentSwitcherOpen: true }),
  closeDepartmentSwitcher: () => set({ departmentSwitcherOpen: false }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openQuickActions: () => set({ quickActionsOpen: true }),
  closeQuickActions: () => set({ quickActionsOpen: false }),
  setActiveDepartment: (dept) => set({ activeDepartment: dept }),
}));
