// rebma-mobile/screens/finance/SalesHistoryScreen.tsx
// Thin re-export — Sales History moved from Marketing to Finance, same
// department move web made (views/finance/SalesHistoryView.tsx). Reuses
// the exact same component, matching this file's own established
// re-export convention (finance/InvoicesScreen.tsx does the same for
// Invoices).
export { default } from '../marketing/SalesHistoryScreen';
