/** Escape database/user text before inserting it into a printable HTML document.
 * Use for text and quoted attribute values, never to bless arbitrary markup.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]!));
}
