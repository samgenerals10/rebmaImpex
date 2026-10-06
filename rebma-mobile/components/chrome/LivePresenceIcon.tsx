// rebma-mobile/components/chrome/LivePresenceIcon.tsx
//
// Phone twin of the web top bar's Live chip (LivePresenceButton.tsx): a
// badge with how many people are online, and a sheet listing them. For
// the CEO and admins each person, and "Open Live Users", goes to the Live
// Users page where they can act; for everyone else tapping a person opens
// a chat with them.
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Radio, ChevronRight } from 'lucide-react-native';
import { subscribeToLiveUsers, type PresencePayload } from '../../lib/presence';
import { messenger } from '../../lib/messenger';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useTheme } from '../../theme/ThemeProvider';
import { navigationRef } from '../../navigation/navigationRef';
import { Alert } from '../../lib/appAlert';
import Avatar from '../ui/Avatar';
import Sheet from '../ui/Sheet';

function since(iso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

export default function LivePresenceIcon({ iconStyle, badgeStyle, badgeTextStyle, borderColor }: { iconStyle: any; badgeStyle: any; badgeTextStyle: any; borderColor: string }) {
  const t = useTheme();
  const me = useAuthStore((s) => s.profile);
  const [users, setUsers] = useState<PresencePayload[]>([]);
  const [open, setOpen] = useState(false);
  const canManage = !!me?.isAdmin || String(me?.department || '').toUpperCase() === 'CEO';

  useEffect(() => subscribeToLiveUsers(setUsers), []);

  const openLiveUsers = () => {
    setOpen(false);
    useUIStore.getState().setActiveDepartment('CEO');
    if (!navigationRef.isReady()) return;
    (navigationRef.navigate as any)('HomeTab');
    // The CEO pages mount after the department switch, then open Live Users.
    setTimeout(() => { if (navigationRef.isReady()) (navigationRef.navigate as any)('LiveUsers'); }, 200);
  };

  const pick = async (u: PresencePayload) => {
    if (canManage) return openLiveUsers();
    if (!me || u.userId === me.id) return;
    setOpen(false);
    try {
      const channel = await messenger.getOrCreateDmChannel(me.id, u.userId);
      if (navigationRef.isReady()) {
        (navigationRef.navigate as any)('Messenger', { screen: 'MessengerThread', params: { channelId: channel.id, channelType: 'dm', title: u.fullName, subtitle: u.department } });
      }
    } catch (e: any) {
      Alert.alert('Could not open the chat', e.message);
    }
  };

  const now = Date.now();
  const sorted = [...users].sort((a, b) => (a.userId === me?.id ? -1 : b.userId === me?.id ? 1 : a.fullName.localeCompare(b.fullName)));

  return (
    <>
      <Pressable hitSlop={8} onPress={() => setOpen(true)} style={iconStyle} accessibilityLabel={`${users.length} online`}>
        <Radio size={18} color="#FFFFFF" />
        {users.length > 0 && (
          <View style={[badgeStyle, { borderColor }]}>
            <Text style={badgeTextStyle} numberOfLines={1}>{users.length > 9 ? '9+' : users.length}</Text>
          </View>
        )}
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title="Online now" subtitle={`${users.length} ${users.length === 1 ? 'person' : 'people'} on web and phone`} side="bottom">
        <View style={{ gap: 4, paddingBottom: 8 }}>
          {sorted.length === 0 ? (
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: 20 }}>No one is online right now.</Text>
          ) : sorted.map((u) => (
            <Pressable key={u.userId} onPress={() => pick(u)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12, backgroundColor: pressed ? t.colors.accentSoft : 'transparent' })}>
              <View>
                <Avatar name={u.fullName} photo={u.photo || undefined} size={40} />
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: t.colors.bgCard }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>{u.fullName}{u.userId === me?.id ? ' (you)' : ''}</Text>
                <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textMuted }} numberOfLines={1}>{u.department}{u.role ? `, ${u.role}` : ''} · {since(u.loggedInAt, now)}</Text>
              </View>
              {(canManage || u.userId !== me?.id) && <ChevronRight size={16} color={t.colors.textMuted} />}
            </Pressable>
          ))}
          {canManage && (
            <Pressable onPress={openLiveUsers} style={{ marginTop: 8, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: t.colors.border }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.accent }}>Open Live Users</Text>
            </Pressable>
          )}
        </View>
      </Sheet>
    </>
  );
}
