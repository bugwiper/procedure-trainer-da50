# Project Research Summary

**Project:** DA50 RG Procedure Trainer
**Domain:** Web-based 2D cockpit procedure / emergency part-task trainer (interactive SVG panel, TOON-authored scenarios, graded debrief, static hosting)
**Researched:** 2026-10-19
**Confidence:** MEDIUM-HIGH (toolchain HIGH; grading/DSL design and legal items MEDIUM)

## Executive Summary

This is a narrow-gap product. The market splits into read-only checklists and full simulators. Only VRflow (DA40, subscription) sits near an operate-the-panel trainer with evaluation. No competitor publicly documents partial-order, forbidden-action or escalation grading, and none covers the DA50 RG. Experts build this class of product as a deterministic, headless simulation core with a thin rendering shell. The core holds flat aircraft state, a control registry, an event log, an injectable clock, a scenario rules engine and a pure-function grader. The UI emits control events and never decides correctness.

The recommended approach is Vite 8, TypeScript 6.0.x (pinned, not 7) and Preact 11 with signals for the SVG panel. `@toon-format/toon` (pinned exactly) and Zod 4 are the single source of truth for the scenario schema. The engine is plain TS, event-sourced, with a virtual clock (no XState). The panel is generated from a control registry plus layout data, not a hand-exported SVG. Scenarios are a small closed declarative DSL. It covers required/optional/forbidden actions, ordered groups and trigger/effect reactions. Scenarios are compiled and cross-checked against the registry. Training and Exam share one engine, and mode is a feedback policy only. Deploy via GitHub Actions to Pages, starting with a hello-world on day one.

Key risks:
1. Grading semantics (state predicates, partial order, harmful actions, critical-item fail) must be specified before any scenario is authored, because schema changes break content.
2. Touch and phone ergonomics on a dense panel are the largest rework risk and must be validated on real devices in the panel phase.
3. Legal/IP exposure from verbatim AFM text, Garmin/Diamond marks and the public repo must be decided before content enters git history.
4. GitHub Pages cannot enforce paid gating and its terms disallow commercial use. v1 is therefore free-only with a gate-ready seam, and paid packs never enter the public repo.

## Key Findings

### Recommended Stack

Versions were verified against npm on 2026-10-19 with a passing probe build. Do not "correct" them from memory. Keep the engine and aircraft model framework-agnostic so the UI choice stays cheap to reverse. There is no router: screens are app state, or hash routing.

**Core technologies:**
- Node 24 LTS (CI): Vitest 5 requires it, and Node 20 is unsupported.
- TypeScript `~6.0.3`: TS 7 has no programmatic API, and the typescript-eslint peer is `<6.1.0`. Pin it and ignore TS majors in Dependabot.
- Vite 8.3.x: dev and build, `import.meta.glob` for lazy per-pack chunks, official Pages workflow.
- Preact 11 + @preact/signals + @preact/preset-vite: about 3 KB, native SVG JSX, fine-grained attribute updates (fallback Preact 10.29.x).
- `@toon-format/toon` 4.4.0, pinned exactly: strict decoding with 1-based line errors; schema errors get line and column from the project's own path-to-line index.
- Zod 4.6.x: schema, TS types and JSON Schema (`z.toJSONSchema`) for VS Code authoring. Use `z.strictObject` everywhere.
- Plain TS reducer engine + virtual clock: not XState, because scenarios are TOON data and not an FSM.
- Vitest 5, Playwright 1.64 (chromium, webkit, mobile emulation), ESLint 10, Prettier, self-hosted B612 font. vite-plugin-pwa comes later.

### Expected Features

**Must have (table stakes):**
- Interactive panel with discrete controls (switches, guarded switches, detented levers, buttons, knobs), annunciator area and responding gauges, on mouse and touch
- Training mode (checklist, next-step highlight, hint) and Exam mode (silent, explicit "Procedure complete"), on one engine
- Debrief with PASS/FAIL, per-step verdicts, order violations, harmful actions, outcome and AFM reference
- Non-panel actions palette (MAYDAY, squawk 7700, landing site decision)
- Scenario selection, random "new situation", briefing, retry, pause/resume
- Responsive layout with phone region zoom and 44 px hit targets, plus guarded controls
- Per-scenario source/disclaimer and a global training-aid notice

**Should have (competitive):**
- Rich grading taxonomy: critical/standard required, optional, ordered/unordered, forbidden, conditional, time-bound
- Scripted escalation with deterministic reactions and harmful-action consequences
- Schema-validated TOON authoring with line-numbered errors and a validate CLI
- Reference-solution replay tests per scenario (golden run passes, do-nothing run fails)
- Debrief timeline, local progress history, outcome-based critical-item grading, PWA offline, scenario variants
- Gate-ready pack seam (manifest plus allow-all access policy) in v1

**Defer (v2+):**
- Paid pack unlock and enforcement, additional packs, partial engine failure scenario, normal procedures, visual scenario editor, instructor sharing (needs a backend)
- Anti-features to avoid: flight model/physics, pixel-accurate G1000, bundled AFM text, gamification, LLM-generated scenarios, voice/ATC, multi-language, certification claims

### Architecture Approach

The domain core (`core/`) holds the state store and reducer, registry, clock, event log, matcher, engine and grader. It has no DOM, enforced by lint/tsconfig. A single control registry is the source of truth for rendering, scenario cross-reference validation and event normalization. A Session Controller is the only mediator between core and UI.

Content flows TOON -> parse (line-aware) -> Zod -> compile (xref vs registry) -> CompiledScenario. It fails fast in CI and soft at load. Packs are reached only through `PackProvider` + `AccessPolicy` (decorator, `OpenPolicy` in v1). Lever and continuous controls emit commit events on release/detent, never per drag frame.

**Major components:**
1. Aircraft definition + Control Registry: control ids, legal values, layout, baseline state
2. AircraftState store + EventLog + injectable Clock: deterministic, replayable session core
3. Action Matcher + Scenario Engine + Grader: one shared matcher for live and post-hoc grading
4. TOON Loader + Zod schema + Scenario Compiler + validate CLI: two-stage validation
5. PackProvider + AccessPolicy: the gate seam
6. Session Controller + feedback policy: Training/Exam as policy, not an engine branch
7. PanelView (generated SVG, Pointer Events, viewBox region zoom) + HTML overlays: the UI shell

### Critical Pitfalls

1. **Event-log grading instead of state-predicate grading.** Define actions as predicates on control state, with partial-order groups and forbidden actions recorded on entry. Use a pure `grade()` with golden fixtures. Write the grading spec before authoring scenarios.
2. **Nondeterministic wall-clock reactions.** Use a single injected clock with no `setTimeout` in the engine. Pause on visibility change, define the queue order, detect cycles, and use replay tests.
3. **Schema/TOON authoring failures and schema churn.** Use strict TOON decoding (array counts must match), quoted numeric-looking strings and enum states, strict Zod, registry cross-ref checks reporting file:line, and `schemaVersion` from day one. Include AFM idiom fields (step type, condition, any_of, source, criticality). Do not freeze the schema for external authors until three real scenarios are written.
4. **Touch/mobile treated as mouse-plus.** Use Pointer Events, `touch-action`, oversized hit rects, an explicit region-zoom model, `getScreenCTM` math and `100dvh`. Run real-device QA at the panel-phase exit.
5. **Legal/IP and gating reality.**
   - No verbatim AFM text or Garmin/Diamond artwork or marks. Use original generic art, an ASSETS register and neutral branding.
   - Paid content never goes in the public repo.
   - Pages terms bar commerce, so use a custom domain and a host-agnostic build, and migrate before the first sale.
   - Client-side gating is deterrence only.

Also material: a critical miss must fail regardless of percentage (misleading debrief), Exam-mode leakage, Pages base-path/cache/case-sensitivity gotchas, and keyboard/ARIA accessibility.

## Implications for Roadmap

The pitfall research's P1-P6 maps onto the six phases below.

### Phase 1: Foundation, Deploy and Policy Decisions
**Rationale:** Hosting and repo-visibility problems surface late and are expensive. Content/legal policy must precede any AFM text entering git history. Layer boundaries set here are costly to retrofit.
**Delivers:**
- Vite/TS/Preact scaffold, a `core/` no-DOM lint boundary, Vitest + Playwright
- Actions deploy of a hello-world to Pages, with `base` from env, a subpath smoke test and `.nojekyll`
- Custom-domain and host-agnostic build decision
- Content policy (paraphrase-only, public/private repo split), ASSETS register, disclaimer/trademark wording draft

**Addresses:** Static deploy; gate-ready posture.
**Avoids:** Pitfalls 7, 9, 10, 11 (policy and deploy parts).

### Phase 2: Core Model (Registry, State, Clock, Event Log) and Grading Spec
**Rationale:** Everything depends on stable control-id and state-key conventions. Grading semantics must be settled before the schema.
**Delivers:**
- DA50 control registry (derived from the user's POH/AFM), aircraft state store and reducer
- Injectable pausable clock and event log
- Written grading/semantics spec and golden-fixture scaffolding

**Implements:** Registry, store, clock, event log.
**Avoids:** Pitfalls 1 (decision), 2 (clock), 4 (registry layering).

### Phase 3: Panel and Interaction
**Rationale:** Independent of the engine after Phase 2. Phone ergonomics are the likeliest costly rework, so validate early with a playable free-form panel.
**Delivers:**
- Registry-generated SVG panel, discrete controls, guarded switches, annunciators and gauges
- Pointer Events input, region-zoom/pan model and oversized hit areas
- a11y roles, audio unlock, original artwork and a size budget

**Addresses:** Panel, annunciators and responsive/touch table stakes.
**Avoids:** Pitfalls 4, 5, 6, 8, 15.

### Phase 4: Scenario Schema, Compiler, Engine and Grader
**Rationale:** The schema is the highest-leverage decision and the engine is the core value. The gate seam lands here so nothing bypasses it.
**Delivers:**
- Zod schema (including `schemaVersion`, source metadata and criticality), line-aware parser, compiler with xref checks and validate CLI
- PackProvider/AccessPolicy (OpenPolicy)
- Matcher, engine (triggers, timers, ramps, outcomes) and grader with critical-fail logic
- Replay tests: golden, do-nothing, wrong-order, forbidden

**Uses:** `@toon-format/toon`, Zod 4, Vitest.
**Avoids:** Pitfalls 1, 2, 3, 13.

### Phase 5: Session Flows, Modes, Debrief and Initial Content Pack
**Rationale:** Needs the engine and panel. Authoring the three real scenarios validates the DSL, so expect schema revisions here.
**Delivers:**
- Session Controller, feedback policy (Training/Exam), briefing, random/selected start, pause/retry and the non-panel actions palette
- Debrief (verdicts, order violations, harmful actions, outcome, source references)
- Oil Temp High, Electrical Failure and Engine Fire scenarios with replay tests
- Authoring README, first-run acknowledgment and disclaimers

**Addresses:** All remaining must-have features.
**Avoids:** Pitfalls 12, 13, 14.

### Phase 6: Hardening and v1.x Polish
**Rationale:** Quality gates before wider release. v1.x items follow once users repeat scenarios.
**Delivers:**
- Real-device QA (iOS Safari, iPad, Android), profiling, a11y audit and a stale-deploy chunk handler
- Versioned storage, local history, debrief timeline and PWA
- Time-bound and conditional steps as needed

**Avoids:** Pitfalls 6, 10, 12, 15, 16.

Deferred beyond v1 (own milestone):
- Paid-pack gate (edge-validated unlock or encrypted packs)
- Host migration off Pages
- ToS/Impressum/privacy
- Lawyer review
- Diamond/Garmin clarification

### Phase Ordering Rationale

- Registry, state and clock come first because the panel, compiler and engine all depend on stable ids and deterministic time.
- Panel (3) and schema/engine (4) can run in parallel after Phase 2. The panel goes first for risk reasons.
- The gate seam lands in Phase 4, before content volume. Policy decisions land in Phase 1, before git history fills with content.
- Content authoring comes after the engine so real scenarios stress the DSL. Freeze the schema for external authors only after three scenarios.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:**
  - Review the grading semantics spec against 2-3 real DA50 AFM emergency checklists.
  - Derive the DA50 control inventory from the POH/AFM.
  - Confirm with a DA50 instructor: memory-item deadlines, the "holds at end" default and ordered-group strictness.
- **Phase 3:**
  - Test iOS Safari pointer-capture and `touch-action` on SVG on a real device.
  - Choose the small-screen model (region zoom vs pan mode) via a prototype spike.
  - Decide custom viewBox pan/zoom vs `@panzoom/panzoom`, and generated vs hybrid panel art.
- **Phase 4:** DSL vocabulary (conditional steps, any_of, reaction cycle detection) and error UX. Moderate research.
- **Deferred gate milestone:** payment/license provider, Cloudflare Worker prototype, VAT/Impressum, and legal clearance on AFM-derived paid content and trademarks.

Phases with standard patterns (skip research-phase):
- **Phase 1:** the Vite + Pages Actions workflow is well documented. Pin the verified versions.
- **Phase 5:** session/UI flows follow established patterns once the engine and schema exist. Content authoring is user-supplied.
- **Phase 6:** standard QA, PWA and a11y practice.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions read from npm and a probe project built, type-checked, linted and tested. The Preact choice and the gating options are MEDIUM judgment calls. |
| Features | MEDIUM | Competitor landscape comes from store listings (marketing copy). The grading/escalation/debrief taxonomy is synthesized and needs instructor validation. |
| Architecture | MEDIUM-HIGH | Established deterministic-core pattern, and tooling claims verified in official docs. The scenario DSL specifics are design recommendations. |
| Pitfalls | MEDIUM | Pages terms are HIGH (official). The Garmin trademark position is partial. Touch, grading and schema items come from engineering practice. Legal items are not legal advice. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Competitor grading internals are undocumented, so the differentiator rests on absence of docs. Optionally try VRflow's free demo, and validate the taxonomy with a DA50 instructor before locking the schema.
- DA50 RG AFM procedures, CAS texts and the control inventory are not in the research. The user supplies them. Derive the registry in Phase 2/3.
- Time-bound (memory item) deadlines in the initial pack are unconfirmed. Keep `within_s` optional and decide in Phase 2 with the instructor.
- The phone interaction model is unproven on real devices. Run a prototype spike in Phase 3.
- Legal items are open: verbatim AFM text, Garmin/Diamond marks, repo visibility and Pages commercial terms. Resolve the content policy in Phase 1, and get legal review before any sale.
- Monetization specifics are LOW confidence (Lemon Squeezy post-Stripe migration, Cloudflare Worker, Gumroad CORS). Defer them to the gate milestone.
- The Preact 11 and TS 6.0 pinning is specific to the current state. Revisit when TS 7.1 and typescript-eslint support land.

## Sources

### Primary (HIGH confidence)
- npm registry (2026-10-19) and probe project: all versions, engines, peers, build/lint/test results
- Microsoft TypeScript 7.0 announcement: no API in 7.0
- Vite static deploy guide and glob import docs: Pages workflow, `base`, `import.meta.glob`
- Zod JSON Schema docs: `z.toJSONSchema`
- GitHub Docs, Pages limits: commercial-use prohibition, size and bandwidth limits
- GitHub Releases API: Actions versions

### Secondary (MEDIUM confidence)
- App Store listings (VRflow, Learrocket/Aviation eLearning, Cirrus Go), Halldale VRflow article, Threshold DA50RG review: competitor landscape and pricing
- Dutch Safety Board DA50 RG report: partial engine failure training recommendation
- SAE 912100: part-task trainer automatic scoring
- Garmin manual trademark notices: marks require express permission
- Community Vite/GitHub Pages SPA routing guidance, Lemon Squeezy License API CORS probe

### Tertiary (LOW confidence)
- Cross-domain part-task-trainer grading literature, and the author synthesis of the grading taxonomy and escalation DSL (needs instructor validation)
- Lemon Squeezy/Stripe migration (competitor blog), Gumroad CORS (unconfirmed), Cloudflare Worker specifics (not exercised)
- Legal points (AFM copyright, Impressum/GDPR, liability): not legal advice

---
*Research completed: 2026-10-19*
*Ready for roadmap: yes*
