// rebma-mobile/screens/ceo/TrackingScreen.tsx
// Thin re-export (D70) — web's CEO "GPS Tracking" nav item is confirmed
// degenerate: App.tsx's CEO block has no `Tracking` case, so it falls
// through to the department switch's default, which unconditionally
// renders CeoDashboard regardless of activeSubTab. Rather than replicate
// that dead click, this reuses Admin & Warehouse's real, working
// TrackingScreen (Phase 7.1, D8) directly — same reuse pattern already
// used for 7 other CEO sub-tabs, just applied to fix a confirmed web
// routing gap instead of mirroring an already-working component.
export { default } from '../adminWarehouse/TrackingScreen';
