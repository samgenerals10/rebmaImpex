// rebma-mobile/components/shared/callUi.tsx
//
// Phone-style pieces shared by the call screens, the same set the web app
// has (rebma-web/src/components/collaborative/callUi.tsx): the tone you
// hear while calling someone, the ringtone (plus vibration) for an
// incoming call, a running call timer, and the person's photo with
// pulsing rings. Tones reuse the app's own bundled sounds.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, Vibration, View } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../../theme/ThemeProvider';

const RINGBACK = require('../../assets/sounds/pulse.wav');
const RINGTONE = require('../../assets/sounds/marimba.wav');

function useLoopingSound(active: boolean, source: number, vibrate: boolean) {
  useEffect(() => {
    if (!active) return;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    try {
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      player = createAudioPlayer(source);
      player.loop = true;
      player.play();
    } catch {
      player = null; // no sound available; the screen still works
    }
    if (vibrate) Vibration.vibrate([0, 900, 700], true);
    return () => {
      if (vibrate) Vibration.cancel();
      try { player?.pause(); player?.remove(); } catch { /* already freed */ }
    };
  }, [active, source, vibrate]);
}

/** The tone you hear while waiting for someone to pick up. */
export const useRingback = (active: boolean) => useLoopingSound(active, RINGBACK, false);
/** Ringtone and vibration for a call coming in. */
export const useRingtone = (active: boolean) => useLoopingSound(active, RINGTONE, true);

/** Time since `running` became true, as m:ss or h:mm:ss. */
export function useCallTimer(running: boolean): string {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) { setSeconds(0); return; }
    const started = Date.now();
    const iv = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [running]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const initialsOf = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/** The person's photo (or initials), with soft rings pulsing out while ringing. */
export function CallAvatar({ name, photo, size = 128, ringing = false }: { name: string; photo?: string | null; size?: number; ringing?: boolean }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ringing) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [ringing, pulse]);

  const ring = (delay: number) => {
    const v = Animated.modulo(Animated.add(pulse, delay), 1);
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          backgroundColor: 'rgba(255,255,255,0.18)',
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
        }}
      />
    );
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {ringing && ring(0)}
      {ringing && ring(0.5)}
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)' }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)' }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: size * 0.34, color: t.colors.onAccent }}>{initialsOf(name)}</Text>
        </View>
      )}
    </View>
  );
}
