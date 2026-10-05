// rebma-web/src/utils/attendanceTable.ts
//
// Loads attendance for one day or a date range and attaches each person's
// details (photo, employee number, department, role) so the HR table shows
// who they are, not just a typed name.
//
// A row is matched to a person in this order:
//   1. user_id      rows from the app, and device scans of app users
//   2. employee #   device scans and Reception check-ins by number, for app
//                   users (profiles) and staff without an app (non_app_staff)
//   3. exact name   older manual rows that only stored a name
// A row nobody matches still shows, with its typed name and no photo.
//
// Phone twin: rebma-mobile/lib/attendanceTable.ts. Keep them in step.
import { supabase } from '../lib/supabaseClient';

export type AttStatus = 'PRESENT' | 'LATE' | 'ABSENT';

export interface AttendanceTableRow {
  id: string;
  date: string;
  checkInTime: string;      // display, e.g. 08:41
  checkInSortKey: string;   // ISO, for sorting
  status: AttStatus;
  lateReason: string | null;
  source: string;           // Device, Reception, Remote, HR entry
  fullName: string;
  photo?: string;
  employeeNumber?: string;
  department?: string;
  role?: string;
  hasAppAccount: boolean;
}

interface Person { fullName: string; photo?: string; employeeNumber?: string; department?: string; role?: string; hasAppAccount: boolean }

// The role column holds the department code in this app (e.g. 'finance').
const ROLE_TO_DEPT: Record<string, string> = {
  admin_warehouse: 'Admin & Warehouse', operations: 'Admin & Warehouse', dispatch: 'Admin & Warehouse', logistics: 'Admin & Warehouse',
  finance: 'Account Department', hr: 'HR', marketing: 'Marketing', receptionist: 'Reception', production: 'Production',
  management: 'Management', risk: 'Risk', ceo: 'CEO',
};
const deptLabel = (role?: string | null) => (role ? ROLE_TO_DEPT[String(role).toLowerCase()] || role : undefined);

function sourceLabel(type?: string | null): string {
  switch (String(type || '').toLowerCase()) {
    case 'biometric': return 'Device';
    case 'physical': return 'Reception';
    case 'virtual': return 'Remote';
    default: return 'HR entry';
  }
}

const unique = (xs: (string | null | undefined)[]) => Array.from(new Set(xs.filter((x): x is string => !!x)));

export async function loadAttendanceRange(start: string, end: string): Promise<AttendanceTableRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, user_id, staff_name, employee_number, check_in_time, status, date, late_reason, attendance_type, department')
    .gte('date', start)
    .lte('date', end)
    .order('check_in_time', { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data || []) as any[];

  const userIds = unique(rows.map((r) => r.user_id));
  const numbers = unique(rows.map((r) => r.employee_number));
  const names = unique(rows.filter((r) => !r.user_id && !r.employee_number).map((r) => r.staff_name));

  const byId = new Map<string, Person>();
  const byNumber = new Map<string, Person>();
  const byName = new Map<string, Person>();

  const profileFilters = [
    userIds.length ? `id.in.(${userIds.join(',')})` : '',
    numbers.length ? `employee_number.in.(${numbers.map((n) => `"${n.replace(/"/g, '')}"`).join(',')})` : '',
  ].filter(Boolean);

  const [profilesRes, othersRes, namedRes] = await Promise.all([
    profileFilters.length
      ? supabase.from('profiles').select('id, full_name, photo, employee_number, role, is_admin, metadata').or(profileFilters.join(','))
      : Promise.resolve({ data: [] as any[] }),
    numbers.length
      ? supabase.from('non_app_staff').select('full_name, photo, employee_number, department, role').in('employee_number', numbers)
      : Promise.resolve({ data: [] as any[] }),
    names.length
      ? supabase.from('profiles').select('id, full_name, photo, employee_number, role, is_admin, metadata').in('full_name', names)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const fromProfile = (p: any): Person => ({
    fullName: p.full_name, photo: p.photo || undefined, employeeNumber: p.employee_number || undefined,
    department: p.is_admin ? 'CEO' : deptLabel(p.role), role: p.is_admin ? 'CEO' : (p.metadata?.role || undefined), hasAppAccount: true,
  });
  for (const p of (profilesRes.data || []) as any[]) {
    const person = fromProfile(p);
    byId.set(p.id, person);
    if (p.employee_number) byNumber.set(p.employee_number, person);
  }
  for (const o of (othersRes.data || []) as any[]) {
    if (!byNumber.has(o.employee_number)) {
      byNumber.set(o.employee_number, {
        fullName: o.full_name, photo: o.photo || undefined, employeeNumber: o.employee_number,
        department: o.department || undefined, role: o.role || undefined, hasAppAccount: false,
      });
    }
  }
  for (const p of (namedRes.data || []) as any[]) byName.set(String(p.full_name).toLowerCase(), fromProfile(p));

  return rows.map((r) => {
    const person = (r.user_id && byId.get(r.user_id))
      || (r.employee_number && byNumber.get(r.employee_number))
      || (r.staff_name && byName.get(String(r.staff_name).toLowerCase()))
      || null;
    return {
      id: r.id,
      date: r.date || (r.check_in_time ? String(r.check_in_time).slice(0, 10) : ''),
      checkInTime: r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      checkInSortKey: r.check_in_time || '',
      status: r.status as AttStatus,
      lateReason: r.late_reason || null,
      source: sourceLabel(r.attendance_type),
      fullName: person?.fullName || r.staff_name || 'Unknown',
      photo: person?.photo,
      employeeNumber: person?.employeeNumber || r.employee_number || undefined,
      department: person?.department || deptLabel(r.department),
      role: person?.role,
      hasAppAccount: person?.hasAppAccount ?? false,
    };
  });
}

// Which days in a month have records, and the worst status that day, for
// the calendar's dots (red = someone absent, amber = someone late).
export async function loadMonthMarks(year: number, month: number): Promise<Record<string, AttStatus[]>> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${year}-${pad(month + 1)}-01`;
  const end = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
  const { data } = await supabase.from('attendance').select('date, status').gte('date', start).lte('date', end).limit(10000);
  const out: Record<string, AttStatus[]> = {};
  for (const row of (data || []) as any[]) (out[row.date] ||= []).push(row.status);
  return out;
}
