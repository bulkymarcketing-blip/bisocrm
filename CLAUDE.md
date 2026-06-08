# Biso CRM — FRONTEND repo context (`index.html`)

> **Scope: the FRONTEND repo only** (`bulkymarcketing-blip/bisocrm`, GitHub Pages, `index.html`). The backend (Cloud Functions + Firebase rules) is a **separate repo with its own `CLAUDE.md`** — do not edit backend logic from here. This file is for Claude Code working on `index.html`.
>
> **Owner:** Claude Code on this repo; the UI-redesign browser chat proposes update blocks. **Each fact has one home** — frontend engineering lives here; product intent, business rules, and the roadmap live in the browser-chat `SKILL.md`; the contract the backend owns lives in the backend `CLAUDE.md`. Don't copy content between the files.

Single-file bridal-styling CRM for Kushan (Biso by Dinushi, Negombo, Sri Lanka). Owner directs product; **no coding background**; tests on **iPhone Chrome**.

- Live at **crm.bisobydinushi.com** (GitHub Pages). Deploys automatically on push to `main`.
- **One file, `index.html` (~7,300 lines).** Vanilla HTML/CSS/JS. **No React/Vue/build tools — the single file is deliberate. Do not introduce a framework or a build step.**
- Talks to: Firebase Realtime DB (REST, no SDK for data) + Firebase Auth + Cloud Functions (the separate backend repo).

## Hard conventions (FRONTEND — these are real iOS / runtime constraints)

- **HTML via string concatenation, NEVER nested template literals.** Nested template literals crash silently on **iOS Safari** (Kushan’s test device). Hard rule for `index.html`. *(This rule is frontend-only; it does NOT apply to the backend repo’s Node code.)*
- **No native dialogs** (`alert` / `confirm` / `prompt`) — use **`showConfirm`**; user-facing notifications via **`notif`**.
- **Wrap any multi-write save in `window._saving = true/false`** — a 15-second polling loop overwrites local state otherwise.
- **Red = act-now only** (overdue, errors, danger). Never use red for informational urgency — amber for time cues, neutral otherwise.
- Fonts: **Cinzel** (brand + page/section titles only) + **Inter** (everything else, incl. all data and numbers). Navy / gold palette.

## Audit — MANDATORY before every change (any FAIL = hard stop, investigate)

- **CSS-only changes:** prove scope — every changed line sits inside the app `<style>` block; `{` / `}` counts unchanged; the file OUTSIDE the CSS is byte-identical (md5 the head region and the tail region before/after); the CSS class-set is unchanged.
- **JS render changes:** `node --check` on the file PLUS a **runtime sim** — mount the changed render function with a mocked DOM + mocked data, assert it doesn’t throw and returns sane HTML, then regression-diff the untouched functions. **No sim harness is in the repo** — build a small one for the touched screen and **commit it** so later work reuses it.
- Static check should include the overlapping-Firebase-paths rule.
- `docCSS` contains CSS braces — **mock it** in any brace-match/extraction audit or it breaks the extractor.
- After shipping: deploy is automatic on push to `main`; **test on iPhone in a Chrome Incognito tab** (bypasses the PWA service-worker cache).

## Frontend status — Cycles A–C (LIVE in the committed `index.html`)

- **Cycle A:** sequential document numbering + payment receipts. The **frontend mints** numbers via `mintDocNum(type)` against `/counters/{invoiceSeq|quoteSeq|receiptSeq}` (formats `BI-/BQ-/RC-2026-####`; seeds 1247 / 3061 / 1000; monotonic, never reset across years). The backend is instructed never to mint/reset/clobber these.
- **Cycle B:** the standalone quote builder was removed — quotes are built only inside the **Overview Form**. A **Messages** tab placeholder sits in the bottom nav — the slot the two-way WhatsApp inbox UI (#6, “Cycle E”) will fill; its backend is already shipped (contract below).
- **Cycle C:** quote/invoice/receipt visual redesign — premium template, ceremony-grouped line items + subtotals, payment schedule, logo in all three docs, “Rs” currency. Doc functions: `dMoney`, `docSectionFor`, `docSections`, `docTotals`, `docSchedule`, `docCSS`, `docLogo`, `docHeader`, `docFooter`, `docWrap`, `buildPDF`, `buildReceipt`.
- **Already shipped UX:** Pipeline mobile (collapsible stage lanes, per-card hero “next step” CTA, idle/rotting badge, stage-definition help); per-user “My Account” (display name → `/profiles/{uid}`, read-only role badge, password reauth + reset, relocated notification prefs).
- **Known bug (frontend):** the notification bell badge clears only when an individual item is tapped, not when the feed panel opens.

## Build sequence (frontend items)

Locked order **1 → 2 → 4 → 5 → (3/6 UI)**: #1 Pipeline ✅, #2 My Account ✅, **#4 Discounts + promo-code catalog (next)**, #5 Line items / packages (parent + sub-lines) + installment schedule (must not break the event↔quote binding), then the **#3/#6 WhatsApp inbox UI** (Cycle E) against the shipped backend.

## Data model (paths the frontend reads / writes)

`/brides` (pipeline + confirmed clients; a bride’s quotes / invoices / payments live underneath), `/leads` + `/customers` (phone-matched mirrors written by `convInv`), `/leadintake` (incoming enquiries — see contract), `/roles` (**read-only here; never written from the app** — role lives here, not in `/profiles`), `/profiles/{uid}` (self-editable display name), `/settings` (Firebase-synced app settings), `/counters` (doc numbers), `/notifications/{uid}`, `/notificationPrefs/{uid}`, `/fcmTokens/{uid}`, and the WhatsApp paths `/messages/{normalizedPhone}` + `/conversations/{normalizedPhone}` (for the #6 UI).

## Contracts the frontend DEPENDS ON (the backend owns these — match them exactly)

- **`/leadintake/{id}`** (the backend / chatbot writes; the frontend reads it in `openOverviewForm`): `id` (**MUST equal the `/leadintake` key — it’s reused as the bride id and as the delete path**), `name`, `phone` (**digits incl. country code, NO leading `+`**), `email`, `source`, `notes`, `weddingDate`, `events`, plus `nextReminderAt`, `remindersStopped`, `contactAttempts`, `stage`, `intakeAt`, `createdAt`. Review & Accept opens the Overview Form prefilled → saving promotes to `/brides` and deletes the intake record; Dismiss deletes it.
- **`normPhone`** (must match the backend’s rule exactly; default country code 94): strip non-digits → if len ≥ 11 and not leading `0`, use as-is → leading `0` → replace the leading 0 with `94` → 9 digits → prepend `94`.
- **`/settings` keys** the frontend owns and the backend may read: `defaultNotes`, `logoUrl`, `defaultBespeaking`, `balanceDueDays` (default 14 — when a balance is due/overdue), `bankDetails`, plus WhatsApp flags `waBotEnabled`, `waReGreetAfterDays`, `waAutoGreeting`, and `brideGreeting`.
- **WhatsApp inbox (#6 UI)** reads the backend-persisted thread: `/messages/{normalizedPhone}/{msgId}` — message shape `{ id, dir:'in'|'out', kind:'text'|'image'|'template', body, mediaUrl, templateName, at (ISO), by, waMessageId, status }` — and conversation state `/conversations/{normalizedPhone}` (`mode:'bot'|'human'`, `takenOverBy`, etc.). The reply box is enabled only inside the 24h window (else templates) and calls the backend callable **`waReply`**. Conversations are keyed by **normalized phone, NOT brideId**.
- **Bride Portal** (`bride-portal.html`, separate page, demo-mode built): consumes the backend `getBrideQuote(token)` / `acceptBrideQuote(token)` contract. **Don’t wire the CRM share button until the page is hosted** (avoids 404 links).

## Open frontend items (pre-existing)

- `b.quotations` vs `b.quotes` path drift — quotes should write to **`b.quotes`** (canonical), not `b.quotations` (legacy). Not yet fixed.
- `rCustomers` filter — scope to brides with invoices only?
- `_saving` guards still needed on ~7 lower-risk async functions.

## Process

Built in **Claude Code on this repo**: plan-then-approve (propose the plan + the exact functions you’ll touch, then wait for approval — no surprise code), implement, run the full audit above, commit. Deploy is automatic on push to `main`. The browser chat handles design / mockups / decisions.

-----

## Redesign — frontend visual overhaul (productivity-app direction)

> Added from the frontend design chat (June 2026). **This file is the single home of the redesign spec** — the browser-chat `SKILL.md` keeps only the high-level direction and points here. Phases 4–8 are built in **Claude Code on this repo**.

### Direction

White-background modern productivity app — “warm minimalism” (Linear / Things / Notion calm, but warm, not clinical). Keep the navy + gold brand. End state: this look across the whole app.

### Status

- **Phase 1 — global tokens — DONE & LIVE.**
- **Phase 2 — labels (de-uppercased) — DONE & LIVE.**
- **Phase 3 — tags (tamed) — DONE & LIVE.**
- **Next: Phase 4 (Today / Daily Brief).** Phases 1–3 are CSS-only and already in the committed `index.html` — confirm with `grep -c -- --canvas index.html` (must be ≥ 1) before starting, so you build on them and don’t undo them.

### The token system AS SHIPPED — do NOT revert

In `:root` inside the app `<style>` at the top of `index.html`:

- `--canvas:#F7F5F0` — warm-white PAGE background (set on `body`). Tunable toward whiter as screens become flat lists.
- `--bg:#F4F2EC` — warm INSET FILL for inputs / table headers / list rows (this is NOT the page background anymore).
- `--surf:#FFF` — cards.
- `--border:#EAE7E0` — warm hairline. **All borders are now 1px** (the old 1.5px is gone).
- `--sh:0 1px 2px rgba(27,43,75,0.05)` — near-flat card shadow. `--sh2` stays heavier and is for overlays / dropdowns / modals only.
- `.sv` (stat numbers) → Inter + `font-variant-numeric:tabular-nums` (NOT Cinzel).
- `.btn-gold` → navy text on gold (not white).
- **Labels:** `text-transform:uppercase` removed from all functional labels (`th`, `label`, `.stitle`, `.dl`, `.nl`, `.qcll`, `.mc-lbl`, `.tab`, `.sname`, `.nav-sec`); letter-spacing ~`.2px`. **Still uppercase ON PURPOSE — do not touch:** `.auth-title`, `.auth-field label`, `.auth-brand .tg`, `.user-chip .rl`, `.av-menu .av-info .rl`.
- **Tags:** source pills neutral `#F0EEE8` bg / `#6C6E72` text, EXCEPT `.tw` (WhatsApp) green `#E7F2E9` / `#46815B`. `.tq` and `.twg` softened to amber (`#F5ECD6` / `#8A6D1E`). `.tu` urgent RED kept.

### Design rules (apply to every screen rebuild)

- **One gold, one job:** gold = primary actions + the active state ONLY (the `+`, primary CTAs, active tab/filter). Navy ink = text and state. “Ink for state, gold for action.”
- Separation via hairlines + whitespace, not heavy borders/shadows. Don’t introduce new shadows beyond `--sh`; overlays use `--sh2`.
- Sentence-case labels everywhere (except the documented brand/role flourishes above).
- Numbers in Inter `tabular-nums`. **Cinzel is reserved for the brand + page/section titles only — never on data.**
- Tags restrained: neutral default, WhatsApp green, amber for time cues, RED only for genuine act-now (overdue / error / danger) — never for informational urgency.
- Line icons (Tabler-style) in place of emoji where feasible.
- ~8px spacing rhythm, modest radii (10–16px).
- **iOS Safari: string concatenation only, NO template literals** (existing hard rule, still applies).

### Remaining phases — one audited cycle each, plan-then-approve, ship-to-test each

1. **Today / Daily Brief** — flat grouped lists (sections + counts), a search field and a single `+` primary action (the shared chrome is introduced here), checkable task rows, appointment rows with small event-type dots, a one-line “X things need you today” summary; demote the stat-card grid in favour of list-first. This establishes the component vocabulary that 5 and 6 reuse.
1. **Pipeline** — regroup the existing collapsible lanes into the grouped-list look; muted COOL stage dots (not gold); keep the per-card “hero” next-step CTA (gold); idle/rotting in amber (not red); pipeline value in the subtitle / per-card. (Logic already exists — this is mostly restyle/regroup.)
1. **Data screens (batch)** — Quotations, Invoices, Finance, Confirmed, Profiles, Analytics — shared table/list pattern → cleaner rows/cards on the established tokens. May split into 2 cycles.
1. **Schedule + Overview Form / bride detail & modals** — the remaining bespoke surfaces.
1. **Login decision + final polish & consistency sweep.**

### Audit for the redesign — MANDATORY, same discipline as the rest of the project

- **CSS-only changes** (as in Phases 1–3): prove scope — every changed line sits inside the app `<style>` block; `{` / `}` counts unchanged; the file OUTSIDE the CSS is byte-identical (md5 the head region and the tail region before/after); the CSS class-set is unchanged. No native dialogs / template literals involved.
- **JS render changes** (Phases 4–8): `node --check` on the file PLUS a **runtime sim** — mount the changed render function with a mocked DOM and mocked `fbP`/data, assert it does not throw and returns sane HTML, and regression-diff the untouched functions. **There is NO sim harness in the repo** (the laptop sims were never committed), so build a small sim file for the touched screen — and **commit it** so later phases reuse it. Any FAIL = hard stop.
- After each phase: commit → deploy (GitHub Pages auto-deploys on push to `main`) → test on iPhone in a Chrome **Incognito** tab (bypasses the PWA service-worker cache).

### Process note (changed from the old split)

The frontend redesign is now built in **Claude Code on the connected repo**, not via browser-file-handover. The browser chat is used for design / mockups / decisions; Code implements + audits + commits. This supersedes the older “frontend via browser-Claude, file handed over” note for the redesign work.
