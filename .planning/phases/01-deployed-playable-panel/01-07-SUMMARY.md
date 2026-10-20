---
phase: 01-deployed-playable-panel
plan: 07
subsystem: ui
tags: [guarded-toggle, momentary-button, neutral-area, pointer-events, playwright, release]
requires:
  - phase: 01-03
    provides: registry, store interlock, widget contract
  - phase: 01-05
    provides: detent levers
  - phase: 01-06
    provides: glass frames, layout gates
  - phase: 01-09
    provides: region zoom, gesture arbitration
  - phase: 01-04
    provides: public repository and green deploy
provides:
  - De-ice ALTERNATE guarded switch (the panel's only guarded switch)
  - ENGINE START and FADEC TEST momentary buttons
  - ELECT. MASTER and ELT confirmed as unguarded plain toggles
  - Neutral-area guarantee proven on every device project
  - Complete Phase 1 panel (23 controls) live on GitHub Pages
affects: [phase-2]
tech-stack:
  added: []
  patterns:
    - GuardedToggle reuses the Toggle switch skin (SwitchBody exported)
    - ControlWidget exhaustive switch ends in unsupported(def: never)
    - Event-log assertions live in @hooks specs, excluded from the live run
key-files:
  created:
    - src/aircraft/da50rg/controls/deice.ts
    - src/ui/panel/widgets/GuardedToggle.tsx
    - src/ui/panel/widgets/MomentaryButton.tsx
    - e2e/guard.spec.ts
    - e2e/button.spec.ts
    - e2e/neutral.spec.ts
  modified:
    - src/aircraft/da50rg/controls/switch-bank.ts
    - src/aircraft/da50rg/controls/engine.ts
    - src/aircraft/da50rg/panel.ts
    - src/ui/panel/ControlWidget.tsx
    - src/ui/panel/widgets/Toggle.tsx
    - README.md
key-decisions:
  - "FADEC TEST hit width is 60, not the planned 74, so every region keeps 1.5 px of clear background for tap-to-zoom (plan 09 gate)"
  - "ALTERNATE is modelled as a two-state OFF/ON switch, default OFF; label and states to be confirmed against the de-ice supplement"
requirements-completed: [PNL-06, PNL-01, PNL-08]
completed: 2026-10-20
status: complete
commits: 2
plan_head_before: a53b48227708268c35dbc4b8a4a7ed527fb5e025
plan_head_after: 12b01b5ba1f0a9062cc0c97e5a73decf2501d95c
---

# Phase 1 Plan 07: Guarded switch, push buttons, release

## What was built

- **Task 1 (61c2b3a):** the de-ice ALTERNATE switch behind its guard, end to end. First tap lifts the guard without moving the switch; the second tap flips it; the guard stays up until closed; closing it keeps the switch where it is.
- **Task 2 (12b01b5):** ENGINE START and FADEC TEST momentary buttons (PRESSED while held, RELEASED on release or pointer cancel), ELECT. MASTER and ELT confirmed as plain unguarded toggles, and the neutral-area guarantee (taps on background, frames, artwork, gaps and the footer record no event) on all device projects. All PNL-08 layout relations are now checked with none skipped.
- **Task 3:** the user confirmed publishing HEAD `c973830ec5c6` ("ship it", after the manifest was shown); the orchestrator pushed it fast-forward with no force.
- **Task 4:** CI and Deploy run 39397409510 on `c973830ec5c6` succeeded on attempt 1. The live site returned 200 and the non-@hooks Playwright suite passed against it (159 passed, 51 skipped by project conditions).

## Verification

- Local: typecheck, lint, format:check clean; 185 unit tests; 199 e2e passed (59 skipped by project conditions) in the executor's worktree; layout.test.ts 79 passed, 0 skipped.
- A regression probe (a deliberate handler on the panel background) made the neutral-area spec fail, then was reverted.

## Deviations

1. FADEC TEST hit width 60 instead of 74 (see key-decisions).
2. `Toggle.tsx` modified to export `SwitchBody`; not in the plan's files_modified. Behaviour unchanged.
3. First dispatch stopped on a base mismatch (the harness forked from origin/main). It was re-dispatched on the published base a53b482; no work was lost.

## Open items

- Real-device pass (iPhone/iOS Safari, Android/Chrome, tablet): 13-point checklist, handed to end-of-phase UAT.
- Pinch, touch pan and touch lever drags are proven on Chromium only (Playwright WebKit cannot emulate them).
- The smallest landscape phone has very little background clearance in the tiny under-panel regions; worth checking by hand.
- ALTERNATE label, position and states remain to be confirmed against the de-ice supplement (D-07b).

## Publish confirmation

The user confirmed publishing `c973830ec5c6` to git@github.com:bugwiper/procedure-trainer-da50.git in this run. The push was a fast-forward from `a53b482`.
