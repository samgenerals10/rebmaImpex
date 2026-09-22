// rebma-mobile/lib/notificationSounds.ts
//
// Single source of truth for the 10 notification tones, shared by
// NotificationSoundPicker.tsx (preview/pick) and PersistentIconRow.tsx
// (actually playing the picked one when a new alert arrives). Metro
// resolves each require() at build time regardless of which file calls
// it, so extracting this list out of the picker doesn't change what
// gets bundled — it just gives both consumers one list to agree on.
export interface NotificationSoundOption {
  id: string;
  label: string;
  asset: number;
}

export const NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  { id: 'chime', label: 'Chime', asset: require('../assets/sounds/chime.wav') },
  { id: 'ding', label: 'Ding', asset: require('../assets/sounds/ding.wav') },
  { id: 'bell', label: 'Bell', asset: require('../assets/sounds/bell.wav') },
  { id: 'pop', label: 'Pop', asset: require('../assets/sounds/pop.wav') },
  { id: 'marimba', label: 'Marimba', asset: require('../assets/sounds/marimba.wav') },
  { id: 'xylophone', label: 'Xylophone', asset: require('../assets/sounds/xylophone.wav') },
  { id: 'pulse', label: 'Pulse', asset: require('../assets/sounds/pulse.wav') },
  { id: 'bloop', label: 'Soft Bloop', asset: require('../assets/sounds/bloop.wav') },
  { id: 'alert', label: 'Alert', asset: require('../assets/sounds/alert.wav') },
  { id: 'whistle', label: 'Whistle', asset: require('../assets/sounds/whistle.wav') },
];
