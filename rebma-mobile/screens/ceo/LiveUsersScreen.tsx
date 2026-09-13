// rebma-mobile/screens/ceo/LiveUsersScreen.tsx
// Ports: rebma-web/src/views/ceo/LiveUsersView.tsx — Phase 10.3. Same
// shared Realtime Presence channel (lib/presence.ts) every signed-in
// session (web or mobile) tracks itself on — no table, no polling.
import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { Radio } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { LIVE_USERS_CHANNEL, type PresencePayload } from '../../lib/presence';
import { useTheme } from '../../theme/ThemeProvider';
import { usePresets } from '../../theme/presets';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LiveUsersScreen() {
  const t = useTheme();
  const p = usePresets();
  const [users, setUsers] = useState<PresencePayload[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const channel = supabase.channel(LIVE_USERS_CHANNEL);
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        const flat = Object.values(state).flat().filter(Boolean) as unknown as PresencePayload[];
        setUsers(flat);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen scroll>
      <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: 4 }}>
          <Radio size={20} color={t.colors.textPrimary} />
          <Text style={{ ...p.pageTitle }}>Live Users</Text>
        </View>
        <Text style={{ fontSize: t.type.body12.size, color: t.colors.textMuted, marginBottom: t.spacing.lg }}>
          {users.length} {users.length === 1 ? 'person' : 'people'} online right now, across web and mobile.
        </Text>
      </View>

      {users.length === 0 ? (
        <EmptyState title="No one else is online right now" />
      ) : (
        <View style={{ paddingHorizontal: t.spacing.lg, gap: t.spacing.sm }}>
          {users
            .sort((a, b) => new Date(a.loggedInAt).getTime() - new Date(b.loggedInAt).getTime())
            .map((u) => (
              <Card key={u.userId} padded>
                <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                  <Avatar name={u.fullName} photo={u.photo} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.status.success.text }} />
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{u.fullName}</Text>
                    </View>
                    <Text style={{ ...p.meta, marginTop: 2 }}>{u.department}</Text>
                    <Text style={{ ...p.meta, marginTop: 6 }}>Online for {formatDuration(now - new Date(u.loggedInAt).getTime())}</Text>
                    <Text style={{ ...p.meta }}>Since {new Date(u.loggedInAt).toLocaleString()}</Text>
                  </View>
                </View>
              </Card>
            ))}
        </View>
      )}
    </Screen>
  );
}
