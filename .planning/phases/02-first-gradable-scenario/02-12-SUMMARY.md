---
phase: 02-first-gradable-scenario
plan: 12
subsystem: ui-session-area
tags: [choose-situation, leave-run-confirm, load-error, empty-state, input-shield, session, playwright]

requires:
  - phase: 02-first-gradable-scenario
    provides: pack seam and AccessPolicy (plan 02), session machine (plan 06), modal shell and clock driver (plan 09), session area safe at every zoom level (plan 10), briefing (plan 11)
provides:
  - choose view of the session area (CLOSE LIST and up to 4 rows titled from the manifests) and the session transitions openChooser, closeChooser, chooseScenario
  - leave-run confirm (keepGoing, leaveRun without grading), load error with retryLoad and dismissFailure, empty message
  - Confirm.tsx modals on the shared shell (LeaveConfirm, LoadError, EmptyNotice)
  - busy presses (held rim, other presses ignored) and the 400 ms shield on list rows
  - U-08 list guard over the shipped manifests
affects: [02-13]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2

plan_head_before: 81260fc4ff2860ff5368d5d6f67d289f9aa964e2
plan_head_after: 3c143a5b41986c2547f4598ff615cfa2bfbc7975

tech-stack:
  added: []
  patterns:
    - "One load path for NEW SITUATION, CHOOSE SITUATION and a row (loading(key, work) sets busy, busyKey and clears failure and empty); the failed request is kept so retryLoad repeats exactly it"
    - "A request made while a run is live waits in a confirm signal and is performed by leaveRun after the run is dropped"
    - "Modal shield also swallows the compatibility mousedown so a touch release that opened a dialog keeps focus on its primary action"

key-files:
  created:
    - src/ui/screens/Confirm.tsx
  modified:
    - src/ui/session.ts
    - src/ui/panel/frames/ScenarioAreaFrame.tsx
    - src/ui/panel/widgets/SessionButton.tsx
    - src/ui/App.tsx
    - src/ui/screens/Modal.tsx
    - src/ui/stage.css
    - tests/session.test.ts
    - e2e/scenario.spec.ts
    - e2e/session-area.spec.ts
    - e2e/static-text.spec.ts

key-decisions:
  - "A listing with no allowed scenario (every pack denied, or none shipped) sets empty for NEW SITUATION as well as CHOOSE SITUATION; the earlier 'denied' load failure of newSituation for an all-denied policy is gone (UI-SPEC: empty covers 'no packs or none allowed'). A single denied row still fails with reason denied through openScenario"
  - "A failed chosen row keeps the screen on choosing under the error modal; Back to panel (dismissFailure) returns to free and closes the list"
  - "Session busy keys are the session-hit ids: session.new, session.choose, session.row.<pack>.<scenario>"

requirements-completed: [SES-01, PLT-03]

coverage:
  - id: D1
    description: "CHOOSE SITUATION swaps the area to CLOSE LIST plus one row per allowed scenario in manifest order with manifest titles and no scenario text loaded; a row opens that scenario's briefing; CLOSE LIST and Escape return"
    requirement: SES-01
    verification:
      - kind: unit
        ref: "tests/session.test.ts#openChooser, closeChooser and chooseScenario"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#CHOOSE SITUATION lists the allowed scenarios and a row opens its briefing"
        status: pass
    human_judgment: false
  - id: D2
    description: "A denying policy hides its pack from the list and from the random pick"
    requirement: PLT-03
    verification:
      - kind: unit
        ref: "tests/session.test.ts#hides a pack the policy denies (T-02-23)"
        status: pass
    human_judgment: false
  - id: D3
    description: "NEW SITUATION or CHOOSE SITUATION during a run opens Leave this run? with Keep going focused and on Escape; Leave run ends the run without a result, resets panel and quantities, then performs the action"
    requirement: SES-01
    verification:
      - kind: unit
        ref: "tests/session.test.ts#leave-run confirm (U-03, T-02-24)"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#NEW SITUATION during a run asks first"
        status: pass
    human_judgment: false
  - id: D4
    description: "A pack that fails to load shows the error with Try again (same request) and Back to panel; an empty listing shows No situations available"
    requirement: SES-01
    verification:
      - kind: unit
        ref: "tests/session.test.ts#load failure, retry and dismiss (U-16, U-18)"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#a pack that cannot be loaded shows the error; Try again retries the same request"
        status: pass
    human_judgment: true
    rationale: "The empty message is unit tested only (the shipped build always has a scenario); the wording is the planner's, owner reviews it before ship (U-16)"
  - id: D5
    description: "A double tap or double click on NEW SITUATION, on a row, or on CHOOSE SITUATION opens exactly one briefing or one list and records no event; the list never exceeds 4 rows"
    requirement: SES-01
    verification:
      - kind: e2e
        ref: "e2e/session-area.spec.ts#a double tap or double click on NEW SITUATION opens exactly one briefing"
        status: pass
      - kind: e2e
        ref: "e2e/session-area.spec.ts#a double tap or double click on the list row opens exactly one briefing"
        status: pass
      - kind: unit
        ref: "tests/session.test.ts#choose list guard (U-08)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The static-text gate excludes the session area, whose text follows the session state"
    verification:
      - kind: e2e
        ref: "e2e/static-text.spec.ts"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 12: Choose situation, leave-run confirm, error and empty states Summary

**CHOOSE SITUATION lists the allowed scenarios from the manifests in the legroom area and a row opens its briefing; pressing a session button during a run asks "Leave this run?" first, a failed pack load shows an error with Try again that repeats the same request, an empty listing shows "No situations available", and presses cannot double-fire.**

## Performance

- **Duration:** about 20 min
- **Tasks:** 2 (tracer, then one TDD task)
- **Files:** 11 changed (1 created), 1027 insertions, 70 deletions

## Accomplishments

- `src/ui/session.ts`: screen `choosing`; `choices`, `openChooser`, `closeChooser`, `chooseScenario(ref, key)`; `confirm`, `keepGoing`, `leaveRun`; `retryLoad` and `dismissFailure` over the remembered request (`random`, `list` or `chosen`); `empty`, `dismissEmpty`; `busyKey`. NEW SITUATION, CHOOSE SITUATION and a row share one `loading` path and one `openBriefing`. `leaveRun` never calls `grade`: it resets the store (`bridge.reset({})`), drops the time source, scenario, briefing, result and clock, then runs the pending request.
- `ScenarioAreaFrame.tsx`: main view (two buttons) and choose view (CLOSE LIST, at most `SESSION_LAYOUT.choose.maxRows` rows); the time the view changed is kept, rows and CLOSE LIST ignore activations for 400 ms; the busy button keeps its pressed rim and other presses are ignored. `SessionButton.tsx` gained `held` and `ignoreUntil` (keyboard follows the same rules).
- `Confirm.tsx`: `LeaveConfirm` (Keep going primary and focused, Leave run outline in `#ff5a50`, Escape keeps going), `LoadError` (`alertdialog`, title in `#ff5a50`, Try again, Back to panel, Escape is Back to panel), `EmptyNotice`. `App.tsx` mounts them from the session signals and closes the list on Escape (unless a modal is open); the 52 px session footer applies to briefing, running and debrief but not to choosing.
- Tests: 21 new session cases (chooser, policy filtering, busyKey, confirm, leaveRun, retry of a random pick and of a chosen entry, dismiss, empty), the `VITE_PACKS` list guard, and e2e for choose, confirm, load error with retry (requests for `pack-engine*` aborted, then unrouted), and three double-press cases.

## Task Commits

1. Task 1 (tracer): `4f3ae4c` feat(02-12): CHOOSE SITUATION lists the allowed scenarios and a row opens its briefing
2. Task 2: `3c143a5` feat(02-12): leave-run confirm, load error with retry, empty state and the 4-row guard

Tracer gate: the Task 1 verify set (scenario, static-text and art-fit specs on desktop and phone, session unit tests, typecheck, lint, format) passed after the commit before Task 2 started.

## Verification

`npx vitest run` (42 files, 2152 passed), `npm run typecheck`, `npm run lint`, `npm run format:check` exit 0; the whole Playwright suite on desktop-chromium, phone-chromium and tablet-chromium with `PW_PORT=4332` passed (700 passed, 257 skipped by the existing project and live-mode filters).

## Assumptions taken

- The plan's local coordinates (x 20, w 780) differ from the shipped `SESSION_LAYOUT` (x 35, w 750, set in plan 10 for the Full panel corner); the shipped layout was kept.
- The empty-listing rule applies to NEW SITUATION as well (see key-decisions); two plan-06 session tests that expected a `denied` load failure for an all-denied policy now assert `empty`.
- The plan's prohibition "STATE.md is not edited" conflicts with the dispatch instruction to update STATE.md and ROADMAP.md; the dispatch was followed (state verbs only, no hand edits).
- Chromium retried the failed lazy pack chunk without a cache-busting loader, so the loader needed no change for Try again.
- Wait of 500 ms in the e2e specs mirrors the 400 ms shield plus 100 ms; the spec cannot import `Modal.tsx` (JSX) the way it imports `tap-intent`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Touch release that opened the confirm lost the focus of Keep going**
- **Found during:** Task 2 (phone and tablet e2e)
- **Issue:** The confirm opens synchronously on the release; the browser's compatibility `mousedown` of the same touch then moved focus off the primary action, so "Keep going focused" failed on touch projects (the briefing hid it because it opens after an async load).
- **Fix:** the modal shield also stops and cancels `mousedown` during the first 400 ms.
- **Files modified:** src/ui/screens/Modal.tsx
- **Commit:** 3c143a5

**2. [Rule 1 - Bug] Escape did not close the list right after it appeared**
- **Found during:** Task 1 (e2e)
- **Issue:** `useEffect` registered the Escape listener after paint, so an immediate Escape was lost.
- **Fix:** `useLayoutEffect` in App.tsx.
- **Commit:** 4f3ae4c

**Total deviations:** 2 auto-fixed (2 bugs). **Impact:** none on scope; both are guards on behaviour the plan specifies.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-02-22 mitigated (400 ms shield on rows and every modal, double-press e2e on desktop, phone and tablet). T-02-23 mitigated (openChooser and newSituation filter by the policy, openScenario checks again; unit case with a denying policy). T-02-24 mitigated (leaveRun never grades and clears the result; unit case). No package was installed (T-02-SC).

## Next Phase Readiness

Plan 13 (complete debrief, replay, exam-silence and blueprint gates, documents, final gates) can rely on every session state being reachable and recoverable. The exam-silence gate should include the new confirm and error dialogs: they are `dialog` and `alertdialog` roles that only appear on a user press, never during an unattended run.

## Self-Check: PASSED

`src/ui/screens/Confirm.tsx` exists; commits `4f3ae4c` and `3c143a5` are ancestors of HEAD and the plan ledger measures 2 commits; `grep -c "Leave this run?" src/ui/screens/Confirm.tsx` is 1, `grep -c "Try again" src/ui/screens/Confirm.tsx` is 2, `grep -c leaveRun src/ui/session.ts` is 2, `grep -c "CHOOSE SITUATION" src/ui/panel/frames/ScenarioAreaFrame.tsx` is 3, `grep -c "CLOSE LIST" src/ui/panel/frames/ScenarioAreaFrame.tsx` is 3, `grep -c scenario_area e2e/static-text.spec.ts` is 1.
