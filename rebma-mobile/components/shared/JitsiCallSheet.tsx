// rebma-mobile/components/shared/JitsiCallSheet.tsx
// Ports: rebma-web/src/components/collaborative/JitsiCallModal.tsx (read
// in full) — D76/D82. A real Jitsi Meet embed, parameterized by room
// name, wrapping the new react-native-webview dependency (D76 — the
// first WebView usage in mobile, Expo-Go compatible, no dev client).
// Built as its own lightweight full-screen Modal rather than on top of
// the shared Sheet primitive: Sheet's content area isn't flex-grown by
// default (sized to fit its children), which doesn't suit a WebView that
// needs to claim all remaining vertical space — the same reason web's
// own JitsiCallModal is a bespoke overlay rather than reusing SidePanel.
// Used by MeetingsScreen's "Join" action for dynamic per-meeting rooms;
// VideoConfScreen embeds its own static-room WebView inline instead
// (matching web's own two different embeddings — persistent iframe on
// the VideoConf tab vs. a modal overlay for ad-hoc/meeting joins).
import { Modal, View, Text, Pressable, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { X, Phone, Video } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  room: string;
  title: string;
  kind: 'voice' | 'video';
  onClose: () => void;
}

export default function JitsiCallSheet({ room, title, kind, onClose }: Props) {
  const t = useTheme();
  const src = `https://meet.jit.si/${room}#config.startWithVideoMuted=${kind === 'voice'}&config.startWithAudioMuted=false`;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md, backgroundColor: t.colors.bgCard, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            {kind === 'voice' ? <Phone size={16} color={t.colors.accent} /> : <Video size={16} color={t.colors.accent} />}
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{title}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: t.spacing.xs, borderRadius: t.radius.pill, backgroundColor: t.colors.bgInput }}>
            <X size={18} color={t.colors.textMuted} />
          </Pressable>
        </View>
        <WebView
          source={{ uri: src }}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
        />
      </SafeAreaView>
    </Modal>
  );
}
