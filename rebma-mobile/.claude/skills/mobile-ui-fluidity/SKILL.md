---
name: mobile-ui-fluidity
description: Rebma mobile's visual redesign language. Load this before restyling or building any rebma-mobile screen so cards, lists, tabs, buttons, and progress indicators stay consistent with the approved fluid direction, using Rebma's own green identity and real icons, never the purple/illustrated reference app's colors or artwork.
---

# Rebma Mobile — Fluid UI Skill

## Where this came from

The user sent three reference-image sets (nine screens total, from a study-companion app called Aczone) and asked for the same fluidity, structure, and polish applied to Rebma's actual features and data. Two decisions were locked explicitly and must never be silently reopened:

- **Keep Rebma's own branding.** The reference app is purple with 3D illustrations. Rebma mobile's green identity (`colors.accent = #22c55e`), its logo, and its existing token system stay exactly as they are. Only the *shape* of the design — radius, spacing, card weight, tab style, progress visualization, icon tiles — comes from the reference.
- **Icons only, no illustration assets.** No commissioned or generated artwork. Every visual richness the reference gets from illustration, this app gets from color-coded icon tiles, shadows, and layout instead.

A third standing rule applies to every screen touched under this skill, not just new copy: **never use a hyphen or em dash as connecting punctuation** in any UI text — button labels, empty states, toasts, helper copy. Two sentences, "and", "so", or a comma, never "—" or " - " joining a clause. This is a standing instruction from the user, not specific to this skill, but it applies here constantly since redesign work touches copy on nearly every screen.

## The nine patterns, extracted screen by screen

These are the structural facts pulled from the reference images, independent of its color choices. Read them once; the "Applying this to Rebma" section below is where they become concrete token changes.

1. **Radius is aggressive and consistent.** Hero cards, list rows, and icon tiles all read as *rounded*, not just cards. Buttons and badges are always full pills.
2. **Every list row gets a colored icon tile.** A soft pastel-tinted rounded square with a matching solid-colored icon inside — not a plain gray or monochrome icon. The color maps to what the row *is* (a subject, a category, a status), so a long list scans by color before it scans by text.
3. **Progress renders in three shapes, chosen by context.** A circular ring with a percentage centered inside it, for one headline completion number (weekly goal, quiz progress). A horizontal bar with the percentage at the trailing end, for a list of parallel completions (subject progress, course completion). A row of small circles for a day-by-day streak, filled and checked for done days.
4. **Three card weights, spent deliberately.** *Hero*: a fully saturated accent-color background, white text, one dominant number or message, an icon or motif bleeding off one edge — used for the one thing per screen that should win the eye. *Soft*: a light tint background (not white, not saturated) for a secondary promo or streak. *List row*: white or near-white, with the color carried entirely by the icon tile, not the card background.
5. **Three tab styles, chosen by what they're switching.** *Pill-segmented*, solid fill on the active tab, for mutually exclusive views of the same data (In Progress / Completed / Bookmarked). *Plain-text filter chips*, only the active one gets a pill, for quick filters over a list (Today / Tomorrow / This Week). *Underline indicator*, bold text plus a bottom border with no pill at all, for document or content categories (All Notes / Subjects / Lecture Notes).
6. **Primary buttons are pills with a trailing icon badge.** The button itself is a solid pill; a separate small white circle sits at the trailing edge carrying an arrow, chevron, or play icon — visually distinct from the button's own fill, not just an inline icon+text pairing.
7. **Separation comes from tint and shadow, rarely from a hairline border.** Cards and rows are told apart by background color and soft elevation, not by a visible 1px line around every block.
8. **The bottom tab bar stays flat and functional.** Not a floating pill, not elevated off the screen edge — a plain bar with a subtle top shadow, outline icons when inactive, filled bold icons in the accent color when active.
9. **Section headers pair with a trailing "View all" link** in the accent color, right-aligned against the section title.

## Applying this to Rebma: token and component changes

Rebma's token system already has real infrastructure to carry most of this without inventing anything new. The work is mostly *using what's already defined more consistently*, plus a few real additions.

### Radius — already close, needs wider use

`theme/tokens.ts`'s `radius` scale (`sm:8, md:12, lg:16, card:24, pill:9999`) already matches the reference's card radius (`card:24`) and pill buttons exactly. What's inconsistent is that **list rows and icon tiles currently use `radius.md` (12)**, which reads noticeably tighter than the reference's rounded-everywhere feel. Bump list-row containers (the `DataList` row primitive, and any hand-rolled row/card in a screen) from `radius.md` to `radius.lg` (16). Icon tiles inside rows should also use `radius.lg`, not `radius.sm`/`radius.md`. Don't touch `radius.card` or `radius.pill` — they're already correct.

### Colored icon tiles — the token already exists, just underused

`colors.action` (`emerald, blue, indigo, amber, teal, sky, rose, violet`) is exactly the fixed, theme-independent palette the reference's per-category icon tiles need — it's currently reserved for `QuickActions`' icon circles only. Extend its use: **any list row representing a typed entity (an order, a department, a document category, a staff record, a status) gets a `radius.lg` tile, sized ~40–44px, with a background at roughly 12–15% opacity of one `colors.action` value and the icon rendered solid in that same value.** Pick the mapping once per domain and keep it stable (e.g. one action color per department, or per document/record type) rather than assigning colors ad hoc per screen — consistency across screens is what makes the color-coding actually useful for scanning, not just decorative.

Never use `colors.accent` for these tiles. `accent` stays reserved for primary actions, active states, and the app's own identity; `action` colors are what carry per-item variety.

### Progress — add the two shapes that don't exist yet

`DataList` and dashboards currently render completion as a plain number or a `Badge`. Two new shared primitives are needed under `components/ui/`:

- **`ProgressRing`** — a circular percentage ring (SVG or a `View`-based conic approximation), center-labeled with the percentage, sized for a headline metric. Use for one dominant completion figure per screen (e.g. an approval queue's clearance rate, a staff member's attendance rate on their own profile).
- **`ProgressBar`** (horizontal) — already partially covered by ad hoc bars in a few screens; formalize it as a shared primitive taking a 0–100 value and rendering a track plus a filled `colors.accent` (or a passed `action` color) segment, with the percentage as trailing text. Use anywhere a list has several parallel completions (stock fulfillment per product, order line-item progress, department headcount vs. target).
- A **streak/day-tracker row** (small filled/unfilled circles, one per day) is lower priority since Rebma's domain has fewer natural weekly-streak use cases than a study app, but the same primitive shape is worth having for Attendance-adjacent screens if a weekly view is ever built. Don't force it onto data that isn't actually day-by-day.

### Card weight — formalize the three tiers

`theme/presets.ts`'s `card` preset is currently one tier (white, `radius.card`, 1px border, `shadow('card')`). Add two variants without breaking the existing one:

- **Hero**: `backgroundColor: colors.accent` (or `accentPressed` for more contrast), white text throughout, no border, a stronger shadow (`shadow('raised')`). Reserve for exactly one thing per screen — a dashboard's single headline KPI, an approval queue's clearance summary, a quiz-style flow's progress header. Do not use it for more than one card per screen or it stops meaning "this is the important one."
- **Soft**: background `bgPage` (already what `cardInner` does) rather than `bgCard`, no border, light shadow or none. Use for secondary promos, streaks, and tips, which `cardInner` already covers structurally, just extend its use.
- **List row** (default `card` preset, but see the border note below) stays the neutral workhorse for repeatable rows.

### Borders — soften, don't remove

Every `card`/`cardInner` currently carries a 1px `border` token. Don't strip borders globally, since some do real work (input fields, dividers between sections). But for card-shaped containers specifically, prefer relying on `shadow('card')` alone and drop the border when the card already sits on a contrasting background (a white card on `bgPage`'s pale green already reads as separate without a line around it). Keep the border only where two adjacent surfaces are the same color and would otherwise visually merge.

### Tabs — pick the right one per screen, don't default to one style everywhere

Rebma mobile currently has one general tab pattern. Going forward, choose deliberately:

- Segmented tabs switching between full views of the same entity (an approval queue's status tabs, a staff profile's Attendance/Leave/Performance tabs) → pill-segmented, active tab gets a solid `accentSoft` or `accent` fill.
- A quick filter row over an existing list (date range, status quick-filter) → plain text chips, only the active one gets a pill background, others stay unstyled text.
- Document or record-category switching (Spreadsheets' Data vs. Free mode, a notes-style list) → underline indicator, bold text plus a 2px bottom border in `accent`, no pill.

### Buttons — add the trailing icon badge to primary CTAs

`components/ui/Button.tsx`'s `primary` variant is already a pill. Add an optional trailing-icon-badge slot: a small (~28px) white circle with 12–15% black overlay border, containing an arrow/chevron/play icon, positioned at the pill's trailing edge. Use it specifically for "move forward" actions (submit, continue, start, proceed), not for every button, since the reference itself reserves this treatment for that one action type, not general-purpose buttons.

### Section headers — add the trailing link consistently

Any screen with more than one logical section (a dashboard, an overview screen) should pair each section's bold title with a right-aligned "View all" (or equivalent) link in `colors.accent`, wherever more content genuinely exists behind it. Don't add a dead link where there's nothing further to show.

### Bottom nav — correction: the center FAB must go

An earlier pass on this skill claimed the bottom nav "already matches this direction, don't change." That was wrong, confirmed directly by the user against a live build: the nav bar has a raised, elevated green circular button in the center slot, floating above the bar. The reference never does this anywhere across all nine screens — every one of its bottom bars is a plain flat row of equally-sized icon+label items, five across, no item raised or visually distinct from the others beyond the active-state color.

Fix: flatten the center slot back to a normal tab item (its own icon and label, same size and baseline as the other four, no elevation, no larger circle). The "+" quick-add action moves out of the nav bar entirely and becomes a contextual floating action button on the individual screens that actually need a fast add action (e.g. a bottom-right FAB on Port Ingestion, matching the reference's own My Notes screen, which puts its "+" bottom-right over the content, not in the nav bar). Not every screen needs one; only add it where there's a real, single, obvious "create new" action for that screen.

## What this skill does not cover

- Feature parity gaps (what screens/buttons/settings are missing versus web) — that's the separate Mobile Parity Audit, already reported and approved separately from this redesign.
- The onboarding/welcome carousel — a real new feature (shown whenever the user is logged out, not just first install), planned separately; this skill covers its visual treatment once built, not whether to build it.
- Dark mode token values — `darkColors`/`darkShadow` already exist; any new primitive or preset added under this skill must define both light and dark values before shipping, following the existing pattern in `tokens.ts`.

## Checklist when restyling or building a screen under this skill

1. Does every list row have a colored icon tile from `colors.action`, sized and radius'd consistently with other screens' rows?
2. Is there at most one hero-weight card on this screen, and does it use `colors.accent`/`accentPressed`, not a neutral background?
3. Is any completion/percentage value rendered as a ring or bar rather than bare text?
4. Does the tab style (if any) match what it's actually switching — segmented, filter chip, or underline?
5. Do primary "move forward" buttons carry the trailing icon badge?
6. Are card borders present only where two same-color surfaces would otherwise merge?
7. Does every section with more content behind it have a trailing accent-colored link?
8. Has every string on the screen been checked for a stray hyphen or em dash used as connecting punctuation?
9. Are light and dark tokens both defined for anything new added to `tokens.ts`, `presets.ts`, or a new shared primitive?
