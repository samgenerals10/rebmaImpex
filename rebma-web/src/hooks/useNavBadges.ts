import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

// Maps DB table events to sidebar tab IDs per department
// badge counts auto-clear when user navigates to that tab
export function useNavBadges(activeSubTab: string) {
  const [badges, setBadges] = useState<Record<string, number>>({});

  const bump = useCallback((tabId: string) => {
    setBadges(prev => ({ ...prev, [tabId]: (prev[tabId] ?? 0) + 1 }));
  }, []);

  // Clear badge when user views that tab
  useEffect(() => {
    if (badges[activeSubTab]) {
      setBadges(prev => { const n = { ...prev }; delete n[activeSubTab]; return n; });
    }
  }, [activeSubTab]);

  useEffect(() => {
    const subs = [
      // cargo_intake inserts → Stock Intake + Overview
      supabase.channel('nav-cargo-' + Math.random().toString(36).substring(7))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cargo_intake' }, () => {
          bump('PortIngestion');
          bump('Overview');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cargo_intake' }, (payload) => {
          const s = (payload.new as any)?.status;
          if (s === 'APPROVED') bump('ApprovedGoods');
          if (s === 'APPROVED') bump('Stock');
          if ((payload.new as any)?.discrepancies && (payload.new as any).discrepancies !== 'None') bump('OpsHistory');
        })
        .subscribe(),

      // orders inserts → Finance OrdersQueue + Marketing Overview + Ops Overview
      supabase.channel('nav-orders-' + Math.random().toString(36).substring(7))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
          bump('OrdersQueue');
          bump('Overview');       // Marketing dashboard
          bump('Evaluation');     // Finance dashboard
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
          const s = (payload.new as any)?.status;
          if (s === 'APPROVED' || s === 'PROCESSING') {
            bump('Releases');     // Ops fulfillment
            bump('Invoices');     // Finance/CEO invoices
          }
          if (s === 'OUT_FOR_DELIVERY' || s === 'DELIVERED') {
            bump('ActiveDeliveries'); // Dispatch
          }
        })
        .subscribe(),

      // general_purchases inserts → Approved Goods + Stock
      supabase.channel('nav-gp-' + Math.random().toString(36).substring(7))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'general_purchases' }, () => {
          bump('ApprovedGoods');
          bump('Stock');
        })
        .subscribe(),

      // finance_payments inserts → Wallets + Transactions
      supabase.channel('nav-payments-' + Math.random().toString(36).substring(7))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'finance_payments' }, () => {
          bump('Wallets');
          bump('Transactions');
          bump('RecordPayment');
        })
        .subscribe(),

      // dispatches/deliveries → Dispatch dashboard
      supabase.channel('nav-dispatch-' + Math.random().toString(36).substring(7))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dispatches' }, () => {
          bump('Deliveries');
          bump('ActiveDeliveries');
        })
        .subscribe(),
    ];

    return () => { subs.forEach(s => supabase.removeChannel(s)); };
  }, [bump]);

  return badges;
}
