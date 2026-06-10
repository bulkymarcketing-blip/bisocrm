# Schedule screen — visual restyle plan

**Status:** PLAN — awaiting approval. Presentation-only; NO logic/data changes.
**Branch (on approval):** `claude/schedule-restyle` off `main` — push and HOLD (no fast-forward until live check).
**HEAD at planning:** `e51f85f`.

---

## Scope & guardrails

Everything is inside **`rSchedule()`** (index.html ~line 1760) and its local helpers
`eventCard()`, `section()`, `modeBtn()`/`toggleBar`, and the `legend` block + the local
`typeMeta` map. **Not touched:** `setSchedMode` + `window._schedMode` (filter state),
the event-collection logic, and the no-show / did-come / reschedule actions
(`openResched` / `markApptDone` / `openDisp` / `openDetail`) — all stay exactly as-is.

### Where the colour map is used (scoping)
- `typeMeta` is a **local var inside `rSchedule`** (line 1769) — used only by `eventCard`
  (the dot + the type tag). It does not exist anywhere else in the app.
- A **second hardcoded copy** of the colours lives in the `legendItems` array
  (lines ~2007–2011) and must be kept in sync.
- Hex-value safety check:
  - **`#C8A55B`** (Wedding) appears only at 1770 + 2008 — both inside `rSchedule`. Safe.
  - **`#DC2626`** (Final Trial) appears at 1776 + 2009 (rSchedule) **AND at lines 111/125**,
    which are the app-wide urgent-red `.tu` / `.bu` tag classes (Overdue/Today badges
    elsewhere). I will change **only the two `rSchedule` literals**, never `.tu`/`.bu`.
    The recolour stays scoped to Schedule event-type coding.

---

## Changes (all in `rSchedule`)

1. **Filter control → pills.** Replace `modeBtn`/`toggleBar` (the boxed segmented control)
   with a `.fpills` row of `.fpill` / `.fpill.on` (gold active) — identical to Today/Pipeline.
   Each pill still calls `setSchedMode('appts'|'followups'|'both')`; state/behaviour unchanged.

2. **Section headers** (`section()`). Cinzel uppercase → **Inter, sentence case**
   ("This Week" → "This week", "This Month" → "This month", "Later"). Keep the muted
   "next 7 days" sub-label and the right-aligned count; soften the `1.5px` divider to `1px`.

3. **Appointment cards → flatten** (`eventCard()`):
   - Drop the amber `cardBg` and the colored `width:8px` left-bar.
   - Card = `background:var(--surf); border:1px solid var(--border); box-shadow:var(--sh)`
     (matches Pipeline cards).
   - Keep: a small **cool event-type dot** (`meta.color`), name (navy),
     "date · time" (muted, `tabular-nums`), the **type tag** (de-uppercased), status tags.
   - **De-uppercase all tags:** "NO-SHOW" → "No-show", type tag loses `text-transform:uppercase`.
   - **Status colour:** overdue = **red** (act-now); no-show = **neutral**
     (drop the amber bg/border). Normal day badge → **neutral/muted, not gold**
     (gold stays for the topbar + and the active pill).
   - **Action buttons → compact chips:** "Reschedule" = compact **navy-filled** chip;
     "Did come" = compact **ghost chip in `var(--success)`** green.
   - Replace emoji (📍 ↻ ✓ 📞) with inline line icons / plain text (no-emoji rule).

4. **Colour-key legend → slim it.** Remove the `--bg` bordered box; render as a light,
   muted, single-line wrap of small dots + labels (no box, no fill). Same items.

5. **Event-type colours** — in `typeMeta` AND the `legendItems` copy, change ONLY:
   - Wedding `#C8A55B` → **`#C77D8E`** (soft rose)
   - Final Trial `#DC2626` → **`#8E2A4A`** (deep wine)
   - Homecoming / Going Away / Consultation / Trial / Fabric / Pickup left exactly as-is.

---

## Two confirms

- **(a) Tag background tints.** The type tag uses `meta.bg` (a pale tint) behind `meta.color`.
  For coherence I'd also retint the two changed entries' `bg` (Wedding → soft rose tint,
  Final Trial → soft wine tint) so the de-uppercased tag isn't e.g. rose-text-on-pale-gold.
  Still "only those two event types." **OK, or change `color` only and leave `bg`?**
- **(b) Follow-up cards.** They share `eventCard` (currently a dashed border + "Log attempt").
  I'll flatten them the same way (flat hairline card, Follow-up dot, compact navy
  "Log attempt" chip) for consistency. **OK?**

---

## Audit (before commit; any FAIL = stop)

- `node --check` on index.html.
- New **`sim/schedule.sim.js`**: mount `rSchedule` on a mocked DOM + `brides`/`lA`/`q`
  across modes (with a wedding, an appointment, a no-show, a follow-up); assert it does
  not throw AND:
  - filter uses `.fpill` / `.fpill.on` (not the old boxed control);
  - cards flat (no `#FEF7E5` bg, no `width:8px` bar; `var(--surf)`);
  - "No-show" not "NO-SHOW";
  - Wedding `#C77D8E` / Final Trial `#8E2A4A` present, and `#C8A55B` / `#DC2626` absent
    from the Schedule output;
  - legend has no `var(--bg)` box;
  - headers Inter sentence-case ("This week");
  - Reschedule navy chip + "Did come" `var(--success)` chip.
- **Regression byte-diff** (unchanged vs HEAD): `computeTodaysActions`, the `_brief*`
  helpers, `rDailyBrief`, `renderTodaysActions`, `rPipeline`, `lCard`, `cardCTA`,
  `setSchedMode`. Plus re-run the existing `pipeline` / `dailyBrief` / `quoteItems` sims.

---

## Build sequence (on approval)
1. Cut `claude/schedule-restyle` off `main`.
2. Apply the 5 changes inside `rSchedule` (string-scoped edits; no shared CSS/JS touched
   except reusing `.fpill`).
3. `node --check` → write/run `sim/schedule.sim.js` → run all sims → regression diff.
4. Commit + push; **HOLD** for the live render check before any fast-forward.
