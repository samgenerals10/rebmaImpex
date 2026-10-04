// rebma-web/src/utils/staffDirectory.ts
//
// Step 4: one staff list for everyone HR deals with.
//   App user     profiles (anyone with an app account, any status)
//   No app       non_app_staff (hired, identified only by employee number)
//   Invited      staff_invites not yet used (link sent, not registered)
// People who were terminated stay in the list as "Former staff" (status
// TERMINATED), because nothing about them or their work is ever deleted.
//
// Also: device enrollments (who is enrolled on which device, under which
// User ID), the CEO's Terminate, and Delete Account requests that HR
// confirms (api/terminate-user.ts, api/account-deletion.ts).
//
// Phone twin: rebma-mobile/lib/staffDirectory.ts. Keep them in step.
import { supabase as typedSupabase } from '../lib/supabaseClient';
import { callPrivilegedApi } from './privilegedApi';

const supabase = typedSupabase as any;

export type PersonKind = 'app' | 'no_app';
export type DirectoryKind = PersonKind | 'invite';

export interface DirectoryRow {
  key: string;
  kind: DirectoryKind;
  id: string;
  fullName: string;
  photo?: string;
  employeeNumber?: string;
  department: string;       // label, e.g. "Accounts Department"
  departmentCode: string;   // as stored, lower case
  role?: string;
  status: string;           // ACTIVE, SUSPENDED, BLOCKED, TERMINATED, PENDING_APPROVAL, INVITED, EXPIRED
  email?: string;
  phone?: string;
  joinedAt: string;         // YYYY-MM-DD
  devices: string[];        // device names they're enrolled on
  isCeo: boolean;
  raw: any;
}

export interface EnrollmentRow {
  id: string;
  deviceId: string;
  deviceName: string;
  personKind: PersonKind;
  personId: string;
  deviceUserId: string;
  source: 'hr' | 'scan';
  enrolledAt: string;
}

const ROLE_TO_DEPT: Record<string, string> = {
  admin_warehouse: 'Admin & Warehouse', operations: 'Admin & Warehouse', dispatch: 'Admin & Warehouse', logistics: 'Admin & Warehouse',
  finance: 'Accounts Department', hr: 'HR', marketing: 'Marketing', receptionist: 'Reception', production: 'Production',
  management: 'Management', risk: 'Risk', ceo: 'CEO',
};
export const deptLabel = (code?: string | null) => (code ? ROLE_TO_DEPT[String(code).toLowerCase()] || String(code) : '');

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active', SUSPENDED: 'Suspended', BLOCKED: 'Blocked', TERMINATED: 'Former staff',
  PENDING_APPROVAL: 'Waiting approval', INVITED: 'Invited', EXPIRED: 'Link expired', REJECTED: 'Denied',
};
export const KIND_LABEL: Record<DirectoryKind, string> = { app: 'App user', no_app: 'No app', invite: 'Invited' };

const dayOf = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '');

export async function loadDirectory(): Promise<DirectoryRow[]> {
  const [profilesRes, othersRes, invitesRes, enrollRes, devicesRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5000),
    supabase.from('non_app_staff').select('*').order('created_at', { ascending: false }).limit(5000),
    supabase.from('staff_invites').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(2000),
    supabase.from('device_enrollments' as any).select('device_id, person_kind, person_id').limit(20000),
    supabase.from('peripheral_devices').select('id, device_name').limit(500),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const deviceName = new Map<string, string>(((devicesRes.data || []) as any[]).map((d) => [d.id, d.device_name]));
  const devicesFor = new Map<string, string[]>();
  for (const e of (enrollRes.data || []) as any[]) {
    const k = `${e.person_kind}:${e.person_id}`;
    const name = deviceName.get(e.device_id);
    if (name) devicesFor.set(k, [...(devicesFor.get(k) || []), name]);
  }

  const rows: DirectoryRow[] = [];
  for (const p of (profilesRes.data || []) as any[]) {
    const isCeo = !!p.is_admin;
    rows.push({
      key: `app:${p.id}`, kind: 'app', id: p.id, fullName: p.full_name || 'Employee', photo: p.photo || undefined,
      employeeNumber: p.employee_number || undefined, department: isCeo ? 'CEO' : deptLabel(p.role), departmentCode: String(p.role || '').toLowerCase(),
      role: isCeo ? 'CEO' : (p.metadata?.role || undefined), status: String(p.status || 'ACTIVE').toUpperCase(),
      email: p.email || undefined, phone: p.phone || undefined, joinedAt: dayOf(p.created_at),
      devices: devicesFor.get(`app:${p.id}`) || [], isCeo, raw: p,
    });
  }
  for (const o of (othersRes.data || []) as any[]) {
    rows.push({
      key: `no_app:${o.id}`, kind: 'no_app', id: o.id, fullName: o.full_name || 'Employee', photo: o.photo || undefined,
      employeeNumber: o.employee_number || undefined, department: deptLabel(o.department), departmentCode: String(o.department || '').toLowerCase(),
      role: o.role || undefined, status: String(o.status || 'ACTIVE').toUpperCase(), phone: o.phone || undefined,
      joinedAt: dayOf(o.created_at), devices: devicesFor.get(`no_app:${o.id}`) || [],
      isCeo: false, raw: o,
    });
  }
  const now = Date.now();
  for (const i of (invitesRes.data || []) as any[]) {
    const expired = i.expires_at && new Date(i.expires_at).getTime() < now;
    rows.push({
      key: `invite:${i.id}`, kind: 'invite', id: i.id, fullName: i.full_name || i.email || 'Invited person', photo: i.photo || undefined,
      department: String(i.department || '').toUpperCase() === 'CEO' ? 'CEO' : deptLabel(i.department), departmentCode: String(i.department || '').toLowerCase(),
      role: i.role || undefined, status: expired ? 'EXPIRED' : 'INVITED', email: i.email || undefined, phone: i.whatsapp_number || i.phone || undefined,
      joinedAt: dayOf(i.created_at), devices: [], isCeo: String(i.department || '').toUpperCase() === 'CEO', raw: i,
    });
  }
  return rows;
}

// ── Terminate (CEO) and Delete Account requests (HR confirms) ────────
export const terminateApi = {
  terminate: (person: { kind: PersonKind; id: string }, password: string) =>
    callPrivilegedApi<{ message: string }>('/api/terminate-user', person.kind === 'no_app' ? { nonAppStaffId: person.id, password } : { userId: person.id, password }),
};

export interface DeletionRequest {
  id: string;
  userId: string;
  fullName: string;
  department: string | null;
  reason: string;
  confirmer: 'HR' | 'CEO';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  note: string | null;
  decidedByName: string | null;
  createdAt: string;
}

const mapDeletion = (r: any): DeletionRequest => ({
  id: r.id, userId: r.user_id, fullName: r.full_name || 'Staff member', department: r.department || null, reason: r.reason || '',
  confirmer: r.confirmer === 'CEO' ? 'CEO' : 'HR', status: r.status, note: r.note || null, decidedByName: r.decided_by_name || null, createdAt: r.created_at,
});

export async function listPendingDeletionRequests(): Promise<DeletionRequest[]> {
  const { data, error } = await (supabase.from('account_deletion_requests' as any) as any)
    .select('*').eq('status', 'pending').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapDeletion);
}

// The signed-in person's latest request, if any (shown in Settings).
export async function getMyDeletionRequest(userId: string): Promise<DeletionRequest | null> {
  const { data } = await (supabase.from('account_deletion_requests' as any) as any)
    .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
  return data?.[0] ? mapDeletion(data[0]) : null;
}

export const deletionApi = {
  request: (reason: string, password: string) => callPrivilegedApi<{ message: string }>('/api/account-deletion', { action: 'request', reason, password }),
  cancel: (requestId: string) => callPrivilegedApi<{ message: string }>('/api/account-deletion', { action: 'cancel', requestId }),
  approve: (requestId: string, password: string) => callPrivilegedApi<{ message: string }>('/api/account-deletion', { action: 'approve', requestId, password }),
  reject: (requestId: string, password: string, note?: string) => callPrivilegedApi<{ message: string }>('/api/account-deletion', { action: 'reject', requestId, password, note }),
};

// ── Same department and role: was someone here before? ────────────────
// People terminated from this department and role. When HR hires into it,
// HR chooses "Continue previous work" (their open work becomes the new
// person's once approved, api/approve-user.ts) or "Start new". Only app
// users can have open work in the app, so only they are offered.
export interface PreviousHolder { id: string; name: string; leftOn: string }

export async function findPreviousHolders(departmentCode: string, role: string): Promise<PreviousHolder[]> {
  if (!departmentCode || !role) return [];
  const { data } = await supabase.from('profiles').select('id, full_name, role, metadata, updated_at, status')
    .eq('status', 'TERMINATED').ilike('role', departmentCode);
  return ((data || []) as any[])
    .filter((p) => String(p.metadata?.role || '').trim().toLowerCase() === role.trim().toLowerCase())
    .map((p) => ({ id: p.id, name: p.full_name || 'Former staff member', leftOn: String(p.updated_at || '').slice(0, 10) }));
}

// ── Department change requests (the CEO approves first) ─────────────────
export interface DepartmentChangeRequest {
  id: string;
  userId: string;
  fullName: string;
  fromDepartment: string | null;
  toDepartment: string;
  toRole: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  note: string | null;
  createdAt: string;
}

const mapDeptChange = (r: any): DepartmentChangeRequest => ({
  id: r.id, userId: r.user_id, fullName: r.full_name || 'Staff member', fromDepartment: r.from_department || null,
  toDepartment: r.to_department, toRole: r.to_role || null, reason: r.reason || '', status: r.status, note: r.note || null, createdAt: r.created_at,
});

export async function listPendingDepartmentChanges(): Promise<DepartmentChangeRequest[]> {
  const { data, error } = await (supabase.from('department_change_requests' as any) as any)
    .select('*').eq('status', 'pending').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapDeptChange);
}

export async function getMyDepartmentChange(userId: string): Promise<DepartmentChangeRequest | null> {
  const { data } = await (supabase.from('department_change_requests' as any) as any)
    .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
  return data?.[0] ? mapDeptChange(data[0]) : null;
}

export const departmentChangeApi = {
  request: (toDepartment: string, toRole: string, reason: string) =>
    callPrivilegedApi<{ message: string }>('/api/department-change', { action: 'request', toDepartment, toRole, reason }),
  cancel: (requestId: string) => callPrivilegedApi<{ message: string }>('/api/department-change', { action: 'cancel', requestId }),
  approve: (requestId: string, password: string) => callPrivilegedApi<{ message: string }>('/api/department-change', { action: 'approve', requestId, password }),
  reject: (requestId: string, password: string) => callPrivilegedApi<{ message: string }>('/api/department-change', { action: 'reject', requestId, password }),
};

// Departments someone can ask to move to (code as the server expects it).
export const MOVABLE_DEPARTMENTS: { code: string; label: string }[] = [
  { code: 'admin_warehouse', label: 'Admin & Warehouse' }, { code: 'finance', label: 'Accounts Department' },
  { code: 'hr', label: 'HR' }, { code: 'marketing', label: 'Marketing' }, { code: 'receptionist', label: 'Reception' },
  { code: 'production', label: 'Production' }, { code: 'management', label: 'Management' }, { code: 'risk', label: 'Risk' },
];

// ── Device enrollments ─────────────────────────────────────────────────
export async function listEnrollments(personKind: PersonKind, personId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await (supabase.from('device_enrollments' as any) as any)
    .select('id, device_id, person_kind, person_id, device_user_id, source, enrolled_at, peripheral_devices(device_name)')
    .eq('person_kind', personKind).eq('person_id', personId).order('enrolled_at');
  if (error) throw new Error(error.message);
  return ((data || []) as any[]).map((e) => ({
    id: e.id, deviceId: e.device_id, deviceName: e.peripheral_devices?.device_name || 'Device', personKind: e.person_kind,
    personId: e.person_id, deviceUserId: e.device_user_id, source: e.source, enrolledAt: e.enrolled_at,
  }));
}

export async function addEnrollment(input: { deviceId: string; personKind: PersonKind; personId: string; employeeNumber?: string; deviceUserId: string; enrolledBy: string }) {
  const { error } = await (supabase.from('device_enrollments' as any) as any).insert({
    device_id: input.deviceId, person_kind: input.personKind, person_id: input.personId, employee_number: input.employeeNumber || null,
    device_user_id: input.deviceUserId.trim(), source: 'hr', enrolled_by: input.enrolledBy,
  });
  if (error) {
    throw new Error(/duplicate|unique/i.test(error.message)
      ? 'That User ID is already used on this device, or this person is already enrolled on it.'
      : error.message);
  }
}

export async function removeEnrollment(id: string) {
  const { error } = await (supabase.from('device_enrollments' as any) as any).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listAttendanceDevices(): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase.from('peripheral_devices').select('id, device_name, is_active').eq('device_type', 'attendance').order('device_name');
  return ((data || []) as any[]).map((d) => ({ id: d.id, name: d.device_name + (d.is_active ? '' : ' (off)') }));
}
