// api/report-error.ts
// The web and phone apps send their errors here: crashes, and every failure
// message a person sees. Each is logged and emailed to the company address
// by _shared/errorReport.ts (with its repeat and daily limits).
//
// Signing in is optional, so errors on the sign-in and register screens
// are caught too; when a valid sign-in token comes with the report, the
// person's name is attached. Rate-limited per address so it can't be used
// to spam the company inbox.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { reportError } from '../_shared/errorReport';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'report-error', 30, 60)) return;

  const b = req.body || {};
  const source = b.source === 'phone' ? 'phone' : 'web';
  const message = String(b.message || '').trim();
  if (!message) return res.status(400).json({ error: 'message is required.' });

  let userId: string | null = null;
  let userName: string | null = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
    if (data.user) {
      userId = data.user.id;
      const { data: p } = await supabaseAdmin.from('profiles').select('full_name').eq('id', userId).maybeSingle();
      userName = p?.full_name || data.user.email || null;
    }
  }

  await reportError(supabaseAdmin, {
    source,
    location: b.location ? String(b.location) : null,
    message,
    detail: b.detail ? String(b.detail) : null,
    userId,
    userName,
    pageUrl: b.pageUrl ? String(b.pageUrl) : null,
  });
  return res.status(200).json({ ok: true });
}
