// rebma-mobile/components/settings/NotificationSoundPicker.tsx
//
// 10 short, distinct tones (assets/sounds/*.wav, generated locally —
// no external sound library) the user can preview and pick from for
// new-alert/new-message notifications. Selection persists via
// ThemeProvider's notificationSound (AsyncStorage, same pattern as
// dark mode/accent color). Tapping a row plays a live preview right
// here via expo-audio, already a dependency (Phase 11.3's voice notes) —
// that part works immediately, no build required. Actually using the
// picked tone as the OS push-notification sound additionally needs an
// EAS build (a bundled JS asset isn't a native notification resource
// under Expo Go) — same standing, already-documented blocker as every
// other EAS-gated capability in this app; not silently glossed over.
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Play, Pause, Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { NOTIFICATION_SOUNDS as SOUNDS } from '../../lib/notificationSounds';

function SoundRow({ id, label, asset, selected, onSelect }: { id: string; label: string; asset: number; selected: boolean; onSelect: () => void }) {
  const t = useTheme();
  const player = useAudioPlayer(asset);
  const status = useAudioPlayerStatus(player);

  const preview = () => {
    player.seekTo(0);
    player.play();
  };

  return (
    <Pressable
      onPress={onSelect}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.border,
      }}
    >
      <Pressable
        onPress={preview}
        hitSlop={8}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: t.colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {status.playing ? <Pause size={14} color={t.colors.accent} /> : <Play size={14} color={t.colors.accent} />}
      </Pressable>
      <Text style={{ flex: 1, fontFamily: selected ? t.font.bold : t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
        {label}
      </Text>
      {selected ? (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={14} color={t.colors.onAccent} strokeWidth={2.5} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function NotificationSoundPicker() {
  const t = useTheme();

  return (
    <View>
      {SOUNDS.map((s) => (
        <SoundRow
          key={s.id}
          id={s.id}
          label={s.label}
          asset={s.asset}
          selected={t.notificationSound === s.id}
          onSelect={() => t.setNotificationSound(s.id)}
        />
      ))}
    </View>
  );
}
