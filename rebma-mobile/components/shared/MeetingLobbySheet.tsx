// rebma-mobile/components/shared/MeetingLobbySheet.tsx
//
// Phone twin of the web app's MeetingLobby.tsx: the screen before a
// meeting, as in Zoom, Teams or Google Meet. Check your camera, choose
// whether to go in with the camera and microphone on, and (when starting)
// name the meeting, invite people and share the code. Nothing joins until
// "Start meeting" or "Join now" is pressed. The preview uses the phone's
// own camera view, so it works even before a full app build.
import { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { Mic, MicOff, Video, VideoOff, Copy, Check, X, Search, Users } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface LobbyPerson { id: string; fullName: string; department: string; photo?: string | null }

interface Props {
  mode: 'start' | 'join';
  title: string;
  code: string;
  myName: string;
  people?: LobbyPerson[];
  onCancel: () => void;
  onConfirm: (choice: { title: string; inviteeIds: string[]; micOn: boolean; camOn: boolean }) => Promise<void> | void;
}

const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function MeetingLobbySheet({ mode, title: initialTitle, code, myName, people = [], onCancel, onConfirm }: Props) {
  const t = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [title, setTitle] = useState(initialTitle);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<'code' | 'invite' | null>(null);
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => !q || p.fullName.toLowerCase().includes(q) || p.department.toLowerCase().includes(q)).slice(0, 50);
  }, [people, search]);

  const invitation = `${myName} is inviting you to "${title || initialTitle}" on REBMA IMPEX.\nJoin from Viber, then Boardroom, then Meetings, or enter this code: ${code}`;
  const copy = async (what: 'code' | 'invite') => {
    await Clipboard.setStringAsync(what === 'code' ? code : invitation);
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  const confirm = async () => {
    setBusy(true);
    try { await onConfirm({ title: title.trim() || initialTitle, inviteeIds: invitees, micOn, camOn }); }
    finally { setBusy(false); }
  };

  const toggle = (on: boolean) => ({ width: 54, height: 54, borderRadius: 27, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: on ? 'rgba(255,255,255,0.15)' : '#ef4444' });
  const label = { fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: 6 };
  const outlineBtn = { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: t.colors.border };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bgCard }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: 10, letterSpacing: 2, color: t.colors.textMuted }}>{mode === 'start' ? 'NEW MEETING' : 'READY TO JOIN?'}</Text>
            {mode === 'join' && <Text style={{ fontFamily: t.font.extrabold, fontSize: 18, color: t.colors.textPrimary }} numberOfLines={1}>{initialTitle}</Text>}
          </View>
          <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Close"><X size={22} color={t.colors.textMuted} /></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          {/* Preview */}
          <View style={{ backgroundColor: '#0f172a', borderRadius: 20, padding: 14, gap: 14 }}>
            <View style={{ height: 240, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
              {camOn && permission?.granted ? (
                <CameraView facing="front" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              ) : (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: 26, color: '#fff' }}>{initials(myName)}</Text>
                  </View>
                  {camOn && !permission?.granted ? (
                    <Pressable onPress={requestPermission}><Text style={{ fontFamily: t.font.bold, fontSize: 12, color: '#93c5fd' }}>Allow camera to see yourself</Text></Pressable>
                  ) : <Text style={{ fontFamily: t.font.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Camera is off</Text>}
                </View>
              )}
              <View style={{ position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: 11, color: '#fff' }}>{myName}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
              <Pressable onPress={() => setMicOn((v) => !v)} style={toggle(micOn)} accessibilityLabel={micOn ? 'Turn microphone off' : 'Turn microphone on'}>
                {micOn ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#fff" />}
              </Pressable>
              <Pressable onPress={() => setCamOn((v) => !v)} style={toggle(camOn)} accessibilityLabel={camOn ? 'Turn camera off' : 'Turn camera on'}>
                {camOn ? <Video size={22} color="#fff" /> : <VideoOff size={22} color="#fff" />}
              </Pressable>
            </View>
          </View>

          {mode === 'start' && (
            <View>
              <Text style={label}>Meeting title</Text>
              <TextInput value={title} onChangeText={setTitle} placeholder="What is this meeting about?" placeholderTextColor={t.colors.textMuted}
                style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgInput, fontFamily: t.font.medium, fontSize: 14, color: t.colors.textPrimary }} />
            </View>
          )}

          <View style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: 14, padding: 12, gap: 8 }}>
            <Text style={label}>Meeting code</Text>
            <Text style={{ fontFamily: t.font.medium, fontSize: 12, color: t.colors.textSecondary }} selectable>{code}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => copy('code')} style={outlineBtn}>
                {copied === 'code' ? <Check size={14} color={t.colors.accent} /> : <Copy size={14} color={t.colors.textPrimary} />}
                <Text style={{ fontFamily: t.font.bold, fontSize: 12, color: t.colors.textPrimary }}>{copied === 'code' ? 'Copied' : 'Copy code'}</Text>
              </Pressable>
              <Pressable onPress={() => copy('invite')} style={outlineBtn}>
                {copied === 'invite' ? <Check size={14} color={t.colors.accent} /> : <Copy size={14} color={t.colors.textPrimary} />}
                <Text style={{ fontFamily: t.font.bold, fontSize: 12, color: t.colors.textPrimary }}>{copied === 'invite' ? 'Copied' : 'Copy invitation'}</Text>
              </Pressable>
            </View>
          </View>

          {mode === 'start' && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Users size={14} color={t.colors.textPrimary} />
                <Text style={{ ...label, marginBottom: 0 }}>Invite people</Text>
                {invitees.length > 0 && (
                  <View style={{ minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: 10, color: '#fff' }}>{invitees.length}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgInput, marginBottom: 8 }}>
                <Search size={14} color={t.colors.textMuted} />
                <TextInput value={search} onChangeText={setSearch} placeholder="Search by name or department" placeholderTextColor={t.colors.textMuted}
                  style={{ flex: 1, paddingVertical: 10, fontFamily: t.font.medium, fontSize: 13, color: t.colors.textPrimary }} />
              </View>
              {shown.map((p) => {
                const on = invitees.includes(p.id);
                return (
                  <Pressable key={p.id} onPress={() => setInvitees((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, backgroundColor: on ? t.colors.accentSoft : 'transparent' }}>
                    {p.photo ? <Image source={{ uri: p.photo }} style={{ width: 32, height: 32, borderRadius: 16 }} /> : (
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: t.font.bold, fontSize: 11, color: t.colors.accent }}>{initials(p.fullName)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: 13, color: t.colors.textPrimary }} numberOfLines={1}>{p.fullName}</Text>
                      <Text style={{ fontFamily: t.font.medium, fontSize: 11, color: t.colors.textMuted }} numberOfLines={1}>{p.department}</Text>
                    </View>
                    <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: on ? t.colors.accent : t.colors.border, backgroundColor: on ? t.colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <Check size={13} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })}
              {shown.length === 0 && <Text style={{ fontFamily: t.font.medium, fontSize: 12, color: t.colors.textMuted, textAlign: 'center', paddingVertical: 10 }}>No one matches.</Text>}
            </View>
          )}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: t.colors.border }}>
          <Pressable onPress={onCancel} style={{ paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: t.colors.border }}>
            <Text style={{ fontFamily: t.font.semibold, fontSize: 14, color: t.colors.textSecondary }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={confirm} disabled={busy} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: t.colors.accent, opacity: busy ? 0.6 : 1 }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: 15, color: '#fff' }}>{busy ? 'Starting…' : mode === 'start' ? 'Start meeting' : 'Join now'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
