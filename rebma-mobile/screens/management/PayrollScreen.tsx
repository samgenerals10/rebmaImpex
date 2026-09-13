// rebma-mobile/screens/management/PayrollScreen.tsx
// Thin re-export (D45) — web routes Management's Payroll sub-tab to the
// same PayrollPanel component Finance uses (App.tsx:3175, a global
// intercept before department-specific routing). Its own role gate
// (`canViewTotals = isFinance || isAdmin`, and `isAdmin` already includes
// `department === 'MANAGEMENT'`, verified directly) resolves correctly
// for a Management viewer with zero code changes — mirrors Finance's
// already-ported screen (D29) exactly.
export { default } from '../finance/PayrollScreen';
