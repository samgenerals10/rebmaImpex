// Notification sound player using Web Audio API — no external files needed

export type NotificationSoundType = 'default' | 'ping' | 'bell' | 'soft' | 'silent' | 'alert';

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _ctx;
}

// Volume storage
const VOLUME_KEY = 'rebma-notification-volume';
export function getSavedVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    const n = v !== null ? parseFloat(v) : 0.7;
    return isNaN(n) ? 0.7 : Math.max(0, Math.min(1, n));
  } catch { return 0.7; }
}
export function saveVolume(vol: number): void {
  try { localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(1, vol)))); } catch {}
}

// Repeating alert — stored so it can be stopped
let _alertInterval: ReturnType<typeof setInterval> | null = null;
let _alertActive = false;
// Track which notification ID triggered the current alert (null = triggered by local toast)
let _alertNotifId: string | null = null;

/** Set the notification ID that owns the current alert sound. */
export function setAlertNotifId(id: string | null): void {
  _alertNotifId = id;
}

/**
 * Stop the repeating alert.
 * If `notifId` is provided, only stops when it matches the ID that started the alert
 * (so clicking a different notification doesn't kill someone else's sound).
 */
export function stopAlertSound(notifId?: string): void {
  if (notifId !== undefined && _alertNotifId !== null && _alertNotifId !== notifId) return;
  if (_alertInterval !== null) {
    clearInterval(_alertInterval);
    _alertInterval = null;
  }
  _alertActive = false;
  _alertNotifId = null;
}

function playOnce(sound: Exclude<NotificationSoundType, 'silent' | 'alert'>, volume: number): void {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    masterGain.connect(ctx.destination);

    if (sound === 'default') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(520, ctx.currentTime + 0.15);
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.4 * volume, ctx.currentTime + 0.05);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);

    } else if (sound === 'ping') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      masterGain.gain.setValueAtTime(0.5 * volume, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);

    } else if (sound === 'bell') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1047, ctx.currentTime);
      const g1 = ctx.createGain();
      const g2 = ctx.createGain();
      g1.gain.setValueAtTime(0.5 * volume, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      g2.gain.setValueAtTime(0.2 * volume, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(g1); g1.connect(masterGain);
      osc2.connect(g2); g2.connect(masterGain);
      masterGain.gain.setValueAtTime(1, ctx.currentTime);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 0.5);

    } else if (sound === 'soft') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.3 * volume, ctx.currentTime + 0.1);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch { /* Web Audio not supported */ }
}

function playAlertBeep(volume: number): void {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    g.gain.setValueAtTime(0.3 * volume, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    osc.connect(g);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export function playNotificationSound(sound: NotificationSoundType, volume?: number): void {
  const vol = volume ?? getSavedVolume();

  if (sound === 'silent') {
    if (navigator.vibrate) navigator.vibrate(200);
    return;
  }

  if (sound === 'alert') {
    // Stop any existing alert loop first
    stopAlertSound();
    _alertActive = true;
    playAlertBeep(vol);
    // Repeat every 1.5 seconds until stopAlertSound() is called
    _alertInterval = setInterval(() => {
      if (!_alertActive) { stopAlertSound(); return; }
      playAlertBeep(vol);
    }, 1500);
    return;
  }

  playOnce(sound, vol);
}

export function isAlertActive(): boolean {
  return _alertActive;
}

// Sound preference storage
const STORAGE_KEY = 'rebma-notification-sound';

export function getSavedSound(): NotificationSoundType {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && ['default','ping','bell','soft','silent','alert'].includes(v)) return v as NotificationSoundType;
  } catch {}
  return 'default';
}

export function saveSound(sound: NotificationSoundType): void {
  try { localStorage.setItem(STORAGE_KEY, sound); } catch {}
}
