// rebma-mobile/screens/ceo/InvoicesScreen.tsx
// Thin re-export (D69) — web itself uses the byte-identical
// ceo/InvoicesView.tsx component for CEO/Finance/Management/Marketing.
// Marketing's InvoicesScreen (Phase 7.3) and Finance's (Phase 7.4, D25)
// already established this exact reuse; CEO does the same. Zero new code.
export { default } from '../marketing/InvoicesScreen';
