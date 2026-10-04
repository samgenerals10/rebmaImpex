// rebma-mobile/components/shared/TodaysBirthdaysCard.tsx
//
// HR dashboard card: whose birthday it is today (staff and customers) and
// whether their wish has gone out. Sending happens on HR → Birthdays, which
// "Open Birthdays" takes you to. Birthdays are HR's alone (approved Part B).
// Hidden when nobody has a birthday today.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Cake } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

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

export default function TodaysBirthdaysCard({ onOpen }: { onOpen: () => void }) {
  const t = useTheme();
  const [people, setPeople] = useState<Person[]>([]);
  const [wished, setWished] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const year = new Date().getFullYear();
    const [{ data: staff }, { data: customers }, { data: logs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, photo, date_of_birth, status').not('date_of_birth', 'is', null),
      supabase.from('customers').select('*').not('date_of_birth', 'is', null),
      supabase.from('birthday_wishes_log').select('person_type, person_id, email_sent, sms_sent, whatsapp_sent').eq('wish_year', year),
    ]);
    // Staff without the app get birthday wishes too (their record is
    // non_app_staff; they are 'staff' with their own id).
    const { data: otherStaff } = await supabase.from('non_app_staff').select('id, full_name, phone, photo, date_of_birth, status').not('date_of_birth', 'is', null);
    setPeople([
      ...[...(staff || []), ...((otherStaff as any[]) || [])].filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE' && isToday(p.date_of_birth))
        .map((p: any) => ({ type: 'staff' as const, id: String(p.id), name: p.full_name || '', photo: p.photo || null })),
      ...(customers || []).filter((c: any) => isToday(c.date_of_birth))
        .map((c: any) => ({ type: 'customer' as const, id: String(c.id), name: c.name || '', photo: c.customer_photo || c.photo || null })),
    ]);
    setWished(new Set((logs || []).filter((l: any) => l.email_sent || l.sms_sent || l.whatsapp_sent).map((l: any) => `${l.person_type}-${l.person_id}`)));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (people.length === 0) return null;

  return (
    <Card>
      <SectionHeader title="Today's Birthdays" subtitle={`${people.length} today`} icon={<Cake size={16} color={t.colors.action.rose} />} />
      <View style={{ gap: t.spacing.sm, marginTop: t.spacing.sm }}>
        {people.map((p) => (
          <View key={`${p.type}-${p.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Avatar name={p.name} photo={p.photo} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{p.name}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{p.type === 'staff' ? 'Staff' : 'Customer'}</Text>
            </View>
            <Badge tone={wished.has(`${p.type}-${p.id}`) ? 'success' : 'warning'} label={wished.has(`${p.type}-${p.id}`) ? 'WISHED' : 'NOT YET'} size="xs" />
          </View>
        ))}
      </View>
      <View style={{ alignItems: 'flex-start', marginTop: t.spacing.sm }}>
        <Button label="Open Birthdays" size="sm" variant="ghost" onPress={onOpen} />
      </View>
    </Card>
  );
}
