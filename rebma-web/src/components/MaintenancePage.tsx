// rebma-web/src/components/MaintenancePage.tsx
import { useEffect } from 'react';
import { Settings } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  onAccessRestored: () => void;
}

export default function MaintenancePage({ onAccessRestored }: Props) {
  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase
          .from('ceo_settings')
          .select('setting_value')
          .eq('setting_key', 'maintenance_mode')
          .single();
        if (data) {
          const val = typeof data.setting_value === 'string'
            ? JSON.parse(data.setting_value)
            : data.setting_value;
          if (!val) onAccessRestored();
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [onAccessRestored]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f172a] text-white p-6">
      <div className="flex flex-col items-center text-center max-w-lg space-y-6">
        <img src="/logo.png" alt="REBMA IMPEX" className="w-16 h-16 object-contain rounded-2xl" />
        <Settings className="w-20 h-20 text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">System Under Maintenance</h1>
          <p className="text-slate-400 text-sm mt-2 font-semibold tracking-wide uppercase">REBMA IMPEX ERP</p>
        </div>
        <p className="text-slate-300 text-base leading-relaxed">
          We are performing scheduled maintenance. The system will be back shortly.
          Thank you for your patience.
        </p>
        <p className="text-slate-500 text-sm">
          For urgent matters, contact your system administrator.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span className="text-xs text-slate-400">Auto-checking every 60 seconds…</span>
        </div>
      </div>
    </div>
  );
}
