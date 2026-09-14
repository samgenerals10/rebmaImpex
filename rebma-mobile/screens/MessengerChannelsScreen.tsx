// rebma-mobile/screens/MessengerChannelsScreen.tsx
// Phase 11.0 — mobile's real Messenger, channel list. Ports:
// rebma-web/src/components/collaborative/Messenger.tsx's sidebar.
// Reachable from AppHeader's new chat icon (any department) rather than
// nested under one department — messaging isn't department-scoped.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MessageSquare, Plus, Search, Users, X, Check, BellOff, Bell, MoreVertical, Pin, Archive, EyeOff, Trash2 } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { messenger, type Channel } from '../lib/messenger';
import { subscribeToLiveUsers, type PresencePayload } from '../lib/presence';
import { getCeoSetting } from '../lib/ceoSetting';
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
  const [mutedChannelIds, setMutedChannelIds] = useState<Set<string>>(new Set());
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [groupPhotoUrls, setGroupPhotoUrls] = useState<Record<string, string>>({});
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.bgInput, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd }}>
            <Search size={16} color={t.colors.textMuted} />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search people, department, email…"
              style={{ flex: 1, backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 }}
            />
          </View>
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

      <FlatList
        data={[{ kind: 'spacer' as const }]}
        keyExtractor={() => 'root'}
        renderItem={() => (
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
