// rebma-mobile/screens/MessengerChannelsScreen.tsx
// Phase 11.0 — mobile's real Messenger, channel list. Ports:
// rebma-web/src/components/collaborative/Messenger.tsx's sidebar.
// Reachable from AppHeader's new chat icon (any department) rather than
// nested under one department — messaging isn't department-scoped.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MessageSquare, Plus, Search, Users, X, Check } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { messenger, type Channel } from '../lib/messenger';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import { usePresets } from '../theme/presets';
import Screen from '../components/ui/Screen';
import Avatar from '../components/ui/Avatar';
import Input from '../components/ui/Input';
import Sheet from '../components/ui/Sheet';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

interface Profile { id: string; fullName: string; department: string; email: string; }

function initials(name: string) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

export default function MessengerChannelsScreen({ navigation }: any) {
  const t = useTheme();
  const p = usePresets();
  const me = useAuthStore((s) => s.profile);
  const myId = me?.id || '';
  const myName = me?.fullName || 'Me';

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dmChannelByUser, setDmChannelByUser] = useState<Record<string, Channel>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    if (!myId) return;
    setCheckingAccess(true);
    messenger.checkMessagingAccess(me?.email).then((v) => { setAllowed(v); setCheckingAccess(false); });
  }, [myId, me?.email]);

  const load = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase.from('profiles_directory').select('id, full_name, department, email').eq('status', 'ACTIVE').order('full_name', { ascending: true });
    setProfiles((data || []).map((row: any) => ({ id: row.id, fullName: row.full_name || 'Unknown', department: row.department || '', email: row.email || '' })).filter((pr: Profile) => pr.id !== myId));

    const everyoneId = await messenger.ensureEveryoneChannel();
    if (everyoneId) await messenger.joinChannel(everyoneId, myId);
    const mine = await messenger.listMyChannels(myId);
    setChannels(mine);

    const dmMap: Record<string, Channel> = {};
    for (const ch of mine.filter((c) => c.type === 'dm')) {
      const { data: members } = await supabase.from('channel_members').select('user_id').eq('channel_id', ch.id);
      const other = (members || []).find((m: any) => m.user_id !== myId);
      if (other) dmMap[other.user_id] = ch;
    }
    setDmChannelByUser(dmMap);

    messenger.getUnreadCounts().then(setUnreadCounts);
  }, [myId]);

  useEffect(() => { load(); }, [load]);
  // Refresh unread badges every time this screen regains focus (coming
  // back from a thread after reading it) — no realtime subscription
  // needed at the list level, matching this app's established "poll on
  // focus/interval for secondary state" posture.
  useFocusEffect(useCallback(() => { messenger.getUnreadCounts().then(setUnreadCounts); }, []));

  const everyoneChannel = channels.find((c) => c.type === 'everyone');
  const groupChannels = channels.filter((c) => c.type === 'group');

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return profiles;
    return profiles.filter((pr) => pr.fullName.toLowerCase().includes(q) || pr.department.toLowerCase().includes(q) || pr.email.toLowerCase().includes(q));
  }, [profiles, search]);

  const openThread = (channel: Channel, title: string, subtitle: string) => {
    navigation.navigate('MessengerThread', { channelId: channel.id, channelType: channel.type, title, subtitle });
  };

  const openDm = async (contact: Profile) => {
    let ch = dmChannelByUser[contact.id];
    if (!ch) {
      ch = await messenger.getOrCreateDmChannel(myId, contact.id);
      setDmChannelByUser((prev) => ({ ...prev, [contact.id]: ch }));
      setChannels((prev) => (prev.some((c) => c.id === ch.id) ? prev : [...prev, ch]));
    }
    openThread(ch, contact.fullName, contact.department);
  };

  const toggleGroupMember = (id: string) => {
    setNewGroupMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.length === 0 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const ch = await messenger.createGroupChannel(newGroupName.trim(), newGroupMembers, myId);
      setChannels((prev) => [...prev, ch]);
      setShowNewGroup(false);
      setNewGroupName('');
      setNewGroupMembers([]);
      openThread(ch, ch.name || 'Group', 'Group channel');
    } catch (e: any) {
      // fall through — a failed create just leaves the sheet open
    } finally {
      setCreatingGroup(false);
    }
  };

  if (checkingAccess) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={p.meta}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  if (!allowed) {
    return (
      <Screen>
        <EmptyState
          icon={<MessageSquare size={20} color={t.colors.textMuted} />}
          title="Messaging is disabled for your account"
          description="The CEO has turned off chat access for this account. Contact your administrator if you believe this is a mistake."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <MessageSquare size={20} color={t.colors.textPrimary} />
          <Text style={p.pageTitle}>Messenger</Text>
        </View>
        <Pressable onPress={() => setShowNewGroup(true)} hitSlop={8} style={{ padding: 6 }}>
          <Plus size={22} color={t.colors.accent} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.bgInput, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd }}>
          <Search size={16} color={t.colors.textMuted} />
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search people, department, email…"
            style={{ flex: 1, backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 }}
          />
        </View>
      </View>

      <FlatList
        data={[{ kind: 'spacer' as const }]}
        keyExtractor={() => 'root'}
        renderItem={() => (
          <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl }}>
            {everyoneChannel && (
              <Row
                title="Everyone"
                subtitle="Company-wide broadcast"
                icon={<Users size={16} color={t.colors.onAccent} />}
                iconBg={t.colors.accent}
                unread={unreadCounts[everyoneChannel.id]}
                onPress={() => openThread(everyoneChannel, 'Everyone', 'Company-wide broadcast')}
              />
            )}
            {groupChannels.length > 0 && <Text style={{ ...p.label9, marginTop: t.spacing.md, marginBottom: t.spacing.xs }}>Groups</Text>}
            {groupChannels.map((ch) => (
              <Row
                key={ch.id}
                title={ch.name || 'Group'}
                subtitle="Group channel"
                initialsText={initials(ch.name || 'GC')}
                unread={unreadCounts[ch.id]}
                onPress={() => openThread(ch, ch.name || 'Group', 'Group channel')}
              />
            ))}
            <Text style={{ ...p.label9, marginTop: t.spacing.md, marginBottom: t.spacing.xs }}>People</Text>
            {filteredContacts.length === 0 && <Text style={{ ...p.meta, paddingVertical: t.spacing.md }}>No one matches your search.</Text>}
            {filteredContacts.map((c) => {
              const dm = dmChannelByUser[c.id];
              return (
                <Row
                  key={c.id}
                  title={c.fullName}
                  subtitle={c.department}
                  photo={undefined}
                  initialsText={initials(c.fullName)}
                  unread={dm ? unreadCounts[dm.id] : undefined}
                  onPress={() => openDm(c)}
                />
              );
            })}
          </View>
        )}
      />

      <Sheet open={showNewGroup} onClose={() => setShowNewGroup(false)} title="New Group" side="bottom">
        <Input value={newGroupName} onChangeText={setNewGroupName} placeholder="Group name" style={{ marginBottom: t.spacing.md }} />
        <Text style={{ ...p.label9, marginBottom: t.spacing.sm }}>Members</Text>
        <View style={{ maxHeight: 280 }}>
          <FlatList
            data={profiles}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const selected = newGroupMembers.includes(item.id);
              return (
                <Pressable onPress={() => toggleGroupMember(item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
                  <Avatar name={item.fullName} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...p.body, fontFamily: t.font.semibold }}>{item.fullName}</Text>
                    <Text style={p.meta}>{item.department}</Text>
                  </View>
                  {selected ? <Check size={18} color={t.colors.accent} /> : <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: t.colors.border }} />}
                </Pressable>
              );
            }}
          />
        </View>
        <Button label="Create Group" onPress={createGroup} loading={creatingGroup} disabled={!newGroupName.trim() || newGroupMembers.length === 0} fullWidth style={{ marginTop: t.spacing.md }} />
      </Sheet>
    </Screen>
  );
}

function Row({
  title, subtitle, icon, iconBg, photo, initialsText, unread, onPress,
}: {
  title: string; subtitle?: string; icon?: React.ReactNode; iconBg?: string; photo?: string;
  initialsText?: string; unread?: number; onPress: () => void;
}) {
  const t = useTheme();
  const p = usePresets();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBg || t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      ) : (
        <Avatar name={initialsText ? initialsText : title} photo={photo} size={40} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...p.body, fontFamily: t.font.semibold }}>{title}</Text>
        {!!subtitle && <Text numberOfLines={1} style={p.meta}>{subtitle}</Text>}
      </View>
      {!!unread && unread > 0 && (
        <View style={{ minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: 10, color: t.colors.onAccent }}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
