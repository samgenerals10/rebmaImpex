// rebma-web/src/utils/attendanceRules.ts
// Web twin of rebma-mobile/lib/attendanceRules.ts. Keep them in step.
//
// HR-configurable clock-in/clock-out/late times (direct instruction:
// these are set by HR, not CEO — a new `attendance_rules` table with its
// own HR-write RLS, not ceo_settings, whose write policy is admin/
// delegate-only). Falls back to sane defaults if the table/row doesn't
// exist yet (migration written, not necessarily run — see
// supabase_attendance_rules.sql), matching this app's established
// graceful-degrade pattern for not-yet-run migrations.
import { supabase } from '../lib/supabaseClient';

export interface AttendanceRules {
  clockInTime: string; // 'HH:MM'
  clockOutTime: string;
  lateAfterTime: string;
}

export const DEFAULT_ATTENDANCE_RULES: AttendanceRules = {
  clockInTime: '08:00',
  clockOutTime: '17:00',
  lateAfterTime: '09:00',
};

export async function getAttendanceRules(): Promise<AttendanceRules> {
  try {
    const { data, error } = await supabase
      .from('attendance_rules')
      .select('clock_in_time, clock_out_time, late_after_time')
      .eq('id', 'default')
      .maybeSingle();
    if (error || !data) return DEFAULT_ATTENDANCE_RULES;
    return {
      clockInTime: data.clock_in_time || DEFAULT_ATTENDANCE_RULES.clockInTime,
      clockOutTime: data.clock_out_time || DEFAULT_ATTENDANCE_RULES.clockOutTime,
      lateAfterTime: data.late_after_time || DEFAULT_ATTENDANCE_RULES.lateAfterTime,
    };
  } catch {
    return DEFAULT_ATTENDANCE_RULES;
  }
}

export async function setAttendanceRules(rules: AttendanceRules, updatedBy: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('attendance_rules').upsert({
    id: 'default',
    clock_in_time: rules.clockInTime,
    clock_out_time: rules.clockOutTime,
    late_after_time: rules.lateAfterTime,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  return { error: error?.message || null };
}

// 'HH:MM' -> minutes since midnight, for a plain numeric comparison
// against a Date's own getHours()/getMinutes().
export function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function isPastTime(now: Date, hhmm: string): boolean {
  return now.getHours() * 60 + now.getMinutes() > timeStringToMinutes(hhmm);
}
