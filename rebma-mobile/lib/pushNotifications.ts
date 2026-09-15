// rebma-mobile/lib/pushNotifications.ts
//
// Phase 7.12, D126-D128: genuinely new, end-to-end push infrastructure —
// confirmed by an exhaustive repo-wide grep across both rebma-web and
// rebma-mobile (zero real matches for expo-notifications/push_token/
// device_token/fcm/apns/ExponentPushToken) that no push infrastructure
// exists anywhere in this codebase before this phase.
//
// Registration flow: request permission, fetch the Expo push token (needs
// a real EAS projectId from app.json's extra.eas.projectId — see D130,
// this cannot be exercised for real until the user runs `eas init`),
// upsert into the new `push_tokens` table (supabase_push_tokens.sql).
//
// D130 — three independent, confirmed blockers to real end-to-end
// verification, none silently worked around:
//   1. No EAS login on this machine -> no real projectId.
//   2. Supabase access is billing-blocked (standing constraint) -> the
//      push_tokens table + the Database Webhook are both unreachable.
//   3. Expo Go itself cannot receive remote push on Android from SDK 53
//      onward -> real Android testing needs a dev build regardless,
//      which is itself gated on #1.
// registerForPushNotifications() below degrades safely when any of these
// aren't cleared yet: it returns null rather than throwing, and logs a
// clear reason so a future run can tell what's still blocking it.
//
// Real regression found running this on Expo Go under SDK 57, not a D130
// blocker: `expo-notifications` runs an unconditional, un-catchable
// module-load side effect on Android (DevicePushTokenAutoRegistration.fx.ts
// calls addPushTokenListener() at import time, which throws when it
// detects Expo Go — SDK 53+ removed remote-push support there). A
// try/catch around this module's OWN code can't help, since the throw
// happens during `import * as Notifications from 'expo-notifications'`
// itself, before any of this file's own code runs at all. Fixed by never
// statically importing the package — it's dynamically imported only
// inside functions that need it, and only after confirming we're not
// running inside Expo Go.
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

// Lazily loaded and cached — never touched at all when running in Expo
// Go, which is what avoids the crash (a dynamic import still evaluates
// the module's own top-level side effects the first time it resolves,
// same as a static one would).
let notificationsModule: typeof import('expo-notifications') | null = null;
async function loadNotifications() {
  if (isExpoGo()) return null;
  if (!notificationsModule) {
    try {
      notificationsModule = await import('expo-notifications');
      notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch (e) {
      console.log('[push] expo-notifications failed to load, push notifications will be unavailable this session:', e);
      return null;
    }
  }
  return notificationsModule;
}

export interface PushRegistrationResult {
  token: string | null;
  reason?: string;
}

/**
 * Requests permission, fetches the Expo push token, and upserts it into
 * `push_tokens` for the given user. Returns { token: null, reason } on
 * any of the three D130 blockers instead of throwing — this is expected,
 * ordinary state until the user clears them, not an error condition.
 */
export async function registerForPushNotifications(userId: string): Promise<PushRegistrationResult> {
  if (isExpoGo()) {
    return { token: null, reason: 'Push notifications are not available in Expo Go on SDK 53+ — this needs a real installed build (eas build), not the Expo Go app.' };
  }

  if (!Device.isDevice) {
    return { token: null, reason: 'Push notifications require a physical device (or a real push-capable simulator), not this environment.' };
  }

  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
  if (!projectId) {
    return { token: null, reason: 'No EAS projectId configured yet — run `eas init` under a logged-in Expo account, then add extra.eas.projectId to app.json (D130 blocker #1).' };
  }

  const Notifications = await loadNotifications();
  if (!Notifications) {
    return { token: null, reason: 'expo-notifications could not be loaded.' };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return { token: null, reason: 'Notification permission was not granted.' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#22c55e',
    });
  }

  let expoPushToken: string;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    expoPushToken = data;
  } catch (e: any) {
    return { token: null, reason: `getExpoPushTokenAsync failed: ${e?.message || 'unknown error'}` };
  }

  try {
    const { error } = await supabase.from('push_tokens').upsert(
      { user_id: userId, token: expoPushToken, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );
    if (error) {
      return { token: expoPushToken, reason: `Token fetched but the push_tokens upsert failed (likely D130 blocker #2 — Supabase access): ${error.message}` };
    }
  } catch (e: any) {
    return { token: expoPushToken, reason: `Token fetched but the push_tokens upsert threw: ${e?.message || 'unknown error'}` };
  }

  return { token: expoPushToken };
}
