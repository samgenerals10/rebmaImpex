// rebma-web/src/components/global/TodaysBirthdaysCard.tsx
// Web twin of rebma-mobile/components/shared/TodaysBirthdaysCard.tsx.
//
// HR dashboard card: whose birthday it is today (staff and customers) and
// whether their wish has gone out. Sending happens on HR → Birthdays.
// Birthdays are HR's alone (approved Part B). Hidden when there are none.
import { useEffect, useState } from 'react';
import { Cake } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Person { type: 'staff' | 'customer'; id: string; name: string; photo: string | null }

function isToday(dob: string | null): boolean {
  if (!dob) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return false;
  const now = new Date();
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month === now.getMonth() + 1 && day === now.getDate()) return true;
  const y = now.getFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return month === 2 && day === 29 && !leap && now.getMonth() === 1 && now.getDate() === 28;
}

const initials = (name: string) => name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export default function TodaysBirthdaysCard({ onOpen }: { onOpen: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [wished, setWished] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      // Typed loosely: mixed-table queries in one Promise.all trip
      // supabase-js's type inference (TS2589) without adding any safety.
      const db = supabase as any;
      const year = new Date().getFullYear();
      const [{ data: staff }, { data: customers }, { data: logs }] = await Promise.all([
        db.from('profiles').select('id, full_name, photo, date_of_birth, status').not('date_of_birth', 'is', null),
        db.from('customers').select('*').not('date_of_birth', 'is', null),
        db.from('birthday_wishes_log').select('person_type, person_id, email_sent, sms_sent, whatsapp_sent').eq('wish_year', year),
      ]);
      // Staff without the app get birthday wishes too (their record is
      // non_app_staff; they are 'staff' with their own id).
      const { data: otherStaff } = await db.from('non_app_staff').select('id, full_name, phone, photo, date_of_birth, status').not('date_of_birth', 'is', null);
      setPeople([
        ...[...(staff || []), ...((otherStaff as any[]) || [])].filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE' && isToday(p.date_of_birth))
          .map((p: any) => ({ type: 'staff' as const, id: String(p.id), name: p.full_name || '', photo: p.photo || null })),
        ...(customers || []).filter((c: any) => isToday(c.date_of_birth))
          .map((c: any) => ({ type: 'customer' as const, id: String(c.id), name: c.name || '', photo: c.customer_photo || c.photo || null })),
      ]);
      setWished(new Set((logs || []).filter((l: any) => l.email_sent || l.sms_sent || l.whatsapp_sent).map((l: any) => `${l.person_type}-${l.person_id}`)));
    })();
  }, []);

  if (people.length === 0) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cake className="w-4 h-4 text-rose-500" />
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex-1">Today's Birthdays</h3>
        <button onClick={onOpen} className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer">Open Birthdays</button>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {people.map(p => {
          const done = wished.has(`${p.type}-${p.id}`);
          return (
            <div key={`${p.type}-${p.id}`} className="flex items-center gap-3 py-2">
              {p.photo
                ? <img src={p.photo} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                : <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-[11px] font-bold">{initials(p.name)}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{p.type === 'staff' ? 'Staff' : 'Customer'}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${done ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>{done ? 'WISHED' : 'NOT YET'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
