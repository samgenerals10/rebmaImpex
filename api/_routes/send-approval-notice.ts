// api/send-approval-notice.ts
// Re-sends the "you're approved, sign in" email and text to an active staff
// member, for someone who lost or never got the one sent automatically on
// approval (approve-user.ts). HR or the CEO only. The message includes the
// web address and, when set, the mobile app download link.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { sendApproved, deliverySummary } from '../_shared/mailer';
import { getAppOrigin } from '../_shared/settings';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Sends a real email and text, same limit as the invite senders.
  if (await isRateLimited(supabaseAdmin, req, res, 'send-approval-notice', 10, 60)) return;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (callerError || !callerData.user) return res.status(401).json({ error: 'Invalid authentication token.' });
  const { data: caller } = await supabaseAdmin.from('profiles').select('role, is_admin, status').eq('id', callerData.user.id).maybeSingle();
  if (!caller || String(caller.status || '').toUpperCase() !== 'ACTIVE' || ((caller.role || '').toUpperCase() !== 'HR' && !caller.is_admin)) {
    return res.status(403).json({ error: 'Only HR or the CEO can send this notice.' });
  }

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required.' });
  const { data: target } = await supabaseAdmin.from('profiles').select('email, phone, full_name, status').eq('id', userId).maybeSingle();
  if (!target) return res.status(404).json({ error: 'Staff member not found.' });
  if (String(target.status || '').toUpperCase() !== 'ACTIVE') {
    return res.status(409).json({ error: 'Only active staff can be sent the sign-in notice. Approve them first.' });
  }

  const origin = await getAppOrigin(supabaseAdmin, req.headers.origin as string);
  const result = await sendApproved(supabaseAdmin, { email: target.email, phone: target.phone, fullName: target.full_name || '' }, origin, req.body?.includeApp === true);
  return res.status(200).json({
    success: result.email.sent || result.sms.sent,
    email: result.email,
    sms: result.sms,
    message: deliverySummary(result) || 'Nothing was sent.',
  });
}
