// api/send-push.ts
// Vercel Serverless Function — Phase 7.12 (mobile), D129: the server-side
// half of push notifications. Triggered by a Supabase Database Webhook on
// every INSERT into `notifications`, not by editing the 4 existing write
// call sites (utils/sendNotification.ts, apiClient.ts's notifyUsers with
// 2 callers, and mobile's own MeetingsScreen.tsx insert) — a webhook
// fires regardless of which of those (or any future) call site wrote the
// row, so this covers all of them without touching any of that code.
//
// Manual setup required once Supabase access is restored (a
// dashboard-configured resource, not something SQL alone can create):
//   1. Run supabase_push_tokens.sql.
//   2. Database > Webhooks > Create a new webhook:
//        Table: public.notifications
//        Events: Insert
//        Type: HTTP Request, POST
//        URL: https://<deployed-rebma-web-domain>/api/send-push
//        HTTP Headers: x-webhook-secret: <the same value as
//          SUPABASE_WEBHOOK_SECRET below, set in the Vercel project's
//          environment variables>
//   3. Set SUPABASE_WEBHOOK_SECRET in Vercel to a fresh random value —
//      this authenticates the webhook call itself, since Supabase (not
//      an end user) is the caller here, not a user Bearer token like
//      every other function in this api/ directory uses.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface NotificationRow {
  id: string;
  recipient_id: string | null;
  recipient_department: string | null;
  title: string;
  message: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: NotificationRow;
}

async function resolveTokens(row: NotificationRow): Promise<string[]> {
  if (row.recipient_id) {
    const { data } = await supabaseAdmin.from('push_tokens').select('token').eq('user_id', row.recipient_id);
    return (data || []).map((r) => r.token);
  }
  if (row.recipient_department) {
    // Matches against profiles.role, not a separate `department` column —
    // this codebase overloads role==department throughout (confirmed
    // repeatedly across the mobile rollout: mapProfileToFrontend() reads
    // `db.role || db.department`). Case-insensitive since
    // recipient_department values are uppercase codes (e.g. 'RISK') while
    // role is stored lowercase ('risk').
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('role', row.recipient_department);
    const userIds = (profiles || []).map((p) => p.id);
    if (userIds.length === 0) return [];
    const { data } = await supabaseAdmin.from('push_tokens').select('token').in('user_id', userIds);
    return (data || []).map((r) => r.token);
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Authenticated via a shared-secret header, not a user Bearer token —
  // Supabase itself is the caller here, not an end user with a session.
  const secretHeader = req.headers['x-webhook-secret'];
  if (!webhookSecret || secretHeader !== webhookSecret) {
    return res.status(401).json({ error: 'Invalid webhook secret.' });
  }

  const payload = req.body as WebhookPayload;
  if (payload?.type !== 'INSERT' || payload?.table !== 'notifications' || !payload.record) {
    return res.status(200).json({ skipped: true });
  }

  const row = payload.record;
  const tokens = await resolveTokens(row);
  if (tokens.length === 0) return res.status(200).json({ sent: 0 });

  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: row.title,
    body: row.message,
    data: { notificationId: row.id },
  }));

  try {
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await expoRes.json();
    return res.status(200).json({ sent: tokens.length, result });
  } catch (e: any) {
    return res.status(500).json({ error: `Expo push send failed: ${e?.message || 'unknown error'}` });
  }
}
