import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  department: string;
  onNavigate?: (tab: string) => void;
  /** Also pushes a bell/toast notification when the pending set changes —
   * without this, someone who wasn't connected when the item was created
   * (e.g. opening the department fresh) would only ever see the inline
   * banner and never get a notification for it. */
  addNotification?: (msg: string, link?: { dept?: string; tab: string }) => void;
}

interface PendingItem {
  label: string;
  count: number;
  tab: string;
}

async function fetchPendingForDept(department: string): Promise<PendingItem[]> {
  const items: PendingItem[] = [];

  try {
    if (department === 'MANAGEMENT') {
      const [cargo, credit, requisitions, floats] = await Promise.all([
        supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT'),
        supabase.from('material_requisitions').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT').then(r => r, () => ({ count: 0 })),
        supabase.from('float_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT').then(r => r, () => ({ count: 0 })),
      ]);
      if ((cargo.count ?? 0) > 0) items.push({ label: 'cargo approvals', count: cargo.count!, tab: 'CargoApproval' });
      if ((credit.count ?? 0) > 0) items.push({ label: 'credit approvals', count: credit.count!, tab: 'CreditApproval' });
      if ((requisitions.count ?? 0) > 0) items.push({ label: 'material requisitions', count: requisitions.count!, tab: 'CreditApproval' });
      if ((floats.count ?? 0) > 0) items.push({ label: 'float requests', count: floats.count!, tab: 'CreditApproval' });
    }

    if (department === 'CEO') {
      // Note: CEO electronic co-sign is currently just a toggle in Control
      // Center — no order status routes to CEO for co-signing yet, so there
      // is nothing real to check here beyond registrations.
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL');
      if ((count ?? 0) > 0) items.push({ label: 'registration approvals', count: count!, tab: 'Approvals' });
    }

    if (department === 'FINANCE') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [orders, requisitions, newPrices] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_FINANCE'),
        supabase.from('material_requisitions').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_FINANCE'),
        supabase.from('goods_prices').select('id', { count: 'exact', head: true }).gte('updated_at', since),
      ]);
      if ((orders.count ?? 0) > 0) items.push({ label: 'orders awaiting evaluation', count: orders.count!, tab: 'OrdersQueue' });
      if ((requisitions.count ?? 0) > 0) items.push({ label: 'material requisitions to record', count: requisitions.count!, tab: 'Evaluation' });
      if ((newPrices.count ?? 0) > 0) items.push({ label: 'newly priced items', count: newPrices.count!, tab: 'PriceCatalog' });
    }

    if (department === 'MARKETING') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from('goods_prices').select('id', { count: 'exact', head: true }).gte('updated_at', since);
      if ((count ?? 0) > 0) items.push({ label: 'newly priced items ready to sell', count: count!, tab: 'PriceCatalog' });
    }

    if (department === 'HR') {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL');
      if ((count ?? 0) > 0) items.push({ label: 'registration approvals', count: count!, tab: 'Registrations' });
    }

    if (department === 'RECEPTION') {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL');
      if ((count ?? 0) > 0) items.push({ label: 'pending registrations', count: count!, tab: 'Registrations' });
    }

    if (department === 'OPERATIONS') {
      const [cargo, production, rawMaterial] = await Promise.all([
        supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL'),
        supabase.from('fulfillment_tickets').select('id', { count: 'exact', head: true }).eq('type', 'PRODUCTION_RELEASE').eq('status', 'PENDING').then(r => r, () => ({ count: 0 })),
        supabase.from('fulfillment_tickets').select('id', { count: 'exact', head: true }).eq('type', 'RAW_MATERIAL_RELEASE').eq('status', 'PENDING').then(r => r, () => ({ count: 0 })),
      ]);
      if ((cargo.count ?? 0) > 0) items.push({ label: 'cargo pending management sign-off', count: cargo.count!, tab: 'PortIngestion' });
      if ((production.count ?? 0) > 0) items.push({ label: 'production releases to prepare', count: production.count!, tab: 'Releases' });
      if ((rawMaterial.count ?? 0) > 0) items.push({ label: 'raw material releases to prepare', count: rawMaterial.count!, tab: 'Releases' });
    }

    if (department === 'DISPATCH') {
      const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PROCESSING');
      if ((count ?? 0) > 0) items.push({ label: 'orders pending dispatch', count: count!, tab: 'Deliveries' });
    }

    if (department === 'PRODUCTION') {
      const { count } = await supabase.from('production_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT');
      if ((count ?? 0) > 0) items.push({ label: 'internal production requests pending', count: count!, tab: 'InternalOrders' });
    }
  } catch {
    // Table may not exist — silently skip
  }

  return items;
}

export default function PendingApprovalsAlert({ department, onNavigate, addNotification }: Props) {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const lastNotifiedSignature = useRef<string>('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await fetchPendingForDept(department);
      if (!active) return;
      setPending(result);

      const signature = result.map(p => `${p.tab}:${p.count}`).join('|');
      if (result.length > 0 && signature !== lastNotifiedSignature.current) {
        lastNotifiedSignature.current = signature;
        const totalCount = result.reduce((s, p) => s + p.count, 0);
        addNotification?.(
          `${totalCount} pending approval${totalCount !== 1 ? 's' : ''}: ${result.map(p => `${p.count} ${p.label}`).join(', ')}`,
          { dept: department, tab: result[0].tab }
        );
      } else if (result.length === 0) {
        lastNotifiedSignature.current = '';
      }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { active = false; clearInterval(iv); };
  }, [department]);

  if (pending.length === 0) return null;

  const totalCount = pending.reduce((s, p) => s + p.count, 0);
  // Navigate to the first pending tab if there's only one type, else let user click each
  const primaryTab = pending[0].tab;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl border border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 shadow-sm cursor-pointer group hover:border-amber-500 transition-all"
      onClick={() => onNavigate?.(primaryTab)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onNavigate?.(primaryTab)}
    >
      <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 relative red-pilot">
        <AlertCircle className="w-5 h-5 text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
          {totalCount} Pending Approval{totalCount !== 1 ? 's' : ''}
        </p>
        <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 leading-snug mt-0.5 truncate">
          {pending.map(p => `${p.count} ${p.label}`).join(' · ')}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-[11px] font-bold group-hover:bg-amber-600 transition-colors">
        Review →
      </div>
    </div>
  );
}
