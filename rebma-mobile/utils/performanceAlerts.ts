// rebma-mobile/utils/performanceAlerts.ts
//
// Phase 7.6, D44. Ported verbatim from rebma-web/src/utils/performanceAlerts.ts
// — pure Supabase-query logic with no web-only dependency, reused as-is by
// the new shared components/shared/PerformanceAlertsPanel.tsx and ready for
// HR's 7.7 phase to reuse unmodified (HR's own HrPerformanceAlertsView
// wraps the identical underlying panel on web). Web's 30-minute
// startAlertPolling() auto-poll is NOT ported — matches the established
// "no background timers, reload on mount + manual refresh" precedent
// (Phase 7.5's ApprovalHistoryPanel/DeptActivityGrid); the manual
// "Run Check" button (the real, user-triggered capability) is kept.
import { supabase } from '../lib/supabaseClient';
import { deptAliasGroup } from './departments';

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

const DEPT_TO_ROLE: Record<string, string[]> = {
  HR: ['HR'], MARKETING: ['marketing'], PRODUCTION: ['production'],
  RECEPTION: ['receptionist'], FINANCE: ['finance'],
  ADMIN_WAREHOUSE: ['operations', 'dispatch', 'logistics', 'admin_warehouse'],
};

async function checkDeptInactivity(): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const depts = ['MARKETING', 'ADMIN_WAREHOUSE', 'PRODUCTION', 'RECEPTION'];

  for (const dept of depts) {
    try {
      const { count } = await supabase
        .from('global_audit_history')
        .select('*', { count: 'exact', head: true })
        .in('department', deptAliasGroup(dept))
        .gte('timestamp', yesterday);

      if ((count ?? 0) === 0) {
        alerts.push({
          alert_type: 'dept_inactivity',
          department: dept,
          severity: 'medium',
          description: `${dept}: No Activity Detected. The ${dept} department has recorded zero activity in the last 24 hours. Please verify operations are running normally.`,
          status: 'open',
        });
      }
    } catch {
      // skip silently
    }
  }
  return alerts;
}

async function checkAttendanceAlerts(): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  const today = new Date().toISOString().split('T')[0];

  for (const [dept, roles] of Object.entries(DEPT_TO_ROLE)) {
    try {
      const { count: total } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('role', roles);

      const { count: present } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .in('department', deptAliasGroup(dept))
        .gte('check_in_time', today);

      if ((total ?? 0) > 0) {
        const rate = ((present ?? 0) / (total ?? 1)) * 100;
        if (rate < ATTENDANCE_THRESHOLD) {
          alerts.push({
            alert_type: 'attendance_low',
            department: dept,
            severity: rate < 25 ? 'critical' : 'high',
            description: `${dept}: Low Attendance (${rate.toFixed(0)}%). Only ${present ?? 0} of ${total ?? 0} staff have checked in today, below the ${ATTENDANCE_THRESHOLD}% threshold.`,
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
          description: `Finance: Low Revenue Today (GHS ${total.toLocaleString()}). Below the expected minimum of GHS ${FINANCE_LOW_THRESHOLD.toLocaleString()}.`,
          status: 'open',
        });
      }
      if (total > FINANCE_HIGH_THRESHOLD) {
        alerts.push({
          alert_type: 'finance_high',
          department: 'FINANCE',
          severity: 'low',
          description: `Finance: High Revenue Day (GHS ${total.toLocaleString()}). Exceeds the high-value threshold. Consider end-of-day reconciliation.`,
          status: 'open',
        });
      }
    }
  } catch {
    // skip
  }
  return alerts;
}

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

export async function resolveAlert(id: string, resolvedBy?: string): Promise<void> {
  await supabase.from('performance_alerts').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolved_by: resolvedBy || null,
  }).eq('id', id);
}
