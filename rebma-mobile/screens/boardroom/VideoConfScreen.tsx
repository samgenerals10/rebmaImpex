// rebma-mobile/screens/boardroom/VideoConfScreen.tsx
// Ports: rebma-web/src/views/BoardroomView.tsx's VideoConf branch (lines
// 323-390) — D76/D77/D78, and screens.home for BOARDROOM (mirrors the
// default-subtab pattern every other department's registry entry uses).
//
// No Jitsi, anywhere — the persistent company-wide room now opens a real
// device-camera/mic group call (GroupCallSheet.tsx, mesh WebRTC over
// Supabase Realtime, same primitives as Viber's 1:1 calls). Web's
// always-on inline iframe doesn't map cleanly onto a real camera call —
// a camera needs to actually be requested/granted, and a full-screen
// call view is the honest native shape for that — so this is a "Join
// Boardroom" card that opens the call, not an always-embedded video feed.
//
// The Live Meeting Minutes Editor is ported as a real but genuinely
// non-persisted local textarea, matching web's actual behavior exactly
// (confirmed by direct source read: boardroomMinutes has zero backing
// Supabase call anywhere in App.tsx) — web's own inaccurate "auto-syncs
// to database" claim is dropped from the copy. The "Active Presence"
// panel (4 hardcoded fake people) is dropped entirely (D78) — nothing
// real to port.
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Video } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import SectionHeader from '../../components/ui/SectionHeader';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import GroupCallSheet from '../../components/shared/GroupCallSheet';
import { useAuthStore } from '../../store/authStore';
import MeetingLobbySheet from '../../components/shared/MeetingLobbySheet';

const ROOM_ID = 'RembaImpexGhanaExecutiveBoardroom_101';

export default function VideoConfScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const dept = getDepartmentEntry('BOARDROOM');
  const [minutes, setMinutes] = useState('');
  const [inCall, setInCall] = useState(false);
  // The lobby comes first (camera and mic check), same as the web app.
  const profile = useAuthStore((st) => st.profile);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [callChoice, setCallChoice] = useState({ micOn: true, camOn: true });

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.md }}>
            <Video size={16} color={t.colors.accent} />
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Executive Boardroom</Text>
          </View>
          <Pressable
            onPress={() => setLobbyOpen(true)}
            style={{ height: 160, borderRadius: t.radius.md, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm }}
          >
            <Video size={32} color={t.colors.accent} />
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.accent }}>Join Boardroom</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Company-wide video room</Text>
          </Pressable>
        </Card>

        <Card>
          <SectionHeader title="Live Meeting Minutes Editor" subtitle="Local to this device for this session, not shared or saved." />
          <Input
            value={minutes}
            onChangeText={setMinutes}
            placeholder="Type boardroom updates here..."
            multiline
            numberOfLines={8}
            style={{ minHeight: 160, textAlignVertical: 'top', fontFamily: t.font.regular }}
          />
        </Card>

        <ModuleLauncher dept={dept} exclude={['VideoConf']} onSelect={(id) => navigation.navigate(id)} />
      </View>

      {lobbyOpen && (
        <MeetingLobbySheet
          mode="join" title="Executive Boardroom" code={ROOM_ID} myName={profile?.fullName || 'Me'}
          onCancel={() => setLobbyOpen(false)}
          onConfirm={({ micOn, camOn }) => { setCallChoice({ micOn, camOn }); setLobbyOpen(false); setInCall(true); }}
        />
      )}
      {inCall && (
        <GroupCallSheet room={ROOM_ID} title="Executive Boardroom" startWithCamera={callChoice.camOn} startWithMic={callChoice.micOn} onClose={() => setInCall(false)} />
      )}
    </Screen>
  );
}
