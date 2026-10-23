# Phase 2: First Gradable Scenario - Research

**Researched:** 2026-10-22
**Domain:** Data-driven scenario engine (TOON files + Zod), pure state-predicate grading with a virtual clock, session flow (menu, briefing, run, debrief), CAS annunciation, pack seam
**Confidence:** HIGH on codebase integration and grading design; MEDIUM on TOON as a long-lived authoring format (spec is a fast-moving Working Draft, see Summary)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Scenario content: ENG OIL TEMP (blueprint)
- **D-01:** The first scenario is the AFM main case "Engine Oil Temperature High, OIL PRES within the green range" (AFM 03-08, issue 018). The branch "OIL PRES outside the green range" is a second scenario in Phase 3. The scenario file names AFM section and revision (SCN-07).
- **D-02:** Panel-operable steps are exactly two and **both are critical** (owner-confirmed): POWER reduced and COWL FLAP open. POWER target: **at least 10 percentage points below the initial value**; initial POWER 75 percent, so 65 percent or lower credits (the lever has a 5 percent grid). COWL FLAP target: OPEN (initial CLOSED). The two steps form an **unordered** group (the AFM and the pocket card list POWER first but do not require the order). Initial POWER 75 percent and COWL FLAP closed are owner-confirmed.
- **D-03:** Forbidden action: **POWER increased** above the initial value. No other forbidden actions in the first scenario. Severity classes (critical, standard, optional, forbidden) are scenario data; the first scenario uses critical for the two panel steps.
- **D-04:** Steps without a panel control appear (the pocket checklist card, `.input/oil-temp-checklist-card.jpg`: "Check oil pressure" as the first, deciding step; in the green branch "Increase airspeed", "Check oil temp in green range" and "if not returning to green range: land at nearest suitable airfield"; in Phase 2 the last condition is always true because the temperature value stays fixed) as **non-graded checklist lines** in the briefing/debrief, marked as not graded in v1. Their grading is Phase 7 (SES-05).
- **D-23:** The **scenario format has condition blocks now**: a step or group can be bound to a condition on an aircraft-state quantity (e.g. only when oil pressure is green). The first scenario uses the "OIL PRES green" block; the card's "If too low" branch (reduce power, open cowl flap, be prepared for loss of oil and engine failure and emergency landing) becomes a second scenario file in Phase 3 without a format change. The initial state decides which block applies. — **Reversibility:** costly — every later scenario depends on the condition vocabulary.
- **D-24:** The briefing names **AFM 03-08 ENG OIL TEMP, Issue 018** as the source (SCN-07). Step wording follows the pocket card and the AFM in short lines (at most 12 words); explanatory text is own wording. The pocket card is a private reference, not a cited source.
- **D-05:** Short AFM checklist step lines may be verbatim up to 12 words; all explanatory text is paraphrased (`docs/CONTENT-POLICY.md`, D-15 of Phase 1). WARNING/CAUTION/NOTE text is never copied.

### Annunciation and initial state
- **D-06:** The annunciation "ENG OIL TEMP" appears in the **PFD**: right side, about one third from the bottom, left of the altitude tape, **static red text in a black block**, no flashing. The owner can supply a reference image (to be placed in `.input/`).
- **D-06a:** Reference for the look (owner image `.input/cas-warnings-table-card.jpg`, pocket-card table of CAS messages with the page of the checklist and the meaning): each CAS message is a **short chip with a black background and coloured text**: **warnings in red** (e.g. ENG OIL TEMP, FUEL PRESS, GB OIL TEMP, OIL PRES, COOLANT TEMP, L/R DOOR OPEN), **cautions in yellow** (e.g. ALTN 1 FAIL, ALTN 2 FAIL); related messages can share a row (ALTN 1 FAIL and ALTN 2 FAIL). ENG OIL TEMP is a red warning, trigger **oil temperature above 125 degrees C (red range)**, checklist page 4. The annunciation level (warning red, caution yellow) and the message text are scenario/rule data, so the same mechanism serves the other CAS messages of later scenarios.
- **D-07:** The initial state, which is also the trigger of the warning, has the **oil temperature on the PFD above 125 degrees C (red range)**, e.g. 128. In Phase 2 the value stays fixed during the run (it does not fall after POWER is reduced; live behaviour is Phase 3). The oil pressure indication is green.
- **D-08:** The scenario sets **named aircraft-state quantities** (e.g. `oil_temp_c: 128`, oil pressure green). Instruments and annunciation rules read these quantities; the message ENG OIL TEMP results from a rule (oil temperature above 125 degrees C) rather than being a literal in the scenario. This is the seam Phase 3 builds on (reactions, live values) without a format change. — **Reversibility:** costly — every later scenario and the engine/instrument binding depend on the quantity model.

### Grading
- **D-09:** Actions count by **resulting control state, not by clicks**. A step is credited if its target state **holds at "Procedure complete"**; toggling back and forth in between does not matter. For ordering, the time at which the target state was last entered counts.
- **D-10:** **PASS requires every critical step**; standard and optional steps are reported in the debrief only. A missed critical step is FAIL.
- **D-11:** A forbidden action is **shown in the debrief only** (with its time); it does not turn PASS into FAIL on its own. The schema may offer a per-action flag that makes a forbidden action fail the run (Claude's discretion), default off.
- **D-12:** **Order violations in an ordered group** are always shown in the debrief; they cause FAIL only for groups the scenario marks as order-critical. The first scenario uses an unordered group.
- **D-13:** Grading is a pure function of the recorded action log and the scenario, driven by the **virtual, pausable clock** (SCN-08, no real timers in the engine). Replaying a recorded run gives identical verdicts. Tests replay four recorded runs and expect: golden = PASS, do-nothing = FAIL, wrong-order (in a test group that is order-critical) = FAIL, forbidden action = reported. The log-level `retract` of the store (round 3) applies: a retracted event does not exist for grading.

### Flow and screens
- **D-14:** The app opens on the **panel as today**; a menu overlay on top offers **New situation (random)** and **Choose situation**. A **briefing** follows as an overlay over the panel: situation in short own words, source (AFM section, revision) and disclaimer (SCN-07), the non-graded checklist lines, a Start button. On start the panel is set to the scenario's initial state. Free panel use without a scenario stays possible.
- **D-15:** In the run (**exam mode, silent**): no hints, no checklist, no feedback. **"Procedure complete"** is a clear button in the **footer bar** outside the panel (not floating over controls), so it is not hit while panning.
- **D-16:** The **debrief** shows PASS/FAIL, a verdict per step (critical, standard, optional), order violations, harmful actions and the non-graded lines. **No action timeline** in v1 (verdicts only). Retry/next is Phase 7.
- **D-17:** **First-run training-aid acknowledgment (PLT-04):** shown once, remembered in the browser (storage access wrapped, the app works without it), shown again when the disclaimer text version changes. Each scenario briefing shows source, revision and disclaimer.
- **D-18:** Screens are app state (menu, briefing, running, debrief); no router (CLAUDE.md).

### Scenario data format and packs
- **D-19:** **Scenario files are written in TOON** (owner decision, "Nur TOON"). This changes the earlier stack decision "YAML". The decision stands with known risks to be resolved in research: parser maturity, **line-numbered errors still required** (SCN-01), editor support (no JSON-Schema autocomplete expected), how Zod validation maps error paths to lines. If research finds no viable parser or no way to report positions, **return to the owner before planning**. Requirements, ROADMAP, PROJECT.md and CLAUDE.md wording ("YAML") must be amended as part of this phase. — **Reversibility:** costly — every scenario file and the authoring guide are written in the chosen notation; changing it later means converting all packs.
- **D-20:** **Pack folder with manifest:** `scenarios/<pack>/pack` manifest (title, free flag, scenario count) plus one file per scenario. A **PackProvider** interface (list packs, load pack text) and an **AccessPolicy** (open in v1) are the only way the app reads scenarios (PLT-03). Metadata is available without loading the scenarios. Each pack is its own lazy build chunk. — **Reversibility:** costly — packs, entitlement and later paid-pack gating depend on the seam.
- **D-21:** **Validation:** a `validate` command checks every scenario file with **line-numbered errors** and against the **control registry** (every control id and state must exist, SCN-02), and the same check runs in Vitest and CI so a bad file fails the build. Loading a user file inside the app is Phase 7 (authoring guide).
- **D-22:** Scenarios are **data, never code**: no expression strings evaluated, conditions come from a small declarative vocabulary validated by the schema (consistent with the engine decision in CLAUDE.md).

### Claude's Discretion
- Exact schema field names and the condition vocabulary (comparisons against the initial value, state membership), as long as D-02, D-08 and D-09 are expressible.
- Shape of the pack manifest and the TOON-to-schema validation path.
- Visual details of the menu, briefing and debrief within the owner's panel rules (static labels, no pulsing, 44 px targets on touch).
- Whether a per-action flag lets a forbidden action fail the run (D-11).

### Deferred Ideas (OUT OF SCOPE)
- Second scenario variant "OIL PRES outside the green range" with the engine-failure preparation: Phase 3.
- Grading of the non-panel steps (airspeed, monitoring, landing decision) via "Further actions": Phase 7 (SES-05).
- In-app loading of a user scenario file with line-numbered errors, authoring guide: Phase 7 (CNT-02).
- Live oil temperature falling after POWER reduction, escalation if ignored: Phase 3 (SCN-06, PNL-04).
- Per-action option that lets a forbidden action fail the run: schema discretion, default off.
- Action timeline in the debrief: owner chose verdicts only for now.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCN-01 | Scenarios are files validated against a schema, with line-numbered errors (REQUIREMENTS says YAML; superseded by D-19 TOON) | TOON decoder throws `ToonDecodeError.line` for syntax errors; Zod issue paths map to lines through a path-to-line index (prototype tested, Code Examples 1-2) |
| SCN-02 | A validate command checks every scenario file against the control registry | `parseScenario` (pure) + `lintScenario(registry, quantities, cas)`; CLI via Vite `ssrLoadModule` (no new dependency, tested) and the same call in Vitest |
| SCN-03 | A scenario defines initial panel state, annunciations and the displayed checklist | `initial.controls`, `initial.quantities`, `annunciations` (expected CAS ids, lint-checked against the CAS rule table), `checklist` lines |
| SCN-04 | Actions can be critical, standard, optional or forbidden, in ordered or unordered groups | `groups[].ordered/order_critical`, `steps[].severity`, `forbidden[]`; grader design in Architecture Patterns |
| SCN-05 | Actions matched on resulting control/aircraft state, not raw clicks | Predicate vocabulary evaluated over `deriveState(...)` of the log; "holds at completion" plus "last entered" index |
| SCN-07 | Each scenario carries source, revision and disclaimer metadata | `source{document,issue,section,verified}` required by schema (CONTENT-POLICY section 4), `disclaimer` id resolved to an app-level versioned text |
| SCN-08 | Virtual, pausable clock so grading and replay are deterministic | `VirtualClock` in `src/engine`, UI drives `advance(dt)`; grader reads recorded `t` only |
| PNL-03 | Alert/annunciation area shows scenario-driven messages | CAS rule table (aircraft data) evaluated over quantities; chip rendered in `PfdFrame` |
| SES-01 | New situation (random or selected) with short briefing | Session state machine; `PackProvider.listPacks()` for the choose list; injectable RNG for random |
| SES-03 | Exam mode silent, ends with "Procedure complete" | Footer button; no listeners that echo feedback during `running` |
| SES-04 | Debrief PASS/FAIL, per-step verdicts, order violations, harmful actions | `grade()` output type `Debrief`; Debrief screen reads it |
| PLT-03 | Packs load only through PackProvider/AccessPolicy seam, open in v1 | One module owns `import.meta.glob`; ESLint + Vitest gate forbid it elsewhere |
| PLT-04 | First-run training-aid acknowledgment; each scenario shows source/disclaimer | Versioned ack in wrapped `localStorage`; briefing shows `source` + disclaimer text |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Source: `/Users/pascalbetz/projects/procedure-trainer-da-50/.claude/CLAUDE.md` (read this session). The planner must treat these as locked.

- Stack: TypeScript pinned `~6.0.3`/6.0.3 (NOT 7), Vite 8.3.x, Preact 11 + `@preact/signals`, SVG panel, Vitest 5.0.5 (node env), Playwright 1.64.1, ESLint 10 flat config. No router; screens are app state; never History-API paths on GitHub Pages.
- Engine rules: `src/engine` is pure TypeScript, no framework, no clock, no timers, no `Date.now`/`performance.now`, no browser globals (enforced by `eslint.config.js` `no-restricted-globals`/`no-restricted-imports`/`no-restricted-properties`). `src/aircraft/**` has the same boundary. Scenarios are data; never `eval`/`new Function`/expression strings in scenario files. Use `step(state, event)`-style pure functions with a virtual clock (`tick(dt)` from the UI). A `scenario-lint` pass checks cross references the schema cannot (control ids exist, action ids referenced exist, ordered groups reference real actions).
- Owner rules (G-0): static labels only, no text on the panel changes with control state; a lamp exists only where the original has one; parts stay inside their plates. Brand rule (GO-AROUND, no maker names, no RUBIN). Gesture contract (PNL-15): control acts on release, single tap never zooms, double tap zooms and retracts the first actuation from the log.
- Counts are derived, never literals (reference tables in `tests/`). Data-driven registry; control state lives in the store, never the DOM.
- No real photos or AFM text committed. `.input/` is private and git-ignored. Verbatim checklist step lines at most 12 words; no WARNING/CAUTION/NOTE copying (`docs/CONTENT-POLICY.md`).
- Tests: Vitest in `tests/*.test.ts` (node env); Playwright specs in `e2e/` hit the production build; specs reading `window.__panel` carry `@hooks` in the title and are excluded in live mode (`PW_BASE_URL`). `PW_PORT` selects the preview port.
- Git: phase branches `gsd/phase-NN-slug`, Conventional Commits with plan id as scope (`feat(02-03): ...`). Nothing is pushed by agents.
- Workflow: file changes go through a GSD command. The YAML wording in CLAUDE.md (about 22 mentions), PROJECT.md (lines 32, 56, 59, 66), ROADMAP.md (lines 244, 274) and REQUIREMENTS.md (SCN-01) must be amended to TOON in this phase (D-19).
- Memory notes (owner): MVP first, defer audits; token-lean working style (small fixes with targeted tests); layout fidelity is core.

## Summary

**TOON verdict (D-19): viable. No need to return to the owner before planning**, but the owner should know three risks. (1) Parser: the official `@toon-format/toon` 4.4.0 (MIT, 1.4M downloads/week, repo `toon-format/toon`) decodes to plain JS values and throws `ToonDecodeError` with a 1-based `line` and the raw `source` line for every syntax/structure error (probed this session: bad indentation, tabs, duplicate keys, missing colon, array-length mismatch, unterminated string all report the correct original line even when comment lines precede). (2) Schema-level positions are NOT provided by the library (it returns plain values). A ~90-line path-to-position index over the source text, differential-checked against the decoded value, gives `line, col` for any Zod issue path (prototype built and run this session, Code Examples 1-2). Fallback walks to the nearest known ancestor, so the index never needs to be perfect. (3) The format is a **Working Draft**: 11 spec releases in 11 months, 6 of them changed decoding of previously valid documents (4.0 on 2026-07-22 introduced `#` comment lines, 4.4 on 2026-10-08 tightened non-strict mode). Mitigation: pin `@toon-format/toon` to exactly `4.4.0` (no caret), author scenarios in a conservative subset (objects, list-form arrays, inline primitive arrays; no tabular rows, no root arrays), keep a conformance fixture test, and have Dependabot ignore TOON updates. Editor support is weak (no JSON-Schema autocomplete; the official docs suggest YAML highlighting for `.toon`, plus a community VS Code extension), so the validate command and the in-Vitest check carry the authoring feedback. Comments are supported only as **full lines starting with `#`** (spec 4.x section 5.1); there are no trailing comments.

The grading design follows from D-09 to D-13 and the project's own pitfalls research: `grade(scenario, registry, recording) -> Debrief` is a pure function. It replays the recorded log over the scenario's **baseline** (initial state), evaluates declarative predicates after every event, credits a step if its predicate holds at completion, and records the log index of the event after which the predicate last became (and stayed) true. That index (not wall time) orders steps in ordered groups. Forbidden predicates are detected on entry, even if later reverted. The most important integration gotcha is in the existing store: `deriveState` and `retract` rebuild state from registry defaults, so a scenario baseline (POWER p75 while the registry default is `p70`) would be silently lost on the first retract. The store needs a baseline parameter and a `reset(baseline)` that does not create log events.

Scenario operation also exposes three integration hazards for the existing test suite and gestures: every one of the 22 e2e specs does `page.goto('./')` and would now meet the first-run acknowledgment and the menu overlay (needs a shared helper plus a seeded `storageState`); the `Full panel` button is `z-index: 30` above the `About` overlay (`z-index: 20`), so new overlays must sit above 30 or hide it; and floating-point travel percentages (`p55` gives `55.00000000000001`) need a tolerance in comparisons.

**Primary recommendation:** Add exactly two runtime dependencies (`@toon-format/toon@4.4.0`, `zod@4.6.7`), build a pure `src/scenario` (schema, parse with line index, lint) and `src/engine` (predicates, quantities, grading, clock) layer, extend `PanelStore` with a baseline and reset, and drive the whole Phase 2 slice from one TOON scenario file loaded through a single glob-owning `PackProvider` module.

## Architectural Responsibility Map

This is a static single-page app (no server). "Tiers" are the project's layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scenario text parse + schema validation + line mapping | `src/scenario` (pure, runs in Node and browser) | CLI script, Vitest | One function for app, CLI and tests (D-21); no I/O inside |
| Cross-reference lint (control ids/states, quantities, CAS ids, group refs) | `src/scenario` | `src/aircraft` data as input | Needs registry; schema alone cannot (CLAUDE.md scenario-lint) |
| Predicate evaluation, quantities, CAS rules, grading, virtual clock | `src/engine` (pure) | `src/aircraft/da50rg` supplies quantity defs + CAS table | Deterministic replay (D-13, SCN-08); ESLint purity boundary |
| Baseline application / reset of control state | `src/engine/store.ts` | `src/ui/bridge.ts` refreshes signals | Log must stay truthful; retract must use the baseline |
| Pack listing, access check, lazy chunk load | `src/scenario/packs` (the only `import.meta.glob` owner) | Vite `codeSplitting` config | PLT-03 seam, per-pack chunk (D-20) |
| Session state machine (menu, briefing, running, debrief), clock ticking, recorder | `src/ui` (signals) | engine clock + store | Screens are app state (D-18); UI drives ticks, engine has no timers |
| CAS chip + oil temp value display | `src/ui/panel/frames` (PFD chip, MFD gauges) | engine quantities via bridge signals | Presentational frames, no handlers |
| Ack persistence | `src/ui` (wrapped `localStorage`) | — | Browser global forbidden in engine |
| Footer "Procedure complete" | `src/ui/App.tsx` footer | — | Outside the SVG so panning never hits it (D-15) |

## Standard Stack

### Core (new in this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@toon-format/toon` | **4.4.0, exact pin** | Decode scenario/manifest text to plain values; `ToonDecodeError.line` | Owner decision D-19; official implementation (`toon-format/toon`), ESM, no dependencies, 108 KB unpacked [VERIFIED: npm registry, `npm view @toon-format/toon` this session] |
| `zod` | **4.6.7** | Single source of truth for scenario/manifest schema, inferred TS types, error paths | Already the project's chosen validator (CLAUDE.md); `z.strictObject` rejects typo keys; `z.discriminatedUnion` models the predicate vocabulary [VERIFIED: `npm view zod version` = 4.6.7; probe this session parsed TOON output with strict objects and a discriminated union] |

Already installed and reused: `preact` 11.0.1, `@preact/signals` 2.11.3, `vite` 8.3.4, `vitest` 5.0.5, `@playwright/test` 1.64.1, `typescript` 6.0.3 [VERIFIED: package.json read this session]. **No `yaml` package** is in `package.json` and none should be added (TOON supersedes it; the CLAUDE.md YAML sections become obsolete).

### Supporting
None new. Do not add `tsx`, `js-yaml`, Ajv, XState, or a pan/zoom library. The validate CLI needs no extra dependency (see Architecture, Pattern 6).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Path-to-line index (own, ~90 lines) | Using `decodeStreamSync` events with a counting line iterator | Probed: events carry no position and the decoder looks ahead (a key whose value is a nested object is emitted after one extra line is pulled), so line counts are off by one for some events. Reject. |
| Vite `ssrLoadModule` for the validate CLI | `tsx` devDependency | `tsx` is simpler to read but adds a dependency; Node's native type stripping fails on the project's extensionless imports (tested: `ERR_MODULE_NOT_FOUND` for `./registry`). Use Vite (already installed). `tsx` is an acceptable fallback if `ssrLoadModule` is removed in a later Vite. |
| `strict: true` decode (default) | `strict: false` | Strict keeps tab/indent/duplicate-key/array-length checks (good line-numbered errors) but forces authors to keep `[N]` counts correct. Keep strict; the count error is explicit ("Expected 3 list-form items, but got 2") and carries a line. Non-strict also changed behaviour in spec 4.4. |

**Installation:**
```bash
npm install --save-exact @toon-format/toon@4.4.0 zod@4.6.7
```

**Version verification:** `@toon-format/toon` latest = 4.4.0, last modified 2026-10-08, created 2025-11-01; `zod` latest = 4.6.7, modified 2026-10-12 [VERIFIED: npm registry, this session]. Postinstall script: none for either [VERIFIED: `npm view ... scripts.postinstall` empty; seam signal `postinstall: null`].

## Package Legitimacy Audit

Run: `gsd-tools query package-legitimacy check --ecosystem npm @toon-format/toon @toon-format/spec zod` (this session).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@toon-format/toon` | npm | created 2025-11-01 (about 1 yr); latest published 2026-10-08 | 1,396,096/wk | github.com/toon-format/toon | SUS (reason: `too-new`, i.e. latest version is 14 days old) | Approved by owner decision D-19; flagged, see below |
| `zod` | npm | many years (colinhacks/zod) | 207,048,213/wk | github.com/colinhacks/zod | SUS (reason: `too-new`, latest 4.6.7 published 2026-10-12) | Already the project's chosen validator; flagged, see below |
| `@toon-format/spec` | npm | latest 2026-10-08 | 595/wk | github.com/toon-format/spec | SUS (`too-new`, `low-downloads`) | **Do not install.** It is only a dev dependency of the TOON package (conformance fixtures). Not needed. |

**Packages removed due to SLOP verdict:** none.
**Packages flagged SUS:** `@toon-format/toon`, `zod`. Both verdicts come only from the recency of the latest release (the packages themselves are established, with source repos, large download counts and no postinstall). The planner should still insert one cheap `checkpoint:human-verify` task before the install: confirm exact versions `4.4.0` / `4.6.7` in `package-lock.json`, install with `npm ci`/`--ignore-scripts` first, and record the registry publish dates. The seam's `SUS` is advisory; tagging per the provenance rule: both package names come from CONTEXT.md D-19 (owner) and CLAUDE.md (project), i.e. authoritative project documents, and `package-legitimacy` returned no `SLOP`.

## Architecture Patterns

### System Architecture Diagram

```
                       BUILD / CI (npm run validate, npm test)
 scenarios/<pack>/pack.toon ─┐                      ┌── tests/fixtures/*.toon (golden + synthetic)
 scenarios/<pack>/*.toon ────┼─> parseScenario(text) ──> ParseResult {ok, scenario | errors[line,col,msg]}
                             │        │  (toon decode -> zod -> path index)
                             │        v
                             │   lintScenario(scenario, DA50RG, QUANTITIES, CAS_RULES) -> errors[line,col]
                             │
 ───────────────────────── RUNTIME (browser) ─────────────────────────
 PackProvider (only glob owner) ──listPacks()──> manifests (eager, tiny)
        │ loadPack(id) via AccessPolicy.canAccess(id)   (lazy chunk per pack)
        v
   pack text ──> parseScenario + lint (same code as CLI) ──> Scenario
        v
 UI session (signals):  free ──> menu ──> briefing ──> running ──> debrief ──> free
        │                                   │            │
        │                       Start: store.reset(baseline), quantities := initial,
        │                              clock := new VirtualClock(); recorder starts
        │                                   │
        │   pointer gestures ─> bridge.actuate(id,value) ─> PanelStore.dispatch(t = clock.now())
        │   rAF/interval ─> clock.advance(dt)  (UI owns real time; clamped; paused when hidden/overlay)
        │                                   │
        │   "Procedure complete" (footer) ──┘
        v
   Recording {scenarioId, events[{t,id,value}], completedAt}   (store.events() snapshot)
        v
   grade(scenario, DA50RG, recording) ──pure──> Debrief {result, steps[], orderViolations[], harmful[], notGraded[]}
        v
   Debrief screen (no timeline)

 Quantities (oil_temp_c, oil_pressure_bar) ─> CAS rules (aircraft data) ─> active chips ─> PfdFrame
                                           └> MFD gauge values (OIL TEMP, OIL PRES)
```

### Recommended Project Structure
```
scenarios/
└── engine/
    ├── pack.toon                    # manifest: title, free, scenarios list
    └── eng-oil-temp-green.toon      # the blueprint scenario
src/
├── engine/
│   ├── store.ts                     # + baseline, reset(), onReset (changed)
│   ├── clock.ts                     # VirtualClock (new)
│   ├── predicates.ts                # evaluate Predicate over {controls, initial, quantities} (new)
│   ├── quantities.ts                # QuantityDef, band classify, CasRule evaluate (new)
│   └── grading.ts                   # grade(), Debrief types (new)
├── scenario/
│   ├── schema.ts                    # Zod: Scenario, Predicate, Manifest; z.infer types
│   ├── toon-index.ts                # path -> {line,col} index (Code Example 1)
│   ├── parse.ts                     # parseScenario / parseManifest -> Result with line-numbered errors
│   ├── lint.ts                      # cross-reference checks against registry/quantities/CAS
│   ├── packs.ts                     # PackProvider, AccessPolicy, OpenAccessPolicy (interfaces + glue)
│   └── packs-vite.ts                # ONLY file with import.meta.glob for scenarios
├── aircraft/da50rg/
│   ├── quantities.ts                # oil_temp_c, oil_pressure_bar defs + bands (facts from AFM 02-05)
│   └── cas.ts                       # CAS rule table (ENG OIL TEMP: warning, > 125)
└── ui/
    ├── session.ts                   # screen signal, recorder, clock driver, start/complete
    ├── ack.ts                       # versioned ack, wrapped localStorage
    └── screens/ Ack.tsx Menu.tsx Briefing.tsx Debrief.tsx
scripts/validate-scenarios.mjs       # CLI (npm run validate)
tests/fixtures/                      # golden recordings (JSON) + synthetic ordered scenario (.toon)
```

### Pattern 1: Parse pipeline with line-numbered errors (SCN-01, SCN-02)
**What:** `parseScenario(text) -> {ok:true, scenario} | {ok:false, errors: {line, col?, path, message}[]}`. Order: (1) `decode(text)` in try/catch; a `ToonDecodeError` yields one error with `e.line` (strip the redundant `Line N:` prefix from `e.message`). (2) `Scenario.safeParse(value)`; each Zod issue is mapped with the path index; for `unrecognized_keys` issues emit one error per key, located at `[...issue.path, key]`. (3) `lintScenario` runs only when 1-2 pass.
**When to use:** the single entry used by the app, the CLI and Vitest (D-21). Pure: takes text, never touches `fs`.
**Example:** see Code Examples 1 and 2 (prototype run this session produced `line 28, col 11: unknown key "opp"`, `line 36, col 11: groups.0.steps.1.done.in: Invalid input: expected array, received string`, `line 23, col 9: ... severity: Invalid option ...`).

### Pattern 2: Predicate vocabulary (D-02, D-08, D-09, D-22, D-23)
**What:** One small discriminated union used by `done` (steps), `forbidden`, `when` (conditions) and CAS triggers. No strings are evaluated. Recommended members (field names are Claude's discretion):

| `check` | Fields | Meaning |
|---------|--------|---------|
| `state` | `control`, `is` (one state id) or `in` (list) | the control is in a state |
| `travel` | `control`, `op` (`lt\|lte\|gt\|gte`), `value` (0..100) | detent lever travel in percent of travel (`pos * 100`) |
| `travel_rel` | `control`, `op`, `delta` (percentage points) | lever travel compared with its **baseline** (scenario initial) travel plus `delta` |
| `quantity` | `quantity`, `op`, `value` | numeric aircraft quantity comparison |
| `band` | `quantity`, `in` (band names) | quantity currently inside a named band (green, yellow, red) |

D-02: `{check: travel_rel, control: lv.power, op: lte, delta: -10}` credits p65 and below when baseline is p75. D-03: forbidden `{check: travel_rel, control: lv.power, op: gt, delta: 0}`. D-23: group `when: {check: band, quantity: oil_pressure_bar, in[1]: green}`.
**Conditions evaluated against the initial quantities** at session start in Phase 2 (quantities are fixed); `evaluate` takes a quantities snapshot so Phase 3 can pass live values without a format change.
**Float hazard:** `POWER_STEPS` use `pos: (i * 5) / 100`, and `p55` gives `pos * 100 === 55.00000000000001` (tested). Compute travel as `Math.round(pos * 1000) / 10` (or compare with a 1e-9 tolerance) so `lte -10` on p65 is exact.

### Pattern 3: Grading as a pure replay (SCN-05, SCN-08, D-09 to D-13)
**What:** `grade(scenario, registry, recording)`:
1. `baseline = applyInitial(registry defaults, scenario.initial.controls)`. Applicable groups/forbidden/checklist = those whose `when` holds on the initial quantities.
2. Walk `recording.events` in order, maintaining the state map from `baseline`. After each event evaluate every applicable step predicate and forbidden predicate against (state, baseline, quantities).
3. Per step: `credited = predicate holds after the last event` (or at baseline when there are no events). `enteredAt = index of the event after which the predicate became true and stayed true` (reset to none when it turns false). A step already true at baseline is a **lint error** at authoring time (otherwise a do-nothing run would credit it; the pitfalls research recommends an explicit per-step opt-in instead, deferred).
4. Forbidden: for each event after which a forbidden predicate turns from false to true, record `{id, t, seq}` (even if reverted later). Several entries are listed in order. Report only (D-11) unless the item has `fails_run: true` (default false).
5. Ordered group: for credited steps in declared order, every pair `(a before b)` with `enteredAt(a) > enteredAt(b)` is one violation (pairwise, so a single swap is one violation, not N). Uncredited steps produce no order violation (they are already missed). `order_critical: true` on the group turns violations into FAIL (D-12).
6. `result = PASS` iff every applicable **critical** step is credited, and no `fails_run` forbidden fired, and no order-critical violation (D-10..D-12).
7. Output ordering follows declared scenario order; no `Date`, `Math.random`, no iteration over unordered keys. The return value is JSON-serialisable, so tests assert `toEqual` and `JSON.stringify` equality on two runs.
`Recording` = `{ scenarioId, completedAt, events: {t, id, value}[] }`. Order by log index, never by `t` alone (two events may share a virtual `t`).
**Retract:** the recorder takes `store.events()` at completion, so retracted events are already absent (D-13). Because grading is a pull at completion, it attaches **no store listeners**, so review warnings WR-01/WR-02 do not block this phase. Still fold the cheap WR-07 (freeze events returned by `events()`/`dispatch`) because the recording is long-lived [source: `.planning/todos/pending/2026-10-21-review-warnings-hardening.md`, read this session].

### Pattern 4: Store baseline and reset (integration gotcha)
Current code [VERIFIED: src/engine/store.ts:31-39 and :118]:
```ts
export function deriveState(registry: Registry, events: readonly ControlEvent[]): Record<ControlId, StateId> {
  const state: Record<ControlId, StateId> = {};
  for (const def of registry.controls) state[def.id] = def.default;
  for (const event of events) state[event.id] = event.value;
  return state;
}
...
const next = deriveState(this.registry, remaining);   // inside retract()
```
and the registry default of the power lever is `default: 'p70', // cruise load, D-07d in-flight default` [VERIFIED: src/aircraft/da50rg/controls/pedestal.ts:35], while D-02 requires an initial p75. If a scenario set p75 without a baseline-aware `deriveState`, the first `retract` (the double-tap gesture) would snap POWER to p70 and grade a phantom change. Required change:
- `deriveState(registry, events, baseline?)` starts from defaults, overlays `baseline`, then the events.
- `PanelStore` keeps `private baseline: Readonly<Record<ControlId, StateId>>`; `retract` passes it.
- `reset(baseline = {})`: validates every id/state against the registry (throws a `RegistryError`-like error otherwise), clears the log, resets `consumed = -1`, rebuilds state, notifies new `onReset` listeners. No `ControlEvent` is created, so the baseline is never a "user action".
- `bridge.ts` subscribes to `onReset` and refreshes all signals; add `startScenario(baseline)`/`endScenario()` helpers there. Guard ids (`sw.x.guard`) are valid baseline keys (derived controls are in `registry.controls`).
- `bridge.actuate` currently reads the wall clock [VERIFIED: src/ui/bridge.ts:102-104 `return store.dispatch(id, value, performance.now());`]. Inject a `now: () => number` (default `performance.now`) so a running session stamps events with `clock.now()`.

### Pattern 5: Virtual clock (SCN-08)
`src/engine/clock.ts`: `class VirtualClock { now(): number; advance(dtMs: number): void; pause(): void; resume(): void; get paused(): boolean }`. `advance` ignores calls while paused, throws `RangeError` on non-finite or negative `dtMs` (same style as `dispatch`). The UI owns real time: a `requestAnimationFrame` or 250 ms interval computes `dt = performance.now() - last`, **clamps** it (for example to at most 1000 ms) so a throttled or hidden tab does not jump the scenario, and pauses on `visibilitychange` hidden and while a modal (About, menu) is open. In Phase 2 nothing time-dependent changes grading (ordering uses log index), but event `t` is shown for forbidden actions, and Phase 3 reactions need the seam. Test with a fake: advance by explicit steps, assert `now()`.

### Pattern 6: Packs, seam, validate command (PLT-03, D-20, D-21)
- Interfaces (`src/scenario/packs.ts`): `PackMeta {id, title, free, scenarios: {id, title}[]}`; `PackProvider {listPacks(): Promise<PackMeta[]>; loadPack(id): Promise<PackSource>}` where `PackSource` = `{id, files: {name, text}[]}`; `AccessPolicy {canAccess(packId): boolean | Promise<boolean>}`; `OpenAccessPolicy` returns true. The app gets scenarios only via `loadPack` guarded by the policy.
- Manifest `scenarios/<pack>/pack.toon` (D-20 names it `pack`; recommend the `.toon` extension so editors and `?raw` globs treat it as TOON; flag to owner as a naming nuance). Include `scenarios[N]` with `id`, `title`, `file` so the Choose list and a locked pack can be listed without loading scenario text; a lint cross-checks that the list matches the files (the "scenario count" is then derived, not a literal, per project convention).
- Glob owner `packs-vite.ts` (tested in this session):
```ts
const manifests = import.meta.glob('/scenarios/*/pack.toon', { query: '?raw', import: 'default', eager: true });
const scenarios = import.meta.glob(['/scenarios/*/*.toon', '!/scenarios/*/pack.toon'], { query: '?raw', import: 'default' });
```
- **Per-pack lazy chunk** (D-20): by default Vite creates one chunk per scenario file. Group by pack with Vite 8's Rolldown option (tested on 8.3.4, produced `pack-engine-*.js` and `pack-electrical-*.js`, manifests stayed in the entry chunk). `advancedChunks` is deprecated in 8.3.4 (warning); use `codeSplitting`:
```ts
build: { rolldownOptions: { output: { codeSplitting: { groups: [{
  name: (id) => { const m = /\/scenarios\/([^/]+)\/(?!pack\.toon)[^/]+\.toon/.exec(id); return m ? `pack-${m[1]}` : null; },
  debugName: 'packs',
}] } } } }
```
  (`debugName` silences the "name is a function" warning.) The repo's `vite.config.ts` uses `defineConfig` from `vitest/config`; add `build` there.
- Seam gate: ESLint `no-restricted-syntax`/`no-restricted-imports` cannot easily ban `import.meta.glob`; add a Vitest test that reads every `src/**/*.ts(x)` and asserts only `src/scenario/packs-vite.ts` contains `import.meta.glob` with `scenarios`, and that `src/ui` never imports a `.toon` file directly.
- `import.meta.glob` works under Vitest 5.0.5 (node env) [VERIFIED: probe this session, 2 manifests and 4 scenario keys resolved, lazy loader returned text], so the app provider itself is unit-testable.
- **Validate command** (`npm run validate` -> `node scripts/validate-scenarios.mjs`): Node 26 native type stripping cannot import the repo's extensionless TS modules (tested: `ERR_MODULE_NOT_FOUND`). Use Vite (already a dependency): `createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })` then `server.ssrLoadModule('/src/scenario/validate-all.ts')`, and `server.close()` in `finally` (tested: loaded `src/aircraft/da50rg/panel.ts`, 93 controls). The script walks `scenarios/` with `fs` (an `FsPackProvider` implementing the same interface), prints `file:line:col: message`, exits 1 on any error. Add `npm run validate` to the CI `verify` job before `npm run build` (`.github/workflows/deploy.yml` has `npm run typecheck`, `lint`, `format:check`, `test`, `build` at lines 27-32 [VERIFIED: grep output this session]).

### Pattern 7: Session flow and overlays (D-14 to D-18)
- `src/ui/session.ts`: `screen = signal<'free'|'menu'|'briefing'|'running'|'debrief'>`; `ackRequired = computed(...)`. Transitions are plain functions (`openMenu`, `chooseScenario(id)`, `start()`, `complete()`, `closeDebrief()`); all other state is derived. No router.
- Overlays are DOM siblings after `.panel-area` (like `About`), never inside the SVG, so `attachZoomGestures` (listeners on the SVG) is untouched. `.zoom-out` has `z-index: 30` and `.about` has 20 (`src/ui/stage.css`, review item WR-06): new modal overlays need `z-index` above 30, or hide the Full panel button while a modal is open.
- **Footer** "Procedure complete" appears only in `running`. The footer is a 28 px single line; owner rule is 44 px touch targets, so the running footer button needs `min-height: 44px` (the panel area shrinks by about 16 px while running; the SVG uses `preserveAspectRatio` so this is safe, but re-run the footer overlap checks of the zoom specs).
- On `start()`: `store.reset(baseline)`, `quantities.value = scenario.initial.quantities`, new `VirtualClock`, `zoomOut(viewBox)` (so the PFD alert is visible), recorder armed, screen `running`. On `complete()`: snapshot `store.events()`, `grade(...)`, screen `debrief`. On leaving the debrief: `store.reset()` to registry defaults and quantities back to idle values.
- Random pick: `pickRandom(list, rng = Math.random)` in `src/ui` only (engine stays free of randomness); tests inject the rng.
- **Exam silence (SES-03):** in `running` nothing reads the grader; no listener, toast or lamp reflects "correctness". The only scenario-driven visible output is the CAS chip and gauge values.

### Pattern 8: Quantities and CAS (PNL-03, D-06 to D-08)
- `src/aircraft/da50rg/quantities.ts`: `oil_temp_c` (unit C, bands yellow -25..50, green 50..115, yellow 115..125, red >125) and `oil_pressure_bar` (red 0..2.0, yellow 2.0..3.5, green 3.5..7.0, yellow 7.0..7.5, red >7.5), copied as numeric facts that already exist in `MfdFrame.tsx` (the `OIL_TEMP` and `OIL_PRES` gauge specs cite "AFM 02-05") and in the private `.input/afm-notes.md` table (read this session). Reuse one source for the gauge bands and the engine bands (derive the MFD `Band[]` from the quantity def, do not duplicate numbers).
- `src/aircraft/da50rg/cas.ts`: `CasRule {id: 'eng_oil_temp', text: 'ENG OIL TEMP', level: 'warning', when: Predicate(quantity oil_temp_c gt 125)}`. Only ENG OIL TEMP is needed; the table shape serves later messages (level `caution` = yellow). `.input/afm-notes.md` records: "ENG OIL TEMP: oil temp above 125 C -> procedure 03-08 (p. 03-13)" [VERIFIED: file read this session].
- The scenario lists `annunciations[1]: eng_oil_temp` (SCN-03 "defines annunciations"); lint verifies the rule fires from `initial.quantities`, and that no other rule fires unexpectedly.
- `bridge.ts` gets a `quantities` signal (record) and a `cas` computed (active rules). `PfdFrame` renders chips from `bridge.cas` (it already receives `bridge` through `FrameProps` but is currently presentational and ignores it). Static red text on a black rounded rect, no animation. PFD local space: attitude spans x 100..395, y 34..266; altitude tape starts at x 405 [VERIFIED: src/ui/panel/frames/PfdFrame.tsx:10-13 `ATT_X = 100`, `ATT_Y = 34`, `ATT_W = 295`, `ATT_H = 232`, and :156 `<rect x={405} ...`]. A chip about 70 x 14 units, right edge near x 396, y near 200-215 (about one third from the bottom of the 367-tall region) satisfies D-06; the planner/executor must keep it clear of the tape and pass the art-fit and text-overlap gates (the e2e text gate excludes the `pfd`/`mfd` regions for instrument data [VERIFIED: e2e/static-text.spec.ts panelText filter], so conditional chip text there is allowed).
- Oil temp display (D-07): the oil temperature gauge already exists on the **MFD** (strip on the Map page and the Engine page, red band above 125, static value 15). CONTEXT says "on the PFD". See Open Question 1. Minimum: feed the existing OIL TEMP and OIL PRES gauges from the quantities signals.

### Pattern 9: First-run acknowledgment (PLT-04, D-17)
`src/ui/ack.ts`: `const DISCLAIMER_VERSION = 1` next to the disclaimer text constant; key `da50.ack` stores the accepted version. `read()` and `write()` wrap `localStorage` in try/catch (blocked storage, private modes, quota): on failure return "not accepted" and keep an in-memory flag for the session so the app works. Modal, no dismiss on Escape or backdrop, one Accept button. The scenario carries `disclaimer: training-aid` (an id resolved to the app-level text and version) so the text lives in one place; the briefing prints that text, plus `source.document`, `source.issue`, `source.section` (CONTENT-POLICY section 4 requires document number, issue, section, last-verified date). [ASSUMED: storing an id rather than a literal text in each scenario satisfies "carries disclaimer metadata" for SCN-07; confirm in discuss/plan-check.]

### Anti-Patterns to Avoid
- **Grading from click counts or toggle events.** Evaluate predicates over replayed state (D-09). A step satisfied then undone is not credited; a harmful entry is still reported.
- **Using `t` for ordering.** Ties are possible; use log index.
- **Storing the scenario baseline as dispatched events.** It would be graded as user actions and double-counted by retract.
- **Hard-coding ENG OIL TEMP anywhere in `src/`** (strings `lv.power`, `125`, `eng_oil_temp` outside `scenarios/` and `aircraft/` data). Blueprint principle (CONTEXT domain): add a Vitest test that greps `src/engine`, `src/scenario`, `src/ui` for scenario-specific literals.
- **Tabular or root-array TOON forms in scenario files.** Optional fields in tabular rows decode as `""`, and every spec major touched array forms. List form only.
- **Letting the validator throw.** `parseScenario` returns errors; only programmer errors throw.
- **A modal that leaves the panel gestures live.** Overlays must cover the SVG hit area (full-viewport container with `pointer-events: auto`) so taps never reach controls behind a menu.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOON syntax parsing | A custom TOON parser | `@toon-format/toon` `decode()` (strict) | Syntax errors with exact lines already provided; spec drifts |
| Schema validation + types | Hand-written validators/type guards | Zod `strictObject` + `discriminatedUnion` + `z.infer` | Typo keys fail loudly; one definition for types |
| Word counting for the 12-word rule | Ad-hoc regex in several places | One `wordCount(text)` helper in the schema refinement (whitespace tokens, as CONTENT-POLICY defines) | The policy defines counting precisely: whitespace-separated tokens |
| Expression evaluation | `eval`, `new Function`, string parser | The closed predicate union (Pattern 2) | D-22, CLAUDE.md |
| Timers | `setTimeout`/`setInterval` in engine | `VirtualClock.advance` driven by UI | SCN-08, ESLint boundary |
| TS execution for the CLI | A transpile step or new loader | Vite `createServer` + `ssrLoadModule` (already installed) | Zero dependency; shares Vite's resolution |
| Random ids / hashing of scenarios | Custom hash | Skip in Phase 2 (history is v2); record `scenarioId` only | YAGNI |

**Key insight:** the only genuinely custom code is the small path-to-line index (about 90 lines) and the grader. Everything else is a library or an existing project seam.

## Runtime State Inventory

Not a rename/refactor/migration phase in the data sense. The YAML-to-TOON wording change is documentation only. Explicit answers for the five categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No database. The app has no persisted state yet; Phase 2 adds one localStorage key (`da50.ack`) | none for migration; document the key and its versioning |
| Live service config | None — verified: static GitHub Pages hosting, no external services | none |
| OS-registered state | None — no scheduled tasks or daemons | none |
| Secrets/env vars | None. `BASE_PATH` and `VITE_TEST_HOOKS` are unchanged | none |
| Build artifacts | `dist/` and `dist-e2e/` exist in the working tree (git-ignored); stale after adding `scenarios/` and the `build.rolldownOptions` config | rebuild; `npm run build:e2e` is run by the Playwright `webServer` command |

Documentation to amend (D-19): `.claude/CLAUDE.md` (about 22 YAML mentions: stack table `yaml` row, "YAML + validation" section, "Loading strategy", "What NOT to Use" rows, alternatives, compatibility rows), `.planning/PROJECT.md` (lines 32, 56, 59, 66), `.planning/ROADMAP.md` (lines 244, 274), `.planning/REQUIREMENTS.md` (SCN-01 text; also the REQUIREMENTS "Content format" constraint in PROJECT.md).

## Common Pitfalls

### Pitfall 1: Scenario baseline lost on retract
**What goes wrong:** POWER starts p75 (scenario) but `retract` rebuilds from registry defaults (p70); a double-tap gesture on any control changes POWER's state and the grader.
**Why:** `deriveState` has no baseline [VERIFIED: store.ts:31-39].
**Avoid:** Pattern 4. Test: reset with `{ 'lv.power': 'p75' }`, actuate and retract another control, assert POWER is still p75.
**Warning signs:** debrief shows POWER credited/forbidden after a double tap.

### Pitfall 2: Existing e2e suite blocked by the new overlays
**What goes wrong:** All 22 spec files call `page.goto('./')` and then tap panel controls [VERIFIED: grep count per file this session]; the ack modal and menu overlay now cover the panel, Playwright's actionability check fails.
**Avoid:** (a) Seed the ack in `playwright.config.ts` via `use.storageState` with an `origins[].localStorage` entry computed from the same base URL logic (`LOCAL_BASE`/`PW_BASE_URL`), (b) introduce `e2e/support/open.ts` `gotoPanel(page)` that does `page.goto('./')` and dismisses the menu with its "Free panel" action, and replace `page.goto('./')` in the 22 specs mechanically (one early plan, own commit). Dedicated new specs use a fresh context (empty storage) to test the ack. Live-mode specs (`PW_BASE_URL`) go through the same helper.
**Warning signs:** whole `e2e` run red right after the overlay lands.

### Pitfall 3: TOON array-length headers and authoring friction
**What goes wrong:** Every array needs `name[N]:` with the exact count; adding a step and forgetting to bump N gives "Expected 3 list-form items, but got 2" at the line after the array.
**Avoid:** Keep strict mode (the error is explicit and has a line), make the CLI print the message with `file:line`, and document the rule in the (Phase 7) authoring guide. Do not use `strict: false`: 4.4 changed its error behaviour and it also drops tab/indent checks.

### Pitfall 4: TOON spec drift
**What goes wrong:** A caret range upgrades to a decoder whose behaviour for hand-written (non-encoder) documents changed (4.2, 4.3, 4.4 each rejected forms earlier versions accepted) [CITED: https://raw.githubusercontent.com/toon-format/spec/main/CHANGELOG.md].
**Avoid:** exact pin, `renovate/dependabot` ignore, a `tests/toon-conformance.test.ts` that decodes a fixed corpus (the blueprint scenario plus syntax-edge strings: dotted keys, comment lines, quoted `"018"`, `no`/`off` as strings) and asserts exact output; the upgrade is a deliberate task.

### Pitfall 5: Quoting surprises
**What goes wrong:** `issue: 018` is accepted as the string `"018"` in 4.4.0 (tested), but other numeric-looking values decode as numbers (`128`, `5.2`), `true`/`null` as keywords, `2026-10-21` stays a string. State ids like `p65`, `open`, `no`, `off` are strings.
**Avoid:** write identifiers quoted when numeric-looking (`issue: "018"`), type fields with Zod (`z.string()`), and let the schema error (with line) catch accidents. Use the full-line `#` for comments only.

### Pitfall 6: Float travel comparison
**What goes wrong:** `pos * 100` for `p55` is `55.00000000000001` (tested), so a "55 or lower" predicate fails by an epsilon.
**Avoid:** Pattern 2 rounding helper, with a unit test across all 21 power detents.

### Pitfall 7: Step already satisfied at start / do-nothing credits
**What goes wrong:** A step whose predicate is true at baseline is credited by a run that does nothing, or its "last entered" index is undefined.
**Avoid:** lint error "step X is already satisfied in the initial state"; the do-nothing replay test depends on it.

### Pitfall 8: Real-time leakage into the engine
**What goes wrong:** `bridge.actuate` stamps `performance.now()`; a session started at page load would give events times of minutes; replay from fixtures would differ.
**Avoid:** inject `now`, start the clock at 0 on `start()`, record `t` from the clock only. ESLint already bans `Date.now`/`performance.now`/timers in `src/engine`.

### Pitfall 9: Overlay stacking and focus
**What goes wrong:** Full panel button (z 30) paints over a new modal; no focus trap (WR-06 exists for About).
**Avoid:** modal z-index above 30 or hide the button; focus the primary button on open (the About dialog pattern: `useLayoutEffect` focusing a ref, Escape handler). Ack modal must not close on Escape.

### Pitfall 10: Scenario text policy drift
**What goes wrong:** An author pastes AFM sentences.
**Avoid:** schema refinement: step `text` and checklist `text` at most 12 words; `source` fields non-empty (CONTENT-POLICY section 4); briefing text cannot be machine-checked, so a review item in the plan (executor writes own wording; the pocket card is not a cited source, D-24).

### Pitfall 11: No formatter or linter for `.toon`
**What goes wrong:** Prettier and ESLint ignore `.toon`; `npm run format` does not cover `scenarios/`. No formatter exists for TOON (only the library `encode`, which would strip comments).
**Avoid:** never auto-format scenario files with `encode`; keep them hand-edited, validated by `npm run validate`.

## Code Examples

### 1. Path-to-position index for TOON text (prototype, run this session)
Tested in plain JS against the 4.4.0 decoder: for the blueprint-shaped scenario every path of the decoded value had an exact entry (differential check "paths without exact position: []"). Port to strict TypeScript (`noUncheckedIndexedAccess`). Handles object keys (quoted or dotted), list items (`- ` with an inline first field), inline primitive arrays (elements point to the header line), tabular rows, comment and blank lines. Unknown paths fall back to the nearest ancestor.
```js
// src/scenario/toon-index.ts (port of the tested prototype)
const INDENT = 2;
const KEY_RE = /^("(?:[^"\\]|\\.)*"|[^:[{"\s][^:[{]*?)(\[[^\]]*\])?(\{[^}]*\})?:(?:\s+(.*)|\s*)$/;
const unquoteKey = (raw) => (raw.startsWith('"') ? JSON.parse(raw) : raw.trim());
const splitFields = (s) => s.slice(1, -1).split(/[,\t|]/).map((f) => unquoteKey(f.trim()));

export function indexToon(source) {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const pos = new Map();
  const put = (path, line, col) => { const k = path.join('\u0000'); if (!pos.has(k)) pos.set(k, { line, col }); };
  const ctx = [{ kind: 'object', path: [] }];            // ctx[depth] = container whose children sit at that depth
  const keyLine = (content, depth, line, col, container) => {
    const m = KEY_RE.exec(content); if (!m) return false;
    const p = [...container.path, unquoteKey(m[1])]; put(p, line, col);
    const [, , arr, fields, rest] = m; ctx.length = depth + 1;
    if (arr !== undefined) {
      if (rest !== undefined && rest !== '') { for (let i = 0; i < rest.split(/[,\t|]/).length; i++) put([...p, i], line, col); }
      else ctx[depth + 1] = fields !== undefined ? { kind: 'rows', path: p, next: 0, fields: splitFields(fields) } : { kind: 'list', path: p, next: 0 };
    } else if (rest === undefined || rest === '') ctx[depth + 1] = { kind: 'object', path: p };
    return true;
  };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1, s = raw.replace(/\s+$/, '');
    if (s.trim() === '' || s.trimStart().startsWith('#')) return;
    const lead = s.length - s.trimStart().length, depth = Math.floor(lead / INDENT), content = s.trimStart(), col = lead + 1;
    const c = ctx[depth]; if (c === undefined) return;   // structural error: the decoder reports it
    if (c.kind === 'rows') { const rp = [...c.path, c.next++]; put(rp, line, col); c.fields.forEach((f) => put([...rp, f], line, col)); return; }
    if (c.kind === 'list' && (content === '-' || content.startsWith('- '))) {
      const ip = [...c.path, c.next++]; put(ip, line, col); ctx.length = depth + 1;
      const inner = content === '-' ? '' : content.slice(2);
      if (inner !== '') { ctx[depth + 1] = { kind: 'object', path: ip }; if (!keyLine(inner, depth + 1, line, col + 2, ctx[depth + 1])) ctx.length = depth + 1; }
      return;
    }
    if (c.kind === 'object') keyLine(content, depth, line, col, c);
  });
  return pos;
}
export const locate = (pos, path) => { for (let n = path.length; n >= 0; n--) { const h = pos.get(path.slice(0, n).join('\u0000')); if (h) return h; } return { line: 1, col: 1 }; };
```
Add a Vitest differential test: for every `.toon` file under `scenarios/` and `tests/fixtures/`, every path of `decode(text)` must have an exact entry in `indexToon(text)`. (Indent size 2 is the decoder default; reject other sizes in the scenario guide.)

### 2. Validation entry (shape, mapping Zod issues)
```ts
import { decode, ToonDecodeError } from '@toon-format/toon';
export function parseScenario(text: string): ParseResult {
  let value: unknown;
  try { value = decode(text); }                        // strict by default
  catch (e) {
    if (e instanceof ToonDecodeError) return fail([{ line: e.line ?? 1, message: e.message.replace(/^Line \d+:\s*/, '') }]);
    throw e;
  }
  const r = Scenario.safeParse(value);
  if (r.success) return { ok: true, scenario: r.data };
  const pos = indexToon(text);
  return fail(r.error.issues.flatMap((iss) =>
    iss.code === 'unrecognized_keys'
      ? iss.keys.map((k) => ({ ...locate(pos, [...iss.path, k]), message: `unknown key "${k}"` }))
      : [{ ...locate(pos, iss.path), message: `${iss.path.join('.')}: ${iss.message}` }]));
}
```
Observed outputs (probe, this session): `line 25, col 9: groups.0.steps.0.done.op: Invalid option: expected one of "lt"|"lte"|"gt"|"gte"`; `line 28, col 11: unknown key "opp"`; `line 34, col 11: ...done.check: Invalid discriminator value. Expected 'state' | 'travel_rel'`; array-count error `line 36: Line 36: Expected 3 list-form items, but got 2` (strip the duplicate prefix).

### 3. Blueprint scenario file (proposed shape; field names are discretion)
Conservative TOON subset (objects + list form + inline primitive arrays). Wording of `text` is the executor's job against the private pocket card and AFM, at most 12 words per line; the sample text below is placeholder own wording.
```toon
# ENG OIL TEMP, OIL PRES within the green range (blueprint scenario)
format: 1
id: eng-oil-temp-green
title: ENG OIL TEMP
source:
  document: AFM DA 50 C, Doc 9.01.01-E
  issue: "018"
  section: 03-08 ENG OIL TEMP
  verified: 2026-10-21
disclaimer: training-aid
briefing:
  situation: Own-words short situation text.
initial:
  controls:
    lv.power: p75
    lv.cowl_flap: closed
  quantities:
    oil_temp_c: 128
    oil_pressure_bar: 5
annunciations[1]: eng_oil_temp
groups[1]:
  - id: immediate
    ordered: false
    order_critical: false
    when:
      check: band
      quantity: oil_pressure_bar
      in[1]: green
    steps[2]:
      - id: reduce_power
        severity: critical
        text: Reduce power
        done:
          check: travel_rel
          control: lv.power
          op: lte
          delta: -10
      - id: open_cowl_flap
        severity: critical
        text: Open cowl flap
        done:
          check: state
          control: lv.cowl_flap
          is: open
forbidden[1]:
  - id: power_increased
    text: Increase power
    fails_run: false
    check: travel_rel
    control: lv.power
    op: gt
    delta: 0
checklist[4]:
  - text: Check oil pressure
  - text: Increase airspeed
  - text: Check oil temperature in green range
  - text: If not returning to green, land at nearest suitable airfield
```
`checklist` lines are not graded (D-04); the UI marks them "not graded in v1". (The `when:` on the group is the D-23 condition block; the same keyword can sit on a forbidden item or a checklist line.)

### 4. Pack manifest
```toon
format: 1
title: Engine
free: true
scenarios[1]:
  - id: eng-oil-temp-green
    title: ENG OIL TEMP
    file: eng-oil-temp-green
```

### 5. Golden recordings (JSON fixtures, replayed by `grade`)
```json
{ "scenarioId": "eng-oil-temp-green", "completedAt": 42000,
  "events": [ { "t": 8000, "id": "lv.power", "value": "p60" }, { "t": 15000, "id": "lv.cowl_flap", "value": "open" } ] }
```
Four recordings (golden PASS, do-nothing FAIL, wrong-order against a **synthetic** ordered/order-critical scenario in `tests/fixtures/`, forbidden action: `p80` then `p60`, expect PASS with one harmful entry). Add toggle-back (credit lost), reverted forbidden (still reported), and retract-absence cases. Assert `grade(...)` twice and `JSON.stringify` equality.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| YAML scenario files + `yaml` positions | TOON + `@toon-format/toon` + own path index | Owner decision D-19 | Positions for syntax errors are native; schema positions are our code; no JSON-Schema editor autocomplete |
| Rollup `manualChunks` / `advancedChunks` | Rolldown `output.codeSplitting.groups` (Vite 8) | Vite 8.x (deprecation warning for `advancedChunks` seen on 8.3.4) | Per-pack chunking config |
| Node `--experimental-strip-types` for scripts | Still cannot resolve extensionless TS imports | — | CLI uses Vite `ssrLoadModule` |

**Deprecated/outdated:** the `yaml` package, `z.toJSONSchema` for VS Code autocomplete (no TOON consumer exists), `public/schema/scenario.schema.json` (CLAUDE.md). Keep `z.toJSONSchema` as an optional doc artifact for the Phase 7 authoring guide only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storing a `disclaimer` id (resolved to one app-level versioned text) satisfies SCN-07 "carries disclaimer metadata" | Pattern 9 | Owner may want literal text in each file; cheap to change before authoring |
| A2 | Initial `oil_pressure_bar` of 5 (inside green 3.5-7.0) is acceptable | Code Example 3 | None for grading; owner may prefer another green value |
| A3 | Manifest should be named `pack.toon` and list scenarios with titles (D-20 says `pack`, "scenario count") | Pattern 6 | Naming/shape nuance; both are discretion items |
| A4 | A step already satisfied at baseline is a lint error rather than an opt-in `must_actuate` | Pattern 3, Pitfall 7 | A future scenario may legitimately need a "keep as is" step (pitfalls research suggests a per-step flag); defer flag to Phase 3 if needed |
| A5 | Forbidden detection on entry (even if reverted), each occurrence listed | Pattern 3 | Matches the pitfalls research and D-11 ("shown with its time"), but D-09 only speaks about credited steps; confirm with the DA50 instructor review noted in STATE blockers |
| A6 | `localStorage` can throw (blocked storage, some privacy modes), hence the wrapper | Pattern 9 | Wrapper is harmless if wrong; D-17 already requires it |
| A7 | Oil temperature readout belongs to the MFD gauges although CONTEXT D-07 says PFD | Pattern 8, Open Question 1 | Owner-visible placement; ask before building |
| A8 | 44 px "Procedure complete" footer button (grow footer while running) | Pattern 7 | Owner rule says 44 px touch targets; footer is 28 px today |
| A9 | Vite `ssrLoadModule` remains available in Vite 8.x | Pattern 6 | Fallback `tsx` devDependency |

## Open Questions

1. **Where does the oil temperature number appear (D-07 says PFD)?**
   - What we know: the PFD frame has attitude, speed, altitude, heading and no engine data [VERIFIED: PfdFrame.tsx read]; the OIL TEMP and OIL PRES gauges with the red band exist on the MFD (Map page strip, Engine page) with static values.
   - What's unclear: whether the owner means the glass in general or an actual PFD readout.
   - Recommendation: drive the existing MFD gauges from quantities and show the CAS chip on the PFD (D-06); raise the question at plan-check. No format change either way.

2. **Menu overlay on open vs. existing e2e specs and free panel use.** D-14 says the app opens with a menu overlay. Recommendation: modal menu with a visible "Free panel" action, and the shared `gotoPanel` helper (Pitfall 2). Owner may prefer a non-modal "New situation" button; that avoids touching 22 specs but deviates from D-14 wording.

3. **Confirm step before "Procedure complete".** D-15 asks for a clear button; an accidental tap ends the run irreversibly. No confirm is specified; leave out unless the owner asks (not researched further).

4. **Panel label THROTTLE vs step wording POWER.** The panel plate reads THROTTLE (id `lv.power`, [VERIFIED: pedestal.ts:22-24 `label: 'THROTTLE'`]) while the AFM/card and D-02 say POWER. Debrief text should follow D-24 (card wording); low risk, mention in the briefing if confusing.

5. **DA50 instructor review of grading semantics** (STATE blocker "[Phase 2]: Write the grading semantics spec ... Review it with a DA50 instructor"). This research proposes the semantics (Pattern 3); the planner should include a short `02-GRADING-SPEC.md` task (or a section in the plan) and mark owner confirmation of "holds at end" and entry-detected forbidden.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, test, validate CLI | yes | v26.12.0 local (CI uses 24; engines `^22.12 \|\| ^24 \|\| >=26`) | — |
| npm | install, scripts | yes | 11.20.0 | — |
| npm registry access | installing the two new packages | yes | `npm view` worked | — |
| Vite / Vitest / Playwright | build, unit, e2e | yes (in `node_modules`: vite 8.3.4, vitest 5.0.5) | as pinned | — |
| `tsx` | validate CLI | no (not needed) | — | Vite `ssrLoadModule` |
| Playwright browsers | e2e | not probed this session | — | Run `npx playwright install` per CI step before e2e |

**Missing dependencies with no fallback:** none.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` [VERIFIED: file read this session], so this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 (node env), Playwright 1.64.1 |
| Config file | `vite.config.ts` (`test: { environment: 'node', include: ['tests/**/*.test.ts'] }`), `playwright.config.ts` |
| Quick run command | `npx vitest run tests/<file>.test.ts` |
| Full suite command | `npm test` (Vitest) then `npm run e2e` (production-build Playwright, use `--project desktop-chromium` for a fast pass); plus `npm run typecheck`, `npm run lint`, `npm run validate` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCN-01 | Syntax and schema errors carry file line/col; typo key, wrong enum, wrong type, bad array count | unit | `npx vitest run tests/scenario-parse.test.ts` | Wave 0 |
| SCN-01 | Path index covers every decoded path (differential) | unit | `npx vitest run tests/toon-index.test.ts` | Wave 0 |
| SCN-01 | TOON decoder behaviour pinned (conformance corpus) | unit | `npx vitest run tests/toon-conformance.test.ts` | Wave 0 |
| SCN-02 | Unknown control id / illegal state / unknown quantity / unknown CAS id / step satisfied at start rejected with line | unit | `npx vitest run tests/scenario-lint.test.ts` | Wave 0 |
| SCN-02 | Every shipped scenario and manifest validates | unit | `npx vitest run tests/scenarios.test.ts` and `npm run validate` | Wave 0 |
| SCN-03 | Initial state applied without log events; annunciation rule fires from initial quantities | unit | `npx vitest run tests/session-start.test.ts` | Wave 0 |
| SCN-04, SCN-05 | Four replays + toggle-back, reverted forbidden, retract cases | unit | `npx vitest run tests/grading.test.ts` | Wave 0 |
| SCN-07 | Source fields required and non-empty; 12-word limit on step text | unit | in `scenario-parse.test.ts` | Wave 0 |
| SCN-08 | Clock: advance, pause ignores advance, rejects bad dt; grading output independent of wall time | unit | `npx vitest run tests/clock.test.ts` | Wave 0 |
| (store) | baseline survives retract; reset clears log, watermark, notifies | unit | extend `tests/store.test.ts`, `tests/bridge.test.ts` | exists, extend |
| PNL-03 | CAS rule engine; chip shown in PFD for ENG OIL TEMP and absent in idle | unit + e2e `@hooks` | `npx vitest run tests/cas.test.ts`; `npx playwright test e2e/scenario.spec.ts --project desktop-chromium` | Wave 0 |
| SES-01/03/04 | menu -> briefing -> start -> operate (tap POWER marker p50, tap COWL FLAP open) -> Procedure complete -> PASS debrief; do-nothing -> FAIL | e2e | `npx playwright test e2e/scenario.spec.ts` | Wave 0 |
| PLT-03 | Only `packs-vite.ts` uses the scenario glob; open policy; manifests list without loading chunks; per-pack chunk emitted | unit + build check | `npx vitest run tests/packs.test.ts` | Wave 0 |
| PLT-04 | Ack on fresh storage, not shown again, shown again on version bump; works with storage throwing | unit (ack logic) + e2e fresh context | `npx vitest run tests/ack.test.ts`; `npx playwright test e2e/ack.spec.ts` | Wave 0 |
| Blueprint | No scenario-specific literals in `src/` | unit | `npx vitest run tests/blueprint.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single targeted test file (`npx vitest run tests/<file>`), plus `npm run typecheck` when types changed.
- **Per wave merge:** `npm test`, `npm run lint`, `npm run validate`.
- **Phase gate:** full Vitest + typecheck + lint + format:check + validate + `npm run e2e` (chromium and webkit projects) green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/fixtures/` — golden recordings (JSON) and the synthetic ordered scenario (`.toon`)
- [ ] `e2e/support/open.ts` (`gotoPanel`) and `storageState` seeding in `playwright.config.ts` (before any overlay lands)
- [ ] Test files listed above (all new); framework install: none (Vitest and Playwright present)
- [ ] `npm install --save-exact @toon-format/toon@4.4.0 zod@4.6.7` after the human-verify checkpoint

## Security Domain

`security_enforcement` is enabled (absent or true); ASVS level 1, `block_on: high` [VERIFIED: .planning/config.json]. Owner memory says MVP first, defer audits: keep to cheap, structural controls.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no accounts in v1 |
| V3 Session Management | no | "session" here is app state, no cookies |
| V4 Access Control | partial | `AccessPolicy` seam (open in v1); no server enforcement possible on Pages |
| V5 Input Validation | yes | TOON decode strict + Zod `strictObject` for scenario and manifest text (trusted repo files now, user files in Phase 7: apply a size cap such as 256 KB and reject early) |
| V6 Cryptography | no | none in this phase |
| V14 / Config | yes | pinned exact dependency versions, `npm ci`, no postinstall scripts |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via scenario keys (`__proto__`, `constructor`) | Tampering | Tested: `decode` keeps `__proto__` as an own data property and `({}).polluted` stayed `undefined`; Zod 4 `z.record` drops the `__proto__` key. Still look up control ids with `registry.get` (a `Map`) and use `Object.hasOwn`/`Map` for scenario-keyed data, never `obj[key]` on a plain object |
| Script/markup injection through scenario text | Tampering / XSS | Render all scenario strings as Preact text children; the existing gate `no source file uses a raw-HTML injection API` (tests/content-policy.test.ts) already forbids `innerHTML`/`dangerouslySetInnerHTML` |
| Expression injection through conditions | Tampering | Closed predicate union, no evaluated strings (D-22) |
| Malformed or huge file DoS | DoS | Size cap before decode; decoder is linear; indentation-based |
| Supply chain (two new deps) | Tampering | Exact pins, lockfile review, human-verify checkpoint, Dependabot ignore for TOON, no postinstall |
| Copyright leakage into committed text | Information disclosure (legal) | 12-word schema refinement, content-policy review checklist item, hygiene test already blocks PDFs and `.input/` |

## Sources

### Primary (HIGH confidence)
- Codebase files read this session: `.planning/phases/02-first-gradable-scenario/02-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`, `.claude/CLAUDE.md` (via task context), `src/engine/store.ts`, `registry.ts`, `indicators.ts`, `src/ui/bridge.ts`, `App.tsx`, `src/ui/panel/frames/PfdFrame.tsx`, `MfdFrame.tsx`, `src/aircraft/da50rg/controls/pedestal.ts`, `panel.ts`, `docs/CONTENT-POLICY.md`, `eslint.config.js`, `vite.config.ts`, `playwright.config.ts`, `.github/workflows/deploy.yml`, `tests/*.ts` samples, `e2e/static-text.spec.ts`, `.planning/research/PITFALLS.md`, `.planning/todos/pending/*`, private `.input/afm-notes.md`.
- `npm view` for `@toon-format/toon` (4.4.0), `zod` (4.6.7); `gsd-tools package-legitimacy check`.
- Local probes (scratchpad, this session): TOON 4.4.0 decode behaviour and `ToonDecodeError` fields; comment-line handling and original line numbers; Zod 4.6.7 on decoded output; path index differential check; Vite 8.3.4 build with `?raw` globs and `codeSplitting` per-pack chunks; Vitest 5.0.5 `import.meta.glob`; Vite `ssrLoadModule` loading repo TS; Node native TS import failure.
- TOON spec: https://raw.githubusercontent.com/toon-format/spec/main/SPEC.md (v4.4, Working Draft, 2026-10-08; section 5.1 comment lines; key/value quoting rules; `.toon`, `text/toon`)
- TOON changelog: https://raw.githubusercontent.com/toon-format/spec/main/CHANGELOG.md (breaking changes per release)
- TOON versioning policy: https://raw.githubusercontent.com/toon-format/spec/main/VERSIONING.md

### Secondary (MEDIUM confidence)
- TOON decoding guide and error class listing (search results): https://www.mintlify.com/toon-format/toon/guides/decoding ; npm diff showing `ToonDecodeError` added in 2.2.0: https://socket.dev/npm/package/@toon-format/toon/diff/2.2.0
- TOON ecosystem and editor tooling: https://toonformat.dev/ecosystem/tools-and-playgrounds (VS Code "TOON Language Support" `vishalraut.vscode-toon`, Sublime package, tree-sitter grammar; YAML highlighting as approximation). Marketplace page itself not confirmed.

### Tertiary (LOW confidence)
- Safari/private-mode `localStorage` behaviour (A6): training knowledge only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for versions and behaviour (probed); MEDIUM for TOON longevity (draft spec churn)
- Architecture: HIGH — built on the read store/bridge/registry code and probed tooling
- Pitfalls: HIGH for store baseline, e2e blocking, float travel (all reproduced or read in code); MEDIUM for UI sizing (footer 44 px) and focus issues

**Research date:** 2026-10-22
**Valid until:** 2026-11-05 (TOON and Zod publish quickly; re-check the pinned versions' changelog before upgrading; the codebase findings stay valid until the store/bridge change)
