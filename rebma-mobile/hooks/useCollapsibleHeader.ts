// rebma-mobile/hooks/useCollapsibleHeader.ts
//
// Drop this into any department dashboard's ScrollView:
//
//   const { scrollHandler } = useCollapsibleHeader();
//   <Screen onScroll={scrollHandler} scrollEventThrottle={16} ...>
//
// Screen.tsx auto-detects the `onScroll` prop and switches into its
// dashboard layout (DashboardHeader rendered as normal scrolling
// content, followed by a rounded-top content sheet — see Screen.tsx
// and AppHeader.tsx's own header comments). The header scrolls away
// with the page like everything else, so nothing here needs to track
// scroll position any more — this hook is kept only as the stable,
// call-site-compatible signal Screen.tsx watches for, so none of the
// department dashboard screens that already call it need to change.
const noop = () => {};

export function useCollapsibleHeader() {
  return { scrollHandler: noop };
}
