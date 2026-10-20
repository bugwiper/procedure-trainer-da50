---
phase: 01-deployed-playable-panel
plan: 03
subsystem: panel
tags: [registry, store, signals, svg, toggle, layout, playwright]
requires:
  - phase: 01-01
    provides: toolchain, panel stage shell, ESLint purity boundary, six-project Playwright harness
provides:
  - Engine registry (defineRegistry, ControlDef union, derived guards, derived region.controlIds)
  - PanelStore (dispatch with unknown / illegal-state / blocked / unchanged rejections, guard interlock, event log, subscribe)
  - DA50 RG VIEWBOX 2000x1010, VIEW_PROFILES and 13 data-driven regions
  - 13 operable plain toggles (12 instrument-panel switches plus the MFD PAGE softkey) with in-flight defaults
  - Signals bridge with e2e-only window.__panel hook, Panel, ControlWidget, Toggle widget
  - tests/layout.test.ts geometry gate with reference position and ordering tables
affects: [01-04, 01-05, 01-06, 01-07, 01-08, 01-09]
tech-stack:
  added: []
  patterns:
    - Registry as frozen plain data with small invariant check functions
    - One signal per control id; widgets read only their own signal
    - Widget DOM contract (data-control-id, data-kind, data-state, data-state-text, data-hit)
    - Data-driven layout gate that skips rows for controls added by later plans
key-files:
  created:
    - src/engine/registry.ts
    - src/engine/store.ts
    - src/aircraft/da50rg/panel.ts
    - src/aircraft/da50rg/controls/switch-bank.ts
    - src/aircraft/da50rg/controls/engine.ts
    - src/aircraft/da50rg/controls/mfd.ts
    - src/ui/bridge.ts
    - src/ui/panel/Panel.tsx
    - src/ui/panel/ControlWidget.tsx
    - src/ui/panel/widgets/Toggle.tsx
    - e2e/toggle.spec.ts
    - tests/layout.test.ts
  modified:
    - src/ui/App.tsx
key-decisions:
  - "Closing a guard is always allowed and the switch keeps its position (research assumption A5 rejected, per plan)"
  - "Region name placards are drawn above each region frame so they never collide with controls"
  - "Under-panel rule in the layout test: controls sit below the bottom of every front-panel region (see Deviations)"
patterns-established:
  - "Pointer contract: primary pointer only, setPointerCapture on down, actuate on up within 10 CSS px, clear on cancel / lostpointercapture, no click listener"
  - "Hit rects are the last child of a control group; e2e activates controls through [data-hit]"
requirements-completed: [PNL-02, PNL-01, PNL-05, PNL-06, PNL-08]
duration: 35min
completed: 2026-10-20
status: complete
commits: 2
plan_head_before: 76960ab
plan_head_after: b683e5b85cf7e1c150c67c55017b9b3d43c7ce20
actuals:
  tokens: 30000
  tasks: 2
  commits: 2
---

# Phase 1 Plan 03: Registry, store and first operable toggles Summary

ENGINE MASTER and 12 further plain toggles are operable by mouse or tap, end to end through a validating registry, a pure PanelStore and a per-control signals bridge, laid out on 13 regions at the measured true DA50 RG positions and gated by a data-driven layout test.

## Tasks

| Task | Name | Commit | Notes |
| ---- | ---- | ------ | ----- |
| 1 | Tracer: ENGINE MASTER from registry to visible state | 2a7b80b | typecheck, lint, 30 e2e tests green in all six projects |
| 2 | Complete the toggle set and the layout gate | b683e5b | 36 e2e tests green; vitest 54 passed, 27 skipped |

## What was built

- `defineRegistry` copies and freezes its input, runs one small check function per rule (unique id, id pattern, legal default, region exists), derives a `GuardDef` directly after every guarded toggle, and derives `region.controlIds`. Errors are `RegistryError` naming the offending id.
- `PanelStore.dispatch` rejects in order: RangeError for a bad time, `unknown`, `illegal-state`, `blocked`, `unchanged`; accepted changes append one event and notify. The engine reads no clock.
- Panel regions come from data: 13 regions (DE-ICE, ENGINE, PFD, MFD, MFD SOFTKEYS, SWITCH ROW, LANDING GEAR, FLAPS, RIGHT PANEL, UNDER PANEL L/C/R, PEDESTAL). Empty regions render their frame only. The renderer has no pointer handlers outside widget hit rects.
- Toggle switch skin: placard, bat handle that moves up or down, lit indicator, state text. Softkey skin: key with label, state text and accent border. State never relies on colour alone.
- `tests/layout.test.ts`: viewBox and PFD/MFD size, region containment and overlap, footprint containment and overlap (touching allowed), guard open areas, detent square sizing, 23-row reference position table (3-unit tolerance), reference ordering table with skips for controls from plans 05 and 07.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` exit 0 (54 passed, 27 skipped: layout rows for controls that arrive in plans 05 and 07).
- `npx playwright test e2e/toggle.spec.ts e2e/smoke.spec.ts`: 36 passed across desktop-chromium, desktop-webkit, phone-chromium, phone-webkit, tablet-webkit, phone-portrait.
- `grep -c onPointer` prints 0 for `Panel.tsx` and `App.tsx`; engine files import nothing from Preact or `src/ui`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan inconsistency] Under-panel ordering rule**
- **Found during:** Task 2 (writing the layout test)
- **Issue:** The behaviour block says every under-panel and pedestal control must sit "below y 790 (the front panel's bottom)", but the plan's own reference measurement table places ALTERNATE STATIC, EMERGENCY GEAR EXTENSION and ALTERNATE AIR at y 625 and POWER at y 780. The two cannot both hold.
- **Fix:** The test asserts the intent instead: every control in an under-panel or pedestal region lies below the bottom edge of every front-panel region (560). The measurement table positions are authoritative.
- **Files modified:** tests/layout.test.ts

**2. [Rule 3 - Ambiguity] "MFD PAGE inside the MFD region's bottom-left quarter"**
- **Found during:** Task 2
- **Issue:** MFD PAGE sits at global (1288, 409), under the MFD region (bottom edge 387), so it cannot lie inside the region's bottom-left quarter literally.
- **Fix:** Implemented as relation `under-left-quarter-of`: x within the leftmost quarter of the MFD x-span and y between the MFD bottom edge and 60 units below it.
- **Files modified:** tests/layout.test.ts

**3. [Rule 3 - Blocking] e2e window hook typing**
- **Issue:** The e2e project has no DOM lib, so `window.__panel` does not type-check in specs.
- **Fix:** `e2e/toggle.spec.ts` declares a local mirror interface and reads the hook through `globalThis`.

The reference photos (`.input/`) are git-ignored and not present in the worktree; all coordinates came from the plan text, which fixes them.

## Known Stubs

None. Empty regions (DE-ICE, LANDING GEAR, FLAPS, under-panel, pedestal) are intentional frame-only regions that plans 05 and 07 fill. PFD and MFD frames are drawn by plan 06.

## Threat Flags

None. `window.__panel` exists only when `VITE_TEST_HOOKS=1` (e2e build), is read-only and exposes no dispatch (T-01-06; plan 04 asserts the deploy build lacks it).

## Self-Check: PASSED

- All listed files exist; commits 2a7b80b and b683e5b are in the branch history.
- No STATE.md or ROADMAP.md changes.
