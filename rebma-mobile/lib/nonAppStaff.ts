// rebma-mobile/lib/nonAppStaff.ts
//
// Some hires never touch the app at all — no invite email, no login, no
// phone account. They only need a real, unique employee number, because
// that number is what a physical peripheral (an attendance fingerprint
// terminal, today; possibly others later) matches identity against. This
// is a genuinely separate concept from staff_invites (which always ends
// in a real app account) — see supabase_peripheral_devices.sql's own
// header comment for why non_app_staff is its own table, not a
// profiles/staff_invites row with the account parts left empty.
import { supabase } from './supabaseClient';

export interface NonAppStaffFields {
  fullName: string;
  department: string;
  role?: string;
  phone?: string;
  address?: string;
  staffCategory?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorRelationship?: string;
  guarantorIdNumber?: string;
  guarantorAddress?: string;
  dateOfBirth?: string;
  /** Face photo, so the attendance table can show who scanned. */
  photo?: string;
}

export interface NonAppStaffRow extends NonAppStaffFields {
  id: string;
  employeeNumber: string;
  status: string;
  createdAt: string;
}

function mapRow(r: any): NonAppStaffRow {
  return {
    id: r.id, employeeNumber: r.employee_number, fullName: r.full_name, department: r.department || '',
    role: r.role || undefined, phone: r.phone || undefined, address: r.address || undefined,
    staffCategory: r.staff_category || undefined, guarantorName: r.guarantor_name || undefined,
    guarantorPhone: r.guarantor_phone || undefined, guarantorRelationship: r.guarantor_relationship || undefined,
    guarantorIdNumber: r.guarantor_id_number || undefined, guarantorAddress: r.guarantor_address || undefined,
    dateOfBirth: r.date_of_birth || undefined, photo: r.photo || undefined, status: r.status || 'ACTIVE', createdAt: r.created_at,
  };
}

// employee_number is DB-generated (the same employee_number_seq profiles
// itself uses) — never pass one in, the insert's own default assigns it.
export async function createNonAppStaff(fields: NonAppStaffFields, createdBy: string | null): Promise<NonAppStaffRow> {
  const { data, error } = await supabase.from('non_app_staff').insert({
    full_name: fields.fullName, department: fields.department, role: fields.role || null,
    phone: fields.phone || null, address: fields.address || null, staff_category: fields.staffCategory || null,
    guarantor_name: fields.guarantorName || null, guarantor_phone: fields.guarantorPhone || null,
    guarantor_relationship: fields.guarantorRelationship || null, guarantor_id_number: fields.guarantorIdNumber || null,
    guarantor_address: fields.guarantorAddress || null, date_of_birth: fields.dateOfBirth || null,
    photo: fields.photo || null,
    created_by: createdBy,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function listNonAppStaff(): Promise<NonAppStaffRow[]> {
  const { data, error } = await supabase.from('non_app_staff').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function setNonAppStaffStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
  const { error } = await supabase.from('non_app_staff').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}
