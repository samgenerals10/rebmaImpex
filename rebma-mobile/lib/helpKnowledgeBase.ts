// rebma-mobile/lib/helpKnowledgeBase.ts
//
// The CEO-only Help Assistant's knowledge base — direct instruction:
// a smart search/helper tool, NOT a real AI service. No API key, no
// backend call, no per-message cost, works instantly offline. It's a
// deterministic keyword-match search over real app data, not a
// language model, so it can never "hallucinate" an answer that isn't
// grounded in the actual app.
//
// Two knowledge sources, both real, not hand-invented:
//  1. Every Control Center setting — imported directly from
//     ControlCenterScreen.tsx's own SECTIONS array (one source of
//     truth; a new toggle added there is automatically searchable here,
//     no second place to update).
//  2. Every department + its real sub-pages — built from
//     DEPARTMENT_REGISTRY, but LAZILY (inside a function, not at
//     module top-level) on purpose: departmentRegistry.ts imports the
//     Help Assistant screen (to register it as CEO's own subTab), which
//     imports this file, which would otherwise import
//     DEPARTMENT_REGISTRY back — a circular import. Reading it eagerly
//     at module-eval time risks seeing an unfinished (partially
//     undefined) registry object depending on load order; reading it
//     lazily, the first time someone actually searches, sidesteps that
//     entirely since by then every module has finished loading.
//
// Plus a small set of hand-written entries for the cross-department
// business workflows (the order chain, the cargo chain) that don't
// live in any one file — each grounded in the exact chain confirmed
// earlier this session by reading the real approval-flow source, not
// guessed.
//
// Matching rewrite on the web side too (both platforms confirmed twice
// now to stay non-AI, zero-cost): typo tolerance, a small synonym map,
// and confidence-based replies via getHelpReply() — a single clear
// answer, a short "might be one of these" list when genuinely
// ambiguous, or an honest "not sure," never a guess dressed up as
// certain.
import type { DepartmentEntry } from '../navigation/departmentRegistry';
import { SECTIONS as CONTROL_CENTER_SECTIONS, type SettingField } from '../screens/settings/ControlCenterScreen';

export interface HelpEntry {
  id: string;
  title: string;
  answer: string;
  /** Numbered, actionable "how to actually do this" steps — separate from
   *  `answer` (what the thing is/does). Auto-generated for every Control
   *  Center entry directly from real field data (so it can never drift
   *  from what Control Center actually renders); hand-written for the
   *  small set of cross-department workflow entries, where a real
   *  multi-stage answer is worth the manual accuracy. */
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

function fieldDescription(f: SettingField): string {
  return 'description' in f && f.description ? f.description : '';
}

/** Auto-generated, never hand-maintained — derived straight from the real
 *  field, so a setting's "how to change it" steps can never drift from
 *  where it actually lives in Control Center. */
function stepsForField(sectionTitle: string, f: SettingField): string[] {
  const openSteps = ['Open Settings → Control Center.', `Tap the "${sectionTitle}" section.`];
  switch (f.kind) {
    case 'bool':
      return [...openSteps, `Find "${f.label}" and switch it on or off.`];
    case 'number':
      return [...openSteps, `Find "${f.label}" and type in the new number.`];
    case 'select':
      return [...openSteps, `Find "${f.label}" and pick the option you want from the list.`];
    case 'text':
      return [...openSteps, `Find "${f.label}", type the new wording, and tap outside the box to save it.`];
  }
}

function buildControlCenterEntries(): HelpEntry[] {
  return CONTROL_CENTER_SECTIONS.flatMap((section) =>
    section.fields.map((f) => ({
      id: `cc-${f.key}`,
      title: f.label,
      answer: [
        `"${f.label}" is a Control Center setting under Section — ${section.title}.`,
        fieldDescription(f),
      ].filter(Boolean).join(' '),
      steps: stepsForField(section.title, f),
      keywords: [
        f.key.replace(/_/g, ' '),
        f.label.toLowerCase(),
        section.title.toLowerCase(),
        section.id,
        ...fieldDescription(f).toLowerCase().split(/\s+/),
      ],
      navigateTo: { department: 'SETTINGS', subTab: 'ControlCenter' },
    }))
  );
}

// Department codes excluded from the switcher (Boardroom is folded into
// Viber, Settings isn't a department) — same exclusion
// availableDepartments() itself already applies, mirrored here so the
// directory only lists real, switchable departments.
const EXCLUDED_DEPT_CODES = new Set(['SETTINGS', 'BOARDROOM']);

function buildDepartmentEntries(registry: Record<string, DepartmentEntry>): HelpEntry[] {
  return Object.values(registry)
    .filter((d) => !EXCLUDED_DEPT_CODES.has(d.code))
    .map((d) => ({
      id: `dept-${d.code}`,
      title: d.label,
      answer: `${d.label} has these pages: ${d.subTabs.map((s) => s.label).join(', ')}.`,
      steps: ['Open the department switcher.', `Select "${d.label}".`, 'Tap the page you need from the list.'],
      keywords: [d.code.toLowerCase(), d.label.toLowerCase(), ...d.subTabs.map((s) => s.label.toLowerCase())],
      navigateTo: { department: d.code, subTab: d.defaultSubTab },
    }));
}

// Hand-written, not derived — these describe a business process that
// spans several departments and files, confirmed this session by
// reading the real approval-flow source (not guessed).
const WORKFLOW_ENTRIES: HelpEntry[] = [
  {
    id: 'wf-order-chain',
    title: 'How an order moves through the company',
    answer:
      'Marketing creates the order (PENDING_RISK) → Risk does the initial review (PENDING_MANAGEMENT) → Management reviews (PENDING_FINANCE) → Account Department reviews, checks stock, deducts it (PENDING_RISK_RELEASE) → Risk gives the final release for warehouse → Admin & Warehouse marks it ready for dispatch → Risk assigns a vehicle/driver and dispatches it → Risk reviews the Proof of Delivery, which is the only step that ever marks an order DELIVERED.',
    steps: [
      'Marketing creates the order — status becomes PENDING_RISK.',
      'Risk does the initial review — approving moves it to PENDING_MANAGEMENT.',
      'Management reviews it — approving moves it to PENDING_FINANCE.',
      'Account Department reviews it, checks stock, and deducts it — approving moves it to PENDING_RISK_RELEASE.',
      'Risk gives the final release for warehouse.',
      'Admin & Warehouse marks it ready for dispatch.',
      'Risk assigns a vehicle and driver, then dispatches it.',
      'Risk reviews the Proof of Delivery — this is the only step that marks an order DELIVERED.',
    ],
    keywords: ['order', 'workflow', 'approval', 'chain', 'risk', 'management', 'finance', 'accounts', 'dispatch', 'delivery', 'delivered', 'pending'],
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
      'Check Control Center → Section 1 — Access Control → "Mobile App Access Allowed". This ONLY blocks the mobile app — it never affects logging into the web app, so if web works but mobile doesn’t for the same account, this switch (or a per-email exception, set on web only) is almost always why.',
    steps: [
      'Have them sign into the web app first — this setting never blocks web, only mobile.',
      'Open Settings → Control Center → Access Control.',
      'Check "Mobile App Access Allowed" — if it\'s off, turn it on.',
      "If it's already on, a per-email block could be set on web (Control Center's exception list is web-only) — ask someone with web access to check it.",
      "Have them try signing into the mobile app again — it's checked on every login attempt, so it takes effect immediately.",
    ],
    keywords: ['mobile', 'login', 'sign in', 'access', 'disabled', 'blocked', 'app access', 'cant log in', "can't log in"],
    navigateTo: { department: 'SETTINGS', subTab: 'ControlCenter' },
  },
  {
    id: 'wf-messaging-access',
    title: 'Why someone can’t send messages',
    answer:
      'Check Control Center → Section 6 — Communication Controls → "Messaging Access Allowed", plus Global Chat / Department Chat / Direct Messages Enabled. A per-email exception can also override the master switch, set on web only.',
    steps: [
      'Open Settings → Control Center → Communication Controls.',
      'Check "Messaging Access Allowed" is turned on.',
      'Also check Global Chat / Department Chat / Direct Messages Enabled — whichever type of message they\'re trying to send needs its own toggle on too.',
      "A per-email block could also be set on web (the exception list is web-only) — ask someone with web access to check it.",
    ],
    keywords: ['message', 'messaging', 'chat', 'cant send', "can't send", 'blocked', 'viber'],
    navigateTo: { department: 'SETTINGS', subTab: 'ControlCenter' },
  },
];

let cache: HelpEntry[] | null = null;

function ensureCache(registry: Record<string, DepartmentEntry>): HelpEntry[] {
  if (!cache) {
    cache = [...buildControlCenterEntries(), ...buildDepartmentEntries(registry), ...WORKFLOW_ENTRIES];
  }
  return cache;
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
export function searchHelp(query: string, registry: Record<string, DepartmentEntry>, limit = 5): HelpEntry[] {
  const entries = ensureCache(registry);
  const words = toQueryWords(query);
  if (words.length === 0) return [];
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, words) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * The Assistant's real entry point — confidence-based, never a guessed
 * single answer dressed up as certain. Genuinely ambiguous queries get
 * a short list to choose from instead of a guess; queries that don't
 * match anything well get an honest "not sure," not a stretch.
 */
export function getHelpReply(query: string, registry: Record<string, DepartmentEntry>): HelpReply {
  const smallTalk = detectSmallTalk(query);
  if (smallTalk) return { kind: 'greeting', message: smallTalk };

  const words = toQueryWords(query);
  if (words.length === 0) {
    return { kind: 'unsure', message: "I didn't catch a question there — could you type what you're looking for?" };
  }

  const entries = ensureCache(registry);
  const scored = entries
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
