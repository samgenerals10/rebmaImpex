// api/send-whatsapp-directions.ts
// Sends a driver their queued stops over WhatsApp: each stop gets a plain
// Google Maps deep link (no Maps API key needed — it's just a URL scheme
// Maps already understands) and a "reply DONE <n>" instruction. Triggered
// automatically right after a driver is assigned (auto or manual), and
// re-triggerable from the Deliveries list for a resend.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function mapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

async function sendWhatsApp(toPhone: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!sid || !authToken || !from) {
    throw new Error('WhatsApp is not configured yet — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM in the Vercel project env vars.');
  }
  const to = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;
  const params = new URLSearchParams({ From: from, To: to, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${sid}:${authToken}`).toString('base64'),
    },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || 'Twilio rejected the message.');
  }
  return json;
}

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

  try {
    const { driverId } = req.body || {};
    if (!driverId) return res.status(400).json({ error: 'driverId is required.' });

    const { data: driver, error: driverErr } = await supabaseAdmin
      .from('drivers')
      .select('id, driver_id, full_name, phone')
      .eq('id', driverId)
      .single();
    if (driverErr || !driver) return res.status(404).json({ error: 'Driver not found.' });
    if (!driver.phone) return res.status(400).json({ error: `${driver.full_name} has no phone number on file.` });

    const { data: stops, error: stopsErr } = await supabaseAdmin
      .from('delivery_logs')
      .select('id, order_id, customer_name, delivery_address, dispatch_sequence, created_at')
      .eq('driver_id', driverId)
      .in('status', ['ASSIGNED', 'IN_TRANSIT'])
      .order('dispatch_sequence', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (stopsErr) return res.status(500).json({ error: stopsErr.message });
    if (!stops || stops.length === 0) {
      return res.status(400).json({ error: 'This driver has no active deliveries to send.' });
    }

    // Backfill dispatch_sequence for any stop that doesn't have one yet, in
    // the order already resolved above (existing-sequence stops first).
    let nextSeq = 1;
    const usedSeqs = new Set(stops.filter(s => s.dispatch_sequence).map(s => s.dispatch_sequence));
    for (const stop of stops) {
      if (!stop.dispatch_sequence) {
        while (usedSeqs.has(nextSeq)) nextSeq++;
        stop.dispatch_sequence = nextSeq;
        usedSeqs.add(nextSeq);
        await supabaseAdmin.from('delivery_logs').update({ dispatch_sequence: nextSeq }).eq('id', stop.id);
      }
    }
    stops.sort((a, b) => (a.dispatch_sequence || 0) - (b.dispatch_sequence || 0));

    const lines = [`Hi ${driver.full_name}, you have ${stops.length} ${stops.length === 1 ? 'delivery' : 'deliveries'} today:`, ''];
    for (const stop of stops) {
      const address = stop.delivery_address || 'Address not on file — check with dispatch';
      lines.push(`*Stop ${stop.dispatch_sequence}*: ${stop.customer_name || 'Client'}`);
      lines.push(address);
      if (stop.delivery_address) lines.push(`Directions: ${mapsLink(stop.delivery_address)}`);
      lines.push(`Reply *DONE ${stop.dispatch_sequence}* once delivered.`);
      lines.push('');
    }
    lines.push('Drive safe.');
    const message = lines.join('\n');

    await sendWhatsApp(driver.phone, message);

    const now = new Date().toISOString();
    await supabaseAdmin.from('delivery_logs').update({ whatsapp_sent_at: now }).in('id', stops.map(s => s.id));

    return res.status(200).json({ success: true, sentTo: driver.phone, stopCount: stops.length });
  } catch (err: any) {
    console.error('WhatsApp dispatch error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send WhatsApp directions.' });
  }
}
