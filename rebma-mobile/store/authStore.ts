import { create } from 'zustand';
import { supabase, type DriverRow } from '../lib/supabaseClient';
import { normalizeDeptCode } from '../utils/departments';

// CurrentUser's fields (rebma-web/src/types/erp.ts) are non-negotiable — every
// screen this app will eventually port consumes them, including isAdmin/
// isSuperAdmin which gate the department switcher and Settings' Control
// Center. The six extras below are what a Profile/Settings screen visibly
// needs. The ~14 remaining HR fields (guarantor x5, performance x6,
// resumeUrl, hrRemarks, passwordHash) are dead weight on a phone — mobile
// HR screens will read those straight from a `profiles` query in their own
// sub-phase, not from this store, and passwordHash should never sit in app
// memory at all. `raw` is the escape hatch so a future screen never needs
// an auth-store schema change to read one more column.
export interface MobileUser {
  id: string;
  fullName: string;
  email: string;
  department: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  photo?: string;
  requiresPasswordReset?: boolean;

  status: string;
  phone?: string;
  ghanaCardId?: string;
  employeeNumber?: string;
  staffCategory?: string;
  address?: string;

  raw: Record<string, unknown>;
}

// Kept as an alias so existing call sites (`useAuthStore().profile`) don't
// all need a rename in this same commit.
export type Profile = MobileUser;

interface AuthState {
  initializing: boolean;
  loading: boolean;
  error: string;
  profile: MobileUser | null;
  driver: DriverRow | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

// rebma-web/src/services/apiClient.ts's login()/me() four distinct
// rejection messages (lines ~324-330), reproduced verbatim.
function statusErrorMessage(status: string): string {
  const s = (status || '').toUpperCase();
  if (s === 'PENDING' || s === 'PENDING_APPROVAL') return 'Your account is pending HR approval.';
  if (s === 'REJECTED') return 'Your account access has been denied.';
  if (s === 'BLOCKED') return 'Your account has been blocked by the CEO. Contact HR if you believe this is a mistake.';
  if (s === 'SUSPENDED') return 'Your account has been suspended.';
  if (s === 'ACTIVE') return '';
  return `Your account status is ${status}.`;
}

// The single mapping choke point for mobile — deliberately one, given this
// project's own repeated warnings elsewhere about multi-mapper drift
// (isSpecialCustomer / staffList bugs on rebma-web).
function mapProfileToMobile(row: any): MobileUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || '',
    department: normalizeDeptCode(row.role || row.department || ''),
    isAdmin: row.is_admin ?? (String(row.role || '').toUpperCase() === 'CEO'),
    isSuperAdmin: row.is_super_admin ?? false,
    photo: row.photo || undefined,
    requiresPasswordReset: row.requires_password_reset ?? undefined,
    status: row.status,
    phone: row.phone || undefined,
    ghanaCardId: row.ghana_card_id || undefined,
    employeeNumber: row.employee_number || undefined,
    staffCategory: row.staff_category || undefined,
    address: row.address || undefined,
    raw: row,
  };
}

async function loadProfileAndDriver(userId: string): Promise<{ profile: MobileUser | null; driver: DriverRow | null; error?: string }> {
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profileRow) {
    return { profile: null, driver: null, error: 'No profile found for this account.' };
  }
  const statusMsg = statusErrorMessage(profileRow.status);
  if (statusMsg) {
    return { profile: null, driver: null, error: statusMsg };
  }

  // CEO Control Center — "Mobile App Access": a master switch plus
  // per-user email exceptions (ceo_feature_exceptions, feature_key =
  // 'mobile_app_access_allowed'), the same master-switch-plus-exception
  // mechanism already used for Spreadsheets access on web. Checked on
  // every sign-in AND every session restore, so revoking access takes
  // effect the next time the app is opened, not just on a fresh login.
  try {
    const [{ data: setting }, { data: exception }] = await Promise.all([
      supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'mobile_app_access_allowed').maybeSingle(),
      profileRow.email
        ? supabase.from('ceo_feature_exceptions').select('allowed').eq('feature_key', 'mobile_app_access_allowed').eq('user_email', String(profileRow.email).toLowerCase()).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const masterAllowed = setting?.setting_value !== false;
    const allowed = exception ? !!exception.allowed : masterAllowed;
    if (!allowed) {
      return { profile: null, driver: null, error: 'Mobile app access for your account has been disabled by the CEO.' };
    }
  } catch {
    // A failed check degrades to allowed, matching this codebase's
    // standing pattern of never blocking login on a secondary lookup
    // failing (same reasoning as the driver lookup below).
  }

  const profile = mapProfileToMobile(profileRow);

  // Unconditional — matches rebma-web's App.tsx driver-detection-on-every-
  // session-load pattern exactly (no role/department condition at all).
  // Driver identity outranks department; a driver account with ANY role
  // string still gets routed to the tracking screen, not the department
  // shell. Wrapped in try/catch so a `drivers` lookup failure degrades to
  // driver:null rather than blocking login, same as web.
  let driver: DriverRow | null = null;
  try {
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id, driver_id, full_name, phone, vehicle_id, status, user_id')
      .eq('user_id', userId)
      .maybeSingle();
    driver = driverRow || null;
  } catch {
    driver = null;
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
      // Surface the reason rather than dropping it — a restored session
      // belonging to a just-suspended account should say why it bounced,
      // not bounce silently to a blank login screen.
      set({ initializing: false, profile: null, driver: null, error: error || '' });
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
