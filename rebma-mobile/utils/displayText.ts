// Older audit and notification records were saved with dashes, arrows and
// pipes joining their parts ("APPROVE: ORD-AB12 — Rice | Note: ok"). New
// records use commas, but the old rows are still in the database, so the
// history and activity cards tidy the text when they show it. The stored
// rows are never changed (the approval screens still parse the raw text).
//
// Dashes inside ids such as ORD-AB12 are left alone: only a dash with a
// space on both sides, or an em/en dash, counts as joining punctuation.

/** Replace joining dashes, arrows and pipes with plain words and commas. */
export function cleanDisplayText(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\s*\|\s*Note:\s*/gi, '. Note: ')
    .replace(/\s*\|\s*Reason:\s*/gi, '. Reason: ')
    .replace(/\s*(→|->|=>)\s*/g, ' to ')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\s*\|\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/^\s*,\s*|\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const VERB_WORDS: Record<string, string> = {
  APPROVE: 'Approved',
  APPROVED: 'Approved',
  REJECT: 'Rejected',
  REJECTED: 'Rejected',
  RETURN: 'Returned for correction',
  RETURNED: 'Returned for correction',
  ESCALATE: 'Escalated',
  ESCALATED: 'Escalated',
  RECORD: 'Recorded',
  CORRECT: 'Corrected',
  EXPORT: 'Exported',
  DELETE: 'Deleted',
  CREATE: 'Created',
  UPDATE: 'Updated',
};

/**
 * Turn a stored audit action into a readable line.
 * "APPROVE: CARGO-AB12 — Rice" becomes "Approved CARGO-AB12, Rice";
 * "CORRECT_CARGO: C-9, Rice" becomes "Corrected cargo: C-9, Rice";
 * a bare code like "ORDER_CREATED" becomes "Order created".
 */
export function formatAuditAction(raw: string | null | undefined): string {
  const text = cleanDisplayText(raw);
  if (!text) return '';

  const prefixed = text.match(/^([A-Z][A-Z_]+):\s*(.*)$/);
  if (prefixed) {
    const [, code, rest] = prefixed;
    const words = code.split('_').filter(Boolean);
    const verb = VERB_WORDS[words[0]];
    if (verb) {
      const tail = words.slice(1).join(' ').toLowerCase();
      if (!tail) return rest ? `${verb} ${rest}` : verb;
      return rest ? `${verb} ${tail}: ${rest}` : `${verb} ${tail}`;
    }
    const label = sentenceCase(words.join(' '));
    return rest ? `${label}: ${rest}` : label;
  }

  if (/^[A-Z][A-Z_]+$/.test(text)) return sentenceCase(text.replace(/_/g, ' '));
  return text;
}

function sentenceCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
