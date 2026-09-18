# Rebma Mobile — Design Decisions

A running record of what we've discussed and finally agreed on for the mobile UI redesign, piece by piece, page by page. Every entry here is something that was actually shown as a preview and approved — not a guess, not an assumption. Update this file every time a new piece or page is locked in, before building it for real.

**Scope, standing:** mobile phone, tablet, and iPad — every piece and page gets designed and previewed for all three widths together, not phone-only with tablet/iPad deferred.

**Source material:** five original reference image sets (component kit, iOS widget capsules, iOS spec sheet, fintech wallet, ADOL dashboard) plus a purple finance-app kit and a tracking/maps reference sent later. Colors and structural patterns were pulled from these, then adapted to Rebma's own real content, real logo, and real purple accent (`#5B4DFF`, already in `theme/tokens.ts` from earlier work — not repainted to green).

---

## ✅ ACCEPTED — Top Nav Bar (Header)

**Status:** Approved. Building the real implementation now (`components/chrome/AppHeader.tsx`).

### Structure
- **Background:** solid purple gradient (`#5B4DFF` → `#4F46E5`, 160deg), full-bleed edge to edge, from the status bar down through the search bar.
- **Shape:** rounded bottom-left and bottom-right corners (26–30px). Never a hard-edged rectangle.
- **Icon row (top):**
  - Left: real company logo (`assets/logo.png`) in a small circular white chip, immediately followed by a chevron-down icon — taps to open the sidebar/department switcher.
  - Right, in this exact order: Chat icon → Bell icon (with unread-count red dot) → Avatar (circular photo) → vertical three-dot overflow icon (⋮, not horizontal ⋯) at the very far right, after the avatar.
  - **No background fill behind any icon** — bare icons directly on the purple field, no circle backdrop.
  - **No day/night toggle in the header.** Confirmed Settings → Appearance already has a real, working one (`t.toggleDarkMode()`, backed by the single global `ThemeProvider`), so it already applies identically across phone/tablet/iPad. Nothing to duplicate here.
- **Greeting block:** bold white "Good morning, [Name] 👋", a small green status dot + "Active Session" label beneath it, then a department pill ("Finance Department ▾").
- **Search bar:** one white rounded pill containing — magnifying-glass icon, placeholder text ("Search subjects, topics, records…"), a thin vertical divider, then a filter/sliders icon. The filter is *inside* the same input, not a separate button outside it.

### Scroll behavior (three states, all previewed and approved)
This was the one piece that took several corrections to get right — recorded in detail so it's not re-litigated:

1. **Rest** — top of page, nothing scrolled. Full header: logo+chevron, full icon row, greeting, department pill, search bar.
2. **Mid-scroll** — as the page scrolls, a rounded-top white content sheet rises and physically overlaps the header **from the front** (the header never shrinks, resizes, or moves — it stays completely fixed and full-size, always rendered *behind* the content layer). The icon row thins to just Logo+chevron and Avatar+⋮ (Chat/Bell tuck away — reachable via the ⋮ menu). Because the content sheet's own top-corner radius is slightly smaller than the header's bottom-corner radius, a sliver of the purple rounded corner is always visible peeking out from behind the content, at every scroll position.
3. **Fully covered** — content risen further, covering almost the entire header. The same rounded-corner peek is still visible at the very edges — the header is never fully erased or hidden, just progressively covered.

**Why this shape, not a collapsing header:** the first version we tried had the header shrink/fade on scroll. Rejected — the correct behavior (confirmed against a real reference) is the header staying fixed and full-size at all times, with the page content itself rising as a rounded-top sheet that overlaps it. "Like the page that's been opened has pushed it back" — the header is always there, just covered.

**Same rule applies to opening any page or modal:** a pushed sub-page or bottom sheet taller than the remaining space rises the same way, over the current header, not replacing it.

### Responsive (mobile / tablet / iPad)
- The purple background stays full-bleed at every width.
- The header's actual *content* (logo, icons, greeting, search) is capped to a centered max-width column on tablet and iPad, so it doesn't just stretch into sparse-looking wide elements. Approximate content max-widths previewed: Mobile 150–300px working column (content-width ≈ frame width), Tablet ~210px content column in a 230px frame, iPad ~260px content column in a 300px frame — exact production values to be tuned against real device widths, not the scaled-down preview proportions.

### Explicitly deferred, noted so it isn't lost
- **Accent/background color as a user-configurable Settings option.** Real requirement, not yet built. Needs: a color picker added to `AppearanceScreen.tsx`, and `ThemeProvider.tsx` reading the chosen accent from stored settings instead of the hardcoded constant. Everything downstream (including this header) already reads through one token, so once that's wired, no other file needs to change.

---

## ⏳ PENDING — Not yet discussed

- **Bottom Nav Bar** — next up.
- **Individual pages / screen bodies** — not yet started. 134 screens, 48 shared pieces catalogued (see prior conversation for the full breakdown by department and by screen-shape category) — to be worked through piece by piece the same way: preview → correct → approve → build.
- **Modals / sheets, tables, forms, dropdowns** — pattern language already extracted from the reference images (see conversation history), not yet applied to real components.
- **Tablet/iPad exact breakpoints and content-width values** — approximate values used in previews; need real-device tuning once implementation starts.

---

## Process, standing for every future piece

1. Check the *real* current implementation first — never propose against an assumption.
2. Build a static HTML preview (phone-frame mockups, real content, real accent color) showing the proposed design — for mobile, tablet, *and* iPad together, all relevant states.
3. Get correction rounds until approved.
4. Update this document with the final accepted spec.
5. Only then touch real app code.
