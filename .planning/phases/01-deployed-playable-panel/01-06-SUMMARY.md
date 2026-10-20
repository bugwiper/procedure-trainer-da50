---
phase: 01-deployed-playable-panel
plan: 06
subsystem: ui
tags: [preact, svg, mfd, pfd, b612, fontsource, content-policy, responsive, playwright]

requires:
  - phase: 01-deployed-playable-panel
    provides: "Registry, store, bridge, Toggle widget and the 13 panel regions (plans 01-03)"
provides:
  - "MFD Map page with engine strip and full Engine page, switched by the MFD PAGE softkey (sw.mfd_page)"
  - "Static PFD frame with attitude, airspeed, altitude and heading areas"
  - "ArcGauge and BarGauge presentational components with AFM 02-05 colour bands"
  - "Self-hosted B612 / B612 Mono placard and glass typography for all panel text"
  - "Footer About dialog with training-aid notice, not-affiliated statement and the full content policy text"
  - "Dismissible portrait-phone rotate hint and cross-device layout e2e gates"
affects: [01-09 region zoom, 03 live gauge binding PNL-04, 01-05 levers, 01-07 guarded switches]

actuals:
  tokens: 9800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Region id to frame component map in Panel.tsx; frames render after the region rect and before controls, with pointer-events none"
    - "Gauges take value as a plain prop and rotate needles with the SVG rotate(angle cx cy) attribute"
    - "Policy text imported with ?raw and rendered as a Preact text child of a pre element"
    - "Global .panel-svg text rule supplies the placard font; explicit fill attributes are kept"

key-files:
  created:
    - src/ui/panel/frames/MfdFrame.tsx
    - src/ui/panel/frames/PfdFrame.tsx
    - src/ui/panel/frames/ArcGauge.tsx
    - src/ui/panel/frames/BarGauge.tsx
    - src/ui/about/About.tsx
    - tests/content-policy.test.ts
    - e2e/glass.spec.ts
    - e2e/about.spec.ts
    - e2e/layout.spec.ts
  modified:
    - src/ui/panel/Panel.tsx
    - src/ui/App.tsx
    - src/ui/stage.css
    - src/main.tsx

key-decisions:
  - "Engine gauge set limited to indications with AFM 02-05 markings (RPM, load, oil pressure, oil/coolant/gearbox/fuel temperature, fuel pressure, fuel quantity, volts, amps); fuel flow and rudder trim from the reference photo are left out because no markings are confirmed"
  - "Placard text rule applies fill only to texts without their own fill attribute, so widget label colours survive"
  - "Footer wraps (min-height 28 px, flex-wrap) instead of fixed height, so the notice and the About link both stay visible on a 390 px portrait phone while landscape stays one 28 px line"
  - "About registers its Escape listener in useLayoutEffect so the key works as soon as the dialog is visible"

patterns-established:
  - "Frames are presentational: props are region and bridge, state read only via bridge.stateOf"
  - "Layout specs select tap targets and regions generically by data attributes"

requirements-completed: [PNL-05, CNT-03, PNL-01]

coverage:
  - id: D1
    description: "MFD PAGE softkey switches the MFD between the Map page with engine strip and the full Engine page"
    requirement: PNL-01
    verification:
      - kind: e2e
        ref: "e2e/glass.spec.ts#MFD PAGE softkey switches to the Engine page and back"
        status: pass
    human_judgment: false
  - id: D2
    description: "Static PFD frame with attitude, airspeed, altitude and heading areas"
    requirement: PNL-05
    verification:
      - kind: e2e
        ref: "e2e/glass.spec.ts#PFD shows attitude, airspeed, altitude and heading"
        status: pass
    human_judgment: false
  - id: D3
    description: "Self-hosted B612 fonts, no third-party request"
    requirement: PNL-05
    verification:
      - kind: e2e
        ref: "e2e/glass.spec.ts#B612 fonts are self-hosted and loaded"
        status: pass
    human_judgment: false
  - id: D4
    description: "About dialog surfaces the content policy and training-aid notice in the app"
    requirement: CNT-03
    verification:
      - kind: unit
        ref: "tests/content-policy.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/about.spec.ts#About opens from the footer and shows the policy"
        status: pass
    human_judgment: false
  - id: D5
    description: "Whole panel fits every device class without horizontal scroll; portrait rotate hint; state survives viewport change"
    requirement: PNL-05
    verification:
      - kind: e2e
        ref: "e2e/layout.spec.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual fidelity of the glass frames and not presenting the trainer as official"
    verification: []
    human_judgment: true
    rationale: "Looks of original artwork and tone of the notices need a human eye; footer notice text itself is test-checked"

duration: 55min
completed: 2026-10-20
status: complete
plan_head_before: 931ae93b295d2214c55c62c42cfa46d6e11ec9ee
plan_head_after: e324cac4f6b95015fff1fec2d64917adf5294b44
commits: 3
---

# Phase 1 Plan 06: Glass Frames, About and Layout Summary

**MFD with a softkey-driven Map and Engine page (AFM-banded gauges), a static PFD, self-hosted B612 typography, a footer About dialog rendering the content policy as text, and cross-device layout gates on six Playwright projects.**

## Performance

- **Duration:** about 55 min
- **Tasks:** 3 of 3
- **Files:** 13 (9 created, 4 modified)

## Accomplishments

- Tracer: tapping the MFD PAGE softkey flips `sw.mfd_page`; `MfdFrame` reads it through `bridge.stateOf` and shows the Map page (original vector map, range rings, own-ship, north marker, left engine strip) or the full Engine page (three arc gauges, nine bar gauges). Band limits come from AFM section 02-05 and are commented per gauge.
- `PfdFrame`: sky/ground attitude with pitch ticks and fixed aircraft symbol, airspeed 0 KT, altitude 1400 FT, heading 360, all static (D-11).
- Fonts: three fontsource CSS imports (B612 400/700, B612 Mono 400), woff2 emitted under dist/assets, no googleapis/gstatic in dist, every response same-origin in e2e.
- About dialog and policy surfacing, rotate hint for portrait phones (max-width 700 px), and the layout spec (no horizontal scroll, 13 regions inside the svg, fit-to-width on portrait, state survives rotation).

## Task Commits

1. Task 1 (tracer): MFD pages, gauges, Panel frame map - `84492db`
2. Task 2: PFD frame and B612 typography - `0867d67`
3. Task 3: About, rotate hint, layout gates - `e324cac`

## Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`: clean
- `npx vitest run`: 70 passed (16 new in tests/content-policy.test.ts), 27 skipped (pre-existing)
- Playwright, all six projects, all specs including @hooks: 86 passed, 4 skipped (Escape test skipped on touch projects by design)
- `npm run build`: woff2 present, no third-party font host in dist

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Playwright port 4173 was held by another parallel executor's preview server**
- **Found during:** Task 2 verification (specs failed because the reused server served another worktree's build)
- **Issue:** `reuseExistingServer` silently attached to a sibling worktree's `vite preview` on 4173
- **Fix:** ran my own preview on port 4191 from this worktree's `dist-e2e` and pointed Playwright at it (temporary config and `PW_BASE_URL`, both removed); the other server was left untouched. playwright.config.ts unchanged.
- **Commit:** none (verification only)

**2. [Rule 1 - Bug] Escape key raced the dialog's effect registration**
- **Found during:** Task 3
- **Fix:** `useLayoutEffect` in About, and the spec waits for Close to be focused before pressing Escape
- **Commit:** e324cac

### Plan interpretation notes

- The plan text says every text element gets `fill #e6e9ed`; I applied it only to `text:not([fill])` so existing widget label colours are not flattened. Font family, weight and letter spacing apply to all panel text as specified.
- Footer uses `min-height: 28px` with wrapping rather than a fixed `height: 28px` (see key-decisions); landscape layout is unchanged at 28 px.
- The plan's must_have mentions touch-size checks in layout.spec.ts, but the behavior list and D-21 say the full-panel view may be below 44 px, so no tap-size assertion was added; plan 09 owns tap size.
- Task 1 and Task 2 verification ran against my own preview server, so @hooks specs were run via a temporary config without `grepInvert`.

## Known Stubs

Intentional, by decision D-11: all gauge values and PFD values are static idle values passed as props. Phase 3 (PNL-04) binds live values. Not recorded in WINDOWS.md as defects.

## Threat Flags

None. T-01-15 (no raw-HTML API under src, test-enforced), T-01-16 (self-hosted fonts, dist grep, same-origin check) and T-01-17 (footer notice and About statement, test-checked) are mitigated as planned.

## Self-Check: PASSED

- Files exist: MfdFrame, PfdFrame, ArcGauge, BarGauge, About, content-policy test, glass/about/layout specs
- Commits found in history: 84492db, 0867d67, e324cac
