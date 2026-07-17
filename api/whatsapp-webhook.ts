// api/whatsapp-webhook.ts
// Twilio calls this on every inbound WhatsApp message. It has to be public
// (no Authorization header — Twilio can't send one), so anyone who finds the
// URL could otherwise forge "DONE 3" texts and falsely mark deliveries
// complete. Twilio signs every request with the account's auth token; we
// verify that signature before trusting anything in the body.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { phoneKey } from './_shared/normalizePhone';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string, authToken: string): boolean {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function twiml(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Message></Response>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'] as string | undefined;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host;
  const fullUrl = `${proto}://${host}${req.url}`;
  const body = (req.body || {}) as Record<string, string>;

  if (!authToken || !signature || !verifyTwilioSignature(fullUrl, body, signature, authToken)) {
    return res.status(403).send(twiml('Request could not be verified.'));
  }

  try {
    const from = String(body.From || ''); // "whatsapp:+233267898090"
    const text = String(body.Body || '').trim();
    const driverKey = phoneKey(from);

    const match = text.match(/(?:done|complete|delivered)\D*(\d+)/i);
    const stopNumber = match ? parseInt(match[1], 10) : null;

    const { data: drivers } = await supabaseAdmin.from('drivers').select('id, full_name, phone').not('phone', 'is', null);
    const driver = (drivers || []).find(d => phoneKey(d.phone) === driverKey);
    if (!driver) {
      return res.status(200).send(twiml("We couldn't match this number to a driver on file. Please contact dispatch."));
    }

    const { data: activeStops } = await supabaseAdmin
      .from('delivery_logs')
      .select('id, order_id, dispatch_sequence, customer_name')
      .eq('driver_id', driver.id)
      .in('status', ['ASSIGNED', 'IN_TRANSIT'])
      .order('dispatch_sequence', { ascending: true });

    if (!activeStops || activeStops.length === 0) {
      return res.status(200).send(twiml('You have no active deliveries right now.'));
    }

    let target = stopNumber != null ? activeStops.find(s => s.dispatch_sequence === stopNumber) : null;
    if (!target && activeStops.length === 1) target = activeStops[0];

    if (!target) {
      const list = activeStops.map(s => `Stop ${s.dispatch_sequence}: ${s.customer_name || 'Client'}`).join('\n');
      return res.status(200).send(twiml(`Reply *DONE <number>* to mark a stop delivered. Your active stops:\n${list}`));
    }

    const now = new Date().toISOString();
    await supabaseAdmin.from('delivery_logs').update({ status: 'DELIVERED', delivered_at: now, updated_at: now }).eq('id', target.id);
    if (target.order_id) {
      await supabaseAdmin.from('orders').update({ status: 'DELIVERED', updated_at: now }).eq('id', target.order_id);
    }
    await supabaseAdmin.from('supplier_order_notifications').insert({
      message: `${driver.full_name} marked stop ${target.dispatch_sequence} (${target.customer_name || 'client'}) as delivered via WhatsApp.`,
      notified_department: 'OPERATIONS', read: false, created_at: now,
    });

    const remaining = activeStops.length - 1;
    return res.status(200).send(twiml(
      remaining > 0
        ? `✅ Stop ${target.dispatch_sequence} marked delivered. ${remaining} stop${remaining === 1 ? '' : 's'} left today.`
        : `✅ Stop ${target.dispatch_sequence} marked delivered. That was your last stop — nice work!`
    ));
  } catch (err: any) {
    console.error('WhatsApp webhook error:', err);
    return res.status(200).send(twiml('Something went wrong on our end recording that. Please try again or contact dispatch.'));
  }
}
