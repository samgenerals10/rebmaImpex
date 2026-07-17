// rebma-web/src/utils/whatsapp.ts
// Zero-cost WhatsApp dispatch: no Twilio/Meta business API, no signup, no
// per-message fee. wa.me is a free deep link WhatsApp itself publishes —
// it opens a chat with the message pre-filled; a human still has to tap
// Send. That one tap is the price of not paying anyone for automation.
const DEFAULT_COUNTRY_CODE = '233'; // Ghana

export function toWhatsAppDigits(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) return digits;
  if (digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits.slice(1);
  if (digits.length === 9) return DEFAULT_COUNTRY_CODE + digits;
  return digits;
}

export function mapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export interface WhatsAppStop {
  sequence: number;
  customerName: string;
  deliveryAddress: string;
}

export function buildDirectionsMessage(driverName: string, stops: WhatsAppStop[]): string {
  const trackingUrl = window.location.origin;
  const lines = [`Hi ${driverName}, you have ${stops.length} ${stops.length === 1 ? 'delivery' : 'deliveries'} today:`, ''];
  for (const stop of stops) {
    lines.push(`Stop ${stop.sequence}: ${stop.customerName}`);
    if (stop.deliveryAddress) {
      lines.push(stop.deliveryAddress);
      lines.push(`Directions: ${mapsLink(stop.deliveryAddress)}`);
    }
    lines.push('');
  }
  lines.push(`Log in at ${trackingUrl} with your driver account to mark each stop delivered as you go.`);
  return lines.join('\n');
}

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${toWhatsAppDigits(phone)}?text=${encodeURIComponent(message)}`;
}
