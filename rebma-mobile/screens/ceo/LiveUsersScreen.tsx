// rebma-mobile/screens/ceo/LiveUsersScreen.tsx
// Ports: rebma-web/src/views/ceo/LiveUsersView.tsx — Phase 10.3. Same
// shared Realtime Presence channel (lib/presence.ts) every signed-in
// session (web or mobile) tracks itself on — no table, no polling.
//
// Actions mirror web's LiveUsersView.tsx exactly:
//  - Suspend/Reactivate, Block/Unblock: profiles.status flip, same
//    mechanism as web's Suspend button and CEO Control Center.
//  - Kick Offline: presence.ts's kickUserOffline — a real-time broadcast
//    telling that one connected session to sign itself out right now.
//    NOT account deletion.
//  - Send Message: opens the real mobile Messenger (Phase 11.0) straight
//    into a DM with that person — the same channels/chat_messages tables
//    web's Messenger.tsx uses, not a one-off composer anymore.
import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Alert } from 'react-native';
import { Radio, MessageSquare, LogOut, Ban, ShieldOff, ShieldCheck, UserCheck } from 'lucide-react-native';
import { subscribeToLiveUsers, kickUserOffline, type PresencePayload } from '../../lib/presence';
import { supabase } from '../../lib/supabaseClient';
import { messenger } from '../../lib/messenger';
import { navigationRef } from '../../navigation/navigationRef';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { usePresets } from '../../theme/presets';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Sheet from '../../components/ui/Sheet';
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

function statusTone(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'BLOCKED') return 'danger';
  if (status === 'SUSPENDED') return 'warning';
  return 'success';
}

export default function LiveUsersScreen() {
  const t = useTheme();
  const p = usePresets();
  const me = useAuthStore((s) => s.profile);
  const [users, setUsers] = useState<PresencePayload[]>([]);
  const [now, setNow] = useState(Date.now());
  const [statusByUser, setStatusByUser] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [openingMessageFor, setOpeningMessageFor] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ uri: string; name: string } | null>(null);

  useEffect(() => {
    return subscribeToLiveUsers(setUsers);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ids = users.map((u) => u.userId);
    if (ids.length === 0) return;
    supabase.from('profiles').select('id, status').in('id', ids).then(({ data }) => {
      const next: Record<string, string> = {};
      (data || []).forEach((row: any) => { next[row.id] = row.status; });
      setStatusByUser((prev) => ({ ...prev, ...next }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.map((u) => u.userId).join(',')]);

  const setStatus = async (userId: string, name: string, status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED', verb: string) => {
    if (busyUserId) return;
    setBusyUserId(userId);
    try {
      const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
      if (error) throw error;
      setStatusByUser((prev) => ({ ...prev, [userId]: status }));
    } catch (err: any) {
      Alert.alert('Failed', `Could not update ${name}: ${err.message}`);
    } finally {
      setBusyUserId(null);
    }
  };

  const handleKick = (userId: string, name: string) => {
    kickUserOffline(userId);
    Alert.alert('Kicked offline', `${name} has been signed out.`);
  };

  const handleOpenMessage = async (u: PresencePayload) => {
    if (!me || openingMessageFor) return;
    setOpeningMessageFor(u.userId);
    try {
      const channel = await messenger.getOrCreateDmChannel(me.id, u.userId);
      if (navigationRef.isReady()) {
        (navigationRef.navigate as any)('Messenger', { screen: 'MessengerThread', params: { channelId: channel.id, channelType: 'dm', title: u.fullName, subtitle: u.department } });
      }
    } catch (err: any) {
      Alert.alert('Failed to open conversation', err.message);
    } finally {
      setOpeningMessageFor(null);
    }
  };

  const sorted = [...users].sort((a, b) => new Date(a.loggedInAt).getTime() - new Date(b.loggedInAt).getTime());

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
          {sorted.map((u) => {
            const status = statusByUser[u.userId] || 'ACTIVE';
            const isSelf = me?.id === u.userId;
            const isBusy = busyUserId === u.userId;
            return (
              <Card key={u.userId} padded>
                <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                  <Pressable onPress={() => u.photo && setPhotoPreview({ uri: u.photo, name: u.fullName })}>
                    <Avatar name={u.fullName} photo={u.photo} size={44} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.status.success.text }} />
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
                        {u.fullName}{isSelf ? ' (you)' : ''}
                      </Text>
                    </View>
                    <Text style={{ ...p.meta, marginTop: 2 }}>{u.department}{u.role ? ` · ${u.role}` : ''}</Text>
                    <Text style={{ ...p.meta, marginTop: 6 }}>Online for {formatDuration(now - new Date(u.loggedInAt).getTime())}</Text>
                    <Text style={{ ...p.meta }}>Since {new Date(u.loggedInAt).toLocaleString()}</Text>
                    <View style={{ marginTop: 8 }}>
                      <Badge tone={statusTone(status)} label={status} size="xs" />
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: t.spacing.md, paddingTop: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                  {!isSelf && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        label={status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                        icon={status === 'SUSPENDED' ? <UserCheck size={13} color={t.colors.status.warning.text} /> : <ShieldOff size={13} color={t.colors.status.warning.text} />}
                        disabled={isBusy}
                        onPress={() => setStatus(u.userId, u.fullName, status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED', status === 'SUSPENDED' ? 'reactivated' : 'suspended')}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        label={status === 'BLOCKED' ? 'Unblock' : 'Block'}
                        icon={status === 'BLOCKED' ? <ShieldCheck size={13} color={t.colors.status.danger.text} /> : <Ban size={13} color={t.colors.status.danger.text} />}
                        disabled={isBusy}
                        onPress={() => setStatus(u.userId, u.fullName, status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED', status === 'BLOCKED' ? 'unblocked' : 'blocked')}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        label="Kick"
                        icon={<LogOut size={13} color={t.colors.textMuted} />}
                        onPress={() => handleKick(u.userId, u.fullName)}
                      />
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    label="Message"
                    icon={<MessageSquare size={13} color={t.colors.accent} />}
                    loading={openingMessageFor === u.userId}
                    onPress={() => handleOpenMessage(u)}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Sheet
        open={!!photoPreview}
        onClose={() => setPhotoPreview(null)}
        title={photoPreview?.name}
      >
        {photoPreview && (
          <Image
            source={{ uri: photoPreview.uri }}
            style={{ width: '100%', aspectRatio: 1, borderRadius: t.radius.md }}
            resizeMode="cover"
          />
        )}
      </Sheet>
    </Screen>
  );
}
