// rebma-mobile/lib/rememberMe.ts
//
// Backs Login's real "Keep me logged in" toggle. Supabase's client here
// is configured with `persistSession: true` (lib/supabaseClient.ts), so
// today every login already survives an app restart unconditionally —
// this preference is what makes turning the toggle off a genuine
// promise: authStore.initialize() checks it before restoring any
// session, and signs out immediately (without ever showing the
// restored profile) when it's off. Default true matches today's
// existing always-persisted behavior for anyone who never touches it.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@rebma/keep_logged_in';

export async function getKeepLoggedIn(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export async function setKeepLoggedIn(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value ? '1' : '0');
  } catch {}
}
