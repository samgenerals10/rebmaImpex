// rebma-mobile/screens/boardroom/VideoConfScreen.tsx
// Ports: rebma-web/src/views/BoardroomView.tsx's VideoConf branch (lines
// 323-390) — D76/D77/D78, and screens.home for BOARDROOM (mirrors the
// default-subtab pattern every other department's registry entry uses).
// Inline WebView (not JitsiCallSheet's modal — matches web's own two
// different embeddings: a persistent iframe here vs. a modal overlay for
// Meetings' ad-hoc joins) pointed at the same static, hardcoded
// company-wide Jitsi room web uses. The Live Meeting Minutes Editor is
// ported as a real but genuinely non-persisted local textarea, matching
// web's actual behavior exactly (confirmed by direct source read:
// boardroomMinutes has zero backing Supabase call anywhere in App.tsx) —
// web's own inaccurate "auto-syncs to database" claim is dropped from the
// copy. The "Active Presence" panel (4 hardcoded fake people) is dropped
// entirely (D78) — nothing real to port.
import { useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Video } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import SectionHeader from '../../components/ui/SectionHeader';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

const ROOM_URL = 'https://meet.jit.si/RembaImpexGhanaExecutiveBoardroom_101';

export default function VideoConfScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const dept = getDepartmentEntry('BOARDROOM');
  const [minutes, setMinutes] = useState('');

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.md }}>
            <Video size={16} color={t.colors.accent} />
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Secure Jitsi Video Stream</Text>
          </View>
          <View style={{ height: 320, borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: '#000' }}>
            <WebView
              source={{ uri: ROOM_URL }}
              style={{ flex: 1 }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
            />
          </View>
        </Card>

        <Card>
          <SectionHeader title="Live Meeting Minutes Editor" subtitle="Local to this device for this session — not shared or saved." />
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
    </Screen>
  );
}
