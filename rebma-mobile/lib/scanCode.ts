// Works out what a scanned or typed code is, for the waybill Scanner on
// web and phone (rebma-web/src/utils/scanCode.ts is an identical copy).
//
// Waybills carry a small JSON payload ({ waybillNumber, orderId, ... }).
// Dispatch Tickets printed before waybills existed carry a text block that
// starts "REBMA IMPEX GHANA LIMITED" and includes "Ticket: TKT-...", so the
// order (and its waybill) can still be found from the ticket number.
// Receipts and proformas also have QR codes but aren't delivery papers.

export type ScannedCode =
  | { kind: 'waybill'; waybillNumber: string; orderId?: string | null }
  | { kind: 'ticket'; ticketNumber: string }
  | { kind: 'receipt'; number: string }
  | { kind: 'proforma'; number: string }
  | { kind: 'unknown' };

const field = (text: string, name: string) => {
  const m = text.match(new RegExp(`${name}:\\s*([A-Za-z0-9-]+)`, 'i'));
  return m ? m[1] : '';
};

export function readScannedCode(raw: string): ScannedCode {
  const text = String(raw || '').trim();
  if (!text) return { kind: 'unknown' };

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.waybillNumber) return { kind: 'waybill', waybillNumber: String(parsed.waybillNumber), orderId: parsed.orderId ?? null };
    } catch { /* not JSON */ }
  }

  const ticket = field(text, 'Ticket');
  if (ticket) return { kind: 'ticket', ticketNumber: ticket };
  const receipt = field(text, 'Receipt');
  if (receipt) return { kind: 'receipt', number: receipt };
  const proforma = field(text, 'Proforma');
  if (proforma) return { kind: 'proforma', number: proforma };

  // Something typed by hand: a waybill number, or a ticket number.
  if (/^WB-/i.test(text)) return { kind: 'waybill', waybillNumber: text.toUpperCase() };
  if (/^TKT-/i.test(text)) return { kind: 'ticket', ticketNumber: text.toUpperCase() };
  if (!/\s/.test(text) && text.length <= 40) return { kind: 'waybill', waybillNumber: text };
  return { kind: 'unknown' };
}

/** A short, readable message for a code that isn't a delivery paper. */
export function notADeliveryPaper(code: ScannedCode): string | null {
  if (code.kind === 'receipt') return `That's payment receipt ${code.number}, not a waybill. Scan the waybill that travels with the goods.`;
  if (code.kind === 'proforma') return `That's proforma invoice ${code.number}, not a waybill. Scan the waybill that travels with the goods.`;
  if (code.kind === 'unknown') return "That code isn't a REBMA waybill or dispatch ticket.";
  return null;
}
