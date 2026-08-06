// api/lookup-invite.ts
// Vercel Serverless Function — resolves a staff invite token for an
// anonymous visitor (someone who just clicked the link, not logged in
// yet). staff_invites is HR/CEO-only under RLS, so this has to run with
// the service-role key; it only ever returns the handful of non-sensitive
// fields needed to prefill the registration form, never the whole table.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = String(req.query.token || '');
  if (!token) return res.status(400).json({ error: 'token is required.' });

  const { data: invites } = await supabaseAdmin
    .from('staff_invites')
    .select('email, full_name, department, role, status, expires_at')
    .eq('token', token)
    .limit(1);

  const invite = invites?.[0];
  if (!invite) return res.status(404).json({ error: 'Invite link not found.' });
  if (invite.status !== 'pending') return res.status(410).json({ error: 'This invite has already been used or was revoked.' });
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'This invite link has expired.' });
  }

  return res.status(200).json({
    email: invite.email,
    fullName: invite.full_name,
    department: invite.department,
    role: invite.role,
  });
}
