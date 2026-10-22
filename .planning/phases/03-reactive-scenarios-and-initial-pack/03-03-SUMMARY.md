---
phase: 03-reactive-scenarios-and-initial-pack
plan: 03
subsystem: panel
tags: [transponder, code-entry, registry, press-targets, layout-gates, preact]

requires:
  - phase: 02-first-gradable-scenario
    provides: PanelStore and the state predicate, grade, the press-target registry, the pilot legroom reservation and its layout gate
provides:
  - code-entry control kind in the registry (CodeEntryDef, prefix kp., memoised bounded legal codes, load-time checks)
  - kp.squawk, the simplified transponder, region transponder and plate transponder-pad in the pilot legroom
  - CodeEntry widget (CodeEntryBody pure) with keys 0 to 7, CLR and a readout; pure entry buffer and key press factory
  - layout, label, review, README, static-text and press-classification gates for the new part
affects: [03-08, 03-09, 03-10]

actuals:
  tokens: 16000
  tasks: 3
  commits: 3
plan_head_before: bfc651133b4a63ad4b436a4b070ed18f6d046a74
plan_head_after: a807fe905f105a3ad5412a351a17d46363aa1cf4

tech-stack:
  added: []
  patterns:
    - "Code space as data: legal states of a code-entry control are enumerated once per definition (WeakMap) and capped at 4096 before anything is built"
    - "Uncommitted gesture state (the typed digits) stays in the widget; only a complete code is dispatched"
    - "Pure body component next to the hook-using widget, so a node test can read the printed text"

key-files:
  created:
    - src/aircraft/da50rg/controls/squawk.ts
    - src/ui/panel/code-entry.ts
    - src/ui/panel/widgets/CodeEntry.tsx
    - e2e/xpdr.spec.ts
    - tests/xpdr.test.ts
  modified:
    - src/engine/registry.ts
    - src/aircraft/da50rg/panel.ts
    - src/aircraft/da50rg/plates.ts
    - src/ui/panel/ControlWidget.tsx
    - src/ui/panel/viewport.ts
    - tests/layout-reference.ts
    - tests/layout.test.ts
    - tests/static-text.test.ts
    - tests/panel-labels.test.ts
    - e2e/static-text.spec.ts
    - e2e/press.spec.ts
    - docs/PANEL-LABELS.md
    - docs/PANEL-REVIEW.md
    - README.md

key-decisions:
  - "kp.squawk hit footprint is 252 x 140, tight around the readout and the keys, so the 360 x 200 region keeps a background point for the zoom tap (PNL-09, 7 unit clearance gate)"
  - "Keys are data (CodeEntryKeyDef) in control-local centre coordinates; every key 44 units square with 8 unit gaps, CLR 44 x 96 at the right of both rows"
  - "The readout is the one recorded exception to G-0.1 (D-11, C-17): data-glass readout, excluded from the built-panel static-text gate"

patterns-established:
  - "A new control kind needs: registry union and KIND_PREFIX, a legalStates branch, a widget case, a targetSide case, the press-classification table in e2e/press.spec.ts, and rows in the reference table, labels and review documents"

requirements-completed: [PNL-07]

coverage:
  - id: D1
    description: "The user zooms into the transponder below the panel, types 7700 with four key taps and the panel state kp.squawk holds 7700 as one logged event (default 1200)"
    requirement: "PNL-07"
    verification:
      - kind: e2e
        ref: "e2e/xpdr.spec.ts#four digit taps commit 7700 as one event, and no key tap zooms (desktop-chromium, phone-chromium, tablet-chromium)"
        status: pass
      - kind: unit
        ref: "tests/xpdr.test.ts#key press factory (C-15, C-16)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A step state kp.squawk is 7700 is graded like any other step; the store accepts only legal codes (7800 and 770 are rejected)"
    requirement: "PNL-07"
    verification:
      - kind: unit
        ref: "tests/xpdr.test.ts#grading a committed code (D-11)"
        status: pass
      - kind: unit
        ref: "tests/xpdr.test.ts#store validation of a code (T-03-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A key never zooms, never pairs and never retracts, so a repeated digit can be typed with quick taps; CLR and re-entering the committed code record nothing"
    requirement: "PNL-07"
    verification:
      - kind: e2e
        ref: "e2e/xpdr.spec.ts#CLR empties a partial entry and a further key tap records nothing until four digits"
        status: pass
      - kind: e2e
        ref: "e2e/press.spec.ts#the classification gate: every hit and detent element has the data-press class of its control kind"
        status: pass
    human_judgment: false
  - id: D4
    description: "The registry bounds the code space (digits 1 to 4, distinct alphabet, at most 4096 codes, one key per character plus CLR, keys inside the footprint and disjoint) and enumerates it once"
    requirement: "PNL-07"
    verification:
      - kind: unit
        ref: "tests/xpdr.test.ts#registry checks of the code-entry kind (C-19)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every layout, legroom, tap-size, label, review, README-count and static-text gate holds with the new region, plate and control; only the readout follows a control state"
    verification:
      - kind: unit
        ref: "tests/layout.test.ts, tests/zoom.test.ts, tests/panel-labels.test.ts, tests/panel-review.test.ts, tests/static-text.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/static-text.spec.ts, e2e/layout.spec.ts, e2e/art-fit.spec.ts (desktop-chromium, phone-chromium, tablet-chromium)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The transponder looks and feels right: key layout, readout colour and size, position in the pilot legroom"
    verification: []
    human_judgment: true
    rationale: "The position is an assumption and not a fidelity item (D-11); the look of the housing, the keys and the readout is a planner choice listed in docs/PANEL-REVIEW.md for the owner"

duration: 14min
completed: 2026-10-22
status: complete
---

# Phase 3 Plan 03: Simplified transponder Summary

**A new `code-entry` control kind gives the panel a simplified transponder in the pilot's legroom: keys 0 to 7, CLR and a readout, where four digit taps commit the code as the graded state of `kp.squawk` (default 1200) and a key never zooms, pairs or retracts.**

## Performance

- **Duration:** 14 min (2026-10-22T20:18:35Z to 20:32Z)
- **Tasks:** 3 (1 tracer, 1 auto, 1 TDD-style test task)
- **Files modified:** 19 (5 created)

## Accomplishments

- `src/engine/registry.ts`: `CodeEntryDef` (digits, alphabet, default, keys, display), `CodeEntryKeyDef`, `MAX_CODE_SPACE` 4096, `CODE_ENTRY_CLEAR_KEY`, prefix `kp.`; `legalStates` returns the memoised array of every code (a `WeakMap` keyed by the definition) and refuses a code space above 4096 even when the load check was bypassed; `checkCodeEntry` runs in `defineRegistry` before anything is enumerated (digits 1 to 4, distinct alphabet, default is a legal code, one key per alphabet character plus `clr`, keys and readout inside the footprint, no overlap).
- `src/aircraft/da50rg/controls/squawk.ts`: `kp.squawk` (label TRANSPONDER, default 1200), two rows of four digit keys 0 to 7 and a tall CLR key, every key 44 units square with 8 unit gaps (about 63 px on the phone zoom of the region).
- Region `transponder` (x 300, y 900, 360 x 200) and plate `transponder-pad` (x 280, y 880, 400 x 240, rx 12) in the reserved pilot legroom.
- `src/ui/panel/code-entry.ts`: pure `createEntryBuffer` and `makeCodeKeyPress` (class `momentary`; the fourth digit dispatches the whole code with `bridge.actuate`; a partial entry never reaches the store; re-entering the committed code returns null).
- `src/ui/panel/widgets/CodeEntry.tsx`: widget with `useRef` buffer, a signal for the typed digits, the buffer emptied on `store.onReset`, and the pure `CodeEntryBody` (housing, name, readout marked `data-glass="readout"`, keys with `data-detent="kp.squawk:KEY"` hit rects). `ControlWidget` and `targetSide` gained the `code-entry` case (smallest key side).
- Gates: reference row, region id, under-panel group and three ordering rows in `tests/layout-reference.ts`; the legroom gate names exactly the D-11 region and plate; a code-entry family case in `tests/static-text.test.ts`; the readout excluded from the built-panel text gate; label and review documents with `kp.squawk`; README counts (93 controls, 13 lamps, 32 regions) taken from the reference tables.

## Task Commits

1. **Task 1 (tracer): the pilot enters 7700 and the store holds 7700 as the state of kp.squawk** - `8d87993`
2. **Task 2: the transponder in every layout, label, legroom and static-text gate** - `9aab194`
3. **Task 3: entry rules, registry checks and grading of a code pinned by unit tests** - `a807fe9`

Tracer feedback gate: auto/end-of-phase mode with an automated-only `<verify>`; typecheck, the three unit files and `e2e/xpdr.spec.ts` on desktop-chromium and phone-chromium were re-run end to end and passed, so expansion continued.

## Verification

- `npx vitest run`: 47 files, 2277 tests pass. `npm run typecheck`, `npm run lint` and `npm run format:check` exit 0.
- `PW_PORT=4333 npx playwright test --project=desktop-chromium --project=phone-chromium` (the whole suite): 548 passed, 110 skipped, then the one failing gate (press classification) fixed and `e2e/press.spec.ts` re-run: 178 passed. `tablet-chromium` on xpdr, layout, art-fit, static-text and zoom specs: 25 passed.
- Acceptance greps: `code-entry` in registry.ts 9 and in ControlWidget.tsx 1, `SQUAWK_CONTROLS` in panel.ts 2, `'transponder'` in panel.ts 1, `kp.squawk` in layout-reference.ts 4 / PANEL-LABELS.md 1 / PANEL-REVIEW.md 1, `readout` in static-text.spec.ts 8, `7700` in tests/xpdr.test.ts 18.

## Assumptions taken (defaults C-14 to C-19)

- C-14 to C-19 taken as written. Geometry (C-18 proposal kept): region x 300, y 900, 360 x 200, plate 20 units larger on every side, rx 12.
- Key layout is a planner choice: digits 0 to 3 on the upper row, 4 to 7 on the lower row, CLR 44 x 96 at the right of both rows; the readout window sits above the keys; the name TRANSPONDER above the readout. Listed for the owner in `docs/PANEL-REVIEW.md` (section "Simplified transponder").
- Readout colour (green glass digits) and the key colours are planner choices, not from a photo.
- The partial entry is not shown differently from a committed code except by the trailing dashes; no blink, no pressed visual on a key (the readout is the feedback).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reference row needed in Task 1**
- **Found during:** Task 1 verify
- **Issue:** `tests/registry.test.ts` (in the Task 1 verify) compares the control count with the reference tables; the plan assigns the table rows to Task 2, so the verify could not pass.
- **Fix:** The `kp.squawk` row in `tests/layout-reference.ts` was added in Task 1; the rest of the tables followed in Task 2.
- **Commit:** 8d87993

**2. [Rule 1 - Bug] Footprint too large for the background-clearance gate**
- **Found during:** Task 2
- **Issue:** The first footprint (280 x 170 in a 360 x 200 region) left no background point 7 units from every control (PNL-09 gate).
- **Fix:** The footprint was cut to 252 x 140 around the readout and keys (content shifted to stay centred); the region size is unchanged.
- **Files modified:** src/aircraft/da50rg/controls/squawk.ts
- **Commit:** 9aab194

**3. [Rule 3 - Blocking] Pure body component and gate files beyond the plan's list**
- **Issue:** The static-text gate reads vnode trees without hooks, so the widget was split into the hook-using `CodeEntry` and the pure `CodeEntryBody`. `tests/panel-labels.test.ts` only collected ids of the families sw, btn, lv, lt and cb; `kp` was added to its id pattern. `e2e/press.spec.ts` (the classification gate, Table M2) failed with "unknown kind code-entry" in the full run; the table now maps `code-entry` to `momentary`.
- **Files modified:** src/ui/panel/widgets/CodeEntry.tsx, tests/panel-labels.test.ts, e2e/press.spec.ts
- **Commit:** 9aab194, a807fe9

**4. [Rule 1 - Bug] Purity lint and brand gate**
- **Issue:** `**` is forbidden in `src/engine` (determinism rule of plan 03-01), so the code space is computed by repeated multiplication (`codeSpace`); a comment in squawk.ts named a maker and failed `tests/brand.test.ts`; both were fixed before the commits that carry them.
- **Commit:** 8d87993, a807fe9

**Total deviations:** 4 auto-fixed (2 Rule 1, 2 Rule 3). **Impact:** none on scope; all additions are gates and a split of one component.

## Known Stubs

None.

## Threat Flags

None. The only new input surface is the key presses, covered by T-03-06 and T-03-07 of the plan: the store accepts only legal codes, only a complete buffer is dispatched, the code space is capped at 4096 and enumerated once.

## Self-Check: PASSED

- Created files exist: src/aircraft/da50rg/controls/squawk.ts, src/ui/panel/code-entry.ts, src/ui/panel/widgets/CodeEntry.tsx, e2e/xpdr.spec.ts, tests/xpdr.test.ts (checked with `[ -f ]`).
- Commits `8d87993`, `9aab194`, `a807fe9` are ancestors of HEAD.
