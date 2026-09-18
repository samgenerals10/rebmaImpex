// rebma-mobile/screens/MessengerChannelsScreen.tsx
// Phase 11.0 — mobile's real Messenger, channel list. Ports:
// rebma-web/src/components/collaborative/Messenger.tsx's sidebar.
// Reachable from AppHeader's new chat icon (any department) rather than
// nested under one department — messaging isn't department-scoped.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MessageSquare, Plus, Search, Users, X, Check, BellOff, Bell, MoreVertical, Pin, Archive, EyeOff, Trash2, Video } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { messenger, type Channel } from '../lib/messenger';
import { subscribeToLiveUsers, type PresencePayload } from '../lib/presence';
import { getCeoSetting } from '../lib/ceoSetting';
import { checkChatGate, sendChatInvite, fetchPendingInvitesToMe, respondToInvite, type IncomingInvite } from '../lib/chatAccess';
import { UserPlus } from 'lucide-react-native';
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

export default function MessengerChannelsScreen({ navigation, onOpenBoardroom }: any) {
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
  const [mutedChannelIds, setMutedChannelIds] = useState<Set<string>>(new Set());
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [groupPhotoUrls, setGroupPhotoUrls] = useState<Record<string, string>>({});
  const [inviteGateFor, setInviteGateFor] = useState<{ contact: Profile; status?: 'pending' | 'denied' } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<IncomingInvite[]>([]);
  const [invitesSheetOpen, setInvitesSheetOpen] = useState(false);
  // Phase 11.6 — pin/archive/filter/global search.
  const [pinnedChannelIds, setPinnedChannelIds] = useState<Set<string>>(new Set());
  const [archivedChannelIds, setArchivedChannelIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'unread' | 'pinned' | 'muted'>('all');
  const [rowMenuFor, setRowMenuFor] = useState<Channel | null>(null);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [searchingGlobally, setSearchingGlobally] = useState(false);
  const [search, setSearch] = useState('');
  // Security/gap audit fix — these channel-type toggles were never
  // enforced on mobile's sidebar at all (web already gates every one of
  // these sections on them via useCeoSettings).
  const [globalChatEnabled, setGlobalChatEnabled] = useState(true);
  const [departmentChatEnabled, setDepartmentChatEnabled] = useState(true);
  const [directMessagesEnabled, setDirectMessagesEnabled] = useState(true);
  useEffect(() => {
    getCeoSetting('global_chat_enabled', true).then(setGlobalChatEnabled);
    getCeoSetting('department_chat_enabled', true).then(setDepartmentChatEnabled);
    getCeoSetting('direct_messages_enabled', true).then(setDirectMessagesEnabled);
  }, []);
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

  useEffect(() => {
    if (!myId) return;
    messenger.fetchMutedChannelIds(myId).then((ids) => setMutedChannelIds(new Set(ids)));
    messenger.fetchPinnedChannelIds(myId).then((ids) => setPinnedChannelIds(new Set(ids)));
    messenger.fetchArchivedChannelIds(myId).then((ids) => setArchivedChannelIds(new Set(ids)));
  }, [myId]);

  const toggleChannelPin = async (channelId: string) => {
    await messenger.toggleChannelPin(channelId, myId);
    setPinnedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId); else next.add(channelId);
      return next;
    });
    setRowMenuFor(null);
  };

  const toggleChannelArchive = async (channelId: string) => {
    await messenger.toggleChannelArchive(channelId, myId);
    setArchivedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId); else next.add(channelId);
      return next;
    });
    setRowMenuFor(null);
  };

  const clearChannelHistory = (channelId: string) => {
    Alert.alert('Clear history?', "This only clears your own view. The other participant(s) keep theirs.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await messenger.clearChannelHistory(channelId, myId); setRowMenuFor(null); } },
    ]);
  };

  const runGlobalSearch = async (query: string) => {
    setGlobalSearchQuery(query);
    if (!query.trim()) { setGlobalSearchResults([]); return; }
    setSearchingGlobally(true);
    const results = await messenger.searchAllMyMessages(myId, query);
    setGlobalSearchResults(results);
    setSearchingGlobally(false);
  };

  // A channel is visible only if it isn't archived (unless explicitly
  // viewing the Archived list), and passes the active filter chip.
  const channelVisible = (channelId: string): boolean => {
    const isArchived = archivedChannelIds.has(channelId);
    if (showArchived) return isArchived;
    if (isArchived) return false;
    if (sidebarFilter === 'unread') return (unreadCounts[channelId] || 0) > 0;
    if (sidebarFilter === 'pinned') return pinnedChannelIds.has(channelId);
    if (sidebarFilter === 'muted') return mutedChannelIds.has(channelId);
    return true;
  };

  // Who's online right now — the same shared presence channel every
  // session already tracks itself on for Live Users (lib/presence.ts).
  useEffect(() => {
    return subscribeToLiveUsers((users: PresencePayload[]) => setOnlineIds(new Set(users.map((u) => u.userId))));
  }, []);

  const toggleMuteChannel = async (channelId: string) => {
    await messenger.toggleMute(channelId, myId);
    setMutedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId); else next.add(channelId);
      return next;
    });
  };

  const markChannelUnread = async (channelId: string) => {
    await messenger.markChannelUnread(channelId, myId);
    messenger.getUnreadCounts().then(setUnreadCounts);
  };

  // Five real options (mark unread / mute / pin / archive / clear) don't
  // fit a plain Alert usably — a Sheet-based menu, same reasoning as
  // MessengerThreadScreen's per-message action menu.
  const openRowMenu = (channel: Channel) => setRowMenuFor(channel);

  const everyoneChannel = channels.find((c) => c.type === 'everyone');
  const groupChannels = channels.filter((c) => c.type === 'group');

  // Phase 11.4 — resolve a signed URL for any group's photo, same bucket
  // signing as every other chat attachment.
  useEffect(() => {
    const paths = groupChannels.filter((c) => c.photo_url && !groupPhotoUrls[c.photo_url]).map((c) => c.photo_url!);
    if (paths.length === 0) return;
    (async () => {
      const entries: Record<string, string> = {};
      for (const path of paths) {
        const url = await messenger.getSignedAttachmentUrl(path);
        if (url) entries[path] = url;
      }
      setGroupPhotoUrls((prev) => ({ ...prev, ...entries }));
    })();
  }, [channels]);

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return profiles;
    return profiles.filter((pr) => pr.fullName.toLowerCase().includes(q) || pr.department.toLowerCase().includes(q) || pr.email.toLowerCase().includes(q));
  }, [profiles, search]);

  const openThread = (channel: Channel, title: string, subtitle: string) => {
    navigation.navigate('MessengerThread', { channelId: channel.id, channelType: channel.type, title, subtitle });
  };

  // Cross-department DMs need an accepted invite first (lib/chatAccess.ts)
  // — same-department chat and CEO/HR/Management/Risk stay free. Already
  // has a channel? Skip the check, an accepted invite (or same-dept/
  // free-tier status) is what got that channel created in the first place.
  const openDm = async (contact: Profile) => {
    const existing = dmChannelByUser[contact.id];
    if (existing) { openThread(existing, contact.fullName, contact.department); return; }
    if (!me) return;

    const gate = await checkChatGate(myId, me.department, contact.id);
    if (!gate.allowed) {
      if (gate.reason === 'blocked_by_them') { Alert.alert("Can't message this person", 'This person has blocked messages from you.'); return; }
      if (gate.reason === 'blocked_by_me') { Alert.alert("You've blocked this person", 'Unblock them from Chat Settings to message them again.'); return; }
      setInviteGateFor({ contact, status: gate.existingInviteStatus });
      return;
    }

    const ch = await messenger.getOrCreateDmChannel(myId, contact.id);
    setDmChannelByUser((prev) => ({ ...prev, [contact.id]: ch }));
    setChannels((prev) => (prev.some((c) => c.id === ch.id) ? prev : [...prev, ch]));
    openThread(ch, contact.fullName, contact.department);
  };

  const sendInvite = async () => {
    if (!inviteGateFor || !me) return;
    try {
      await sendChatInvite(myId, inviteGateFor.contact.id);
      await supabase.from('notifications').insert({
        recipient_id: inviteGateFor.contact.id, title: 'New chat invite',
        message: `${me.fullName} wants to start a chat with you.`, type: 'chat_invite', read: false, created_at: new Date().toISOString(),
      });
      Alert.alert('Invite sent', `${inviteGateFor.contact.fullName} needs to accept before you can chat.`);
    } catch (e: any) {
      Alert.alert('Could not send invite', e.message);
    } finally {
      setInviteGateFor(null);
    }
  };

  const loadPendingInvites = useCallback(() => {
    if (!myId) return;
    fetchPendingInvitesToMe(myId).then(setPendingInvites);
  }, [myId]);

  useEffect(() => { loadPendingInvites(); }, [loadPendingInvites]);
  useFocusEffect(useCallback(() => { loadPendingInvites(); }, [loadPendingInvites]));

  const respondInvite = async (invite: IncomingInvite, accept: boolean) => {
    try {
      await respondToInvite(invite.id, accept);
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (accept) {
        const ch = await messenger.getOrCreateDmChannel(myId, invite.from_user_id);
        setDmChannelByUser((prev) => ({ ...prev, [invite.from_user_id]: ch }));
        setChannels((prev) => (prev.some((c) => c.id === ch.id) ? prev : [...prev, ch]));
      }
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => setInvitesSheetOpen(true)} hitSlop={8} style={{ padding: 6, position: 'relative' }}>
            <UserPlus size={20} color={pendingInvites.length > 0 ? t.colors.accent : t.colors.textMuted} />
            {pendingInvites.length > 0 && (
              <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: t.colors.status.danger.text, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9, fontFamily: t.font.bold, color: '#fff' }}>{pendingInvites.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => setShowNewGroup(true)} hitSlop={8} style={{ padding: 6 }}>
            <Plus size={22} color={t.colors.accent} />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, backgroundColor: t.colors.bgInput, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.smd }}>
            <Search size={15} color={t.colors.textMuted} />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search…"
              style={{ flex: 1, backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, fontSize: t.type.meta11.size }}
            />
          </View>
          {onOpenBoardroom && (
            <Pressable
              onPress={onOpenBoardroom}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.smd, borderRadius: t.radius.pill,
                backgroundColor: t.colors.accentSoft, borderWidth: 1, borderColor: t.colors.accentSoft,
              }}
            >
              <Video size={14} color={t.colors.accent} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.accent }}>Boardroom</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setShowGlobalSearch(true)} hitSlop={8} style={{ padding: 6 }} accessibilityLabel="Search all messages">
            <MessageSquare size={18} color={t.colors.textMuted} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: t.spacing.sm }}>
          {(['all', 'unread', 'pinned', 'muted'] as const).map((f) => (
            <Pressable key={f} onPress={() => setSidebarFilter(f)} style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: t.radius.pill, backgroundColor: sidebarFilter === f ? t.colors.accent : t.colors.bgInput }}>
              <Text style={{ fontFamily: t.font.semibold, fontSize: 10, textTransform: 'capitalize', color: sidebarFilter === f ? t.colors.onAccent : t.colors.textMuted }}>{f}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowArchived((v) => !v)} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: t.radius.pill, backgroundColor: showArchived ? t.colors.accent : t.colors.bgInput }}>
            <Archive size={10} color={showArchived ? t.colors.onAccent : t.colors.textMuted} />
            <Text style={{ fontFamily: t.font.semibold, fontSize: 10, color: showArchived ? t.colors.onAccent : t.colors.textMuted }}>Archived</Text>
          </Pressable>
        </View>
      </View>

      {/* Was a FlatList with one fake "spacer" item whose renderItem drew
          the whole list by hand (Everyone / Groups / People) — real rows
          were never actually virtualized, it was only ever standing in
          for a plain scrollable View, and having it inside <Screen>'s own
          ScrollView triggered React Native's "VirtualizedLists should
          never be nested inside plain ScrollViews" warning. A plain View
          does exactly what this was already doing, with no warning. */}
          <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl }}>
            {globalChatEnabled && everyoneChannel && channelVisible(everyoneChannel.id) && (
              <Row
                title="Everyone"
                subtitle="Company-wide broadcast"
                icon={<Users size={16} color={t.colors.onAccent} />}
                iconBg={t.colors.accent}
                unread={unreadCounts[everyoneChannel.id]}
                muted={mutedChannelIds.has(everyoneChannel.id)}
                pinned={pinnedChannelIds.has(everyoneChannel.id)}
                onPress={() => openThread(everyoneChannel, 'Everyone', 'Company-wide broadcast')}
                onMenu={() => openRowMenu(everyoneChannel)}
              />
            )}
            {departmentChatEnabled && groupChannels.some((ch) => channelVisible(ch.id)) && <Text style={{ ...p.label9, marginTop: t.spacing.md, marginBottom: t.spacing.xs }}>Groups</Text>}
            {departmentChatEnabled && [...groupChannels].filter((ch) => channelVisible(ch.id)).sort((a, b) => Number(pinnedChannelIds.has(b.id)) - Number(pinnedChannelIds.has(a.id))).map((ch) => (
              <Row
                key={ch.id}
                title={ch.name || 'Group'}
                subtitle="Group channel"
                initialsText={initials(ch.name || 'GC')}
                photo={ch.photo_url ? groupPhotoUrls[ch.photo_url] : undefined}
                unread={unreadCounts[ch.id]}
                muted={mutedChannelIds.has(ch.id)}
                pinned={pinnedChannelIds.has(ch.id)}
                onPress={() => openThread(ch, ch.name || 'Group', 'Group channel')}
                onMenu={() => openRowMenu(ch)}
              />
            ))}
            {directMessagesEnabled && <Text style={{ ...p.label9, marginTop: t.spacing.md, marginBottom: t.spacing.xs }}>People</Text>}
            {directMessagesEnabled && filteredContacts.length === 0 && <Text style={{ ...p.meta, paddingVertical: t.spacing.md }}>No one matches your search.</Text>}
            {directMessagesEnabled && [...filteredContacts].sort((a, b) => {
              const da = dmChannelByUser[a.id], db = dmChannelByUser[b.id];
              return Number(db && pinnedChannelIds.has(db.id)) - Number(da && pinnedChannelIds.has(da.id));
            }).filter((c) => { const dm = dmChannelByUser[c.id]; return !dm || channelVisible(dm.id); }).map((c) => {
              const dm = dmChannelByUser[c.id];
              const online = onlineIds.has(c.id);
              return (
                <Row
                  key={c.id}
                  title={c.fullName}
                  subtitle={online ? 'Online' : c.department}
                  photo={undefined}
                  initialsText={initials(c.fullName)}
                  online={online}
                  unread={dm ? unreadCounts[dm.id] : undefined}
                  muted={dm ? mutedChannelIds.has(dm.id) : false}
                  pinned={dm ? pinnedChannelIds.has(dm.id) : false}
                  onPress={() => openDm(c)}
                  onMenu={dm ? () => openRowMenu(dm) : undefined}
                />
              );
            })}
          </View>

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

      {/* Crossing departments — a DM here needs an accepted invite first
          (see lib/chatAccess.ts). Shown instead of opening the chat. */}
      <Sheet open={!!inviteGateFor} onClose={() => setInviteGateFor(null)} title="Invite Needed" side="bottom">
        {inviteGateFor && (
          <View style={{ gap: t.spacing.md }}>
            <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.md }}>
              <Avatar name={inviteGateFor.contact.fullName} size={56} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.textPrimary }}>{inviteGateFor.contact.fullName}</Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textMuted }}>{inviteGateFor.contact.department}</Text>
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textSecondary, textAlign: 'center' }}>
              {inviteGateFor.status === 'pending'
                ? 'You already sent an invite — waiting for them to accept.'
                : inviteGateFor.status === 'denied'
                ? 'Your last invite was declined. You can send another one.'
                : "This person is in a different department. You'll need to send a chat invite, and they'll need to accept it before you can message them."}
            </Text>
            {inviteGateFor.status !== 'pending' && (
              <Button label="Send Invite" onPress={sendInvite} fullWidth />
            )}
          </View>
        )}
      </Sheet>

      {/* Invites sent to me — nothing from a new cross-department sender
          reaches me until I Accept here. */}
      <Sheet open={invitesSheetOpen} onClose={() => setInvitesSheetOpen(false)} title="Chat Invites" side="bottom">
        {pendingInvites.length === 0 ? (
          <Text style={{ textAlign: 'center', fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textMuted, paddingVertical: t.spacing.xl }}>
            No pending invites.
          </Text>
        ) : (
          <View style={{ gap: t.spacing.md }}>
            {pendingInvites.map((invite) => (
              <View key={invite.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <Avatar name={invite.fromName} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{invite.fromName}</Text>
                  <Text style={p.meta}>{invite.fromDepartment} · wants to chat</Text>
                </View>
                <Pressable onPress={() => respondInvite(invite, true)} style={{ padding: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.accentSoft }}>
                  <Check size={16} color={t.colors.accent} />
                </Pressable>
                <Pressable onPress={() => respondInvite(invite, false)} style={{ padding: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.bgInput }}>
                  <X size={16} color={t.colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Sheet>

      <Sheet open={!!rowMenuFor} onClose={() => setRowMenuFor(null)} title={rowMenuFor?.name || 'Everyone'} side="bottom">
        {rowMenuFor && (
          <>
            <ActionRow icon={<Bell size={16} color={t.colors.textPrimary} />} label="Mark as unread" onPress={() => markChannelUnread(rowMenuFor.id)} />
            <ActionRow
              icon={mutedChannelIds.has(rowMenuFor.id) ? <Bell size={16} color={t.colors.textPrimary} /> : <BellOff size={16} color={t.colors.textPrimary} />}
              label={mutedChannelIds.has(rowMenuFor.id) ? 'Unmute' : 'Mute'}
              onPress={() => toggleMuteChannel(rowMenuFor.id)}
            />
            <ActionRow
              icon={<Pin size={16} color={t.colors.textPrimary} />}
              label={pinnedChannelIds.has(rowMenuFor.id) ? 'Unpin' : 'Pin'}
              onPress={() => toggleChannelPin(rowMenuFor.id)}
            />
            <ActionRow
              icon={<Archive size={16} color={t.colors.textPrimary} />}
              label={archivedChannelIds.has(rowMenuFor.id) ? 'Unarchive' : 'Archive'}
              onPress={() => toggleChannelArchive(rowMenuFor.id)}
            />
            <ActionRow icon={<Trash2 size={16} color={t.colors.status.danger.text} />} label="Clear history" danger onPress={() => clearChannelHistory(rowMenuFor.id)} />
          </>
        )}
      </Sheet>

      <Sheet open={showGlobalSearch} onClose={() => { setShowGlobalSearch(false); setGlobalSearchQuery(''); setGlobalSearchResults([]); }} title="Search Messages" side="bottom">
        <Input
          value={globalSearchQuery}
          onChangeText={runGlobalSearch}
          placeholder="Search across all your conversations…"
          autoFocus
          style={{ marginBottom: t.spacing.md }}
        />
        {searchingGlobally && <Text style={p.meta}>Searching…</Text>}
        {!searchingGlobally && globalSearchQuery.trim() && globalSearchResults.length === 0 && (
          <Text style={{ ...p.meta, paddingVertical: t.spacing.md }}>No messages found.</Text>
        )}
        <View style={{ maxHeight: 360 }}>
          <FlatList
            data={globalSearchResults}
            keyExtractor={(item, idx) => item.id || String(idx)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  const ch = channels.find((c) => c.id === item.channel_id);
                  setShowGlobalSearch(false);
                  setGlobalSearchQuery('');
                  setGlobalSearchResults([]);
                  if (ch) openThread(ch, ch.name || (ch.type === 'everyone' ? 'Everyone' : 'Conversation'), ch.type === 'group' ? 'Group channel' : '');
                  else navigation.navigate('MessengerThread', { channelId: item.channel_id, channelType: 'dm', title: 'Conversation', subtitle: '' });
                }}
                style={{ paddingVertical: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border }}
              >
                <Text style={{ ...p.body, fontFamily: t.font.semibold }}>{item.sender || 'Unknown'}</Text>
                <Text numberOfLines={2} style={p.meta}>{item.content}</Text>
              </Pressable>
            )}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function ActionRow({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.sm }}>
      {icon}
      <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: danger ? t.colors.status.danger.text : t.colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

function Row({
  title, subtitle, icon, iconBg, photo, initialsText, online, unread, muted, pinned, onPress, onMenu,
}: {
  title: string; subtitle?: string; icon?: React.ReactNode; iconBg?: string; photo?: string;
  initialsText?: string; online?: boolean; unread?: number; muted?: boolean; pinned?: boolean; onPress: () => void; onMenu?: () => void;
}) {
  const t = useTheme();
  const p = usePresets();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm, flex: 1 }}>
        {icon ? (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBg || t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
        ) : (
          <View>
            <Avatar name={initialsText ? initialsText : title} photo={photo} size={40} />
            {online && <View style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.status.success.text, borderWidth: 2, borderColor: t.colors.bgPage }} />}
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {pinned && <Pin size={11} color={t.colors.accent} />}
            <Text numberOfLines={1} style={{ ...p.body, fontFamily: t.font.semibold }}>{title}</Text>
            {muted && <BellOff size={11} color={t.colors.textMuted} />}
          </View>
          {!!subtitle && <Text numberOfLines={1} style={p.meta}>{subtitle}</Text>}
        </View>
        {!!unread && unread > 0 && (
          <View style={{ minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: 10, color: t.colors.onAccent }}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </Pressable>
      {onMenu && (
        <Pressable onPress={onMenu} hitSlop={8} style={{ padding: 6 }}>
          <MoreVertical size={15} color={t.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}
