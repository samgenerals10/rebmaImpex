// api/trip.ts
// Vercel Serverless Function — no-login driver trip page, reached via a
// single WhatsApp link (https://<origin>/trip/<token>). The token is the
// only credential: every read/write below re-resolves the driver from it
// server-side and scopes the target row to that driver, so a token can
// never touch another driver's data.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function resolveDriver(token: string) {
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from('drivers')
    .select('id, driver_id, full_name, vehicle_id')
    .eq('trip_token', token)
    .limit(1);
  return data?.[0] || null;
}

async function loadStops(driverId: string) {
  const { data } = await supabaseAdmin
    .from('delivery_logs')
    .select('id, order_id, customer_name, delivery_address, dispatch_sequence, status')
    .eq('driver_id', driverId)
    .in('status', ['ASSIGNED', 'IN_TRANSIT'])
    .order('dispatch_sequence', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  return (data || []).map(row => ({
    id: row.id,
    orderId: row.order_id,
    customerName: row.customer_name || 'Client',
    deliveryAddress: row.delivery_address || '',
    sequence: row.dispatch_sequence,
    status: row.status,
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const token = String(req.query.token || '');
    const driver = await resolveDriver(token);
    if (!driver) return res.status(404).json({ error: 'Trip link not found or no longer active.' });
    const stops = await loadStops(driver.id);
    return res.status(200).json({
      driverId: driver.driver_id,
      driverName: driver.full_name,
      vehicleId: driver.vehicle_id,
      stops,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, action } = req.body || {};
  const driver = await resolveDriver(String(token || ''));
  if (!driver) return res.status(404).json({ error: 'Trip link not found or no longer active.' });

  const now = new Date().toISOString();

  if (action === 'start' || action === 'deliver') {
    const { deliveryId } = req.body || {};
    const { data: rows } = await supabaseAdmin
      .from('delivery_logs')
      .select('id, order_id, status, proof_photo')
      .eq('id', deliveryId)
      .eq('driver_id', driver.id)
      .limit(1);
    const delivery = rows?.[0];
    if (!delivery) return res.status(403).json({ error: 'Stop not found for this trip.' });

    if (action === 'start') {
      if (delivery.status !== 'ASSIGNED') return res.status(200).json({ ok: true });
      await supabaseAdmin.from('delivery_logs').update({ status: 'IN_TRANSIT', updated_at: now }).eq('id', delivery.id);
      if (delivery.order_id) {
        await supabaseAdmin.from('orders').update({ status: 'OUT_FOR_DELIVERY', updated_at: now }).eq('id', delivery.order_id);
      }
    } else {
      const { data: podSetting } = await supabaseAdmin.from('ceo_settings').select('setting_value').eq('setting_key', 'proof_of_delivery_required').maybeSingle();
      if (podSetting?.setting_value === true && !delivery.proof_photo) {
        return res.status(403).json({ error: 'A proof-of-delivery photo is required by the CEO before this can be marked delivered.' });
      }
      await supabaseAdmin.from('delivery_logs').update({ status: 'DELIVERED', delivered_at: now, updated_at: now }).eq('id', delivery.id);
      if (delivery.order_id) {
        await supabaseAdmin.from('orders').update({ status: 'DELIVERED', updated_at: now }).eq('id', delivery.order_id);
      }
    }
    return res.status(200).json({ ok: true });
  }

  if (action === 'ping') {
    const { data: gpsSetting } = await supabaseAdmin.from('ceo_settings').select('setting_value').eq('setting_key', 'gps_tracking_enabled').maybeSingle();
    if (gpsSetting && gpsSetting.setting_value === false) {
      return res.status(403).json({ error: 'GPS tracking is currently disabled by the CEO.' });
    }
    const { deliveryId, latitude, longitude, accuracy } = req.body || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude are required.' });
    }

    // Throttle to the CEO-configured cadence — the browser's watchPosition
    // fires on every location update with no interval of its own, so this
    // is the only place that setting can actually take effect.
    const { data: intervalSetting } = await supabaseAdmin.from('ceo_settings').select('setting_value').eq('setting_key', 'gps_ping_interval').maybeSingle();
    const intervalMinutes = typeof intervalSetting?.setting_value === 'number' ? intervalSetting.setting_value : 0;
    if (intervalMinutes > 0) {
      const { data: lastPing } = await supabaseAdmin.from('driver_locations').select('recorded_at').eq('driver_id', driver.driver_id).order('recorded_at', { ascending: false }).limit(1).maybeSingle();
      if (lastPing?.recorded_at && Date.now() - new Date(lastPing.recorded_at).getTime() < intervalMinutes * 60000) {
        return res.status(200).json({ ok: true, throttled: true });
      }
    }

    const { error } = await supabaseAdmin.from('driver_locations').insert({
      driver_id: driver.driver_id,
      delivery_id: deliveryId || null,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (action === 'return') {
    await supabaseAdmin.from('drivers').update({ returned_at: now }).eq('id', driver.id);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action.' });
}
