---
phase: 03-reactive-scenarios-and-initial-pack
plan: 10
subsystem: panel
tags: [fuel-selector, ecs-shutoff, rotary, detent-lever, layout-gates, pedestal, preact]

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: plan 03-03 state of registry.ts, panel.ts, the reference tables, the legroom gate and the README count sentence (kp.squawk, region transponder)
provides:
  - sw.fuel_valve, the FUEL selector (rotary, selector-bar look) at the bottom left of the pedestal
  - lv.ecs_shutoff, the ECS SHUTOFF pull (detent lever, pull-ecs skin) in the new region under_panel_ecs
  - ROTARY_SKINS (round, selector-bar) with a load-time check, and the lever skin pull-ecs
  - the cowl flap lever shortened and raised, its two lamps and its placard moved with it
  - layout, legroom, tap-size, label, review, README and static-text gates for the two controls; e2e/fire-controls.spec.ts
affects: [03-08, 03-09]

actuals:
  tokens: 19000
  tasks: 3
  commits: 3
plan_head_before: 8703150e19e75f485ce6a5f1c3c17dd52cc08570
plan_head_after: c98513647b037addb40cf31914ccfb772641943d

tech-stack:
  added: []
  patterns:
    - "A rotary look is data (RotaryDef.skin, validated in defineRegistry); the art keys on the skin, never on a control id"
    - "Art-only pseudo-perspective of a lever head: LeverHandle gets the pull fraction (pullFraction of the track), the hit footprint and the detent geometry stay as the lever computes them"
    - "A gate-forced geometry change is recorded as a deviation, never worked around in the gate"

key-files:
  created:
    - e2e/fire-controls.spec.ts
  modified:
    - src/engine/registry.ts
    - src/aircraft/da50rg/controls/knobs.ts
    - src/aircraft/da50rg/controls/pedestal.ts
    - src/aircraft/da50rg/controls/under-panel.ts
    - src/aircraft/da50rg/panel.ts
    - src/aircraft/da50rg/indicators.ts
    - src/aircraft/da50rg/placards.ts
    - src/ui/panel/widgets/Rotary.tsx
    - src/ui/panel/widgets/DetentLever.tsx
    - src/ui/panel/skins/LeverHandles.tsx
    - tests/detents.test.ts
    - tests/layout-reference.ts
    - tests/layout.test.ts
    - tests/registry.test.ts
    - tests/rotary.test.ts
    - tests/lever-skins.test.ts
    - docs/PANEL-LABELS.md
    - docs/PANEL-REVIEW.md
    - README.md

key-decisions:
  - "FUEL selector final geometry: centre global (1005, 1258), hit 86 x 44, r 22 (the plan proposed 1010, 1256, 64 x 64, r 24); a three-stop knob has a tap half on each side and each half must reach 44 px at the phone pedestal zoom, which needs a hit at least 85 wide"
  - "Cowl flap final geometry: centre global (1058, 1192), track 44 (not 36), hit 50 x 88; the handle square is capped by the marker spacing, which is the track length, and the phone zoom needs at least 42.2 units; lamps at global y 1170 and 1214 level with the track ends, placard offset dy -46"
  - "The pull-ecs head carries the text in two lines (ECS, SHUTOFF) inside one text element so the printed text stays ECS SHUTOFF; font size 6 is the smallest size the type-scale gate allows"
  - "Stem of the pull-ecs is the dark red #8f0f16, not the safety red #c4161f, which the lever gate reserves for the pull-t and pull-tab bodies"

patterns-established:
  - "A new rotary look: add it to ROTARY_SKINS, branch in RotaryBody, add a row to the knob table; no new control kind"

requirements-completed: [CNT-01]

coverage:
  - id: D1
    description: "The user turns the FUEL selector on the pedestal from NORMAL through EMERGENCY to OFF by right-half taps and back by a left-half tap; the view does not change and the three printed words never change"
    requirement: "CNT-01"
    verification:
      - kind: e2e
        ref: "e2e/fire-controls.spec.ts#FUEL selector steps NORMAL, EMERGENCY, OFF by right-half taps and back by a left-half tap (desktop-chromium, phone-chromium)"
        status: pass
      - kind: unit
        ref: "tests/rotary.test.ts#FUEL selector (plan 03-10, C-51, C-52)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The user pulls the ECS SHUTOFF by its marker and pushes it back; pulled, the head is drawn lower and to the left of the stowed head; a double tap retracts the pull from the log; the printed text is ECS SHUTOFF in both states"
    requirement: "CNT-01"
    verification:
      - kind: e2e
        ref: "e2e/fire-controls.spec.ts#ECS SHUTOFF pulls by its marker and the in marker pushes it back (desktop-chromium, phone-chromium)"
        status: pass
      - kind: e2e
        ref: "e2e/fire-controls.spec.ts#@hooks a double tap on the ECS marker retracts the pull (desktop-chromium, phone-chromium)"
        status: pass
      - kind: unit
        ref: "tests/lever-skins.test.ts#ECS SHUTOFF, the pull-ecs skin (plan 03-10, C-54, C-56)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The registry accepts the selector-bar look and the pull-ecs skin and rejects an unknown rotary skin; every existing knob keeps the round look"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "tests/rotary.test.ts#rotary registry invariants, accepts every rotary skin of the vocabulary and none"
        status: pass
      - kind: unit
        ref: "tests/registry.test.ts#lever skins, accepts every skin of the vocabulary and none"
        status: pass
    human_judgment: false
  - id: D4
    description: "The moved cowl flap, its lamps and placard and the two new controls pass every layout, legroom, tap-size, background-clearance, label, review, README-count and static-text gate"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "tests/layout.test.ts, tests/zoom.test.ts, tests/panel-labels.test.ts, tests/panel-review.test.ts, tests/static-text.test.ts, tests/indicators.test.ts, tests/detents.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/layout.spec.ts, e2e/art-fit.spec.ts, e2e/static-text.spec.ts, e2e/inventory.spec.ts, e2e/lever-skins.spec.ts, e2e/lever.spec.ts, e2e/indicator.spec.ts, e2e/rotary.spec.ts (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The look and the positions of the two controls match the owner's description: the red elongated knob with its white line and white words at the bottom left of the pedestal, the white ECS SHUTOFF head under the panel and its tilt when pulled"
    verification: []
    human_judgment: true
    rationale: "No photo exists; positions and looks come from the owner's words of 2026-10-22. The 225 degree OFF angle, the colours, the drawn sizes, the schematic pedestal position and the tilt are listed as unverified in docs/PANEL-LABELS.md (Q-15 to Q-18) and docs/PANEL-REVIEW.md for the owner to check on a render"

duration: 16min
completed: 2026-10-22
status: complete
---

# Phase 3 Plan 10: FUEL selector and ECS SHUTOFF Summary

**The two controls of the Engine Fire checklist that the panel lacked are on it: the FUEL selector (an elongated red rotary knob, NORMAL / EMERGENCY / OFF at 0 / 90 / 225 degrees) at the bottom left of the pedestal, and the ECS SHUTOFF pull (a white head that prints ECS SHUTOFF, drawn down-left when pulled) under the panel, with the cowl flap shortened and raised and every layout, tap-size, label and review gate extended.**

## Performance

- **Duration:** 16 min (2026-10-22T20:49:49Z to 21:06Z)
- **Tasks:** 3 (1 tracer, 1 auto, 1 TDD-style test task)
- **Files modified:** 20 (1 created)

## Accomplishments

- `src/engine/registry.ts`: `ROTARY_SKINS` (`round`, `selector-bar`), the `RotarySkin` type, the optional `RotaryDef.skin` and a `RegistryError` naming the knob for an unknown skin; `LEVER_SKINS` gains `pull-ecs`. No other rule changed, no new control kind.
- `sw.fuel_valve` (`controls/knobs.ts`, region `pedestal`, nameless): stops `normal` 0, `emergency` 90, `off` 225, default `normal`, no click spots, so a tap on the right half steps clockwise, on the left half back, a drag commits the nearest stop (the stop rules of `src/engine/rotary.ts` are unchanged). `RotaryBody` draws the selector-bar look: a red bar of length 2r and width r/2, turned to the stop angle (or the drag angle), a white line at its pointing end, a blue ring while pressed, and the three words in white outside the sweep in the direction of each stop, each reading away from the knob.
- `lv.ecs_shutoff` (`controls/under-panel.ts`, new region `under_panel_ecs` at x 296, y 745, 80 x 120, global centre 336, 805, hit 44 x 110, track 60, nameless, no legends): `pulled` at pos 0 and `in` at pos 1, default `in`, a tap marker on each detent. The `pull-ecs` skin draws a white round head with the static text ECS SHUTOFF in dark lettering; pulled, the head moves 6 units left, grows 10 percent, throws a soft shadow down-left and the stem slants from the panel entry to the head. `DetentLever` passes the smallest extra prop, the pull fraction of the handle (`pullFraction`); the hit footprint, markers and detent geometry are unchanged.
- The cowl flap lever is shorter and higher; `lt.cowl_open`, `lt.cowl_closed` and the COWL FLAP placard moved with it.
- Gates: reference rows for the two controls and the moved cowl flap and lamps, the region in the region lists, six ordering rows, the legroom exception `under_panel_ecs`, the label table (two rows, four questions Q-15 to Q-18), the review list (two rows, the cowl rows updated, the region named), the README count sentence (95 controls, 13 lamps, 33 regions, taken from the test), `tests/rotary.test.ts` and `tests/lever-skins.test.ts` cases, and `e2e/fire-controls.spec.ts`.

## Task Commits

1. **Task 1 (tracer): the pilot turns the FUEL selector to OFF and pulls the ECS SHUTOFF** - `d02c524`
2. **Task 2: labels, review rows and README counts for the two controls** - `24b52ea`
3. **Task 3: the selector look, the pull-ecs skin and the registry rules pinned by unit tests** - `c985136`

Tracer feedback gate: auto/end-of-phase mode with an automated-only `<verify>`; typecheck, the unit files and `e2e/fire-controls.spec.ts` on desktop-chromium and phone-chromium were re-run end to end and passed, so expansion continued.

## Verification

- `npx vitest run`: 47 files, 2346 tests pass. `npm run typecheck`, `npm run lint` and `npm run format:check` exit 0.
- `PW_PORT=4333 npx playwright test --project=desktop-chromium --project=phone-chromium` (the whole suite, which includes `e2e/fire-controls.spec.ts` and the eight specs of the plan verification): 558 passed, 110 skipped (project-specific cases), 0 failed.
- The look was checked on screenshots of the built app (pedestal at NORMAL, EMERGENCY and OFF; the ECS SHUTOFF stowed and pulled): no text overlaps, the pulled head and stem read as pulled down-left.
- Acceptance greps: `sw.fuel_valve` in knobs.ts 1, `lv.ecs_shutoff` in under-panel.ts 1 and detents.test.ts 1, `selector-bar` in registry.ts 3, `pull-ecs` in LeverHandles.tsx 5, `under_panel_ecs` in panel.ts 1 and layout.test.ts 3, `sw.fuel_valve` in layout-reference.ts 4, PANEL-LABELS.md 2 and PANEL-REVIEW.md 1, `lv.ecs_shutoff` in layout-reference.ts 4, PANEL-LABELS.md 2 and PANEL-REVIEW.md 1, `225` in PANEL-LABELS.md 2, `sw.fuel_valve` in rotary.test.ts 6, `pull-ecs` in lever-skins.test.ts 2.

## Assumptions taken (defaults C-51 to C-57)

- C-51, C-52, C-54, C-55, C-56 and C-57 taken as written, except the sizes recorded under "Deviations". Final coordinates and sizes the layout gates accepted:

| Part | Global centre | Size | Notes |
|------|---------------|------|-------|
| `sw.fuel_valve` | 1005, 1258 | hit 86 x 44, r 22 (bar 44 long, 11 wide) | region-local 48, 216 in `pedestal` |
| `lv.cowl_flap` | 1058, 1192 | hit 50 x 88, track 44 | was 1058, 1218, hit 50 x 104, track 60 |
| `lt.cowl_open` | 1022, 1170 | r 5 | was 1188 |
| `lt.cowl_closed` | 1022, 1214 | r 5 | was 1248 |
| COWL FLAP placard | dx -17, dy -46 from the lever | | was dy -54 |
| `lv.ecs_shutoff` | 336, 805 | hit 44 x 110, track 60 | region `under_panel_ecs` x 296, y 745, 80 x 120 |

- C-53 stated "the throttle and the parking brake do not move": both are unchanged.
- The pull-ecs head: radius 14, 6 units left and 10 percent larger when fully pulled, shadow `#050506` at 45 percent opacity, stem `#8f0f16`, head `#f4f5f7`, lettering `#1b1e22`. The selector-bar knob: `#b3141c` with edge `#7a0d13`, words `#f2f4f7`. All are planner choices listed for the owner (Q-16, Q-18).
- ECS SHUTOFF uses its own stem (`EcsStem`, a slanting quadrilateral) instead of the straight `PullTrack` rectangle, because the straight rectangle cannot slant; the stem entry point and end follow the PullTrack rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Gate files and one existing test needed in Task 1**
- **Found during:** Task 1 verify
- **Issue:** `tests/registry.test.ts` (in the Task 1 verify) compares the control count with the reference tables and counts the lever skins; `tests/rotary.test.ts` lists the knobs of Table K1; the legroom case of `tests/layout.test.ts` names the allowed regions. The plan assigns the tables and the legroom case to Task 2, and does not list `tests/registry.test.ts`, so the Task 1 verify could not pass.
- **Fix:** The reference rows, the region lists, the ordering rows and the legroom exception, the skin count of `tests/registry.test.ts` and the Table K1 list of `tests/rotary.test.ts` were committed with Task 1; Task 2 then holds the documents and the README.
- **Files modified:** tests/layout-reference.ts, tests/layout.test.ts, tests/registry.test.ts, tests/rotary.test.ts
- **Commit:** d02c524

**2. [Rule 1 - Bug] The plan's proposed geometry fails the phone tap-size gate**
- **Found during:** Task 1 verify (`tests/zoom.test.ts`)
- **Issue:** C-53 proposed a cowl flap track of 36 and a FUEL hit of 64 x 64. A lever handle square is `min(across, along - track, smallest marker spacing)` and the marker spacing is the track length, so a 36 track gives 36 units, 37.6 px at the pedestal zoom of the phone (44 needed). A knob with three stops has a tap half on each side, `hit.w / 2`, so 64 wide gives 32 units. The plan states that the layout gates decide the geometry.
- **Fix:** Cowl flap track 44 with hit 50 x 88 (handle square 44); FUEL hit 86 x 44 with r 22. To fit them: the lever moves up to global y 1192 so its footprint ends at 1236 and the 86 wide FUEL footprint (x 962 to 1048, on the pedestal plate) starts at 1236 and ends at 1280; the lamps and the placard keep their relation to the lever; the open lamp may not go higher than global y 1170 (the 7 unit bezel clearance and the caption stay below the parking brake footprint at 1154).
- **Files modified:** src/aircraft/da50rg/controls/pedestal.ts, controls/knobs.ts, indicators.ts, placards.ts, tests/layout-reference.ts
- **Commit:** d02c524

**3. [Rule 1 - Bug] Type-scale gate and safety-red gate**
- **Found during:** Task 1 verify (`tests/lever-skins.test.ts`)
- **Issue:** The first ECS head text used font size 5.5, and `tests/lever-skins.test.ts` allows only 6, 8, 10 and 14; the red-stem draft must not use `#c4161f`, which the same file reserves for the pull-t and pull-tab bodies.
- **Fix:** Font size 6, set in two lines (ECS, SHUTOFF) inside one text element so the printed text stays ECS SHUTOFF (the second line is compressed to the head width); the stem is the dark red `#8f0f16`.
- **Files modified:** src/ui/panel/skins/LeverHandles.tsx
- **Commit:** d02c524

**4. [Rule 1 - Bug] Selector word placement**
- **Found during:** Task 1, screenshot check
- **Issue:** The first version put the NORMAL word below its anchor point, over the tip of the knob (the screen direction of a stop was read with the wrong sign).
- **Fix:** A stop straight up puts its word above the point, straight down below it, a sideways or diagonal stop beside the point (OFF at the lower left reads leftwards, so it stays inside the pedestal plate).
- **Files modified:** src/ui/panel/widgets/Rotary.tsx
- **Commit:** d02c524

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 3). **Impact:** none on scope; geometry differs from the C-53 proposal where the existing gates forced it, no gate was loosened and no ordering row had to move (all existing rows and the new ones hold).

## Known Stubs

None. Neither control has a physical effect yet by design: plan 03-08 adds the fuel cut and grades both controls (prohibition of this plan).

## Threat Flags

None. The two controls add no network, file or schema surface; T-03-23 (layout fidelity) is mitigated by the reference rows (tol 8, review true) and the review and label entries, T-03-24 by the unchanged registry rule that only legal stops and detents reach the store.

## Next Phase Readiness

- Plan 03-08 can name `sw.fuel_valve` (`off`) and `lv.ecs_shutoff` (`pulled`) in the Engine Fire scenario and add the fuel cut to the simulation; `tests/blueprint.test.ts` keeps the ids out of `src/engine`, `src/scenario` and `src/ui` (the art keys on the skins).
- Open for the owner (listed, not blocking): the 225 degree OFF angle, the colours and sizes, the schematic pedestal position, the tilt of the pulled look (Q-15 to Q-18 in `docs/PANEL-LABELS.md`, the two rows in `docs/PANEL-REVIEW.md`).

## Self-Check: PASSED

- Files: `src/aircraft/da50rg/controls/knobs.ts`, `src/aircraft/da50rg/controls/under-panel.ts`, `src/engine/registry.ts` and `e2e/fire-controls.spec.ts` exist.
- Commits `d02c524`, `24b52ea` and `c985136` are ancestors of HEAD; `git rev-list --count` from the recorded plan base gives 3.
