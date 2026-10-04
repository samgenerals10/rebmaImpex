// rebma-web/src/utils/helpKnowledgeBase.ts
//
// The CEO-only Help Assistant's knowledge base (web side — the mobile
// app has the same feature in rebma-mobile/lib/helpKnowledgeBase.ts,
// built to the same design). Still no AI service — deterministic,
// zero-cost, zero-API-key matching over real app data, confirmed twice
// now. Two upgrades over the first version:
//
// 1. Control Center settings are no longer a hand-copied duplicate —
//    they're imported directly from utils/ceoSettingsSchema.ts, the
//    same schema CeoControlCenter.tsx now renders itself from. One
//    real source; a setting added there is automatically both rendered
//    and searchable, no second file to remember. (This replaced a
//    version that had silently drifted already — the original
//    transcription was missing 2 real Access Control fields entirely,
//    caught while building this file, not by luck.)
// 2. Smarter matching: typo tolerance, a small synonym map, confidence-
//    based replies (a single clear answer, a short "might be one of
//    these" list when genuinely ambiguous, or an honest "not sure" —
//    never a guessed answer dressed up as a confident one), and small-
//    talk handling. Still can't invent an answer that isn't grounded in
//    real app data — a keyword matcher can only ever point at something
//    that actually exists.

import { CEO_SETTINGS_SCHEMA, type SettingFieldSpec } from './ceoSettingsSchema';

export interface HelpEntry {
  id: string;
  title: string;
  answer: string;
  /** Numbered, actionable "how to actually do this" steps — separate from
   *  `answer` (what the thing is/does). Auto-generated for every schema-
   *  driven Control Center entry directly from real field data (so it
   *  can never drift from what Control Center actually renders); hand-
   *  written for the small set of cross-department workflow entries,
   *  where a real multi-stage answer is worth the manual accuracy. */
  steps?: string[];
  keywords: string[];
  navigateTo?: { department: string; subTab: string };
}

export type HelpReplyKind = 'greeting' | 'confident' | 'weak' | 'multiple' | 'unsure';

export interface HelpReply {
  kind: HelpReplyKind;
  message?: string;
  results?: HelpEntry[];
}

// Verbatim from Sidebar.tsx's departmentTabs object — every real page,
// per department, exactly as the sidebar itself renders it. Not yet
// derived from a shared export the way Control Center now is (Sidebar
// has no such export to import from) — flagged, not fixed, in the plan
// this came from.
const DEPARTMENTS: { code: string; label: string; defaultSubTab: string; pages: string[] }[] = [
  { code: 'CEO', label: 'CEO Command', defaultSubTab: 'Overview', pages: ['Dashboard', 'Supplier Orders', 'Transactions', 'Invoices', 'Receipts', 'Price Catalog', 'Wallets', 'Accounts', 'Approvals', 'Price Approvals', 'GPS Tracking', 'Messages & Boardroom', 'Live Users', 'Dept Activity', 'Spreadsheets'] },
  { code: 'FINANCE', label: 'Finance', defaultSubTab: 'Evaluation', pages: ['Dashboard', 'Orders Queue', 'Payments', 'Receipts', 'Invoices', 'Sales History', 'Price Catalog', 'Wallets', 'Transactions', 'Recurring', 'Credit Management', 'Expenses', 'Tax & VAT', 'Cheques', 'Mobile Money', 'Petty Cash', 'Reports', 'Payroll', 'Spreadsheets'] },
  { code: 'RISK', label: 'Risk & Compliance', defaultSubTab: 'RiskOverview', pages: ['Dashboard', 'Approvals', 'Customer Credit', 'Recruitment', 'Dispatch Board', 'Deliveries', 'Drivers', 'GPS Tracking', 'Proof of Delivery', 'Scanner', 'Dept Activity', 'Spreadsheets'] },
  { code: 'MANAGEMENT', label: 'Management', defaultSubTab: 'CargoApproval', pages: ['Dashboard', 'Approvals', 'Transactions', 'Price Setting', 'Invoices', 'Receipts', 'Audit Log', 'Payroll Overview', 'Analytics', 'Stock Management', 'Dept Activity', 'Performance Alerts', 'Spreadsheets'] },
  { code: 'HR', label: 'Human Resources', defaultSubTab: 'Employees', pages: ['Dashboard', 'Staff', 'Attendance', 'Registrations', 'Leave Management', 'Payroll', 'Department Manager', 'Performance Alerts', 'Spreadsheets'] },
  { code: 'MARKETING', label: 'Marketing', defaultSubTab: 'CreateOrder', pages: ['Dashboard', 'Orders', 'Customers', 'Price Catalog', 'Credit Requests', 'Analytics', 'Spreadsheets'] },
  { code: 'ADMIN_WAREHOUSE', label: 'Admin & Warehouse', defaultSubTab: 'Overview', pages: ['Dashboard', 'Stock Intake', 'Approved Goods', 'Stock', 'Fulfillment', 'Discrepancy Reports', 'Fleet Overview', 'Fuel Management', 'Maintenance Schedule', 'Fleet Analytics', 'Warehouse Analytics', 'Spreadsheets'] },
  { code: 'RECEPTION', label: 'Reception', defaultSubTab: 'VisitorLog', pages: ['Dashboard', 'Visitors', 'Attendance', 'Daily Reports', 'Analytics', 'Spreadsheets'] },
  { code: 'PRODUCTION', label: 'Production', defaultSubTab: 'Requisition', pages: ['Dashboard', 'Internal Orders', 'WIP Stock', 'Output Recording', 'Analytics', 'Spreadsheets'] },
  { code: 'BOARDROOM', label: 'Boardroom', defaultSubTab: 'VideoConf', pages: ['Live Video Minutes', 'Announcements', 'Direct Messages', 'Meetings Organizer'] },
  { code: 'SETTINGS', label: 'Settings', defaultSubTab: 'Appearance', pages: ['Display & Appearance', 'Profile & Account', 'Change Password', 'Two-Factor Authentication', 'Control Center', 'Delete Account'] },
];

// Two more Control Center sections exist but aren't in the schema on
// purpose (each embeds a whole other view/component, not a plain field
// list) — kept here as their own hand-written entries so they're still
// searchable, matching the same "excluded from schema, not from search"
// treatment given to them in CeoControlCenter.tsx itself.
const NON_SCHEMA_CONTROL_CENTER_ENTRIES: HelpEntry[] = [
  {
    id: 'cc-document_templates',
    title: 'Document Templates',
    answer: 'Document Templates is a Control Center section (collapsed by default) for editing the branded letterhead used on receipts, invoices, and waybills — logo, company info, footer note.',
    steps: [
      'Open Control Center (your avatar menu, or Settings → Control Center).',
      'Tap "Document Templates" (collapsed by default — tap it to expand).',
      'Edit the logo, company name, address, phone, email, or footer note, then save.',
    ],
    keywords: ['document', 'templates', 'letterhead', 'logo', 'receipt', 'invoice', 'waybill', 'branding'],
    navigateTo: { department: 'SETTINGS', subTab: 'ControlCenter' },
  },
  {
    id: 'cc-data_reset_center',
    title: 'Data Reset Center',
    answer: 'Data Reset Center (Control Center, collapsed by default) permanently clears a department’s real data after a typed CONFIRM DELETE. Highly destructive.',
    steps: [
      'Open Control Center and expand "Data Reset Center".',
      'Pick the department whose data you want to clear.',
      'Type CONFIRM DELETE exactly to unlock the button, then confirm. This cannot be undone.',
    ],
    keywords: ['data reset', 'reset center', 'delete data', 'wipe', 'clear data', 'destructive'],
    navigateTo: { department: 'SETTINGS', subTab: 'ControlCenter' },
  },
];

const WORKFLOW_ENTRIES: HelpEntry[] = [
  {
    id: 'wf-order-chain',
    title: 'How an order moves through the company',
    answer:
      'Marketing creates the order (PENDING_RISK) → Risk does the initial review (PENDING_MANAGEMENT) → Management reviews (PENDING_FINANCE) → Finance reviews, checks stock, deducts it (PENDING_RISK_RELEASE) → Risk gives the final release for warehouse → Admin & Warehouse marks it ready for dispatch → Risk assigns a vehicle/driver and dispatches it → Risk reviews the Proof of Delivery, the only step that ever marks an order DELIVERED.',
    steps: [
      'Marketing creates the order — status becomes PENDING_RISK.',
      'Risk does the initial review — approving moves it to PENDING_MANAGEMENT.',
      'Management reviews it — approving moves it to PENDING_FINANCE.',
      'Finance reviews it, checks stock, and deducts it — approving moves it to PENDING_RISK_RELEASE.',
      'Risk gives the final release for warehouse.',
      'Admin & Warehouse marks it ready for dispatch.',
      'Risk assigns a vehicle and driver, then dispatches it.',
      'Risk reviews the Proof of Delivery — this is the only step that marks an order DELIVERED.',
    ],
    keywords: ['order', 'workflow', 'approval', 'chain', 'risk', 'management', 'finance', 'dispatch', 'delivery', 'delivered', 'pending'],
    navigateTo: { department: 'MARKETING', subTab: 'CreateOrder' },
  },
  {
    id: 'wf-cargo-chain',
    title: 'How cargo intake is approved',
    answer:
      'Admin & Warehouse logs the cargo at Stock Intake (status PENDING_RISK_APPROVAL) → Risk approves, rejects, or returns it for correction under Approvals. On approval, stock and the stock ledger update automatically.',
    steps: [
      'Admin & Warehouse logs the cargo at Stock Intake — status becomes PENDING_RISK_APPROVAL.',
      'Risk reviews it under Approvals and chooses Approve, Reject, or Return for Correction.',
      'On approval, stock and the stock ledger update automatically. No manual entry needed elsewhere.',
    ],
    keywords: ['cargo', 'intake', 'stock', 'port', 'ingestion', 'approval', 'risk', 'discrepancy'],
    navigateTo: { department: 'ADMIN_WAREHOUSE', subTab: 'PortIngestion' },
  },
  {
    id: 'wf-mobile-access',
    title: 'Why someone can’t log into the mobile app',
    answer:
      'Check Control Center → Section 1 — Access Control → "Mobile App Access". This ONLY blocks the mobile app — it never affects logging into the web app, so if web works but mobile doesn’t for the same account, this switch (or a per-email exception right below it) is almost always why.',
    steps: [
      "Have them sign into the web app first — this setting never blocks web, only mobile.",
      'Open Control Center → Section 1, Access Control.',
      'Check "Mobile App Access" — if the master switch is off, turn it on.',
      "If it's already on, scroll to the email exception list right below it and check whether that person's email is listed as blocked. Remove or flip that exception if so.",
      "Have them try signing into the mobile app again — it's checked on every login attempt, so it takes effect immediately.",
    ],
    keywords: ['mobile', 'login', 'sign in', 'access', 'disabled', 'blocked', 'app access', 'cant log in', "can't log in", 'web works'],
    navigateTo: { department: 'SETTINGS', subTab: 'ControlCenter' },
  },
  {
    id: 'wf-messaging-access',
    title: 'Why someone can’t send messages',
    answer:
      'Check Control Center → Section 6 — Communication Controls → "Messaging Access", plus Global Chat / Department Chat / Direct Messages Enabled. A per-email exception can also override the master switch.',
    steps: [
      'Open Control Center → Section 6, Communication Controls.',
      'Check "Messaging Access" is turned on.',
      'Also check Global Chat / Department Chat / Direct Messages Enabled — whichever type of message they\'re trying to send needs its own toggle on too.',
      'Check the email exception list under "Messaging Access" for a blocked entry for that person.',
    ],
    keywords: ['message', 'messaging', 'chat', 'cant send', "can't send", 'blocked', 'boardroom'],
    navigateTo: { department: 'SETTINGS', subTab: 'ControlCenter' },
  },
];

/** Auto-generated, never hand-maintained — derived straight from the real
 *  schema field, so a setting's "how to change it" steps can never drift
 *  from where it actually lives in Control Center. */
function stepsForField(sectionTitle: string, f: SettingFieldSpec): string[] {
  const openSteps = ['Open Control Center (your avatar menu, or Settings → Control Center).', `Tap "${sectionTitle}".`];
  switch (f.kind) {
    case 'toggle':
      return [...openSteps, `Find "${f.label}" and switch it on or off.`];
    case 'toggleWithException':
      return [
        ...openSteps,
        `Find "${f.label}" and switch it on or off.`,
        'To override it for one specific person regardless of the master switch, use the email exception list right below it.',
      ];
    case 'number':
      return [...openSteps, `Find "${f.label}" and type in the new number, then tap elsewhere to save.`];
    case 'text':
      return [...openSteps, `Find "${f.label}", type the new wording, then click elsewhere to save.`];
    case 'select':
      return [...openSteps, `Find "${f.label}" and pick the option you want from the list.`];
  }
}

let cache: HelpEntry[] | null = null;

function build(): HelpEntry[] {
  const controlCenterEntries: HelpEntry[] = CEO_SETTINGS_SCHEMA.flatMap((section) =>
    section.fields.map((f) => ({
      id: `cc-${f.key}`,
      title: f.label,
      answer: `"${f.label}" is a Control Center setting under ${section.title}. ${f.description}`,
      steps: stepsForField(section.title, f),
      keywords: [f.key.replace(/_/g, ' '), f.label.toLowerCase(), section.title.toLowerCase(), ...f.description.toLowerCase().split(/\s+/)],
      navigateTo: { department: 'SETTINGS', subTab: 'ControlCenter' },
    }))
  );

  const departmentEntries: HelpEntry[] = DEPARTMENTS.map((d) => ({
    id: `dept-${d.code}`,
    title: d.label,
    answer: `${d.label} has these pages: ${d.pages.join(', ')}.`,
    steps: ['Open the department switcher (top left, or your avatar menu).', `Select "${d.label}".`, 'Tap the page you need from its sidebar.'],
    keywords: [d.code.toLowerCase(), d.label.toLowerCase(), ...d.pages.map((p) => p.toLowerCase())],
    navigateTo: { department: d.code, subTab: d.defaultSubTab },
  }));

  return [...controlCenterEntries, ...NON_SCHEMA_CONTROL_CENTER_ENTRIES, ...departmentEntries, ...WORKFLOW_ENTRIES];
}

// ── Typo tolerance (dependency-free Levenshtein) ───────────────────────────
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Word-boundary tokenization ─────────────────────────────────────────────
// Direct correction to my own first draft, found by testing it against
// real queries before shipping (see the plan file's verification
// section): raw substring checks (`haystack.includes(word)`) let a short
// word like "log" false-match inside an unrelated word like "catalog".
// Tokenizing and comparing whole words only fixes that.
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
// Naive singular/plural normalization (strip one trailing 's' on words
// over 3 letters) — needed once word-boundary matching went in, or a
// query for "payment" would miss a real setting titled "...Payments
// Enabled" (plural) entirely, a real false-negative this introduced and
// caught in the same test pass.
function stem(w: string): string {
  return w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w;
}
function tokenHit(word: string, tokens: string[]): boolean {
  const sw = stem(word);
  return tokens.some((t) => t === word || stem(t) === sw);
}

function fuzzyHit(word: string, haystackText: string): boolean {
  const maxDist = word.length <= 5 ? 1 : 2;
  return tokenize(haystackText).some((tok) => Math.abs(tok.length - word.length) <= maxDist && levenshtein(word, tok) <= maxDist);
}

// ── Synonym expansion ───────────────────────────────────────────────────────
// Kept deliberately narrow after testing — an earlier draft grouped
// 'access' with 'allow', which sounds reasonable but 'allow' is the
// generic opening word of nearly every setting's own description
// ("Allow Cash as payment type...", "Allow Management to..."), so that
// group alone made "mobile access" tie with "Mobile Money Enabled" in
// testing. Every group below was checked against the real knowledge
// base the same way before being kept.
const SYNONYM_GROUPS: string[][] = [
  ['login', 'signin'],
  ['block', 'blocked', 'disable', 'disabled', 'deny', 'denied', 'prevent', 'prevented'],
  ['phone', 'cellphone', 'android', 'iphone'],
  ['page', 'screen', 'tab'],
  ['setting', 'toggle', 'switch'],
  ['access', 'permission'],
  ['reset', 'wipe', 'erase'],
];
function expandSynonyms(word: string): string[] {
  const group = SYNONYM_GROUPS.find((g) => g.includes(word));
  return group ? group : [word];
}

// ── Small talk ───────────────────────────────────────────────────────────
const GREETINGS = ['hi', 'hello', 'hey', 'hiya', 'yo', 'sup'];
const THANKS = ['thanks', 'thank you', 'thx', 'appreciate it', 'cheers'];
function detectSmallTalk(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/[!.?]+$/, '');
  if (GREETINGS.includes(t)) return "Hi! Ask me about a Control Center setting, a department's pages, or why something got blocked.";
  if (THANKS.some((x) => t === x || t.includes(x))) return "You're welcome!";
  return null;
}

// Common function words that would otherwise score as if they were
// meaningful search terms (e.g. "in" is a real token inside dozens of
// unrelated descriptions) — filtered out of every query alongside the
// existing length>1 filter. Found via the same test pass: "log in
// problem" was matching unrelated payment settings purely because of
// the word "in".
const STOPWORDS = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'this', 'that', 'for', 'with', 'as', 'by', 'from', 'my', 'me', 'i', 'can', 'do', 'does', 'did']);
function toQueryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function scoreEntry(entry: HelpEntry, words: string[]): number {
  const titleTok = tokenize(entry.title);
  const kwTok = tokenize(entry.keywords.join(' '));
  const hayTok = tokenize(`${entry.title} ${entry.answer} ${entry.keywords.join(' ')}`);
  let score = 0;
  for (const rawWord of words) {
    let wordScore = 0;
    if (tokenHit(rawWord, titleTok)) wordScore = 3;
    else if (tokenHit(rawWord, kwTok)) wordScore = 2;
    else if (tokenHit(rawWord, hayTok)) wordScore = 1;
    // Synonym hits are capped below any direct match — a related-concept
    // signal, never as strong as the real word actually appearing.
    if (wordScore === 0) {
      for (const w of expandSynonyms(rawWord)) {
        if (w === rawWord) continue;
        if (tokenHit(w, titleTok) || tokenHit(w, kwTok) || tokenHit(w, hayTok)) { wordScore = 1.5; break; }
      }
    }
    if (wordScore === 0 && fuzzyHit(rawWord, hayTok.join(' '))) wordScore = 0.5;
    score += wordScore;
  }
  return score;
}

/** Kept for anything that just wants a raw ranked list. */
export function searchHelp(query: string, limit = 5): HelpEntry[] {
  if (!cache) cache = build();
  const words = toQueryWords(query);
  if (words.length === 0) return [];
  return cache
    .map((entry) => ({ entry, score: scoreEntry(entry, words) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * The Assistant's real entry point — confidence-based, never a guessed
 * single answer dressed up as certain. This is the concrete mechanism
 * for "without making wrong judgements": genuinely ambiguous queries
 * get a short list to choose from instead of a guess, and queries that
 * don't match anything well get an honest "not sure," not a stretch.
 */
export function getHelpReply(query: string): HelpReply {
  const smallTalk = detectSmallTalk(query);
  if (smallTalk) return { kind: 'greeting', message: smallTalk };

  const words = toQueryWords(query);
  if (words.length === 0) {
    return { kind: 'unsure', message: "I didn't catch a question there — could you type what you're looking for?" };
  }

  if (!cache) cache = build();
  const scored = cache
    .map((entry) => ({ entry, score: scoreEntry(entry, words) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { kind: 'unsure', message: "I don't have anything on that in the app. Try different words, or tell me the exact setting or page name." };
  }

  const top = scored[0];
  const second = scored[1];
  const maxPossible = words.length * 3;
  const confidence = top.score / maxPossible;

  if (confidence >= 0.6 && (!second || top.score >= second.score * 1.5)) {
    return { kind: 'confident', results: [top.entry] };
  }

  const close = scored.filter((s) => s.score >= top.score * 0.6).slice(0, 3);
  if (close.length > 1) {
    return { kind: 'multiple', results: close.map((s) => s.entry) };
  }

  return { kind: 'weak', results: [top.entry] };
}
