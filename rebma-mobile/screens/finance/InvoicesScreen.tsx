// rebma-mobile/screens/finance/InvoicesScreen.tsx
// Thin re-export (D25) — web itself uses the byte-identical
// `ceo/InvoicesView.tsx` component for both Marketing's and Finance's
// `Invoices` sub-tab, so this mirrors that reuse rather than porting the
// same `proforma_invoices` CRUD screen twice.
export { default } from '../marketing/InvoicesScreen';
