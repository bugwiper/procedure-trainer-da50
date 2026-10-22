---
phase: 02-first-gradable-scenario
plan: 09
subsystem: ui-overlays
tags: [acknowledgment, modal, storage, clock-driver, playwright, preact-signals]

requires:
  - phase: 02-first-gradable-scenario
    provides: session machine with screen and clock signals and the debrief (plan 06), disclaimer data (plan 01), virtual clock (plan 02)
provides:
  - first-run training-aid acknowledgment (ACK_STORAGE_KEY, ACK_VERSION, createAckStore, browserStorage)
  - modal registry (holdModal, releaseModal, anyModalOpen)
  - the shared modal shell (Modal, isShielded, nextFocusIndex, INPUT_SHIELD_MS) and the Ack modal
  - Playwright storage seed that starts every project accepted
  - clock driver (attachClockDriver, MAX_FRAME_STEP_MS) wired in App
affects: [02-10, 02-11, 02-12, 02-13]

actuals:
  tokens: 10800
  tasks: 3
  commits: 3

plan_head_before: 5b09bdf0b38732eb349e4158ae16cd82fd229596
plan_head_after: 20a2f11deb227f3ac5c7dc8582f42e6ee07f3275

tech-stack:
  added: []
  patterns:
    - "One modal shell (scrim, focus trap, opener focus return, 400 ms input shield, id in a registry) for every blocking overlay"
    - "Real time enters the run only through the injected clock driver; the engine clock is advanced, never read"
    - "Playwright config imports a pure module (ack.ts, no DOM types) to seed storage for every project"

key-files:
  created:
    - src/ui/ack.ts
    - src/ui/modals.ts
    - src/ui/clock-driver.ts
    - src/ui/screens/Modal.tsx
    - src/ui/screens/Ack.tsx
    - e2e/ack.spec.ts
    - e2e/clock.spec.ts
    - tests/ack.test.ts
    - tests/modal.test.ts
    - tests/clock-driver.test.ts
  modified:
    - src/ui/App.tsx
    - src/ui/screens/Debrief.tsx
    - src/ui/stage.css
    - playwright.config.ts
    - e2e/support/zoom.ts

key-decisions:
  - "The input shield exposes a data-shield attribute on the modal container for its 400 ms, so e2e helpers wait for it instead of sleeping"
  - "About stays outside the shell and holds the modal id 'about' from App's open and close handlers, so the run clock waits while it is open"
  - "A stored version other than the current one (older, newer or garbage) asks again"

requirements-completed: [PLT-04, SCN-08]

coverage:
  - id: D1
    description: "A fresh browser sees the blocking 'Training aid only' acknowledgment with focus on I understand; Escape and a tap on the MFD softkey behind it do nothing; I understand closes it; a reload does not bring it back; a stored older version brings it back"
    requirement: PLT-04
    verification:
      - kind: e2e
        ref: "e2e/ack.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ack store: missing, blocked, throwing, older, newer and garbage storage; accept keeps the acceptance in memory and swallows a write error"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "tests/ack.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shell helpers (shield at 399 and 400 ms, focus cycle wrap), the modal registry with two ids, and the debrief rendered on the shell with Escape as Back to panel"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "tests/modal.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The whole chromium suite (desktop, phone, tablet) passes with the seeded acceptance and the debrief on the shell"
    requirement: PLT-04
    verification:
      - kind: e2e
        ref: "PW_PORT=4329 npx playwright test --project=desktop-chromium --project=phone-chromium --project=tablet-chromium"
        status: pass
    human_judgment: false
  - id: D5
    description: "The clock driver advances the run clock only while running, visible and unblocked, at most 1000 ms per frame, adds no paused time later and stops on detach"
    requirement: SCN-08
    verification:
      - kind: unit
        ref: "tests/clock-driver.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/clock.spec.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Wording of the acknowledgment and the look of the modal card against the owner's expectations"
    verification: []
    human_judgment: true
    rationale: "U-15: the text is in own words and the owner reviews it before ship; no test judges wording or visual fit"

duration: 20min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 09: Acknowledgment, modal shell and clock driver Summary

**A first-time visitor must accept a blocking, versioned training-aid notice (remembered in localStorage, in memory when storage is blocked) on a shared modal shell that the debrief also uses, and the run's virtual clock now follows real frames only while the run is live, the tab visible and no modal open.**

## Performance

- **Duration:** about 20 min
- **Tasks:** 3 (tracer, then two TDD tasks)
- **Files:** 15 changed (10 created)

## Accomplishments

- `src/ui/ack.ts` (no Preact, no DOM types, so `playwright.config.ts` imports it): key `da50.ack`, version from DISCLAIMERS `training-aid`; every storage read and write is in try/catch and `accept()` sets the in-memory acceptance first (T-02-16).
- `src/ui/screens/Modal.tsx`: scrim at z-index 50 (the acknowledgment 60), focus on the first action, Tab cycle plus a focusin guard, focus returned to the opener, Escape per `onEscape` (null does nothing), backdrop tap does nothing, 400 ms capture-phase input shield (`isShielded`), sticky action row, holds its id in `src/ui/modals.ts` while mounted.
- `Ack.tsx` renders heading and body from `DISCLAIMERS` (no duplicated text). `App.tsx` mounts it above everything while `ackRequired`.
- `playwright.config.ts` seeds `ACK_STORAGE_KEY` with `ACK_VERSION` for the origin of baseURL (local and live); `e2e/ack.spec.ts` overrides it with an empty state.
- `Debrief.tsx` now renders on the shell (no hooks of its own); every test id, role and text of plan 06 is kept, so `e2e/scenario.spec.ts` passes unchanged.
- `src/ui/clock-driver.ts`: `attachClockDriver` adds the elapsed real time (clamped to 1000 ms) to the session clock only while the screen is `running`, `hidden()` and `blocked()` are false; the last frame time updates on every frame so pauses accumulate nothing. App attaches it once with `requestAnimationFrame`, `performance.now`, `document.hidden` and `anyModalOpen`; About holds the id `about`.

## Task Commits

1. Task 1 (tracer): `4dcc2c3` feat(02-09): blocking training-aid acknowledgment on a shared modal shell
2. Task 2: `89aee71` test(02-09): pin ack store and shell helpers; debrief moves onto the modal shell
3. Task 3: `20a2f11` feat(02-09): clock driver advances the run's virtual clock only while live and unblocked

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The 400 ms input shield swallowed the immediate debrief button taps of existing specs**
- **Found during:** Task 1 (design check against `e2e/scenario.spec.ts`, which taps `debrief-back` right after the debrief renders)
- **Issue:** The shield (required by the plan) would discard a Playwright click made within 400 ms of the debrief appearing, failing specs that must stay unedited.
- **Fix:** The shell sets a `data-shield` attribute on its container for the shield duration; the shared `activate()` helper in `e2e/support/zoom.ts` waits until no ancestor-or-self has `data-shield` before clicking or tapping. No spec was edited.
- **Files modified:** src/ui/screens/Modal.tsx, e2e/support/zoom.ts
- **Commit:** 4dcc2c3

**Total deviations:** 1 auto-fixed (1 blocking). **Impact:** one shared e2e support helper gained a wait; no scope change.

## Assumptions taken

- Shell time base: the shield compares `event.timeStamp` with `performance.now()` taken at mount (same timeline in current browsers). The shell reads `performance.now` and a `setTimeout` for the attribute; the run clock path still goes only through `clock-driver.ts`.
- A stored version newer than the current one also counts as not accepted (Table M2: exactly the current version).
- The plan's wish to drop a copied debrief container from `App.tsx` needed no change: the container lived inside `Debrief.tsx` and its CSS (`.modal`, `.modal-card`, `.modal-actions`, `.primary-button`) was reworked in place into the shell styles; `.secondary-button`, `.modal-title`, `.modal-body` and `.modal-ack` were added.
- A tab that returns after a long background gap adds at most the 1000 ms frame cap once (the plan's rule: clamp, do not special-case visibility changes).
- The dispatch asked for STATE.md and ROADMAP.md updates; this overrides the plan's prohibition on editing STATE.md.

## Issues Encountered

None. Vitest prints a Node `localStorage is not available` ExperimentalWarning in `tests/ack.test.ts` from reading `globalThis.localStorage`; it is harmless and the test passes.

## Verification

- `npx vitest run`: 41 files, 2089 tests passed
- `npm run typecheck`, `npm run lint`, `npm run format:check`: pass
- `PW_PORT=4329 npx playwright test --project=desktop-chromium --project=phone-chromium --project=tablet-chromium`: 652 passed, 257 skipped (project-level skips present before this plan)
- Acceptance greps: `storageState` in playwright.config.ts (1), `da50.ack` in ack.ts (1), `INPUT_SHIELD_MS` in Modal.tsx (3), `<Modal` in Debrief.tsx (1), `MAX_FRAME_STEP_MS` in clock-driver.ts (3), `attachClockDriver` in App.tsx (2)

## Known Stubs

None.

## Threat Flags

None. T-02-16 (storage failure) mitigated by try/catch and in-memory acceptance with unit cases; T-02-17 by the z-index 60 blocking modal with no Escape or backdrop close and an e2e tap behind it; T-02-31 by the 1000 ms cap and the hidden, paused and modal conditions with unit cases.

## Next Phase Readiness

Ready for 02-10. Plans 11 to 13 can mount their overlays on `Modal` (the clock pauses through the registry) and `activate()` already waits out the shield.

## Self-Check: PASSED

- Created files exist: src/ui/ack.ts, src/ui/modals.ts, src/ui/clock-driver.ts, src/ui/screens/Modal.tsx, src/ui/screens/Ack.tsx, e2e/ack.spec.ts, e2e/clock.spec.ts, tests/ack.test.ts, tests/modal.test.ts, tests/clock-driver.test.ts
- Commits 4dcc2c3, 89aee71 and 20a2f11 are ancestors of HEAD
