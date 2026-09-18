// rebma-mobile/screens/management/TrackingScreen.tsx
// Thin re-export, same pattern as ceo/TrackingScreen.tsx and
// risk/TrackingScreen.tsx — Management needs the same live fleet-position
// view (confirmed directly with the user), reusing Admin & Warehouse's
// real TrackingScreen rather than duplicating it a fourth time.
export { default } from '../adminWarehouse/TrackingScreen';
