# Walking Skeleton — DA50 RG Procedure Trainer

**Phase:** 1
**Generated:** 2026-10-19

## Capability Proven End-to-End

A visitor opens the public GitHub Pages site at its subpath on a desktop, tablet or phone and flips the ENGINE MASTER switch by mouse or tap; the switch comes from the control registry, its change goes through the pure panel store as exactly one control event, and the panel visibly shows the new state.

Built by plan 01 (toolchain, panel stage, subpath production build verified in Chromium and WebKit), plan 03 (registry -> store -> signals -> SVG widget for ENGINE MASTER) and plan 04 (GitHub Actions deploy, verified live). Plans 05 to 07 add vertical slices on this skeleton, and plan 08 pins the registry and store contract with tests, without changing any decision below.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Preact 11.0.1 + @preact/signals 2.11.3, TypeScript 6.0.3, Vite 8.3.4 (pinned exact) | CLAUDE.md stack; signals re-render only the widget whose control changed; TS stays on 6.0.x because typescript-eslint 8.71.2 requires below 6.1 |
| Data layer | No database. Pure-TS `PanelStore` (`src/engine/store.ts`) holds the control-state map and an append-only `ControlEvent` log; `defineRegistry` (`src/engine/registry.ts`) validates control definitions; aircraft data lives in `src/aircraft/da50rg/` | State lives in the model, not the DOM (D-09); the event log is the input Phase 2's grader reads; the engine reads no clock (callers pass `t`), so Phase 2 can add a virtual clock (SCN-08) |
| Engine boundary | ESLint bans Preact/UI imports, DOM globals, timers, `Date.now` and `performance.now` in `src/engine/**` and `src/aircraft/**` | Keeps grading deterministic and the UI framework replaceable |
| Control model | Typed kinds `toggle`, `guarded-toggle` (with a derived `guard` control `<id>.guard`), `detent-lever` (optional `dragOnly` for safety-consequence levers such as the emergency gear extension: no tap targets, deliberate drag only), `momentary-button`; ids match `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$` with prefixes `sw.`, `lv.`, `btn.`; every control declares its legal states and a default | D-06, D-08, PNL-02; stable ids are the contract Phase 2 scenario YAML references; the `ControlDef` union stays open for a later `circuit-breaker` kind (Research Open Question 5) |
| Panel geometry | One root SVG, viewBox 2000x1310 with real DA50 RG proportions including the under-panel area; eleven regions `{ id, name, bounds, controlIds }` placed where they are on the aircraft (DE-ICE above ENGINE at the left edge, PFD, MFD, the SWITCH ROW under the PFD, LANDING GEAR, FLAPS below the MFD, RIGHT PANEL with ELT, UNDER PANEL L, PEDESTAL, UNDER PANEL R) with region-local control coordinates; `controlIds` derived, never hand-maintained; a reference ordering table in the layout test guards real positions (PNL-08); touch sizing never relocates a control: hit areas grow only up to the neighbour gap, desktop and tablet meet 44 px at the full view (94 units), phones zoom (D-19, D-20) | Position memory for emergencies is the core value; the viewBox model makes zoom a pure view change |
| Input | Pointer Events with `setPointerCapture`, `touch-action: none` on the root SVG only, no `click` listeners, widgets emit `actuate(id, state)` intents only, background and frames have no handlers; a separate gesture layer (`src/ui/panel/zoom.ts`) handles region tap, pinch and pan on phones by changing only the viewBox, never emits control events, and yields to any pointer that starts on a control | Research Pitfall 1 (touch-action on SVG children is ignored), D-05, D-09 |
| Auth | None. Static public site; no accounts or secrets | v1 constraint; the PackProvider/AccessPolicy seam arrives in Phase 2 |
| Deployment target | GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`, all actions SHA-pinned); base path from `BASE_PATH` (default `/`), CI derives it from the repository name | PLT-01 host-agnostic build; hosting moves off Pages before any sale |
| Test hooks | `window.__panel` (read-only events/state/legal) exists only when `VITE_TEST_HOOKS=1` (the e2e build); the deploy build is asserted free of it | Lets e2e prove "no event emitted" without shipping internals |
| Testing | Vitest 5 (node env) for engine, data geometry, hygiene and build gates; Playwright 1.64 with six projects (desktop Chromium/WebKit, Pixel 7 and iPhone 15 landscape, iPad landscape, iPhone 15 portrait) against `vite preview` at `/procedure-trainer-da-50/`; `PW_BASE_URL` retargets the same specs at the live site | Research Validation Architecture; WebKit cannot emulate touch drags, so real-device UAT closes that gap |
| Directory layout | `src/engine` (pure logic), `src/aircraft/da50rg` (data: `panel.ts`, `controls/*.ts` per panel area, defaults in the normal in-flight configuration, D-07d), `src/ui` (App, bridge, `panel/` Panel + ControlWidget + `widgets/` + `frames/` + `viewport.ts` and `zoom.ts` for phone region zoom, `about/`), `tests/` (Vitest), `e2e/` (Playwright), `docs/CONTENT-POLICY.md` | Per-region control files let parallel slices add controls without touching each other |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint, test runner) — plan 01
- [x] Routing — none by design: a single state-based screen; no History-API router (GitHub Pages 404s on refresh). The About dialog is UI state.
- [x] Data layer — the panel store: a real write (`PanelStore.dispatch`) and a real read (`stateOf` signals, `snapshot`) — plan 03
- [x] UI — ENGINE MASTER wired through the store, by mouse and touch — plan 03
- [x] Deployment — live on GitHub Pages through Actions, verified with Playwright against the live URL — plan 04

## Out of Scope (Deferred to Later Slices)

- Scenarios, YAML loading and schema validation, grading and debrief (Phase 2)
- Live gauge values and annunciations driven by aircraft state (Phases 2 and 3; frames are static in Phase 1 by D-11)
- Scripted reactions, escalation, transponder squawk entry (Phase 3)
- Training mode, hints, further actions, retry loop, authoring guide (Phase 4)
- PWA install and offline use (Phase 5)
- Keyboard and screen-reader operation (deferred requirement); phone region zoom is in Phase 1 (PNL-09, plan 09)
- Circuit breakers and the full aircraft switch inventory beyond the demonstration set (added when scenarios need them)
- The full de-ice (TKS/FIKI) panel: Phase 1 has only its guarded ALTERNATE switch (D-07b), the cockpit's single guarded switch
- Lights, avionics knobs, environmental controls and the circuit-breaker panels shown in the reference photos (D-07c covers the engine area, the lower switch row, the pedestal levers and the under-panel levers only)
- Paid packs, private content repository, licence checks, hosting migration

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: user starts Oil Temp High, operates the panel, ends with "Procedure complete" and gets a PASS/FAIL debrief graded from the store's event log and final state
- Phase 3: scenarios react (gauges move, ignored failures escalate); Oil Temp High, Electrical Failure and Engine Fire all playable; transponder squawk entry
- Phase 4: Training mode with checklist and hints, further actions and landing decision, retry/next, authoring guide
- Phase 5: installable offline PWA verified on real devices
