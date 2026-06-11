// src/utils/performanceAlerts.ts
// Runs alert checks on load + every 30 minutes. Inserts alerts into `performance_alerts` Supabase table.

import { supabase } from '../lib/supabaseClient';

export interface PerformanceAlert {
  id?: string;
  alert_type: 'dept_inactivity' | 'attendance_low' | 'finance_low' | 'finance_high' | 'general';
  department: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  threshold_value?: number;
  actual_value?: number;
  resolved: boolean;
  created_at?: string;
}

const ATTENDANCE_THRESHOLD = 50; // percent
const FINANCE_LOW_THRESHOLD = 10000; // GHS
const FINANCE_HIGH_THRESHOLD = 500000; // GHS

// Check if a department has had any activity (orders/payments/records) in the last 24 hours
async function checkDeptInactivity(): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const depts = ['MARKETING', 'OPERATIONS', 'PRODUCTION', 'RECEPTION', 'DISPATCH'];

  for (const dept of depts) {
    try {
      const { count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('department', dept)
        .gte('created_at', yesterday);

      if ((count ?? 0) === 0) {
        alerts.push({
          alert_type: 'dept_inactivity',
          department: dept,
          severity: 'medium',
          title: `${dept} — No Activity Detected`,
          description: `The ${dept} department has recorded zero activity in the last 24 hours. Please verify operations are running normally.`,
          actual_value: 0,
          resolved: false,
        });
      }
    } catch {
      // table may not exist; skip silently
    }
  }
  return alerts;
}

// Check attendance rate from profiles/attendance table
async function checkAttendanceAlerts(): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  const today = new Date().toISOString().split('T')[0];

  const depts = ['HR', 'MARKETING', 'OPERATIONS', 'PRODUCTION', 'RECEPTION', 'DISPATCH', 'FINANCE'];

  for (const dept of depts) {
    try {
      const { count: total } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('department', dept);

      const { count: present } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('department', dept)
        .gte('check_in', today);

      if ((total ?? 0) > 0) {
        const rate = ((present ?? 0) / (total ?? 1)) * 100;
        if (rate < ATTENDANCE_THRESHOLD) {
          alerts.push({
            alert_type: 'attendance_low',
            department: dept,
            severity: rate < 25 ? 'critical' : rate < ATTENDANCE_THRESHOLD ? 'high' : 'medium',
            title: `${dept} — Low Attendance (${rate.toFixed(0)}%)`,
            description: `Only ${present ?? 0} of ${total ?? 0} staff have checked in today. Attendance rate is ${rate.toFixed(0)}%, below the ${ATTENDANCE_THRESHOLD}% threshold.`,
            threshold_value: ATTENDANCE_THRESHOLD,
            actual_value: Math.round(rate),
            resolved: false,
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
    // Check for very low payment collections today
    const today = new Date().toISOString().split('T')[0];
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .gte('created_at', today);

    if (payments) {
      const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      if (total < FINANCE_LOW_THRESHOLD && payments.length > 0) {
        alerts.push({
          alert_type: 'finance_low',
          department: 'FINANCE',
          severity: 'medium',
          title: `Finance — Low Revenue Today (GHS ${total.toLocaleString()})`,
          description: `Today's collected payments total GHS ${total.toLocaleString()}, below the expected minimum of GHS ${FINANCE_LOW_THRESHOLD.toLocaleString()}.`,
          threshold_value: FINANCE_LOW_THRESHOLD,
          actual_value: total,
          resolved: false,
        });
      }
      if (total > FINANCE_HIGH_THRESHOLD) {
        alerts.push({
          alert_type: 'finance_high',
          department: 'FINANCE',
          severity: 'low',
          title: `Finance — High Revenue Day (GHS ${total.toLocaleString()})`,
          description: `Today's collected payments of GHS ${total.toLocaleString()} exceed the high-value threshold. Consider end-of-day reconciliation.`,
          threshold_value: FINANCE_HIGH_THRESHOLD,
          actual_value: total,
          resolved: false,
        });
      }
    }
  } catch {
    // skip
  }
  return alerts;
}

// Insert new alerts, avoiding duplicates by checking for unresolved alerts of the same type+dept created today
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
        .eq('resolved', false)
        .gte('created_at', today);

      if ((count ?? 0) === 0) {
        await supabase.from('performance_alerts').insert(alert);
      }
    } catch {
      // table may not exist; skip
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

// Fetch all unresolved alerts from the database
export async function fetchPerformanceAlerts(): Promise<PerformanceAlert[]> {
  try {
    const { data } = await supabase
      .from('performance_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []) as PerformanceAlert[];
  } catch {
    return [];
  }
}

// Resolve an alert by id
export async function resolveAlert(id: string): Promise<void> {
  await supabase.from('performance_alerts').update({ resolved: true }).eq('id', id);
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
