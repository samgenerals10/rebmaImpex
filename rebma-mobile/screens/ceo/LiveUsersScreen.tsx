// rebma-mobile/screens/ceo/LiveUsersScreen.tsx
// Ports: rebma-web/src/views/ceo/LiveUsersView.tsx — Phase 10.3. Same
// shared Realtime Presence channel (lib/presence.ts) every signed-in
// session (web or mobile) tracks itself on — no table, no polling.
//
// Actions mirror web's LiveUsersView.tsx exactly:
//  - Suspend/Reactivate, Block/Unblock: through api/set-user-status.ts
//    with the CEO's password. The server locks or unlocks sign-in, ends
//    open sessions and logs it; the database refuses a status change made
//    straight from the app.
//  - Kick Offline: api/kick-user.ts ends every session, then the broadcast
//    closes the person's open screen right away. NOT account deletion.
//  - None of these are offered on a CEO account: no CEO acts on another.
//  - Send Message: opens the real mobile Messenger (Phase 11.0) straight
//    into a DM with that person — the same channels/chat_messages tables
//    web's Messenger.tsx uses, not a one-off composer anymore.
import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { Radio, MessageSquare, LogOut, Ban, ShieldOff, ShieldCheck, UserCheck, Download } from 'lucide-react-native';
import ExportSheet from '../../components/shared/ExportSheet';
import { subscribeToLiveUsers, kickUserOffline, type PresencePayload } from '../../lib/presence';
import { supabase } from '../../lib/supabaseClient';
import { messenger } from '../../lib/messenger';
import { callPrivilegedApi, ApiNotConfiguredError } from '../../lib/apiBase';
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
import PasswordConfirmSheet from '../../components/shared/PasswordConfirmSheet';
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

type StatusAction = 'suspend' | 'reactivate' | 'block' | 'unblock';

const STATUS_WORDING: Record<StatusAction, { title: string; verb: string; effect: string }> = {
  suspend: { title: 'Confirm Suspension', verb: 'Suspend', effect: 'They are signed out everywhere and cannot sign in until reactivated.' },
  reactivate: { title: 'Confirm Reactivation', verb: 'Reactivate', effect: 'They can sign in again.' },
  block: { title: 'Confirm Block', verb: 'Block', effect: 'They are signed out everywhere and cannot sign in until unblocked.' },
  unblock: { title: 'Confirm Unblock', verb: 'Unblock', effect: 'They can sign in again.' },
};

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
  const [ceoIds, setCeoIds] = useState<Set<string>>(new Set());
  const [pendingStatus, setPendingStatus] = useState<{ userId: string; name: string; action: StatusAction } | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [openingMessageFor, setOpeningMessageFor] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ uri: string; name: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

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
    supabase.from('profiles').select('id, status, is_admin').in('id', ids).then(({ data }) => {
      const next: Record<string, string> = {};
      const ceos = new Set<string>();
      (data || []).forEach((row: any) => {
        next[row.id] = String(row.status || 'ACTIVE').toUpperCase();
        if (row.is_admin) ceos.add(row.id);
      });
      setStatusByUser((prev) => ({ ...prev, ...next }));
      setCeoIds(ceos);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.map((u) => u.userId).join(',')]);

  // Runs after the CEO types their password. A thrown error keeps the
  // password sheet open with the server's message.
  const runStatusChange = async (password: string) => {
    const pending = pendingStatus;
    if (!pending) return;
    try {
      const res: any = await callPrivilegedApi('/api/set-user-status', { userId: pending.userId, action: pending.action, password });
      if (pending.action === 'suspend' || pending.action === 'block') kickUserOffline(pending.userId);
      setStatusByUser((prev) => ({ ...prev, [pending.userId]: res?.status || prev[pending.userId] }));
      setPendingStatus(null);
      Alert.alert('Done', res?.message || 'Status updated.');
    } catch (e: any) {
      throw new Error(e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'That did not work.'));
    }
  };

  // Routed through api/kick-user.ts (the same new privileged endpoint web
  // now uses), which does a real server-side session invalidation
  // (supabase.auth.admin.signOut) — the old implementation was only a
  // client-side Realtime broadcast with no authorization check at all.
  // Security/gap audit fix. Uses the same callPrivilegedApi gate HR's
  // Add Staff/Approve Registration already use, so it fails with a clear
  // "not configured yet" message rather than a guessed URL if
  // EXPO_PUBLIC_API_BASE_URL isn't set. The broadcast is still sent
  // afterward (unchanged) purely so the target's already-open screen
  // updates immediately if it's still running.
  const handleKick = async (userId: string, name: string) => {
    if (busyUserId) return;
    setBusyUserId(userId);
    try {
      await callPrivilegedApi('/api/kick-user', { userId });
      kickUserOffline(userId);
      Alert.alert('Kicked offline', `${name} has been signed out.`);
    } catch (err: any) {
      Alert.alert('Failed', `Could not kick ${name} offline: ${err.message}`);
    } finally {
      setBusyUserId(null);
    }
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
          <Text style={{ ...p.pageTitle, flex: 1 }}>Live Users</Text>
          {users.length > 0 && (
            <Pressable
              onPress={() => setExportOpen(true)}
              accessibilityLabel="Export Live Users"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgCard }}
            >
              <Download size={14} color={t.colors.accent} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Export</Text>
            </Pressable>
          )}
        </View>
        <ExportSheet
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          title="Live Users"
          data={sorted.map((u) => ({
            name: u.fullName, role: u.role || 'Not set', department: u.department,
            timeSpent: formatDuration(now - new Date(u.loggedInAt).getTime()),
            since: new Date(u.loggedInAt).toLocaleString(),
            status: (statusByUser[u.userId] || 'ACTIVE').replace(/_/g, ' '),
          }))}
          columns={[
            { key: 'name', label: 'User' }, { key: 'role', label: 'Role' }, { key: 'department', label: 'Department' },
            { key: 'timeSpent', label: 'Time Spent' }, { key: 'since', label: 'Since' }, { key: 'status', label: 'Status' },
          ]}
        />
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
            const isCeo = ceoIds.has(u.userId);
            const canAct = !isSelf && !isCeo;
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
                        {u.fullName}{isSelf ? ' (you)' : isCeo ? ' (CEO)' : ''}
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
                  {canAct && status === 'ACTIVE' && (
                    <Button size="sm" variant="ghost" label="Suspend" icon={<ShieldOff size={13} color={t.colors.status.warning.text} />} disabled={isBusy}
                      onPress={() => setPendingStatus({ userId: u.userId, name: u.fullName, action: 'suspend' })} />
                  )}
                  {canAct && status === 'SUSPENDED' && (
                    <Button size="sm" variant="ghost" label="Reactivate" icon={<UserCheck size={13} color={t.colors.status.warning.text} />} disabled={isBusy}
                      onPress={() => setPendingStatus({ userId: u.userId, name: u.fullName, action: 'reactivate' })} />
                  )}
                  {canAct && (status === 'ACTIVE' || status === 'SUSPENDED') && (
                    <Button size="sm" variant="ghost" label="Block" icon={<Ban size={13} color={t.colors.status.danger.text} />} disabled={isBusy}
                      onPress={() => setPendingStatus({ userId: u.userId, name: u.fullName, action: 'block' })} />
                  )}
                  {canAct && status === 'BLOCKED' && (
                    <Button size="sm" variant="ghost" label="Unblock" icon={<ShieldCheck size={13} color={t.colors.status.danger.text} />} disabled={isBusy}
                      onPress={() => setPendingStatus({ userId: u.userId, name: u.fullName, action: 'unblock' })} />
                  )}
                  {canAct && (
                    <Button size="sm" variant="ghost" label="Kick" icon={<LogOut size={13} color={t.colors.textMuted} />} disabled={isBusy}
                      onPress={() => handleKick(u.userId, u.fullName)} />
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

      <PasswordConfirmSheet
        open={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        title={pendingStatus ? STATUS_WORDING[pendingStatus.action].title : ''}
        description={pendingStatus ? `${STATUS_WORDING[pendingStatus.action].verb} ${pendingStatus.name}? ${STATUS_WORDING[pendingStatus.action].effect} Type your password to confirm it is you.` : ''}
        confirmLabel={pendingStatus ? STATUS_WORDING[pendingStatus.action].verb : 'Confirm'}
        danger={pendingStatus?.action === 'suspend' || pendingStatus?.action === 'block'}
        onConfirm={runStatusChange}
      />

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
