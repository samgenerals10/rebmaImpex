// api/terminate-user.ts
// Vercel Serverless Function — the CEO terminates someone (approved rule).
//
// Takes effect at once and deletes NOTHING (api/_shared/termination.ts):
// sign-in locked for good, sessions ended, status TERMINATED. All their
// work stays in the system for the department; a new hire gets their own
// new profile and sees it. This used to delete the sign-in account, which
// could take the profile and its attendance with it.
//
// CEO only, with his password. Works for app users ({ userId }) and for
// staff without the app ({ nonAppStaffId }). A CEO is never terminated
// here (removing a CEO needs both CEOs).
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from './_shared/rateLimit';
import { verifyPassword } from './_shared/reauth';
import { loadPerson, terminatePerson, countOpenDeliveries, notify, audit } from './_shared/termination';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (await isRateLimited(supabaseAdmin, req, res, 'terminate-user', 30, 60)) return;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData.user) {
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }

  const { data: callerProfiles } = await supabaseAdmin
    .from('profiles')
    .select('full_name, role, is_admin, status')
    .eq('id', callerData.user.id)
    .limit(1);

  const callerProfile = callerProfiles?.[0];
  if (!callerProfile) {
    return res.status(403).json({ error: 'Caller profile not found.' });
  }
  if (String(callerProfile.status || '').toUpperCase() !== 'ACTIVE') {
    return res.status(403).json({ error: 'Your account is not active.' });
  }

  if (!callerProfile.is_admin) {
    return res.status(403).json({ error: 'Only the CEO can terminate an account.' });
  }

  const { userId, nonAppStaffId } = req.body || {};
  const kind = nonAppStaffId ? 'no_app' : 'app';
  const targetId = String(nonAppStaffId || userId || '');
  if (!targetId) return res.status(400).json({ error: 'Pick who to terminate.' });
  if (targetId === callerData.user.id) return res.status(400).json({ error: 'You cannot terminate your own account.' });

  const person = await loadPerson(supabaseAdmin, kind, targetId);
  if (!person) return res.status(404).json({ error: 'That person was not found.' });
  // No CEO account can be terminated here, by anyone. Removing a CEO needs
  // both CEOs (Step 2).
  if (person.isCeo) return res.status(403).json({ error: 'A CEO account cannot be terminated here.' });
  if (person.status === 'TERMINATED') return res.status(409).json({ error: `${person.fullName} is already terminated.` });

  // High-risk action: the CEO types his password again.
  if (!(await verifyPassword(supabaseAdmin, res, callerData.user, req.body?.password))) return;

  const done = await terminatePerson(supabaseAdmin, person);
  if (!done.ok) return res.status(500).json({ error: done.error });

  const openDeliveries = person.kind === 'app' ? await countOpenDeliveries(supabaseAdmin, person.id) : 0;
  const deliveriesNote = openDeliveries ? ` ${openDeliveries} open deliveries were assigned to them; Risk should pick another driver in Dispatch.` : '';
  const replaceNote = person.department === 'hr'
    ? ' The CEO invites their replacement into HR by email.'
    : ' You can now add a new person for this position in Staff, Add Staff, and choose whether they continue this work or start new.';
  await notify(supabaseAdmin, { department: 'HR' }, `${person.fullName} was terminated`, `The CEO terminated ${person.fullName}. All their work stays in the system.${replaceNote}${deliveriesNote}`);
  if (openDeliveries) await notify(supabaseAdmin, { department: 'RISK' }, 'Deliveries need a new driver', `${person.fullName} was terminated with ${openDeliveries} open deliveries. Pick another driver in Dispatch.`);
  await audit(supabaseAdmin, 'TERMINATE_USER', 'CEO', callerProfile.full_name || 'CEO', callerData.user.id, person.id,
    `${person.fullName} terminated. Sign-in locked; nothing deleted.${deliveriesNote}`);

  return res.status(200).json({ message: `${person.fullName} has been terminated. All their work stays in the system.${deliveriesNote}` });
}
