// api/kick-user.ts
// Vercel Serverless Function — real server-side session invalidation for
// Live Users' "Kick Offline" action.
//
// Security/gap audit fix: the previous implementation
// (lib/presence.ts's kickUserOffline()) was a plain Supabase Realtime
// broadcast on the shared 'live-users' channel with no authorization
// check anywhere — any authenticated user (any department, any role)
// could call supabase.channel('live-users').send({type:'broadcast',
// event:'force-signout', payload:{targetUserId: '<any-uuid>'}}) directly
// and force-sign-out anyone, including the CEO. It also only ever
// asked the target's own client to sign itself out — a modified client
// could simply ignore the broadcast and stay logged in.
//
// This endpoint does the real thing: it runs with the service-role key
// (same as terminate-user.ts/reset-user-password.ts) and calls
// supabase.auth.admin.signOut(), which invalidates the target's actual
// refresh token server-side — a real kick, not a request the target's
// own client could choose to ignore. Live Users' UI still also sends the
// existing broadcast afterward (kept, not removed) purely so the
// target's already-open screen updates immediately if the app happens to
// still be running — the broadcast is now a UX nicety layered on top of
// real enforcement, not the enforcement itself.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    .select('full_name, is_admin')
    .eq('id', callerData.user.id)
    .limit(1);

  const callerProfile = callerProfiles?.[0];
  if (!callerProfile?.is_admin) {
    return res.status(403).json({ error: 'Only the CEO can kick a user offline.' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }
  if (userId === callerData.user.id) {
    return res.status(400).json({ error: 'You cannot kick your own session offline.' });
  }

  const { data: targetProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .limit(1);
  const targetProfile = targetProfiles?.[0];
  if (!targetProfile) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, 'global');
  if (signOutError) {
    return res.status(500).json({ error: `Failed to end session: ${signOutError.message}` });
  }

  try {
    await supabaseAdmin.from('global_audit_history').insert({
      action: 'KICK_USER_OFFLINE',
      department: 'CEO',
      performed_by: callerProfile.full_name || 'CEO',
      user_id: callerData.user.id,
      details: `${targetProfile.full_name || userId}'s session was forcibly ended.`,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Audit trail logging failed:', e);
  }

  return res.status(200).json({ message: `${targetProfile.full_name || 'User'}'s session has been ended.` });
}
