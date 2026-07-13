import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  department: string;
  onNavigate?: (tab: string) => void;
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
      const [cargo, credit] = await Promise.all([
        supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_CREDIT_APPROVAL'),
      ]);
      if ((cargo.count ?? 0) > 0) items.push({ label: 'cargo approvals', count: cargo.count!, tab: 'CargoApproval' });
      if ((credit.count ?? 0) > 0) items.push({ label: 'credit approvals', count: credit.count!, tab: 'CreditApproval' });
    }

    if (department === 'CEO') {
      const [reg, prices] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_CEO_COSIGN'),
      ]);
      if ((reg.count ?? 0) > 0) items.push({ label: 'registration approvals', count: reg.count!, tab: 'Approvals' });
      if ((prices.count ?? 0) > 0) items.push({ label: 'CEO co-sign requests', count: prices.count!, tab: 'Approvals' });
    }

    if (department === 'FINANCE') {
      const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_EVALUATION');
      if ((count ?? 0) > 0) items.push({ label: 'orders awaiting evaluation', count: count!, tab: 'Evaluation' });
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
      const { count } = await supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL');
      if ((count ?? 0) > 0) items.push({ label: 'cargo pending management sign-off', count: count!, tab: 'PortIngestion' });
    }

    if (department === 'DISPATCH') {
      const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PROCESSING');
      if ((count ?? 0) > 0) items.push({ label: 'orders pending dispatch', count: count!, tab: 'Deliveries' });
    }

    if (department === 'PRODUCTION') {
      const { count } = await supabase.from('production_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING');
      if ((count ?? 0) > 0) items.push({ label: 'internal production requests pending', count: count!, tab: 'Requisition' });
    }
  } catch {
    // Table may not exist — silently skip
  }

  return items;
}

export default function PendingApprovalsAlert({ department, onNavigate }: Props) {
  const [pending, setPending] = useState<PendingItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await fetchPendingForDept(department);
      if (active) setPending(result);
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
