<!-- GSD:project-start source:PROJECT.md -->

## Project

**DA50 RG Procedure Trainer**

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user sees an interactive panel (gauges, glass-display areas, annunciations, switches, levers, buttons). A "new situation" starts a quiz-style scenario (e.g. "OIL TEMP HIGH" annunciated like in the real aircraft), and the user must perform the correct checklist actions by operating the panel. Performance is graded against stored required, optional and ordered actions.

**Core Value:** The user can run an emergency scenario by actually operating the panel controls, and gets accurate, objective feedback on whether they performed the AFM procedure correctly.

### Constraints

- **Tech stack**: TypeScript + Vite, SVG-rendered panel — static output suited to GitHub Pages, scalable graphics for all screen sizes
- **Hosting**: GitHub Pages (static only) — no server-side enforcement in v1
- **Devices**: desktop, tablet, phone — touch and mouse input, responsive scaling
- **Content format**: TOON scenario files with schema validation and line-numbered errors — manual extensibility
- **Safety/legal**: Clearly marked as training aid, not replacing AFM — liability

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
<!-- Intentionally compact. Do not regenerate this block from .planning/research/STACK.md; the full rationale lives there. -->

## Technology Stack

Rationale, alternatives and version compatibility: `.planning/research/STACK.md`.

| Technology                          | Version                                                                                           | Role                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Node.js                             | 24 LTS in CI (Vite 8 `^20.19 \|\| >=22.12`; Vitest 5 `^22.12 \|\| ^24 \|\| >=26`; Node 20 is out) | build and test runtime                                                                |
| TypeScript                          | `~6.0.3`, pinned to 6.0.x, NOT 7                                                                  | type-check (typescript-eslint 8.71.2 peers `<6.1.0`; TS 7 has no programmatic API)    |
| Vite                                | 8.3.x                                                                                             | dev server, bundler, static build                                                     |
| Preact + @preact/signals            | 11.0.1 + 2.11.3 (fallback `preact@10.29.x`)                                                       | SVG panel UI, fine-grained attribute updates                                          |
| @preact/preset-vite                 | 2.10.6                                                                                            | JSX and HMR                                                                           |
| @toon-format/toon                   | 4.4.0, pinned exactly                                                                             | scenario parser (Working Draft spec; strict decode, conformance test guards upgrades) |
| Zod                                 | 4.6.7                                                                                             | scenario schema, types, validation (`z.strictObject` everywhere)                      |
| Vitest / @playwright/test           | 5.0.5 / 1.64.1                                                                                    | unit and e2e (Playwright against `vite preview`)                                      |
| ESLint, typescript-eslint, Prettier | 10.13.0, 8.71.2, 3.9.10                                                                           | lint (flat config) and format                                                         |
| Fonts                               | @fontsource/b612 and b612-mono 5.3.0                                                              | self-hosted glass-display text                                                        |
| Hosting                             | GitHub Pages via Actions                                                                          | static only; actions pinned by commit SHA                                             |

Hard rules:

- Engine and aircraft state are framework-free plain TypeScript (`src/engine`); the UI subscribes via signals. No XState: the engine is a pure `step(state, event)` reducer with a virtual clock (tick events, no `setTimeout`, so runs are deterministic and replayable).
- Scenarios are data (TOON), validated by Zod plus `scenario-lint`. Conditions are a declarative DSL. Never `eval`, `new Function` or expression strings in scenario files.
- TOON: pin the version, run the conformance test before any upgrade, hand-write files, never auto-format them with the library encoder (it drops comments), no tabular rows, no root arrays, quote numeric-looking strings.
- Scenario files load via `?raw` globs, parse at runtime (line-numbered errors), one chunk per pack; no build-time TOON plugin.
- SVG only (no canvas or WebGL). Input through Pointer Events with `setPointerCapture`; `touch-action: none` on draggable controls; hit targets at least about 44 px on screen.
- Full-screen panel uses `100dvh`, never `100vh`. No router: screens are app state (hash routing at most), never History API paths.
- GitHub Pages: `base: '/procedure-trainer-da-50/'`; load assets through `import.meta.env.BASE_URL` or Vite imports, never absolute paths.
- Gating seam from day one: `EntitlementProvider` and `PackRepository`; no paywall in UI components. Paid pack plaintext never goes into the public repo.
- Scaffold by hand (no `npm create vite`); Dependabot ignores TypeScript major updates. No Jest, Cypress or Karma.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

- **Counts are derived, never literals.** Inventory counts (controls, lamps, regions, plates, breakers) come from independent reference tables in `tests/` (`tests/layout-reference.ts`, the label and review tables) and are compared with the registry; a changed number is a data edit plus a table edit, not a literal in a spec. Panel space is 2180 x 1300 (`VIEWBOX` in `src/aircraft/da50rg/panel.ts`, mirrored as `PANEL_VIEWBOX` in the test reference).
- **Data-driven registry.** A control is data with a `kind` (`toggle`, `guarded-toggle`, `guard`, `detent-lever`, `momentary-button`, `rotary`, `circuit-breaker`) and a skin; widgets, hit footprints, labels and tests read the registry. Controls, lamps, regions and plates are added by data, not by widget code. Control state lives in the store, never in the DOM.
- **Owner rules (G-0).** Static labels only: no text on the panel changes with a control state (state shows by position or lamp only; a pulled breaker shows a raised cap and a white ring, no IN/OUT text). A lamp exists only where the original has one. Parts stay inside their plates. Every label that is not known for sure is listed in `docs/PANEL-LABELS.md` and `docs/PANEL-REVIEW.md`.
- **Brand rule.** The panel reads GO-AROUND (not the maker name), no real maker names on the panel, no RUBIN mark; DA50RG is kept. Gated by `tests/brand.test.ts`, `tests/panel-shell.test.ts`, `e2e/brand.spec.ts`.
- **Photos and AFM files stay private; checklist text is reproduced exactly as printed.** Reference photos, scans and the AFM live in `.input/` (private, git-ignored); documents describe layout facts only and refer to photos by short name. Owner decision 2026-10-23: the text of a checklist (heading, message tag, items, actions, comment lines, branch labels, markers) is reproduced exactly as printed in the scenario files and is never reworded; all other text, and the prose of the manual, stays in own words (`docs/CONTENT-POLICY.md`, section 2).
- **Gesture contract (PNL-15).** A control acts on release. A single click or tap never zooms; a double click or double tap zooms into the region and, while zoomed, fully out. On a latching control the first tap actuates and the recognised pair (350 ms, 24 px, same control) retracts it from the log. Slops: 10 px touch and pen, 5 px mouse, then the press becomes a pan; a second finger pinches, also over controls. Momentary buttons commit after 100 ms held still and never zoom; drag controls (lever handles, knob bodies) start at 4 px. Only the main mouse button operates controls.
- **Tests.** Vitest (`tests/*.test.ts`, node environment) holds layout, reference-table and static-text gates plus pure engine and arbiter cases. Playwright specs in `e2e/` hit the production build; specs that read `window.__panel` carry `@hooks` in the title (the hook exists only in the e2e build, `VITE_TEST_HOOKS=1`) and are excluded in live mode (`PW_BASE_URL`). `PW_PORT` selects the preview port for parallel worktrees. Waiting between two quick taps on one control uses the shared pair-window helper.
- **Scenario files.** TOON format 1 under `scenarios/<pack>/`, one `pack.toon` per pack, hand-written (the library encoder drops comments). `npm run validate` checks every pack against the schema and the control registry and prints `file:line:col: message`; the CI runs it and the unit tests load every shipped file, so a bad scenario file fails the build, not the user. Content limits are in `docs/CONTENT-POLICY.md`; grading rules in `docs/GRADING.md`.
- **Physics arithmetic.** Pure engine, aircraft and scenario code uses only `+ - * /`, clamping and quantising to the quantity's resolution, so a live run and a replay agree to the last digit; ESLint forbids `Math.random`, `Math.exp`, `Math.pow` and the exponent operator there. Randomness enters only as a seed drawn by the UI and recorded with the run (`mulberry32`, integer arithmetic).
- **Git.** Phase branches `gsd/phase-NN-slug`; Conventional Commits with the plan id as scope for plan work (`feat(01.1-37): ...`, `test(...)`, `docs(01.1-41): ...`), `fix(panel): ...` for review fixes; planning documents under `.planning/`. Nothing is pushed by agents; publishing is the owner's step.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:src/ -->

## Architecture

- `src/engine`: pure TypeScript, no framework, no clock, no timers. `registry.ts` (control and region definitions, validation by `defineRegistry`), `store.ts` (`PanelStore`: `dispatch`, append-only event log, `deriveState`, `retract` of the newest event, `markConsumed` watermark (raised by the run when a reaction fires), `onRetract`), `indicators.ts` (lamps derived from control state), `rotary.ts` and `detents.ts` (knob and lever geometry). Phase 2 added `predicates.ts` (the closed predicate vocabulary: state, state_in, travel, travel_rel, quantity, band), `quantities.ts` (named readings with ranges and colour bands), `cas.ts` (rule-derived annunciations), `grading.ts` (`grade` and `branchStatuses`: a pure replay of the recorded log into PASS or FAIL with step, branch, order and harmful-action detail; rules in `docs/GRADING.md`), `clock.ts` (virtual clock, advanced by the UI only), `env.ts` (the aircraft a scenario is checked against), and in `store.ts` the scenario baseline and `reset` (a run starts without a single event). Phase 3 added `physics.ts` (the generic model and reaction types and `definePhysics`; the models themselves are aircraft data), `sim.ts` (`STEP_MS` 100, the pure stepper `stepSim`, `simulate`, hold timers and outcomes, `mulberry32` and the seeded onset), `run.ts` (the live `Run`: the virtual clock plus the simulation over the store log; it calls `markConsumed` when a reaction fires and rebuilds by replay when an applied event is retracted), the `code-entry` control kind in `registry.ts` (the transponder keys) and the rotary skin `selector-bar`; `grading.ts` now replays `simulate` (outcome, reaction time from the onset).
- `src/aircraft/da50rg`: the DA50 RG panel as data. `panel.ts` (viewBox, 33 regions, device profiles, registry assembly), `controls/*` (95 controls by family: lights, de-ice, engine, gear-flaps, pedestal, switch-bank, under-panel, knobs, buttons, mfd, breakers, squawk), `indicators.ts` (13 lamps), `plates.ts`, `placards.ts`, `bus-boxes.ts`, `avionics.ts` (inert PFD/MFD columns, audio panel, standby EFIS, autopilot panel). Phase 2 added `quantities.ts`, `cas.ts` (the CAS rule table) and `aircraft.ts` (`DA50RG_ENV`, the environment scenarios are checked and graded against). Phase 3 grew them: `quantities.ts` holds fourteen quantities (the twelve MFD gauges, the hidden `alt2_amps` and `battery_pct`) plus the hidden fire quantity, each with unit, range, base (the cruise equilibrium) and bands; `physics.ts` holds a model for every quantity, the scenario parameters (`oil_cooling`, `alt1_output`, `engine_fire`), the electrical bus, the fire model, the fuel cut of the FUEL selector and the de-ice MAX reaction; `cas.ts` has three rules (ENG OIL TEMP, OIL PRES, ALTN 1 FAIL); `controls/squawk.ts` is the simplified transponder `kp.squawk`, the FUEL selector `sw.fuel_valve` is in `controls/knobs.ts` and the ECS SHUTOFF `lv.ecs_shutoff` (skin `pull-ecs`) in `controls/under-panel.ts`.
- `src/ui`: Preact and signals. `bridge.ts` connects store to signals (and the test hook), `App.tsx`, `about/`. `panel/`: `Panel.tsx`, `PanelShell.tsx` and `BusPanelArt.tsx` (static art), `widgets/` (one per kind), `skins/` (shapes), `frames/` (glass and avionics art), `press-arbiter.ts` (pure press machine), `press-targets.ts`, `tap-intent.ts` (slops and pair decision), `zoom.ts` (pointer glue, view signal, Full panel corner), `viewport.ts` (pure zoom, pan, pinch and footprint maths), `session-area.ts` (the session pad in the co-pilot legroom: NEW SITUATION and CHOOSE SITUATION). The session layer: `session.ts` (the screen machine free, choosing, briefing, running, debrief; start, complete and leave a run, a run completes itself when an outcome fires; also the level, easy, medium or realistic, asked on its own card before the briefing (`levelPicked`) and never an input of `grade`; no DOM), `clock-driver.ts` (real frames into whole 100 ms simulation steps with a remainder carry, paused by a hidden tab or an open modal), the run (`session.run`), the bridge's `quantities` and `flags` signals fed by every run step, the level Realistic (no briefing, a seeded onset, recorded with the run; the level is still never an input of `grade`) in `session.ts`, `modals.ts` and `screens/` (the shared modal shell with its input shield, first-run acknowledgment in `ack.ts` and `Ack.tsx`, `Briefing.tsx`, `Debrief.tsx`, `Confirm.tsx` for leaving a run, load error and empty states), `outline.ts` with `screens/ChecklistOutline.tsx` (the recursive checklist outline: the briefing form lists the checklist with the panel steps, the debrief form adds tags, verdicts and order lines) and `debrief-text.ts` (the pure copy rules: reason lines, order lines and harmful rows, no clock text).
- `src/scenario`: the scenario layer, pure TypeScript. Scenario files are TOON text under `scenarios/<pack>/` with a `pack.toon` manifest per pack. `schema.ts` (Zod format 1), `parse.ts` (strict decode plus schema, issues with line and column), `toon-index.ts` (path to line and column), `lint.ts` (`checkScenario`: cross-references against the aircraft environment; it also rejects a scenario a do-nothing run would pass, L11), `packs.ts` (the pack seam: `PackProvider` and `AccessPolicy`, `listPacks`, `openScenario`), `packs-vite.ts` (the only module that globs scenario files, one chunk per pack), `validate-all.ts` (the core of `npm run validate`) and `disclaimers.ts`. Phase 3 added to the format (still format 1, every new section optional or empty by default) `parameters` (lint L12), `outcomes` (L13) and `onset` (L14); packs `engine` (ENG OIL TEMP, ENGINE FIRE) and `electrical` (ALTN 1 FAIL). No scenario fact (id, step, control id of a step, CAS message or threshold) may appear in `src/engine`, `src/scenario` or `src/ui`: `tests/blueprint.test.ts` derives the list from the shipped scenario and fails the build.
- Since Phase 3 the quantities are simulated during a run (fixed 100 ms steps; a run starts with the base values on Realistic and with the scenario's values on Easy and Medium), ignored failures escalate to a named outcome that ends the run as FAIL, and handled failures recover. The simulation runs only during a scenario run: the free panel shows static base values. Steps and forbidden items stay control-only; end states with physics are Phases 4 and 5. Deferred engine behaviours (ANNUN-TEST, the WIND SHIELD spray, the ICE LIGHT effect, the ELT lamp, the other breaker effects, a simulation on the free panel) are in `.planning/todos/pending/`.
- Since Phase 3.1 a scenario can declare `variants` (several causes behind one failure, drawn by seed and recorded; `src/engine/variants.ts` resolves one into a plain scenario, rules R13 to R15 and the authoring notes in `docs/GRADING.md`); changes the simulation makes itself (`store.inject`, log source `sim`, trips in the physics) are regenerated by every replay and never in the recording, and a run ends at the 30-minute cap (`MAX_RUN_MS`) like its replay.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## Workflow

GSD is used at phase level only (roadmap, phases, todos, a short spec per phase, a UAT at the end, one code review per phase, about three larger plans per phase, one SUMMARY per plan, no plan-checker). Rules in `.planning/WORKFLOW.md`.

- Phase work (a new capability, several files, new scenario content) goes through a phase plan.
- Small fixes, tuning and doc corrections go direct: a Conventional Commit plus a targeted test, no PLAN or SUMMARY.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
