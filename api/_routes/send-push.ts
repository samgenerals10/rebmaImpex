// api/send-push.ts
// Vercel Serverless Function: sends a phone push for every new row in
// `notifications`. Called by a Supabase Database Webhook on INSERT, so it
// covers every writer (web, mobile, server functions) without touching
// any of them.
//
// Department alerts are split into personal rows by the database
// (supabase_notification_delivery.sql), so nearly every row arriving
// here has a recipient_id. The department branch below is kept as a
// fallback and matches staff the same way the database does.
//
// One-time setup:
//   1. Run supabase_push_tokens.sql and supabase_notification_delivery.sql.
//   2. In Control Center → API Keys → Push Notifications: Webhook Secret,
//      enter a long random value you make up. (SUPABASE_WEBHOOK_SECRET in
//      Vercel still works as a backup when that field is empty.)
//   3. Supabase > Database > Webhooks > Create:
//        Table: public.notifications, Events: Insert,
//        Type: HTTP Request, Method: POST,
//        URL: https://<your-web-domain>/api/send-push
//        Header: x-webhook-secret = the same value as step 2.
//   4. Optional: if "Enhanced Security for Push Notifications" is turned on
//      in your Expo project, paste an Expo access token in Control Center →
//      API Keys → Push Notifications (Expo): Access Token.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'crypto';
import { getSettings } from '../_shared/settings';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const envWebhookSecret = process.env.SUPABASE_WEBHOOK_SECRET || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface NotificationRow {
  id: string;
  recipient_id: string | null;
  recipient_department: string | null;
  title: string;
  message: string;
  type?: string | null;
  action_url?: string | null;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: NotificationRow;
}

// Same mapping as public.normalize_dept() in the database.
function normalizeDept(raw: string | null | undefined): string {
  const up = (raw || '').trim().toUpperCase();
  if (up === 'OPERATIONS' || up === 'DISPATCH' || up === 'LOGISTICS') return 'ADMIN_WAREHOUSE';
  if (up === 'HUMAN RESOURCES') return 'HR';
  return up;
}

function secretMatches(header: string | string[] | undefined, webhookSecret: string): boolean {
  if (!webhookSecret || typeof header !== 'string') return false;
  const a = Buffer.from(header);
  const b = Buffer.from(webhookSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function resolveUserIds(row: NotificationRow): Promise<string[]> {
  if (row.recipient_id) return [row.recipient_id];
  if (!row.recipient_department) return [];

  const dept = normalizeDept(row.recipient_department);
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, role, status');
  const { data: drivers } = await supabaseAdmin.from('drivers').select('user_id').not('user_id', 'is', null);
  const driverIds = new Set((drivers || []).map((d: any) => String(d.user_id)));

  return (profiles || [])
    .filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE')
    .filter((p: any) => dept === 'ALL' || normalizeDept(p.role) === dept)
    .filter((p: any) => !driverIds.has(String(p.id)))
    .map((p: any) => String(p.id));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Only Supabase knows this secret. Checked before any other database work,
  // so a stranger hitting this URL costs one small settings read.
  const keys = await getSettings(supabaseAdmin, ['api_key_push_webhook_secret', 'api_key_expo_access_token']);
  if (!secretMatches(req.headers['x-webhook-secret'], keys.api_key_push_webhook_secret || envWebhookSecret)) {
    return res.status(401).json({ error: 'Invalid webhook secret.' });
  }

  const payload = req.body as WebhookPayload;
  if (payload?.type !== 'INSERT' || payload?.table !== 'notifications' || !payload.record) {
    return res.status(200).json({ skipped: true });
  }

  const row = payload.record;

  // Company-wide broadcasts show in the bell but don't buzz every phone.
  if (row.type === 'broadcast') return res.status(200).json({ skipped: 'broadcast' });

  const candidateIds = await resolveUserIds(row);
  if (candidateIds.length === 0) return res.status(200).json({ sent: 0 });

  // Suspended or removed accounts never get pushes, even for a personal alert.
  const { data: activeRows } = await supabaseAdmin.from('profiles').select('id, status').in('id', candidateIds);
  const userIds = (activeRows || [])
    .filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE')
    .map((p: any) => String(p.id));
  if (userIds.length === 0) return res.status(200).json({ sent: 0 });

  const { data: tokenRows } = await supabaseAdmin.from('push_tokens').select('token').in('user_id', userIds);
  const tokens = Array.from(new Set((tokenRows || []).map((r: any) => r.token as string)));
  if (tokens.length === 0) return res.status(200).json({ sent: 0 });

  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: row.title,
    body: row.message,
    channelId: 'default',
    // Used by the phone app to open the right screen when tapped.
    data: { notificationId: row.id, type: row.type || null, actionUrl: row.action_url || null, title: row.title || null },
  }));

  const deadTokens: string[] = [];
  try {
    // Expo accepts at most 100 messages per request.
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // Only needed when Expo's enhanced push security is turned on.
          ...(keys.api_key_expo_access_token ? { Authorization: `Bearer ${keys.api_key_expo_access_token}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      const result: any = await expoRes.json().catch(() => null);
      const tickets: any[] = Array.isArray(result?.data) ? result.data : [];
      tickets.forEach((t, idx) => {
        if (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered') deadTokens.push(batch[idx].to);
      });
    }
  } catch (e: any) {
    return res.status(500).json({ error: `Push send failed: ${e?.message || 'unknown error'}` });
  }

  // Phones that uninstalled the app: stop sending to them.
  if (deadTokens.length > 0) {
    await supabaseAdmin.from('push_tokens').delete().in('token', deadTokens);
  }

  return res.status(200).json({ sent: tokens.length, removed: deadTokens.length });
}
