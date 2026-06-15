// Notification sound player using Web Audio API — no external files needed

export type NotificationSoundType = 'default' | 'ping' | 'bell' | 'soft' | 'silent';

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _ctx;
}

function ramp(gain: GainNode, ctx: AudioContext, value: number, time: number) {
  gain.gain.linearRampToValueAtTime(value, ctx.currentTime + time);
}

export function playNotificationSound(sound: NotificationSoundType): void {
  if (sound === 'silent') {
    if (navigator.vibrate) navigator.vibrate(200);
    return;
  }

  try {
    const ctx = getCtx();
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    if (sound === 'default') {
      // 440 Hz sine wave, 0.3s soft fade
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(520, ctx.currentTime + 0.15);
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);

    } else if (sound === 'ping') {
      // 880 Hz sine wave, 0.1s sharp
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      masterGain.gain.setValueAtTime(0.5, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);

    } else if (sound === 'bell') {
      // 523 Hz (C5) with a decay envelope simulating reverb, 0.5s
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1047, ctx.currentTime); // C6 overtone

      const g1 = ctx.createGain();
      const g2 = ctx.createGain();

      g1.gain.setValueAtTime(0.5, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      g2.gain.setValueAtTime(0.2, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(g1); g1.connect(masterGain);
      osc2.connect(g2); g2.connect(masterGain);
      masterGain.gain.setValueAtTime(1, ctx.currentTime);

      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 0.5);

    } else if (sound === 'soft') {
      // 330 Hz sine wave, 0.4s slow fade
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Web Audio not supported — fail silently
  }
}

const STORAGE_KEY = 'rebma-notification-sound';

export function getSavedSound(): NotificationSoundType {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && ['default','ping','bell','soft','silent'].includes(v)) return v as NotificationSoundType;
  } catch {}
  return 'default';
}

export function saveSound(sound: NotificationSoundType): void {
  try { localStorage.setItem(STORAGE_KEY, sound); } catch {}
}
