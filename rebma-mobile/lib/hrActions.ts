// rebma-mobile/lib/hrActions.ts
//
// Mobile mirrors of rebma-web/src/services/apiClient.ts's `hr` object —
// updateStaffDetails/updatePerformance are plain profiles updates, no
// privileged API involved (unlike Add Staff / Approve Registration, which
// go through lib/apiBase.ts). Same "small local helper for one write
// shape" pattern as lib/riskActions.ts / lib/managementActions.ts.
import { supabase } from './supabaseClient';

export async function updateStaffDetails(staffId: string, fields: {
  address?: string; resumeUrl?: string; hrRemarks?: string; staffCategory?: string;
  guarantorName?: string; guarantorPhone?: string; guarantorRelationship?: string;
  guarantorIdNumber?: string; guarantorAddress?: string;
}): Promise<void> {
  const { error } = await supabase.from('profiles').update({
    address: fields.address ?? null,
    resume_url: fields.resumeUrl ?? null,
    hr_remarks: fields.hrRemarks ?? null,
    staff_category: fields.staffCategory ?? null,
    guarantor_name: fields.guarantorName ?? null,
    guarantor_phone: fields.guarantorPhone ?? null,
    guarantor_relationship: fields.guarantorRelationship ?? null,
    guarantor_id_number: fields.guarantorIdNumber ?? null,
    guarantor_address: fields.guarantorAddress ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', staffId);
  if (error) throw new Error(error.message);
}

export async function updatePerformance(
  staffId: string,
  scores: { taskScore?: number | null; teamScore?: number | null; qualityScore?: number | null; notes?: string },
  reviewedBy: string
): Promise<void> {
  const { error } = await supabase.from('profiles').update({
    performance_task_score: scores.taskScore ?? null,
    performance_team_score: scores.teamScore ?? null,
    performance_quality_score: scores.qualityScore ?? null,
    performance_notes: scores.notes || null,
    performance_reviewed_by: reviewedBy,
    performance_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', staffId);
  if (error) throw new Error(error.message);
}
