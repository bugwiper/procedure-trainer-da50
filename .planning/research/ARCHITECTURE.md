# Architecture Research

**Domain:** Web-based cockpit procedure trainer (interactive SVG panel, YAML-driven scenarios, graded debrief, static hosting)
**Researched:** 2026-10-19
**Confidence:** MEDIUM-HIGH. The component structure is derived from well-established patterns in procedure/part-task trainers (deterministic state + event log + rules engine) and from the project constraints. Tooling claims (Zod JSON Schema export, Vite base path, `import.meta.glob`) were verified against official docs. No public reference implementation of this exact product type was found, so the scenario DSL details are design recommendations, not copied standards.

## Standard Architecture

Cockpit procedure trainers (part-task trainers, CPTs, "click-the-cockpit" systems) are almost always structured as a **deterministic, headless simulation core with a thin rendering shell**:

1. A flat **aircraft state** (switch positions, lever positions, indicator values, annunciations).
2. A **control/instrument registry** that is the single source of truth for what exists on the panel and what values it can take.
3. An **event log** of user actions, timestamped on a simulated clock.
4. A **scenario/rules engine** that reacts to events and time by mutating state (scripted, not physics).
5. A **grader** that is a pure function of (scenario, event log) producing a debrief.
6. A **UI layer** that only renders state and emits control events.

The key discipline: the core (2-5) has **zero DOM dependency** so it can be unit-tested headless and replayed deterministically. The UI never decides whether an action was correct.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           UI LAYER (DOM/SVG)                          │
│  ┌────────────┐ ┌──────────────┐ ┌───────────┐ ┌────────┐ ┌────────┐ │
│  │ PanelView  │ │ Checklist    │ │ Scenario  │ │ Debrief│ │Settings│ │
│  │ (SVG, pan/ │ │ Overlay      │ │ Picker /  │ │ View   │ │/Mode   │ │
│  │  zoom)     │ │ (show/hide)  │ │ Quiz flow │ │        │ │        │ │
│  └─────┬──────┘ └──────▲───────┘ └─────┬─────┘ └───▲────┘ └───┬────┘ │
│        │ ControlEvent  │ view-model    │ start     │ Debrief  │      │
├────────┼───────────────┼───────────────┼───────────┼──────────┼──────┤
│        ▼               │               ▼           │          ▼      │
│                   SESSION CONTROLLER (orchestrator)                   │
│   owns: Clock, mode (training|exam), lifecycle (idle→running→done)    │
│   wires: input → state → engine → grader → UI view-models             │
├──────────────────────────────────────────────────────────────────────┤
│                       DOMAIN CORE (pure TS, no DOM)                   │
│  ┌──────────────┐ ┌───────────────┐ ┌────────────────┐ ┌──────────┐  │
│  │ AircraftState│ │ Control       │ │ Scenario       │ │ Grader   │  │
│  │ store +      │◄┤ Registry      │ │ Engine         │ │ (pure fn)│  │
│  │ reducer      │ │ (definitions, │ │ (triggers,     │ │          │  │
│  │              │ │  value domain)│ │  timers,       │ │          │  │
│  │              │ │               │ │  action match) │ │          │  │
│  └──────┬───────┘ └───────────────┘ └───────┬────────┘ └────▲─────┘  │
│         └───────────── EventLog ────────────┴───────────────┘        │
├──────────────────────────────────────────────────────────────────────┤
│                    CONTENT & ACCESS LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ ┌───────────┐ │
│  │ YAML Loader +│  │ Scenario     │  │ PackProvider  │ │ Access    │ │
│  │ Schema       │─▶│ Compiler     │◄─┤ (index, fetch)│◄┤ Policy    │ │
│  │ Validation   │  │ (xref check) │  │               │ │ (v1: free)│ │
│  └──────────────┘  └──────────────┘  └───────────────┘ └───────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│                         PERSISTENCE (localStorage)                    │
│   settings · attempt history/scores · (later) license token           │
└──────────────────────────────────────────────────────────────────────┘
        BUILD TIME:  content/*.yaml ──validate──▶ dist/packs/*.json (or .enc later)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Aircraft definition** (`aircraft/da50rg`) | Declares every control and indicator (id, kind, state key, legal values, label), the baseline (normal-flight) state, and the panel layout (positions in viewBox units). Single source of truth. | Plain TS data modules exporting typed constants. No logic. |
| **Control Registry** | Lookup + validation of controls: "does `sw.alt` exist, is `off` legal, what state key does it write?" Used by UI (to render), by schema compiler (to validate scenario references), and by engine (to normalize events). | `Map<ControlId, ControlDef>` built from aircraft definition. |
| **AircraftState store** | Holds current flat state, applies `ControlEvent`s and `Effect`s via a reducer, notifies subscribers per key. | Tiny observable store (~50 lines); `Record<StateKey, number\|boolean\|string>`. |
| **EventLog** | Append-only list of `{t, controlId, value, source}` (source = user or scenario). Everything graded derives from it. | Array in session; serializable for replay/tests. |
| **Clock** | Provides scenario time. Injectable so tests advance time deterministically and the app can pause (tab hidden, checklist modal). | `interface Clock { now(): number }` + `ManualClock` for tests; RAF/interval-driven `RealClock`. |
| **Scenario Engine** | Runs a compiled scenario: applies initial state, evaluates triggers (timers, after-action, state-condition), applies effects (set, ramp, annunciate, end), tracks action matches live. | Class with `start()`, `onControlEvent(e)`, `tick(dtMs)`; emits `EngineEvent`s. |
| **Action Matcher** | Decides whether a control event/state satisfies an action predicate (set-to-value, in-range, toggled) and tracks group ordering. | Pure functions used by both engine (live) and grader (post-hoc). |
| **Grader** | Pure function `grade(compiledScenario, eventLog, finalState, outcome) -> Debrief`. Missed required, order violations, forbidden/harmful actions, optional done, timing, outcome. | Pure TS; shares Action Matcher with engine. |
| **YAML Loader + Schema** | Parse YAML (retaining line numbers), validate structurally, produce typed `ScenarioDoc`. | `yaml` parser + Zod schema (Zod 4 exports JSON Schema for editor autocompletion). |
| **Scenario Compiler** | Cross-reference validation against registry (control ids, legal values, action/trigger ids, group membership) and normalization into `CompiledScenario`. | Pure function; runs at build time (CI) and at load time. |
| **PackProvider** | Lists packs (manifest) and returns scenario docs for a pack. Only way UI/session obtain scenarios. | Interface; v1 impl `StaticPackProvider` fetching `packs/<id>.json`. |
| **AccessPolicy** | Answers `canAccess(packId)`. v1: always true for all shipped packs. Wraps PackProvider in a decorator. | Interface; v1 `OpenPolicy`; later `LicensePolicy`. |
| **Session Controller** | Orchestrates one scenario attempt: picks scenario, creates state+engine+clock, routes events, enforces mode feedback policy, finishes and calls grader, persists result. | Single class/module; the only place that touches both core and UI. |
| **PanelView** | Renders registry into SVG; maps pointer/touch to `ControlEvent`s; subscribes to state for visual updates; handles viewBox scaling and pan/zoom. | Imperative TS "control widgets" (toggle, lever, button, gauge, annunciator, text readout). |
| **UI chrome** | Scenario picker/quiz flow, checklist overlay, mode toggle, debrief, disclaimer/source display. | Thin DOM layer (vanilla or Preact; decide in STACK). Consumes view-models only. |
| **Persistence** | Settings, attempt history (score per scenario for the "repeat to improve" metric), later license token. | `localStorage` with versioned keys and a migration stub. |

## Recommended Project Structure

```
src/
├── core/                      # PURE TS. No DOM, no fetch, no Date.now. 100% unit-testable.
│   ├── state/
│   │   ├── store.ts           # AircraftState store + subscribe
│   │   └── reducer.ts         # applyControlEvent, applyEffect
│   ├── registry/
│   │   ├── types.ts           # ControlDef, StateKey, ValueDomain
│   │   └── registry.ts        # lookup + value validation
│   ├── clock.ts               # Clock interface, ManualClock
│   ├── eventlog.ts
│   ├── scenario/
│   │   ├── types.ts           # CompiledScenario, Action, Group, Trigger, Effect
│   │   ├── matcher.ts         # predicate + ordering evaluation (shared by engine & grader)
│   │   ├── engine.ts          # triggers, timers, ramps, outcomes
│   │   └── grader.ts          # grade() -> Debrief
│   └── index.ts
├── aircraft/
│   └── da50rg/
│       ├── controls.ts        # control + indicator definitions
│       ├── baseline.ts        # normal-flight initial state
│       ├── layout.ts          # positions in viewBox coordinates, regions
│       └── derived.ts         # (optional, minimal) invariant couplings only
├── content/                   # Schema + compile (no DOM)
│   ├── schema.ts              # Zod schemas (ScenarioDoc, PackManifest)
│   ├── parse.ts               # yaml -> ScenarioDoc with line-aware errors
│   └── compile.ts             # xref validation vs registry -> CompiledScenario
├── packs/                     # Access layer (the "gate seam")
│   ├── PackProvider.ts        # interface + StaticPackProvider
│   ├── AccessPolicy.ts        # interface + OpenPolicy
│   └── (later) crypto/        # LicensePolicy, EncryptedPackProvider
├── session/
│   ├── SessionController.ts   # orchestrator
│   ├── feedbackPolicy.ts      # training vs exam: what the UI is told, when
│   └── history.ts             # attempt persistence
├── ui/
│   ├── panel/                 # PanelView, widgets/, pan-zoom, input
│   ├── checklist/
│   ├── flow/                  # picker, quiz start, debrief
│   └── app.ts                 # bootstrap, routing between views
├── persistence/storage.ts
└── main.ts
content/                       # AUTHORED CONTENT (outside src; not bundled as code)
├── schema/scenario.schema.json  # generated from Zod; used for VS Code YAML autocomplete
└── packs/
    ├── core-emergencies/
    │   ├── pack.yaml          # manifest: id, title, version, access: free|licensed
    │   ├── oil-temp-high.yaml
    │   ├── electrical-failure.yaml
    │   └── engine-fire.yaml
    └── README-AUTHORING.md
scripts/
├── validate-content.ts        # runs parse+compile on all YAML; CI gate
└── build-packs.ts             # YAML -> dist/packs/<id>.json (later: encrypt)
tests/
├── core/                      # unit tests: reducer, matcher, engine, grader
└── scenarios/                 # golden-path / do-nothing / wrong-order replays per scenario
```

### Structure Rationale

- **`core/` has no browser dependency:** enforces the "UI never grades" rule structurally. Add a lint rule (or `tsconfig` project reference with `lib: []` no `dom`) so `core/` cannot import DOM types.
- **`aircraft/` separate from `core/`:** aircraft is data; the engine is generic. Costs nothing now, makes a second aircraft/variant a data-only change.
- **`content/` (authoring) separate from `src/content/` (compiler):** non-developers touch only `content/packs/**`; the compiler is code.
- **`packs/` as its own module:** the gate seam is one folder. Nothing else may `fetch` or `import` scenario YAML directly.
- **`session/` is the only mediator:** keeps `core` and `ui` mutually ignorant.

## Architectural Patterns

### Pattern 1: Event-sourced session (state = f(baseline, events))

**What:** Every user action and every scripted change is recorded as a timestamped event. The grader and replay tooling read the log; they do not inspect UI state.
**When to use:** Always here. Grading "order violations" and "harmful actions" is trivial with a log, painful with snapshots.
**Trade-offs:** Slight overhead; large testability win (replays = regression tests for scenarios).

```typescript
type ControlEvent = { t: number; controlId: ControlId; value: ControlValue; source: 'user' | 'scenario' };

function onUserInput(controlId: ControlId, value: ControlValue) {
  const def = registry.get(controlId);
  if (!def.isLegal(value)) return;
  const e = { t: clock.now(), controlId, value, source: 'user' as const };
  log.append(e);
  store.apply(e);            // state updates first
  engine.onControlEvent(e);  // then rules react (may emit scenario events)
}
```

### Pattern 2: Single registry as source of truth

**What:** Control definitions (id, kind, state key, legal values, label, layout position) exist once. PanelView renders from it; the scenario compiler validates YAML against it; the engine normalizes through it.
**When to use:** Always. Prevents the classic drift where the SVG file, TS handlers, and YAML disagree on ids.
**Trade-offs:** Panel is generated from layout data rather than hand-drawn in Inkscape. Recommended anyway: functional panel (not pixel-accurate) is a good fit, and it enables responsive re-layout per breakpoint.

```typescript
type ControlDef =
  | { id: 'sw.master'; kind: 'toggle'; stateKey: 'sw.master'; values: ['off', 'on']; label: 'MASTER' }
  | { id: 'lv.throttle'; kind: 'lever'; stateKey: 'lv.throttle'; range: [0, 100]; detents?: number[]; label: 'THROTTLE' }
  | { id: 'an.oilTempHigh'; kind: 'annunciator'; stateKey: 'an.oilTempHigh'; label: 'OIL TEMP' }
  | { id: 'ind.oilTemp'; kind: 'gauge'; stateKey: 'eng.oilTemp'; range: [100, 260]; redline: 245; label: 'OIL T' };
```

Convention: state keys are namespaced strings (`sw.*`, `lv.*`, `btn.*`, `eng.*`, `an.*`). **Inputs** (user-settable) and **indicators** (scenario-set only) share one flat state but the registry marks which are user-writable; the reducer rejects user writes to indicators.

### Pattern 3: Declarative trigger/effect rules (small closed DSL, no code in YAML)

**What:** Scripted reactions are `when -> then` rules with a fixed vocabulary. This is the "rules engine", but deliberately tiny.
**When to use:** All scripted reactions: temperature falls after correct actions, escalation on timeout or redline.
**Trade-offs:** Authors can't express arbitrary logic. That is a feature: schema-validatable, testable, no `eval`. Add vocabulary only when a real scenario needs it.

Vocabulary (recommended v1):

```yaml
# when: exactly one of
#   at: 30s                      # absolute scenario time
#   after: { action: reduce_power, delay: 10s }   # relative to a graded action
#   state: { key: eng.oilTemp, op: gte, value: 245 }  # condition, edge-triggered
# unless: { action: some_action }               # optional cancel (e.g. escalate unless mitigated)
# once: true (default)
# then: list of effects:
#   - set: { key: an.oilTempHigh, value: true }
#   - ramp: { key: eng.oilTemp, to: 210, over: 40s }   # linear interpolation, engine-ticked
#   - message: "Oil pressure dropping"                 # training-mode display only
#   - end: { outcome: engine_failure }                 # terminates scenario with named outcome
```

### Pattern 4: Action predicates + grouping evaluated over the log (shared matcher)

**What:** An action is a predicate on a control event/state; groups impose ordering semantics; the same matcher runs live (engine, for triggers and training feedback) and post-hoc (grader).
**When to use:** All grading.
**Trade-offs:** Must define semantics precisely up front (see below), otherwise grading disputes arise.

```yaml
actions:
  - id: throttle_idle
    control: lv.throttle
    match: { lte: 10 }          # in-range for levers
    kind: required              # required | optional | forbidden
    group: immediate            # optional group reference
  - id: master_off
    control: sw.master
    match: { eq: off }
    kind: forbidden
    reason: "Loss of all electrics in this phase"
    effects: [ { set: { key: ..., value: ... } } ]   # optional immediate consequence
groups:
  - id: immediate
    mode: ordered               # ordered | unordered
```

Recommended grading semantics (decide once, document in AUTHORING README):

- **Satisfaction = first event at which the predicate became true** (timestamped). Levers/continuous controls emit a *commit* event on release/snap, not on every drag frame; state updates live while dragging but matching happens on commit.
- **Ordered group:** satisfied items must occur in relative order; unrelated actions may interleave. A satisfied item appearing before a predecessor is recorded as an *order violation* (not a miss). Strict "no other action between" is an opt-in flag, not default.
- **Unordered group / ungrouped:** order ignored.
- **Reverted actions:** optionally `holds: true` (default for state-type actions) means the predicate must also hold in the final state, else it is reported "done then undone". Prevents flip-flop gaming and credits correct final configuration.
- **Forbidden:** any matching event = harmful action, with optional timestamp window (`during:`) so an action is only harmful in a given phase.
- **Pass/fail:** all required satisfied (with holds) and no outcome-ending failure; harmful actions and order violations reduce score but severity is scenario-defined.

### Pattern 5: Mode as feedback policy, not as engine branch

**What:** Training and Exam run the identical engine and grader. `feedbackPolicy` decides what the Session Controller forwards to the UI: Training shows the checklist, hints, optional immediate "correct/incorrect" toasts; Exam suppresses all of it and surfaces only the debrief.
**When to use:** Always; avoids divergent behaviors and doubled test surface.
**Trade-offs:** Scripted escalations still occur in both modes (correct; they are part of the scenario, not feedback).

### Pattern 6: Compile-then-run scenarios (two-stage validation)

**What:** Stage 1 structural (Zod schema on parsed YAML). Stage 2 semantic (compiler cross-checks every `control`, value, action id, trigger reference, group membership against the registry; checks reachability, e.g. no `unless` pointing at an unknown action; warns on required actions that no trigger or checklist references).
**When to use:** At build/CI (fail the deploy on any error) and at load (defense in depth).
**Trade-offs:** Slightly more code; eliminates the most likely failure mode for a hand-edited content system (typo in a control id producing an ungradeable scenario).
**Authoring UX:** Generate `scenario.schema.json` from Zod (`z.toJSONSchema`, Zod 4) and reference it via the `# yaml-language-server: $schema=...` comment so VS Code's YAML extension gives autocompletion and inline errors. Use line-aware YAML parsing so compile errors report `file:line`.

### Pattern 7: Displayed checklist is linked to, but separate from, graded actions

**What:** `checklist:` is the human-readable AFM text (step wording, notes, warnings), each step optionally referencing `actions: [ids]`. Graded actions are not derived from display text. A step may map to zero actions (e.g. "Land as soon as possible") or several.
**Why:** AFM wording and machine-checkable predicates differ. Keeps source text faithful (the user enters AFM wording) and grading precise.

### Pattern 8: Gate seam via PackProvider + AccessPolicy (decorator)

**What:** UI and Session only know `PackProvider`. v1 wires `new GatedPackProvider(new StaticPackProvider(), new OpenPolicy())`. Later swap in `LicensePolicy` and an encrypted provider with no changes to UI, engine, or content format.

```typescript
interface PackManifest { id: string; title: string; version: string; scenarioCount: number; access: 'free' | 'licensed'; }
interface PackProvider {
  listPacks(): Promise<PackManifest[]>;                 // metadata always visible (storefront)
  loadPack(id: string): Promise<ScenarioDoc[]>;         // throws AccessDenied if gated
}
interface AccessPolicy { check(pack: PackManifest): Promise<AccessDecision>; } // {granted} | {denied, reason}
```

**Static-hosting reality (important, be honest in later phases):** any client-side check is only a soft gate; a user can read the fetched JSON. Real protection on GitHub Pages is only achievable by shipping **encrypted pack payloads** and releasing the key only to licensees. Recommended future design, with no v1 impact beyond keeping the seam:

- Build step encrypts licensed packs (Web Crypto AES-GCM) to `dist/packs/<id>.enc`; free packs stay plain JSON.
- License = signed token (e.g. Ed25519 signature over `{packIds, issuedTo}`), verified offline with an embedded public key, and/or token carries or derives the pack key. Issued by a payment provider webhook/serverless function later (needs a tiny backend or a merchant that issues keys; deferred).
- Paid scenario YAML must never be committed to the public repo in plaintext. If the repo is public, keep paid content in a private repo/submodule or CI secret and only the ciphertext in `dist`. Decide this before authoring any paid content.
- Because a leaked key unlocks content for everyone, treat this as friction against casual sharing, not DRM; one-time unlock for a niche pilot audience makes that acceptable.

## Data Flow

### Interaction Flow (the hot path)

```
Pointer/touch on SVG control
    ↓
PanelView widget  ──(ControlEvent: id, value)──▶ SessionController
                                                    │ 1. stamp t = clock.now()
                                                    │ 2. registry.validate(value)
                                                    │ 3. EventLog.append
                                                    │ 4. store.apply  ──▶ state subscribers ──▶ PanelView updates widget
                                                    │ 5. engine.onControlEvent
                                                    │       ├─ Action Matcher: mark satisfied/violation/forbidden
                                                    │       └─ triggers (after-action, state-cond) fire effects
                                                    │              └─ effects → store.apply (source: scenario) → UI updates
                                                    │ 6. feedbackPolicy: forward EngineEvents to UI per mode
                                                    └─ 7. if outcome reached → finish()
```

### Time Flow

```
Clock (RAF/interval, paused when tab hidden or modal open)
    ↓ dt
Engine.tick(dt): advance ramps, fire timer triggers, evaluate state-condition triggers
    ↓ effects
store.apply ──▶ UI
```

Scenario time is accumulated `dt` (clamped), never raw `Date.now()` differences; this keeps pauses, backgrounded tabs and tests consistent.

### Scenario Lifecycle

```
Quiz "New situation" (random | selected | by pack)
    ↓
PackProvider.loadPack → ScenarioDoc[] → compile (cached) → CompiledScenario
    ↓
Session.start: store = baseline + scenario.initial overrides; annunciations set; clock reset
    ↓
Running: interaction flow + time flow
    ↓ outcome (all required done & stabilized | scripted end | user "finish")
grade(scenario, log, finalState, outcome) → Debrief
    ↓
Debrief view (missed / order violations / harmful / optional / outcome / timeline) + save to history
```

### Build / Content Flow

```
content/packs/**/*.yaml ──▶ scripts/validate-content.ts (parse → schema → compile vs registry)
        │ fail = CI red, no deploy
        ▼
scripts/build-packs.ts ──▶ dist/packs/<id>.json   (later: .enc for licensed)
        ▼
GitHub Actions (npm ci → validate → vite build → upload dist → deploy Pages)
```

Note: Vite `base` must be `'/<REPO>/'` for project pages; fetch pack JSON using `import.meta.env.BASE_URL` (or import via `import.meta.glob(..., { query: '?url' })`) so URLs survive the sub-path. For v1 simplicity packs may alternatively be bundled with `import.meta.glob('/content/packs/**/*.yaml', { query: '?raw', import: 'default', eager: true })`, but still routed through `PackProvider` so the later switch to lazy/encrypted fetch is contained.

### State Management

```
AircraftState store (flat, keyed)
    ↓ subscribe(key)
Widgets (only repaint on own key)   ◀── ControlEvents ── Input
    ▲
    └── Effects from Engine (set / ramp / annunciate)
```

No global app-state framework needed. Two small stores: AircraftState (core) and a Session/UI view-model store (current view, mode, checklist visibility, latest feedback).

### Key Data Flows

1. **User flips a switch:** widget emits ControlEvent → log → state → engine matching → possible trigger effects → state → widgets repaint.
2. **Timer escalation:** engine tick reaches `at: 120s`; `unless` not satisfied → effects set annunciations, ramp temps, possibly `end: engine_failure`.
3. **Grading:** at end, grader replays log against compiled scenario using the same matcher; output is a serializable Debrief (also stored in history).
4. **Content load:** build-time validation (strict, fail-fast) and load-time compile (fail soft: scenario marked unavailable with error shown in a dev console/banner, rest of pack still works).

## Responsive SVG Panel

- **One SVG, fixed logical coordinate system** (e.g. `viewBox="0 0 1600 900"`), scaled with `width:100%; height:100%` and `preserveAspectRatio="xMidYMid meet"`. Desktop/tablet: fit whole panel.
- **Phone:** whole-panel fit makes controls too small. Define **named regions** in `layout.ts` (e.g. `engine`, `annunciators`, `switches`, `pedestal`, `flight-display`). Navigate by animating the **viewBox** (zoom-to-region via tap on a region minimap / swipe), plus optional pinch-pan. Manipulating `viewBox` (not CSS transform on children) keeps hit-testing correct and crisp.
- **Hit targets:** invisible enlarged hit rects (>= ~44 CSS px after scaling) per control; compute a minimum logical size per zoom level. Dense switch rows are the usual failure on phones.
- **Input:** Pointer Events (unified mouse/touch/pen), `touch-action: none` on lever/drag targets only, so page scroll/pinch still works elsewhere. Distinguish pan gesture from control tap with a movement threshold.
- **Orientation:** portrait phone is a hard case; offer "rotate for best view" hint but make region zoom work in both.
- **Overlay UI (checklist, banner) is HTML over the SVG**, not inside it, so text reflows and remains readable independent of panel zoom.
- **Text in SVG** (gauges, annunciators) uses `font-size` in viewBox units; verify legibility at region zoom, not at full-panel zoom.

## Build Order (dependency-driven)

Dependencies: Registry/State → (Panel renderer) ∥ (Schema/Compiler) → Engine/Grader → Session → UI flows → Content → Gate.

1. **Foundation:** Vite + TS scaffold, lint boundary for `core/` (no DOM), Vitest, GitHub Pages deploy workflow with correct `base`. *Deliver the deployed empty app first so hosting problems surface early.*
2. **Aircraft definition + Control Registry + State store/reducer + EventLog + Clock.** Everything depends on these types; keep the state-key and control-id naming conventions final here.
3. **PanelView (static layout, widgets, responsive scaling, pan/zoom, input → ControlEvent).** Can proceed in parallel with 4-5 since it only needs the registry/state. Result: a playable, free-form panel (a demo even without scenarios). Phone ergonomics get validated early; this is where layout rework risk lives.
4. **Scenario schema + parser + compiler + `validate-content` CLI + PackProvider/AccessPolicy interfaces (OpenPolicy).** Land the gate seam here, not at the end, so nothing is built that bypasses it.
5. **Action Matcher + Scenario Engine + Grader (headless, test-first).** Includes ordered/unordered/forbidden, triggers, timers, ramps. Scenario replay tests (golden path = 100%, do-nothing = fail/escalate, wrong order, forbidden action) run in CI.
6. **Session Controller + feedback policy + UI flows** (quiz start, checklist show/hide, training/exam, debrief, history).
7. **Scenario content:** author Oil Temp High, Electrical Failure, Engine Fire using the real schema; each ships with replay tests and `source` + `disclaimer`. Authoring README. Expect schema revisions here; this is the validation of the DSL.
8. **Polish and hardening:** disclaimer/first-run notice, accessibility pass, device testing (iOS Safari, Android Chrome, tablets).
9. **(Deferred) Gate implementation:** encrypted pack provider, license verification, unlock UI, purchase flow.

Roadmap implications: phases 2-5 contain nearly all architectural risk; panel (3) and engine (5) are independent after (2), allowing parallel work. Schema revisions are expected after (7); do not freeze the schema version for external authors until three real scenarios have been written against it.

## Scaling Considerations

Scale here is content volume and device performance, not users (static site, all computation client-side).

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 3 scenarios, 1 pack (v1) | Bundle or small JSON fetch; no lazy loading needed. |
| 20-100 scenarios, several packs | Per-pack JSON lazy-loaded on demand; manifest index small and cacheable; compile on load and memoize. |
| Many aircraft/variants | Aircraft definition is already data; add `aircraft/<type>` folders and an `aircraftId` field on scenarios/packs. |
| Panel complexity (200+ SVG nodes) | Per-key subscriptions already avoid full repaints; ramps tick at ~10 Hz, not every frame, and widgets skip unchanged values. |

### Scaling Priorities

1. **First bottleneck:** authoring correctness (typos, inconsistent ids) as scenario count grows. Fixed by validation + JSON Schema editor support + replay tests, not by performance work.
2. **Second bottleneck:** phone rendering/touch ergonomics of a dense panel. Fixed by region zoom and larger hit areas; avoid CSS filters/shadows on many SVG nodes (slow on mobile).

## Anti-Patterns

### Anti-Pattern 1: Grading or scripting logic in UI handlers

**What people do:** `onClick` of a switch checks "was this correct?" and mutates other widgets.
**Why it's wrong:** untestable, mode-dependent behavior leaks, order tracking breaks with touch/mouse differences.
**Do this instead:** widgets emit ControlEvents only; Session/engine/grader own meaning.

### Anti-Pattern 2: Hand-drawn monolithic SVG with ids duplicated in code and YAML

**What people do:** Draw the panel in a vector editor; manually hook handlers by element id; write the same ids in scenarios.
**Why it's wrong:** three sources of truth; renames silently break scenarios; responsive re-layout is hard.
**Do this instead:** registry + layout data generates the SVG. (A designer-made SVG can still supply decorative backplates/art that widgets overlay.)

### Anti-Pattern 3: Wall-clock timers scattered through code (`setTimeout` per trigger)

**What people do:** Each scripted reaction schedules its own `setTimeout`.
**Why it's wrong:** cannot pause, cannot test, drifts when tab backgrounded, impossible to replay.
**Do this instead:** one injectable Clock and engine `tick(dt)`; triggers are data evaluated by the engine.

### Anti-Pattern 4: Growing the YAML into a programming language

**What people do:** Add expressions, variables, `eval`, or JS snippets to scenarios "just for one case".
**Why it's wrong:** breaks schema validation and non-developer authoring; security and maintenance cost.
**Do this instead:** small closed vocabulary (Pattern 3); add a new effect/condition type in code when a scenario truly needs it.

### Anti-Pattern 5: Creeping flight model

**What people do:** Add derived physics (oil temp as a function of power, airspeed) to make reactions "realistic".
**Why it's wrong:** scope explosion; unpredictable grading; explicitly out of scope.
**Do this instead:** scripted ramps/steps authored per scenario. `aircraft/derived.ts` holds only invariant couplings (e.g. a lever detent snapping), never time dynamics.

### Anti-Pattern 6: Treating the client-side gate as security

**What people do:** `if (hasLicense)` around fetch of a plaintext paid YAML on a public host and public repo.
**Why it's wrong:** paid content is trivially downloadable; the gate is decoration.
**Do this instead:** keep the seam now (PackProvider/AccessPolicy), plan encrypted payloads and non-public paid-content storage for the gated phase (Pattern 8).

### Anti-Pattern 7: Matching on every drag frame / on DOM state

**What people do:** Emit events continuously from lever drags, or read `element.getAttribute` to know a switch position.
**Why it's wrong:** event log floods with transient positions causing false "harmful" matches; DOM becomes state.
**Do this instead:** commit events on release/detent; state store is the only truth.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Pages | Actions workflow: `npm ci` → validate content → `vite build` → upload `dist` → deploy | Set Vite `base` to `'/<REPO>/'` for project pages; build with `import.meta.env.BASE_URL`-aware URLs. Verified in Vite docs. |
| GitHub Actions (CI) | Run unit tests, scenario replay tests and `validate-content` before deploy | Content errors must fail the build. |
| Payment/license (deferred) | Merchant-issued key or signed token; verified client-side with embedded public key | Needs a webhook/serverless piece or merchant key delivery; keep out of v1. |
| Web Crypto (deferred) | AES-GCM decrypt of licensed packs in browser | Available in all target browsers on HTTPS (GitHub Pages is HTTPS). |
| VS Code YAML extension | `$schema` comment → generated `scenario.schema.json` | Authoring UX for non-developers. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI (PanelView) ↔ Session | `ControlEvent` up; state subscriptions and view-models down | UI imports nothing from `core/scenario`. |
| Session ↔ Core | Direct method calls (engine, store, grader) | Only place both are wired. |
| Engine ↔ Store | Engine emits Effects; reducer applies; engine reads via query | Engine never touches DOM; never calls Date.now. |
| Engine ↔ Grader | Share `matcher.ts` | Prevents live-vs-final grading drift. |
| Content ↔ Registry | Compiler imports registry for xref validation | One-way: registry never imports content. |
| Session/UI ↔ Packs | `PackProvider` only | Lint-enforce: no other module imports scenario YAML or fetches `packs/`. |
| Core ↔ Persistence | None; Session writes history via `persistence/` | Keeps core pure. |

## Open Design Decisions to Resolve in Phase Planning

- **Panel authoring:** fully generated widgets (recommended) vs hybrid with designer SVG backplate. Decide in the panel phase after a phone layout spike.
- **Ordered group strictness default** (relative order vs strict adjacency) and **"holds at end"** default; confirm with the user's reading of how AFM procedures are examined.
- **Exam end condition:** explicit "Done" button vs auto-complete vs time limit. Recommend explicit "Done" plus auto-end on scripted outcomes.
- **Scoring model:** weighted points vs pass/fail with itemized findings. Recommend itemized findings first; numeric score derived and optional.
- **UI chrome framework** (vanilla vs Preact): belongs to STACK.md; the architecture above is agnostic as long as the panel stays imperative and `core/` stays framework-free.

## Sources

- Zod 4 JSON Schema export (`z.toJSONSchema`, closed objects, Draft 2020-12): https://zod.dev/json-schema (HIGH, official docs)
- Vite static deploy / GitHub Pages `base` and Actions workflow: https://vite.dev/guide/static-deploy.html (HIGH, official docs)
- Vite glob imports (`import.meta.glob` with `query: '?raw'` / `'?url'`, `eager`): https://vite.dev/guide/features.html (HIGH, official docs; the exact combination of `query`+`import`+`eager` follows from documented options)
- Event-sourcing / deterministic-simulation / rules-engine structure for part-task trainers: established engineering pattern synthesized from domain knowledge, not a single cited source (MEDIUM)
- Pointer Events, viewBox-based zoom, Web Crypto AES-GCM: standard web platform APIs (MEDIUM-HIGH; verify specifics at implementation time)

---
*Architecture research for: web-based cockpit procedure trainer (DA50 RG)*
*Researched: 2026-10-19*
