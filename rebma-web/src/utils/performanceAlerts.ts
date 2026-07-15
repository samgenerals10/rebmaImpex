// src/utils/performanceAlerts.ts
// Runs alert checks on load + every 30 minutes. Inserts alerts into `performance_alerts` Supabase table.

import { supabase } from '../lib/supabaseClient';

export interface PerformanceAlert {
  id?: string;
  alert_type: 'dept_inactivity' | 'attendance_low' | 'finance_low' | 'finance_high' | 'general';
  department: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status?: string;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at?: string;
}

const ATTENDANCE_THRESHOLD = 50; // percent
const FINANCE_LOW_THRESHOLD = 10000; // GHS
const FINANCE_HIGH_THRESHOLD = 500000; // GHS

// profiles.role uses mixed casing per its DB check constraint (e.g. 'marketing', 'HR', 'receptionist')
// rather than the uppercase department labels used across the UI — map explicitly instead of guessing.
const DEPT_TO_ROLE: Record<string, string> = {
  HR: 'HR', MARKETING: 'marketing', OPERATIONS: 'operations', PRODUCTION: 'production',
  RECEPTION: 'receptionist', DISPATCH: 'dispatch', FINANCE: 'finance',
};

// Check if a department has had any activity (orders/payments/records) in the last 24 hours
async function checkDeptInactivity(): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const depts = ['MARKETING', 'OPERATIONS', 'PRODUCTION', 'RECEPTION', 'DISPATCH'];

  for (const dept of depts) {
    try {
      const { count } = await supabase
        .from('global_audit_history')
        .select('*', { count: 'exact', head: true })
        .eq('department', dept)
        .gte('timestamp', yesterday);

      if ((count ?? 0) === 0) {
        alerts.push({
          alert_type: 'dept_inactivity',
          department: dept,
          severity: 'medium',
          description: `${dept} — No Activity Detected: the ${dept} department has recorded zero activity in the last 24 hours. Please verify operations are running normally.`,
          status: 'open',
        });
      }
    } catch {
      // skip silently
    }
  }
  return alerts;
}

// Check attendance rate from profiles/attendance table
async function checkAttendanceAlerts(): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  const today = new Date().toISOString().split('T')[0];

  for (const [dept, role] of Object.entries(DEPT_TO_ROLE)) {
    try {
      const { count: total } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .ilike('role', role);

      const { count: present } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('department', dept)
        .gte('check_in_time', today);

      if ((total ?? 0) > 0) {
        const rate = ((present ?? 0) / (total ?? 1)) * 100;
        if (rate < ATTENDANCE_THRESHOLD) {
          alerts.push({
            alert_type: 'attendance_low',
            department: dept,
            severity: rate < 25 ? 'critical' : 'high',
            description: `${dept} — Low Attendance (${rate.toFixed(0)}%): only ${present ?? 0} of ${total ?? 0} staff have checked in today, below the ${ATTENDANCE_THRESHOLD}% threshold.`,
            status: 'open',
          });
        }
      }
    } catch {
      // skip
    }
  }
  return alerts;
}

// Check finance thresholds — payments/balances
async function checkFinanceAlerts(): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: payments } = await supabase
      .from('finance_payments')
      .select('amount')
      .gte('created_at', today);

    if (payments) {
      const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      if (total < FINANCE_LOW_THRESHOLD && payments.length > 0) {
        alerts.push({
          alert_type: 'finance_low',
          department: 'FINANCE',
          severity: 'medium',
          description: `Finance — Low Revenue Today (GHS ${total.toLocaleString()}): below the expected minimum of GHS ${FINANCE_LOW_THRESHOLD.toLocaleString()}.`,
          status: 'open',
        });
      }
      if (total > FINANCE_HIGH_THRESHOLD) {
        alerts.push({
          alert_type: 'finance_high',
          department: 'FINANCE',
          severity: 'low',
          description: `Finance — High Revenue Day (GHS ${total.toLocaleString()}): exceeds the high-value threshold. Consider end-of-day reconciliation.`,
          status: 'open',
        });
      }
    }
  } catch {
    // skip
  }
  return alerts;
}

// Insert new alerts, avoiding duplicates by checking for open alerts of the same type+dept created today
async function persistAlerts(alerts: PerformanceAlert[]): Promise<void> {
  if (alerts.length === 0) return;
  const today = new Date().toISOString().split('T')[0];

  for (const alert of alerts) {
    try {
      const { count } = await supabase
        .from('performance_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('alert_type', alert.alert_type)
        .eq('department', alert.department)
        .eq('status', 'open')
        .gte('created_at', today);

      if ((count ?? 0) === 0) {
        await supabase.from('performance_alerts').insert({
          alert_type: alert.alert_type,
          department: alert.department,
          severity: alert.severity,
          description: alert.description,
          status: 'open',
        });
      }
    } catch {
      // skip
    }
  }
}

export async function runPerformanceAlerts(): Promise<PerformanceAlert[]> {
  const [inactivity, attendance, finance] = await Promise.all([
    checkDeptInactivity(),
    checkAttendanceAlerts(),
    checkFinanceAlerts(),
  ]);

  const all = [...inactivity, ...attendance, ...finance];
  await persistAlerts(all);
  return all;
}

// Fetch all open alerts from the database
export async function fetchPerformanceAlerts(): Promise<PerformanceAlert[]> {
  try {
    const { data } = await supabase
      .from('performance_alerts')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []) as PerformanceAlert[];
  } catch {
    return [];
  }
}

// Resolve an alert by id
export async function resolveAlert(id: string, resolvedBy?: string): Promise<void> {
  await supabase.from('performance_alerts').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolved_by: resolvedBy || null,
  }).eq('id', id);
}

// Starts the 30-minute polling interval
export function startAlertPolling(onNewAlerts?: (alerts: PerformanceAlert[]) => void): () => void {
  const run = async () => {
    const alerts = await runPerformanceAlerts();
    if (alerts.length > 0 && onNewAlerts) onNewAlerts(alerts);
  };

  run(); // run immediately on load
  const id = setInterval(run, 30 * 60 * 1000); // every 30 minutes
  return () => clearInterval(id);
}
