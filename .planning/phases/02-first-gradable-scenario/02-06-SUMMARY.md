---
phase: 02-first-gradable-scenario
plan: 06
subsystem: session-ui
tags: [session-machine, new-situation, action-press-class, footer-run-button, debrief, e2e]

requires:
  - phase: 02-first-gradable-scenario
    provides: pack seam, openScenario, grade, VirtualClock (plan 02)
  - phase: 02-first-gradable-scenario
    provides: bridge.reset, quantities, setTimeSource, plate session-pad, region scenario_area, SESSION_LAYOUT (plan 04)
provides:
  - createSession and pickRandom (src/ui/session.ts): screens free, running, debrief; newSituation, complete, closeDebrief
  - press class action and data-session-hit: session buttons that never record, pair, retract or zoom
  - SessionButton, ScenarioAreaFrame (NEW SITUATION in the co-pilot legroom)
  - footer Procedure complete (44 px button, 52 px footer) and the PASS/FAIL Debrief modal
  - window.__panelSession e2e hook and e2e/scenario.spec.ts
affects: [02-08, 02-09, 02-10, 02-11, 02-12, 02-13]

actuals:
  tokens: 14200
  tasks: 2
  commits: 2

plan_head_before: 0ee8b225a4c0d75a7c493dafc706a37d4986b6e2
plan_head_after: 7bea76a4b895677cfbd082b26ce248c211049361

tech-stack:
  added: []
  patterns:
    - "Session buttons are a fifth press class (action): the arbiter sees a latch, the gesture layer calls the tap directly and resets the pair tracker"
    - "Session state is a signal machine with injected rng, packs and onRunStart; no DOM, tested in node with a real bridge"
    - "Grading input is store.events() mapped to plain {t, id, value}, so a retract before Procedure complete removes the event from the graded recording"

key-files:
  created:
    - src/ui/session.ts
    - src/ui/screens/Debrief.tsx
    - src/ui/panel/frames/ScenarioAreaFrame.tsx
    - src/ui/panel/widgets/SessionButton.tsx
    - e2e/scenario.spec.ts
    - tests/session.test.ts
  modified:
    - src/ui/App.tsx
    - src/ui/stage.css
    - src/ui/panel/Panel.tsx
    - src/ui/panel/frames/MfdFrame.tsx
    - src/ui/panel/press-targets.ts
    - src/ui/panel/zoom.ts
    - e2e/neutral.spec.ts
    - e2e/support/zoom.ts
    - tests/zoom.test.ts

key-decisions:
  - "Session buttons carry data-session-hit (not data-hit), so every existing spec that enumerates data-hit elements as registry controls stays untouched"
  - "The arbiter is not extended: an action target is classified as latch there, and only zoom.ts treats the resulting tap differently"
  - "complete() keeps the paused clock until closeDebrief; closeDebrief sets the clock to null and keeps result, control state and quantities"

patterns-established:
  - "A new pointer-target kind is added by a press class in press-targets.ts plus one branch in the tap effect, never by a widget-level listener"

requirements-completed: [SES-01, SES-03, SES-04, SCN-05]

coverage:
  - id: D1
    description: "NEW SITUATION picks a scenario at random through the pack seam, applies its baseline without an event, returns to the full panel and starts the run"
    requirement: SES-01
    verification:
      - kind: unit
        ref: "tests/session.test.ts#newSituation"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#NEW SITUATION starts ENG OIL TEMP in its initial state (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "While running the app is silent and the footer carries a Procedure complete button of at least 44 px in a footer of at least 52 px"
    requirement: SES-03
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#the exam stays silent and session buttons record nothing"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#NEW SITUATION starts ENG OIL TEMP in its initial state"
        status: pass
    human_judgment: false
  - id: D3
    description: "Procedure complete grades the recorded log and the debrief shows PASS or FAIL, the reason lines and one verdict row per graded step; Back to panel keeps the end state"
    requirement: SES-04
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#the golden run grades PASS and keeps the end state"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#doing nothing grades FAIL"
        status: pass
      - kind: unit
        ref: "tests/session.test.ts#closeDebrief"
        status: pass
    human_judgment: false
  - id: D4
    description: "Credit follows the resulting control state of the recorded log: a retracted actuation is not graded"
    requirement: SCN-05
    verification:
      - kind: unit
        ref: "tests/session.test.ts#complete"
        status: pass
    human_judgment: false
  - id: D5
    description: "Session buttons never enter the action log, are never graded, act on the first release and never zoom or retract"
    requirement: SES-01
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#the exam stays silent and session buttons record nothing"
        status: pass
      - kind: e2e
        ref: "e2e/neutral.spec.ts, e2e/press.spec.ts, e2e/zoom.spec.ts on desktop-chromium and phone-chromium"
        status: pass
    human_judgment: false
  - id: D6
    description: "How the NEW SITUATION button, the footer button and the debrief look and read on a phone and a tablet"
    requirement: SES-04
    verification: []
    human_judgment: true
    rationale: "Layout gates pass (art-fit, static-text, layout, zoom); visual adequacy of the debrief card and the footer on a real phone is an owner judgement"

duration: 6min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 06: Session machine, NEW SITUATION, footer button and PASS/FAIL debrief Summary

**The pilot's whole path runs on the built panel: NEW SITUATION in the co-pilot legroom opens a random allowed scenario through the pack seam and puts the panel in its initial state without an event, the footer "Procedure complete" grades the recorded log, and a debrief shows PASS or FAIL with one verdict row per step while the end state stays after Back to panel.**

## Performance

- **Duration:** about 6 min
- **Tasks:** 2 of 2 (Task 1 tracer, Task 2 test-first contract)
- **Files:** 15 changed (6 created)

## Accomplishments

- `src/ui/session.ts`: Table N1. `screen`, `scenario`, `result`, `busy`, `loadFailure`, `clock` signals; `newSituation` lists the packs the policy allows in manifest order, picks with `pickRandom(entries, rng)`, opens through `openScenario`, then `bridge.reset(initial)`, a new `VirtualClock` as the bridge time source, `onRunStart` (App: `zoomOut`) and screen `running`. `complete` grades a plain `{ t, id, value }` copy of `store.events()`, pauses the clock and clears the time source. `closeDebrief` returns to `free` and leaves control state and quantities as the run left them.
- Press class `action` (`press-targets.ts`, `zoom.ts`): the tap selector also matches `[data-session-hit]`, the press key falls back to that attribute, the arbiter sees a latch press (same slop, pan and pinch rules) and the tap effect calls the target directly, resets the pair tracker and changes no view.
- `SessionButton.tsx` and `ScenarioAreaFrame.tsx`: Table SB button at the SESSION_LAYOUT rectangle (size 14 label, pressed rim, keyboard Enter/Space, focus ring shown by `:focus-visible`); `Panel` takes an optional `session` and maps `scenario_area` to the frame.
- `App.tsx` and `stage.css`: module-level session over `VITE_PACKS`, `OPEN_ACCESS`, `DA50RG_ENV`, `Math.random`; footer grows to 52 px while running or in the debrief; "Procedure complete" shown only while running; `window.__panelSession` only in the e2e build.
- `screens/Debrief.tsx`: Table F1 modal (role dialog, aria-modal, focus on Back to panel, Escape closes, backdrop does nothing), PASS/FAIL word, reason lines, verdict rows in declared order with severity tag and verdict word.
- `e2e/scenario.spec.ts`: the four cases of Table E1; `neutral.spec.ts` and `backgroundPoint` count session buttons as tap targets.
- `tests/session.test.ts`: 24 cases.

## Task Commits

1. Task 1 (tracer): `ca6a705` feat(02-06): NEW SITUATION to initial state to Procedure complete to a PASS or FAIL debrief
2. Task 2: `7bea76a` test(02-06): unit contract of the session: start, graded log, retract, kept end state, refusals

## Verification

- `npx vitest run`: 35 files, 2019 tests passed
- `npm run typecheck`, `npm run lint`, `npm run format:check`: exit 0
- `PW_PORT=4326 npx playwright test e2e/scenario.spec.ts e2e/layout.spec.ts e2e/art-fit.spec.ts e2e/static-text.spec.ts e2e/zoom.spec.ts e2e/press.spec.ts e2e/neutral.spec.ts e2e/inventory.spec.ts --project=desktop-chromium --project=phone-chromium`: 270 passed, 84 skipped (project-specific skips), 0 failed
- Acceptance greps: `'action'` in press-targets.ts 1, `data-session-hit` in zoom.ts 2, `Procedure complete` in App.tsx 2, `openScenario` in session.ts 3, `pickRandom` in tests/session.test.ts 7
- The build-base hook-absence test (production build contains no `__panel`) passes with the new `__panelSession` hook.

## Assumptions taken

- No 400 ms input shield on the debrief yet: the plan lists the shield under the shared modal shell of plan 09, and Table F1 does not ask for it here.
- Opener focus is not restored on closing the debrief: the opener (the footer button) is gone by then; plan 09's shell owns focus return.
- When the manifest lists no scenario for any allowed pack, `newSituation` sets `loadFailure` with reason `missing`; when every pack is refused by the policy the reason is `denied` (plan 12 renders both).
- A baseline that `bridge.reset` refuses is reported as `loadFailure` reason `invalid` and the screen stays `free`.
- `closeDebrief` keeps `result` and `scenario` (they are cleared at the next start) but sets `clock` to null.
- `buttonCoverage` in e2e/support/zoom.ts is left unchanged (the Full panel button rule covers registry controls); only the neutral grid and `backgroundPoint` count session buttons.
- Executed sequentially on the phase branch; STATE.md and ROADMAP.md updated through the state handlers as the dispatch directed (the plan text says STATE.md is not edited).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] HTML chrome type-scale gate allowed only 14 px**
- **Found during:** Task 1 (full vitest run)
- **Issue:** `tests/zoom.test.ts` required every `font-size` in `stage.css` to be `14px`; the debrief card needs Body 16 and Display 28 from the UI-SPEC Typography scale of this phase.
- **Fix:** The gate now accepts the phase 02 scale 14, 16, 20 and 28 px and still fails for any other size.
- **Files modified:** tests/zoom.test.ts (outside the plan's file list)
- **Commit:** ca6a705

**Total deviations:** 1 auto-fixed (Rule 3, a test gate that follows the UI-SPEC scale). **Impact:** none on scope. The SVG panel keeps its frozen sizes; the new SVG label uses size 14.

## Authentication Gates

None.

## Known Stubs

None. CHOOSE SITUATION, the briefing and the leave-run confirm are separate later plans (11, 12), not stubs of this one.

## Threat Flags

None. T-02-08 (session buttons never call `bridge.actuate`, the e2e case asserts the log holds only the two control events) and T-02-09 (`__panelSession` only with `VITE_TEST_HOOKS=1`, covered by the build-base test) are mitigated as planned; no package was installed (T-02-SC).

## Next Phase Readiness

Plan 08 (CAS chip, MFD oil gauges) can read `bridge.quantities` that the run now sets. Plan 09 adds the clock driver for `session.clock` and moves the debrief onto the shared modal shell (input shield, focus return). Plan 10 checks the session area at every zoom level; plans 11 and 12 add the briefing, CHOOSE SITUATION and the leave-run confirm on top of `createSession`.

## Self-Check: PASSED

All created files exist on disk; commits ca6a705 and 7bea76a are ancestors of HEAD; the plan commit ledger measures 2 commits.
