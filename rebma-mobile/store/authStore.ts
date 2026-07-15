import { create } from 'zustand';
import { supabase, type DriverRow } from '../lib/supabaseClient';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  department: string; // profiles.role, uppercased — same convention as rebma-web
  status: string;
}

interface AuthState {
  initializing: boolean;
  loading: boolean;
  error: string;
  profile: Profile | null;
  driver: DriverRow | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

async function loadProfileAndDriver(userId: string): Promise<{ profile: Profile | null; driver: DriverRow | null; error?: string }> {
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, status')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profileRow) {
    return { profile: null, driver: null, error: 'No profile found for this account.' };
  }
  if (profileRow.status !== 'ACTIVE') {
    return { profile: null, driver: null, error: 'This account is not active yet. Contact HR/CEO for approval.' };
  }

  const profile: Profile = {
    id: profileRow.id,
    email: profileRow.email,
    fullName: profileRow.full_name || '',
    department: String(profileRow.role || '').toUpperCase(),
    status: profileRow.status,
  };

  let driver: DriverRow | null = null;
  if (profile.department === 'DISPATCH') {
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id, driver_id, full_name, phone, vehicle_id, status, user_id')
      .eq('user_id', userId)
      .maybeSingle();
    driver = driverRow || null;
  }

  return { profile, driver };
}

export const useAuthStore = create<AuthState>((set) => ({
  initializing: true,
  loading: false,
  error: '',
  profile: null,
  driver: null,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) {
      set({ initializing: false });
      return;
    }
    const { profile, driver, error } = await loadProfileAndDriver(userId);
    if (error || !profile) {
      await supabase.auth.signOut();
      set({ initializing: false, profile: null, driver: null });
      return;
    }
    set({ initializing: false, profile, driver });
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true, error: '' });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        set({ loading: false, error: error?.message || 'Sign in failed.' });
        return;
      }
      const { profile, driver, error: loadErr } = await loadProfileAndDriver(data.user.id);
      if (loadErr || !profile) {
        await supabase.auth.signOut();
        set({ loading: false, error: loadErr || 'Sign in failed.' });
        return;
      }
      set({ loading: false, profile, driver });
    } catch (e: any) {
      set({ loading: false, error: e.message || 'Sign in failed.' });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, driver: null, error: '' });
  },

  clearError: () => set({ error: '' }),
}));
