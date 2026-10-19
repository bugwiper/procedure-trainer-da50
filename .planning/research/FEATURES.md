# Feature Research

**Domain:** Cockpit procedure / emergency part-task trainer (Diamond DA50 RG, 2D web panel, YAML-authored scenarios)
**Researched:** 2026-10-19
**Confidence:** MEDIUM. The competitor landscape is verified from app-store listings and trade press, which are marketing copy and silent on grading internals. The grading, escalation and debrief models are synthesized from part-task-trainer literature plus domain reasoning. Treat them as well-reasoned recommendations, not market-verified facts. Validate the grading taxonomy with one DA50 instructor before locking the schema.

## Competitive Landscape (what actually exists)

There is no dedicated DA50 RG procedure trainer. The DA50 RG exists in MSFS (Skyward Simulations add-on) and Diamond's own FSTDs cover the DA40/DA42, not the DA50. The nearest products are:

| Product | Format | Modes | Emergencies | Grading / feedback | Pricing |
|---------|--------|-------|-------------|--------------------|---------|
| VRflow (DA40 NG, C172S G1000, B737NG, C152; VRpilot) | 3D cockpit, iPad/PC/VR | Explore, Training, Exam (with or without help), "Hit Me" random emergency | "Selected" emergency procedures, paid tier | Exam confirms correct input (buttons light green when pressed correctly, v1.02 notes); post-procedure evaluation, but no public detail on points, pass marks or order handling | Free demo (1 normal procedure); subscription about $11.99/mo (DA40) |
| Learrocket / Aviation eLearning (737NG, 787, ATR 72, Global Express, A320 memory items) | 2D panel "poster" with moving buttons and sounds, iOS | Learn/Practice (step-by-step guided) and Test (unguided) | Flows and memory items | Listings do not describe error feedback or scoring | $19.99-$24.99 one-time, per aircraft |
| Cirrus Go (SR20/22/22T) | iPhone reference/trainer | n/a | Procedure checklists, real-world emergency scenarios, decision-making exercises, ACS-aligned lessons | Not a panel simulator | Free |
| GoCanvas SR20/SR22 EP, Cirrus iFOM | Static checklists / interactive manual | n/a | Yes, read-only | None | n/a |
| MSFS DA50RG add-on (Skyward) | Full flight sim | n/a | Avionics-bus loss modeled; user self-assesses | None | Paid add-on |

Key takeaways:
1. The market splits into read-only checklists and full simulators. An operate-the-panel trainer with objective grading is a narrow gap, and only VRflow sits near it (subscription, DA40 not DA50).
2. Training vs Exam (guided vs unguided) is universal, so it is table stakes. Nobody publicly documents partial-order, forbidden-action or escalation grading, so that is where this project can differentiate.
3. Pricing norms are $20-25 one-time or about $12/mo. A free v1 with later one-time pack unlock is consistent with the market.
4. Every listing carries a "not for operational use / study aid" disclaimer (matches the project's safety/legal constraint).
5. Learrocket lets users create their own flows, so authorable content has precedent. The project's schema-validated YAML is a stronger version of it.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the product feel like a toy or a PDF.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive panel with discrete, tappable controls (switches, guarded switches, levers with detents, push buttons, rotary knobs) | Core promise: "operate the panel". Learrocket and VRflow both do this | MEDIUM | Model each control as a discrete state machine (e.g. mixture: RICH / LEAN / CUTOFF). Levers on touch need tap-to-cycle or drag-to-detent. Mouse and touch both required |
| Guarded / confirm-to-actuate controls (fuel shutoff, fire handle, battery master) | Accidental taps on phone would trigger "forbidden action" penalties and ruin trust | LOW | Guard cover flip, or press-and-hold. Cheap, and it prevents false positives on touch devices |
| Annunciator and alert area (G1000-style CAS messages with caution/warning colors, flashing until acknowledged, master caution/warning, aural chime) | The scenario trigger ("OIL TEMP HIGH") must look like the real thing | MEDIUM | Functional, not pixel-accurate. Acknowledge via alert button is part of real handling. Aural alert is cheap with WebAudio, and needs a user-gesture unlock on iOS |
| Gauges and engine data readouts that respond to state (oil temp/pressure, EGT/CHT, volts/amps, fuel) | A trainer whose gauges do not move after actions gives no feedback loop | MEDIUM | Driven by scenario-scripted values and ramps, not physics |
| Scenario start flow: random ("hit me") and selected scenario list, with a short situation briefing (phase of flight, altitude, conditions) | Every quiz-style trainer has it. Without a flight model, the briefing text carries the context | LOW | Briefing must state assumptions ("cruise, VMC, over open terrain") so the pilot can choose between actions |
| Training mode: checklist visible, next-step highlight, hint on demand | Guided practice is the universal first mode (Practice/Learn/Training) | MEDIUM | Same scenario engine as Exam, only the presentation layer differs |
| Exam mode: no checklist, no hints, no live feedback; graded at the end | Universal "Test/Exam" counterpart | LOW-MEDIUM | Needs an explicit "Procedure complete" declaration (see Differentiators) |
| Checklist show/hide | Stated requirement. Real flows are used with and without the paper checklist | LOW | Hidden by default in Exam |
| End-of-scenario debrief with per-item verdicts | Without it there is no "objective feedback" (core value) | MEDIUM | See "How grading, escalation and debrief are typically done" below |
| Non-panel / verbal actions for emergencies (declare MAYDAY, squawk 7700, select landing site, brief passengers, "confirm with PNF") | Real emergency checklists contain actions that are not control movements. Without them, procedures cannot be modeled faithfully | MEDIUM | Provide a small fixed "Actions" palette (button list) whose items are first-class gradable actions. Model radio/transponder as simple buttons, not a working radio stack |
| Restart / retry the same scenario, and next scenario | Success metric is repeat attempts to improve | LOW | Retry should reset all state deterministically |
| Source and disclaimer per scenario and a global "training aid, not a substitute for AFM or instructor" notice | Universal in the category, and a liability requirement in PROJECT.md | LOW | Shown in the briefing and in the debrief |
| Responsive layout: scaled SVG panel, pan/zoom on phone, touch targets of 44px or more | Stated requirement. Competitors are mostly tablet-only | MEDIUM-HIGH | The hardest table-stakes item. Plan zoomable regions (engine / flight display / switch panel) rather than shrinking everything. Phone portrait may need a region-focused view |
| Pause / resume (and clean abort) | Real users get interrupted, and timers must not keep running | LOW | Engine clock must be pausable (injectable clock) |

### Differentiators (Competitive Advantage)

Align with the core value: objective feedback on AFM-correct performance.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rich action grading: required, optional, ordered, unordered, forbidden/harmful (see taxonomy below) | No competitor publicly documents this. It is what makes feedback objective rather than "you tapped the right things" | HIGH | The central engine feature. Declarative in YAML, evaluated against an event log |
| Scripted failure escalation (timers and action triggers) with outcomes | Turns a checklist quiz into an emergency drill. Ignoring or botching the procedure has consequences, such as oil temp climbing until engine failure | HIGH | Declarative reaction rules: `when` (action / state / elapsed) then `do` (set value, ramp, raise annunciation, end scenario with outcome). Must be deterministic and testable |
| Harmful actions with visible consequences, not only a penalty (e.g. shutting down the wrong engine control triggers a worse failure) | Teaches why the error matters. Matches the Dutch Safety Board lesson that partial-failure handling needs realistic training | MEDIUM (once reactions exist) | Same reaction mechanism, triggered by a forbidden action |
| YAML scenario authoring with JSON-Schema validation, readable error messages, and an authoring guide | Content extensibility is a stated core design driver. Competitors ship closed content, with Learrocket only offering simple custom flows | MEDIUM | Good errors (path + line + suggestion) matter more than schema cleverness. Ship a `validate` CLI and run it in CI |
| Reference-solution replay test for each scenario (author supplies the golden action sequence, CI verifies it grades 100% and a do-nothing run fails) | Catches authoring mistakes, which is the main risk when non-developers write scenarios | MEDIUM | Reuses the engine headless. Cheap once the engine is pure TS |
| Debrief timeline: what you did vs what was expected, with timestamps, the state at the time, and the AFM reference text/step ID | Debrief is where learning happens. Most competitor listings show no detail | MEDIUM | Interleave user actions, scripted events and annunciations on one timeline. Show "why it matters" notes per item (author-supplied) |
| Outcome-based grading in addition to step-based (recovered / degraded / engine failed / timeout) | Mirrors real consequences. Pass/fail on safety-critical items, not a percentage alone | MEDIUM | Scenario declares critical items. Missing any critical item or a harmful action means FAIL regardless of percentage |
| Time-aware items: immediate (memory) actions with a deadline, and time-to-first-action reported | Emergency procedures split into memory items and checklist items. Engine fire and loss of power are time-critical | MEDIUM | Optional `within_s` per action. Report the time, and penalize only when authors set a deadline |
| Local progress history (localStorage): best score per scenario, attempt count, recurring misses ("you often forget the fuel pump") | Success metric is repeat attempts. History makes improvement visible with no backend | MEDIUM | Export/import as JSON for portability. Skip server sync |
| Scenario variants (author-defined parameters: which temperature, which phase of flight, which fail branch) | Prevents memorizing "scenario 2 = do X" and tests recognition, not recall | MEDIUM | Only after the base engine. Seeded randomness for reproducible bug reports |
| Free, no install, no account, works offline (PWA service worker) | Competitors are paid per aircraft or by subscription ($12/mo to $25 each) and iOS-only | LOW-MEDIUM | PWA caching on GitHub Pages is cheap. Cache-bust on scenario updates |
| Gate-ready scenario pack abstraction | Stated architecture driver for the later one-time unlock | MEDIUM | An `AccessPolicy` interface with an "allow all" v1 implementation. Pack manifests with id/title/entitlement. Do not build licensing now |
| "Declare complete" step plus optional end-of-scenario self-debrief prompts ("Where would you land?") | Exam mode is silent, so the engine needs to know when the pilot thinks they are done. Decision prompts add the airmanship dimension Cirrus Go uses | LOW | The declaration itself is table stakes for Exam mode. Decision prompts are optional |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Flight model / physics, autopilot behavior, outside view | "Make it feel real" | Already out of scope. Huge effort, yields debatable fidelity, and distracts from procedure correctness | Scripted state changes with phase-of-flight briefing text |
| Pixel-accurate G1000 NXi replica | Authenticity | IP and effort, and it does not improve procedure learning | Functional layout with the same annunciation texts and colors |
| Bundling AFM text or checklists in the repo/product | "Pre-filled content saves time" | Copyright and liability sit with the user. Errors would be our liability | Empty/example scenario files with `source` and `disclaimer` fields. The user enters AFM-derived steps |
| Single opaque numeric score or gamification (XP, streaks, leaderboards) | Engagement | A percentage hides critical errors (95% with a missed fire shutoff is a fail). Leaderboards need a backend and encourage gaming | Verdict list plus critical-item PASS/FAIL, with personal best history locally |
| Penalizing every unrelated control touch | Seems strict | Exploring the panel is normal and the phone has stray taps. It produces noisy, unfair debriefs | Penalize only declared forbidden actions. Report neutral extra actions in a collapsed "other actions" list |
| User accounts, cloud sync, leaderboards, payments in v1 | "Needed for monetization" | Needs a backend, and GitHub Pages is static. Deferred by decision | LocalStorage history, abstracted access layer for later |
| Live AI/LLM-generated scenarios or procedure text | Novelty | Hallucinated procedures are dangerous in a safety-critical domain and unverifiable against the AFM | Human-authored, schema-validated YAML only |
| Voice recognition for callouts and ATC radio simulation | Realism | Large effort, flaky on mobile, and off-topic for the procedure | Button-based "Actions" palette (declare MAYDAY, squawk 7700) |
| Normal-procedure (full flight) coverage in v1 | VRflow includes normal flows | Dilutes the emergency-first value, multiplies content work | Leave to a later pack. The engine supports it, since it is just checklists without escalation |
| Multi-language UI/content | Reach | Annunciations and AFM are English. Translation is a content-accuracy risk | English only, as decided |
| Training-device certification claims (BATD/FSTD wording) | Credibility | Legally misleading, since it is not an approved device | Clear "study aid" wording, as the whole category does |
| Time-pressure as a headline score (speed bonus) | Makes it feel like an emergency | Teaches rushing and skipping, which is the wrong habit for an emergency | Report time as information. Deadlines apply only to real memory items where the AFM implies urgency |
| Visual editor / in-app scenario builder | Easier for non-developers | Large UI effort and a second source of truth | YAML plus validation CLI plus good error messages. Revisit if authors struggle |

## How Grading, Escalation and Debrief Are Typically Done

Category products (Learrocket, VRflow) publish almost nothing about grading. The model below follows part-task-trainer practice: critical "must-do" items versus "should-do" items, rigid ordering where the real procedure demands it, automatic scoring with feedback (SAE 912100), and teaching against the same checklist used to grade. It is a synthesized recommendation (MEDIUM confidence).

### Action grading taxonomy

| Action class | Meaning | Scoring effect | Notes |
|--------------|---------|----------------|-------|
| Required (critical) | AFM step whose omission is unsafe | Missing = scenario FAIL | Mark with `critical: true` |
| Required (standard) | AFM step that must be done | Missing = counted miss, no auto-fail | Default |
| Optional | Good practice or situational (e.g. "brief passengers") | Credit if done, no penalty if missed | Shown in the debrief as "bonus" |
| Ordered group | A set of steps whose relative order matters (e.g. fire: throttle idle, mixture cut-off, fuel shutoff) | Order violation reported per pair or step, separate from "missed" | Prefer partial order (`after: [id...]`) over only linear sequences, so interchangeable steps stay unordered |
| Unordered set | Steps that must all happen, in any order | Missed only | The default inside a group |
| Forbidden / harmful | Action that worsens the situation, or is wrong for this scenario | Reported as harmful, may set FAIL, and may trigger a scripted reaction | Optionally scoped: "forbidden before step X" or "forbidden while condition C" |
| Conditional | Required only if a state holds (e.g. "if no relight, then X") | Required only when the guard is true at evaluation time | Needed to model branching AFM checklists. Keep guards as simple state predicates |
| Time-bound | Required within N seconds of the trigger | Late = flagged, may be treated as a miss if the author says so | Memory (immediate) items |

Implementation conventions that avoid common grading bugs:

- **Evaluate state, not clicks.** Define a step as "control X reaches state S" (e.g. mixture reaches CUTOFF), not "button pressed". Switching in either direction, and pressing something already in the right state, must be handled.
- **Record first-satisfied timestamp** per step and keep the full event log. Order is judged on first satisfaction. Decide and document how a later undo is treated: usually the final state also matters for "required end state" checks, so support an optional `end_state` assertion.
- **Separate three verdicts per step**: done correctly, done out of order, not done. The debrief needs all three.
- **Neutral actions are ignored** unless declared forbidden.
- **Grade against the world state at the time of the action**, since scripted reactions change what is legal.
- **Scenario-level result**: PASS only if all critical items are done, no harmful-fatal action occurred, and the outcome was not a scripted failure. The percentage is secondary.

### Scripted failure escalation

Done in comparable training software as a small rule engine over scenario time. Recommended shape:

- **Triggers**: elapsed time since scenario start or since another event, an action satisfied (or not satisfied by a deadline), a state predicate (oil temp above X), or a forbidden action performed.
- **Effects**: set a control or gauge value, start a ramp (value moves to a target over T seconds, linear or eased), raise or clear an annunciation, flip an annunciator color level, play a sound, end the scenario with a named outcome.
- **Typical pattern**: a recoverable stage. Gauge climbs, the pilot performs the corrective actions, and the ramp reverses (temperature falls). If not, the escalation stage fires: caution becomes warning, then engine failure and a terminal outcome. Allow stages, such as "caution 0-60 s, then warning, then failure at 120 s".
- **Determinism**: no wall-clock reads inside the engine (injectable clock, fixed seed), so replay and CI golden-solution tests are reliable.
- **Pause-safe** and **restart-safe**.
- **Guard against unwinnable scenarios** with the reference-solution test (the golden run must reach the success outcome).

### Debrief scoring

Recommended debrief contents, in priority order:

1. Overall result (PASS / FAIL / PASS with notes) with the reason ("critical step missed: fuel selector OFF").
2. Outcome of the scripted scenario (recovered, engine failed, timed out).
3. Per-step list, each with a verdict (done / out of order / missed / harmful), the AFM step reference, and an author-supplied "why this matters" note.
4. Order violations, shown as "expected A before B, you did B then A".
5. Harmful actions with their consequence.
6. Optional actions done.
7. Time to first required action, and total time (informational only).
8. Timeline view of user actions, scripted events, and annunciations.
9. Actions: Retry, Next scenario, and (in Exam mode) "Review in Training mode".

Keep one numeric score at most (percentage of required items done) beside, not instead of, the PASS/FAIL verdict.

### Training vs Exam mode

| Aspect | Training | Exam |
|--------|----------|------|
| Checklist | Visible by default, next step highlighted | Hidden |
| Hints | On demand (reveal next step, reveal why) | None |
| Feedback on actions | Optional immediate right/wrong cue (VRflow-style green confirmation), with an undo for mistakes | None. Silent |
| Escalation timers | Optionally slowed or paused until the first action (configurable per scenario) | Run at full pace |
| Completion | Auto-detected when required steps are done | Pilot presses "Procedure complete" (or timeout or terminal outcome) |
| Debrief | Same engine and same debrief, tagged "Training" | Debrief, with attempt stored in history |
| Retry | Unlimited | Unlimited, but flagged as a separate result |

Both modes must run on one engine. The mode flag must only change the presentation and the completion rule, never the grading, or results stop being comparable.

## Feature Dependencies

```
Panel control state model (discrete controls, guards)
    └──requires──> Simulated aircraft state store (controls + gauge values + annunciations)
                       ├──requires──> Injectable clock / pausable scenario time
                       └──enables───> Scenario engine
                                          ├──requires──> YAML schema + validator + loader
                                          ├──requires──> Action matcher (state-based, event log)
                                          │                  └──enables──> Grading (required/optional/ordered/forbidden/time-bound)
                                          │                                    └──enables──> Debrief (verdicts, timeline)
                                          └──requires──> Reaction rules (triggers + effects + ramps)
                                                             └──enables──> Escalation, harmful-action consequences

Annunciator/alert area + aural alerts ──requires──> Aircraft state store
Non-panel "Actions" palette ──enhances──> Action matcher (verbal/decision steps)
Training/Exam modes ──requires──> Scenario engine + Debrief (same engine, different presentation)
Checklist show/hide ──requires──> Checklist model derived from scenario YAML
Progress history (localStorage) ──requires──> Debrief result record
Reference-solution replay tests ──requires──> Headless scenario engine
Scenario variants ──enhances──> Scenario engine (after base is stable)
Access-check (gate-ready) ──wraps──> Scenario pack loader
Responsive panel scaling ──enhances──> Panel control state model (touch targets, guards)
PWA offline ──enhances──> Static hosting, scenario pack loader (cache strategy)
```

### Dependency Notes

- **Grading requires a state-based action matcher:** the matcher must exist before grading rules, and the YAML schema must be designed around it. Schema design is the highest-leverage early decision, and changing it later breaks authored content.
- **Escalation requires reaction rules and an injectable clock:** a hard-coded wall clock makes escalation and golden tests untestable.
- **Debrief requires the event log:** log everything (user actions, state changes, scripted events) from day one, since the debrief timeline and history depend on it.
- **Training and Exam share one engine:** do not fork mode logic into two code paths.
- **Non-panel actions require a palette in the UI and a matching step type in the schema:** needed before the Engine Fire scenario can be faithful (mayday call, landing site decision).
- **Gate-ready packs wrap the pack loader:** introduce the pack manifest and `AccessPolicy` before there are many scenarios, so the paid-pack boundary does not require a refactor.
- **Responsive scaling conflicts with fixed-pixel hit targets:** design hit areas and guards for touch from the start.
- **Time-pressure scoring conflicts with the "no rushing" principle:** keep deadlines opt-in per step.

## MVP Definition

### Launch With (v1)

- [ ] Panel with discrete controls (switches, guarded switches, levers, buttons), annunciator area, key gauges, touch and mouse, responsive scaling
- [ ] Aircraft state store and injectable pausable clock
- [ ] YAML scenario schema, validator and loader, including source and disclaimer fields
- [ ] Action grading: required (critical/standard), optional, ordered/unordered groups, forbidden
- [ ] Reaction rules: timers, action/state triggers, set/ramp value, raise annunciation, terminal outcome
- [ ] Non-panel actions palette (Mayday, squawk 7700, landing-site decision, etc.)
- [ ] Training mode (checklist, next-step highlight, hint) and Exam mode (silent, "Procedure complete")
- [ ] Debrief with PASS/FAIL, per-step verdicts, order violations, harmful actions, optional actions, outcome
- [ ] Scenario selection and random "new situation" flow; retry; pause
- [ ] Initial pack: Oil Temp High, Electrical Failure, Engine Fire
- [ ] Disclaimer ("training aid, not a substitute for AFM or instructor")
- [ ] Pack manifest plus allow-all `AccessPolicy` (gate-ready seam)
- [ ] Static deploy to GitHub Pages

### Add After Validation (v1.x)

- [ ] Local progress history and recurring-miss summary (after users repeat scenarios)
- [ ] Debrief timeline view (after the base debrief is validated)
- [ ] Reference-solution replay tests and `validate` CLI in CI (as soon as the second author, or the third scenario, appears)
- [ ] PWA/offline (once the asset set is stable)
- [ ] Conditional steps (when a scenario needs AFM branching)
- [ ] Time-bound (memory item) deadlines and time-to-first-action reporting
- [ ] Scenario variants with seeded randomization

### Future Consideration (v2+)

- [ ] Additional scenario packs and the real unlock (license key or purchase), needing a minimal backend or a signed-key scheme
- [ ] Partial engine failure / reduced power scenario (motivated by the Dutch Safety Board DA50 RG report recommending it in routine training)
- [ ] Normal-procedure flows and checklists
- [ ] Visual scenario editor (only if YAML authoring proves a barrier)
- [ ] Instructor features such as shareable result links (needs a backend)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Interactive discrete-control panel and state store | HIGH | MEDIUM | P1 |
| Annunciators and aural alerts | HIGH | MEDIUM | P1 |
| Scenario YAML schema and validator | HIGH | MEDIUM | P1 |
| Action grading (required/optional/ordered/forbidden) | HIGH | HIGH | P1 |
| Scripted escalation and reaction rules | HIGH | HIGH | P1 |
| Training and Exam modes | HIGH | MEDIUM | P1 |
| Debrief with per-step verdicts | HIGH | MEDIUM | P1 |
| Non-panel actions palette | HIGH | MEDIUM | P1 |
| Responsive scaling / phone support | HIGH | MEDIUM-HIGH | P1 |
| Guarded switches (touch-safety) | MEDIUM | LOW | P1 |
| Pause / retry / random scenario | MEDIUM | LOW | P1 |
| Gate-ready pack seam | MEDIUM (strategic) | LOW-MEDIUM | P1 |
| Debrief timeline | MEDIUM | MEDIUM | P2 |
| Local history and recurring-miss summary | MEDIUM | MEDIUM | P2 |
| Reference-solution replay tests / validate CLI | MEDIUM (content quality) | MEDIUM | P2 |
| Time-bound items | MEDIUM | MEDIUM | P2 |
| Conditional steps | MEDIUM | MEDIUM | P2 |
| PWA/offline | MEDIUM | LOW-MEDIUM | P2 |
| Scenario variants | MEDIUM | MEDIUM | P3 |
| Visual scenario editor | LOW | HIGH | P3 |
| Normal-procedure flows | MEDIUM | MEDIUM per pack | P3 |

**Priority key:** P1 must have for launch. P2 should have, add when possible. P3 nice to have, future consideration.

## Competitor Feature Analysis

| Feature | VRflow | Learrocket / Aviation eLearning | Cirrus Go / checklists | Our Approach |
|---------|--------|----------------------------------|------------------------|--------------|
| Operate-the-panel interaction | Yes (3D) | Yes (2D poster with sounds) | No | Yes (2D SVG, touch-first, responsive) |
| Guided vs unguided modes | Training / Exam (with or without help) | Practice-Learn / Test | n/a | Training / Exam |
| Emergency procedures | Selected, paid tier, "Hit Me" random | Flows and memory items | Checklists and scenario text | Core focus, scripted scenarios |
| Scripted escalation / consequences | Not documented | Not documented | Not documented | Declarative reaction rules (differentiator) |
| Order and forbidden-action grading | Not documented | Not documented | n/a | Explicit taxonomy (differentiator) |
| Debrief detail | Post-procedure evaluation, details unpublished | Not described | n/a | Verdicts, timeline, AFM references |
| Custom / extendable content | "Customizable per operator" (B2B) | User-built flows | n/a | Schema-validated YAML, open authoring |
| Platform | iPad / PC / VR | iOS | iPhone | Any browser (desktop, tablet, phone), offline |
| Price | About $12/mo | $20-25 one-time | Free | Free v1, later one-time pack unlock |
| DA50 RG coverage | None (DA40 only) | None | None | Yes |

## Sources

- [Global Express Trainer, App Store listing](https://apps.apple.com/us/app/-/id1199481708): Practice/Test modes, custom flows, not for operational use (MEDIUM, vendor marketing)
- [737ng Flow & Emergency Trainer, App Store](https://apps.apple.com/us/app/-/id1071451172), [787 Flow & Emergency Trainer](https://apps.apple.com/us/app/-/id1031040636), [ATR 72-600 Flow Trainer](https://apps.apple.com/us/app/-/id1274702684): moving buttons and sounds, pricing $19.99-$24.99 (MEDIUM)
- [VRflow DA40, App Store](https://apps.apple.com/app/id6444026708) and [VRflow C172S G1000](https://apps.apple.com/py/app/id6458547102): Explore/Training/Exam modes, green confirmation in exam, selected emergencies, subscription pricing (MEDIUM). Per search summaries and the version-history snippet, since direct fetches of some listings were rate-limited
- [Halldale: Interactive VR Cockpit Procedure Trainer (VRflow)](https://www.halldale.com/articles/16450-interactive-virtual-reality-cockpit-procedure-trainer): "Hit Me" random emergency, Exam with or without help, evaluation after each procedure (MEDIUM, April 2020, early version)
- [Cirrus Go, App Store](https://apps.apple.com/us/app/-/id6751808976): ACS-aligned scenarios and decision-making exercises (MEDIUM, listing partly inconsistent)
- [Skyward Simulations DA50RG review, Threshold](https://thresholdx.net/da50rg/): avionics-bus loss modeled in MSFS (MEDIUM)
- [Dutch Safety Board: partial engine failure in pilot training](https://onderzoeksraad.nl/en/include-partial-engine-failure-as-standard-in-pilot-training/): DA50 RG accident and training recommendation (MEDIUM-HIGH, official body, found via search snippet)
- [SAE 912100, Computer-Based Procedural Training](https://saemobilus.sae.org/papers/computer-based-procedural-training-912100): ideal part-task trainer gives feedback and scores automatically, and rigid order practice transfers to the aircraft (MEDIUM, 1991, abstract only)
- Part-task trainer checklist practice (critical "must-do" vs "should-do" items, teach against the grading checklist), via search results from medical and military simulation literature (LOW-MEDIUM, cross-domain analogy)
- Grading taxonomy, escalation rule-engine shape, and mode-parity rule: author synthesis from the above plus general instructional-design practice (LOW-MEDIUM, needs instructor validation)

## Gaps

- No competitor publishes grading internals, so the "differentiator" claims rest on absence of documentation, not on tested products. Trying VRflow's free demo would confirm what its evaluation reports.
- Exact DA50 RG AFM emergency procedures, CAS message texts and control inventory are not covered here. The user supplies AFM content. The panel-control inventory should be derived from the DA50 RG POH/AFM during the panel phase.
- Whether DA50 instructors expect memory-item/immediate-action deadlines (time-bound items) in the initial pack is unconfirmed.

---
*Feature research for: cockpit procedure / emergency part-task trainer (DA50 RG)*
*Researched: 2026-10-19*
