# Roadmap: DA50 RG Procedure Trainer

## Overview

The journey runs in vertical slices, each of which ends with something a pilot can use. First a deployed, playable panel on every device, with the content-policy decision made before any procedure text exists. Then one real emergency (Oil Temp High) runs end to end, from "new situation" through operating the panel to an objective PASS/FAIL debrief. Next the scenarios come alive: scripted reactions, escalation, and the full initial pack of three emergencies. Then the learning loop (Training mode, non-panel "Further actions", retry) and the authoring guide. Finally the app becomes an installable, offline-capable PWA, checked on real devices. The core value (operate the panel, get accurate feedback on the AFM procedure) is demonstrable from Phase 2 onward.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Deployed Playable Panel** - Live GitHub Pages site where a responsive DA50 panel can be operated by mouse or touch; content policy decided (completed 2026-10-20)
- [ ] **Phase 01.1: Panel shape, controls and indicator lights** (INSERTED) - Real panel outline, every switch, rocker, button and lever at its real position, working gear and flap lights, zoom fixes
- [ ] **Phase 01.2: Circuit breakers, G1000 NXi shapes and avionics panels** (INSERTED) - All circuit breakers, G1000 NXi PFD and MFD with softkeys, audio and autopilot panels, backup EFIS
- [ ] **Phase 2: First Gradable Scenario** - Oil Temp High runs end to end: start, briefing, operate the panel, "Procedure complete", PASS/FAIL debrief
- [ ] **Phase 3: Reactive Scenarios and Initial Pack** - Scripted reactions and escalation; Oil Temp High, Electrical Failure and Engine Fire all playable
- [ ] **Phase 4: Training Mode, Further Actions and Repeat Loop** - Checklist and hints, non-panel decisions, retry/next, and the authoring guide
- [ ] **Phase 5: Offline PWA and Real-Device Hardening** - Installable, offline-capable app verified on real phones, tablets and desktop

## Phase Details

### Phase 1: Deployed Playable Panel

**Goal**: Users can open the deployed site on desktop, tablet or phone and operate a DA50 RG panel (switches, guarded switches, levers, buttons) by mouse or touch.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PLT-01, CNT-03, PNL-01, PNL-02, PNL-05, PNL-06, PNL-08, PNL-09
**Success Criteria** (what must be TRUE):
  1. A push to main deploys the app through GitHub Actions to a public GitHub Pages URL that loads correctly at its subpath, and the build takes its base path from the environment so the same build works on another host.
  2. User opens the site on a desktop, a tablet and a phone and sees the whole panel scaled to fit with no horizontal page scroll; the panel regions (e.g. PFD, engine page, switch bank, pedestal) exist as data, not hard-coded layout.
  3. User can flip switches, lift a guard before actuating a guarded switch, step levers (POWER, flaps, gear, cowl flap; the DA50 RG has a single power lever and no prop lever, per D-05a) between detents and press buttons by mouse or touch (including real iOS Safari and Android), and every control visibly shows its new state; each control comes from the control registry with a stable id and can only reach its defined legal states.
  4. Controls with safety consequences are guarded or require confirmation, and tapping or clicking neutral panel areas changes nothing and produces no control event that could ever be graded.
  5. A written content policy for AFM-derived text (paraphrased vs verbatim, public vs private repo) is in the repo before any procedure text is committed.
  6. The panel layout matches the real DA50 RG: every control sits where it is in the aircraft (relative position and grouping, incl. under-panel controls), and on a phone the user can zoom into any region to operate its controls at full tap size without the layout changing.

**Plans:** 9/9 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Walking skeleton shell: pinned toolchain, panel stage served at the Pages subpath on every device project, engine purity lint (wave 1)
- [x] 01-02-PLAN.md — Content policy for AFM-derived text with the owner-decided verbatim limit, linked from README (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-03-PLAN.md — Registry-driven panel: ENGINE MASTER and MFD PAGE through the pure store; all plain toggles at their real positions with in-flight defaults; layout gate with the reference ordering table (PNL-08) (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-04-PLAN.md — CI and Deploy workflow, public repository, skeleton live on GitHub Pages (wave 3)
- [x] 01-05-PLAN.md — Levers at their real positions: pedestal POWER (0-100 %) and COWL FLAP, front-panel GEAR and FLAPS, under-panel ALTERNATE STATIC, EMERGENCY GEAR EXTENSION (drag-only), ALTERNATE AIR (wave 3)
- [x] 01-06-PLAN.md — PFD and two-page MFD frames, B612 fonts, About/content policy in app, responsive layout and rotate hint (wave 3)
- [x] 01-08-PLAN.md — Registry and store contract pinned test-first for every control kind, incl. the guard interlock (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-09-PLAN.md — Region zoom on all devices (PNL-09, D-21): region tap or click, pinch, pan, Full panel; every control reaches 44 px when zoomed; gestures never emit control events or hijack lever drags (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-07-PLAN.md — Guarded de-ice ALTERNATE switch, ENGINE START and FADEC TEST buttons, neutral-area guarantee, final publish and real-device UAT (wave 5)

**UI hint**: yes

### Phase 01.1: Panel shape, controls and indicator lights (INSERTED)

**Goal**: The panel looks like the real DA50 RG: instrument panel outline, centre console, and every switch, rocker, push button, lever and knob at its real position in kind-of real shape and real colour. Light switches are movable; the gear and flap lights work. Brand marks are replaced (GARMIN becomes GO-AROUND, DIAMOND becomes RUBIN, DA50RG stays). The two zoom usability findings from the Phase 1 UAT are fixed. Every later phase builds on this settled layout.
**Depends on**: Phase 1
**Requirements**: PNL-10, PNL-11, PNL-14, PNL-15
**Success Criteria** (what must be TRUE):
  1. The panel outline, centre console and under-panel areas match the real DA50 RG, with all switches, rockers, push buttons, levers and knobs at their real positions, in kind-of real shape and real colour (ELECT. MASTER big red rocker, ELT small red rocker, ESS BUS white rocker, light switches white).
  2. Every switch and lever works by mouse or touch with state shown by position plus text; the light rockers move.
  3. The gear indicator has three separate green lights (each green or off; all three green means down and locked) and a separate red light (red or off; on for unsafe or in transition); all off means up and locked. The flap lights follow flap state. Transition timing is Phase 3.
  4. A single click or tap never zooms; a double click or double tap zooms in and, while zoomed, fully out, on the panel background and on a latching control (the first tap actuates, the recognised pair retracts it, so the control stays unchanged; momentary and drag controls stay two presses); a press that moves or gains a second finger pans or pinches; the "Full panel" button is never hidden behind the footer and never covers a control.
  5. Brand marks read GO-AROUND, RUBIN and DA50RG; the layout reference tests pass and the live site serves the result.

**Plans:** 40/40 plans executed (12 gap-closure plans 12 to 23 planned from the owner first-render review; 8 more gap-closure plans 24 to 31 planned from the owner live-site review, round 2, executed on the phase 01.2 branch; plan 32 was a quick fix of two WebKit findings without a plan file; 9 more gap-closure plans 33 to 41 planned from the owner live-site review, round 3 (R3 findings), executed on the phase 01.2 branch)

Plans:
**Wave 1**
- [x] 01.1-01-PLAN.md — 2000 x 1300 coordinate space, 18 regions, existing controls at UI-SPEC positions, glareshield light switches, buttons family file, shared layout reference for 42 controls and 7 lamps
- [x] 01.1-02-PLAN.md — Panel shell art, GO-AROUND / RUBIN / DA50RG brand marks and gates, glass-digit font snap, per-worktree Playwright port

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01.1-03-PLAN.md — Rotary kind (FUEL TRANS, INSTRUMENT LIGHT, FLOOD LIGHT, FAN) and the registry skin vocabulary
- [x] 01.1-04-PLAN.md — Derived gear and flap indicator lamps (three green plus red UNSAFE, flap lamps) with readouts
- [x] 01.1-05-PLAN.md — De-ice panel, LEVEL, environmental-control sliders and parking brake with existing kinds

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01.1-06-PLAN.md — Push-button skins, STALL TEST / GEAR TEST spring toggle, inventory completeness gate
- [x] 01.1-07-PLAN.md — Single tap zooms fully out; Full panel button never covered by the footer
- [x] 01.1-08-PLAN.md — Rocker, bat and guarded-switch skins in real sizes and colours (D-08 gate)
- [x] 01.1-09-PLAN.md — Lever, slider and pull-handle skins

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01.1-10-PLAN.md — Owner review document docs/PANEL-REVIEW.md with completeness gate

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01.1-11-PLAN.md — Release manifest, owner SHA confirmation, fast-forward publish, live verification, first-render review

**Gap closure** *(owner first-render review, 01.1-OWNER-FINDINGS.md; sequential, unattended, no push)*

**Wave 6**
- [x] 01.1-12-PLAN.md — Owner label table docs/PANEL-LABELS.md (morning review), completeness gate, derived inventory counts

**Wave 7**
- [x] 01.1-13-PLAN.md — Static toggle family (rockers, bats, softkey, guard cover), rocker side perspective, state-independent text gate

**Wave 8**
- [x] 01.1-14-PLAN.md — Static levers and push buttons

**Wave 9**
- [x] 01.1-15-PLAN.md — Static knobs, lamp-group readouts removed, built-panel static-text gate

**Wave 10**
- [x] 01.1-16-PLAN.md — Plates as data, art-fit and no-overlap gates, FADEC, flap block and LEVEL placement

**Wave 11**
- [x] 01.1-17-PLAN.md — Landing gear block order, GEAR TEST lights all gear lamps

**Wave 12**
- [x] 01.1-18-PLAN.md — Three-position toggle, plate placards, ELT with lamp

**Wave 13**
- [x] 01.1-19-PLAN.md — Pedestal rebuild: parking brake, throttle, cowl flap with lamps

**Wave 14**
- [x] 01.1-20-PLAN.md — Environmental control rebuild: temperature, direction, fan, circulating air

**Wave 15**
- [x] 01.1-21-PLAN.md — De-ice unit part 1: mode toggle, amber and white lamps, MAX button

**Wave 16**
- [x] 01.1-22-PLAN.md — De-ice unit part 2: lower row, ALTERNATE under its guard, framed heading

**Wave 17**
- [x] 01.1-23-PLAN.md — Live-condition rehearsal, exact inventory gates, documents, final gates, morning-review list

**Gap closure, round 2** *(owner live-site review, 01.1-OWNER-FINDINGS-R2.md; plans stored here, executed on the phase 01.2 branch; sequential, unattended, no push)*

**Wave 18**
- [x] 01.1-24-PLAN.md — Shared e2e zoom helper, zoom and breaker specs migrated, behaviour-neutral (prepares R2-Z1)

**Wave 19**
- [x] 01.1-25-PLAN.md — R2-Z1: a single click or tap never zooms; double click or double tap on the background zooms in and out; a double tap on a control stays two control taps

**Wave 20**
- [x] 01.1-26-PLAN.md — R2-T1: Full panel button picks a corner where it covers no control, tablet chromium project, strict gate over every region

**Wave 21**
- [x] 01.1-27-PLAN.md — R2-4.2: parking brake as a hinged flap in pseudo-perspective, a tap toggles

**Wave 22**
- [x] 01.1-28-PLAN.md — R2-4.1: FAN with four direct click spots, art and stops unchanged

**Wave 23**
- [x] 01.1-29-PLAN.md — R2-5.2: engine strip, FADEC and ALTERNATOR groups with bracket lines, headings, AUTO, FORCE B, TEST, ON, OFF and the framed numerals 1 and 2

**Wave 24**
- [x] 01.1-30-PLAN.md — R2-1.1: ON and OFF plate placards once per side of the four light rockers

**Wave 25**
- [x] 01.1-31-PLAN.md — Documents, README, ROADMAP and REQUIREMENTS wording (PNL-15), R2-5.1 verified, final gates incl. tablet chromium, live rehearsal and one WebKit attempt

**Gap closure, round 3** *(owner live-site review of 2026-10-21 at 8e4aa70, R3 findings in 01.1-OWNER-FINDINGS-R2.md; plans stored here, executed on the phase 01.2 branch; sequential, unattended, no push)*

**Wave 26**
- [x] 01.1-33-PLAN.md — R3-1.1: bus box titles as unstroked text over a plate-coloured cut rectangle, no-stroke gate, WebKit check

**Wave 27**
- [x] 01.1-34-PLAN.md — R3-4.1: pulled parking brake as a hinged plate drawn from the owner sketch, geometry gate

**Wave 28**
- [x] 01.1-35-PLAN.md — R3-Z3 (engine side): store retract of the last event, state replayed from the log, bridge hook, Phase 3 rule

**Wave 29**
- [x] 01.1-36-PLAN.md — R3-Z2 core: pure press arbitration machine (pending, tap, pan, pinch, hold, slops 10 px touch and 5 px mouse), background gestures moved onto it

**Wave 30**
- [x] 01.1-37-PLAN.md — R3-Z2: toggles, rockers, bats, circuit breakers and guards act on release; pan and pinch over them

**Wave 31**
- [x] 01.1-38-PLAN.md — R3-Z2: parking brake flap, lever marker taps and FAN spots act on release

**Wave 32**
- [x] 01.1-39-PLAN.md — R3-Z2: momentary controls commit after 100 ms held still; drag controls keep their gesture and can be pinched over

**Wave 33**
- [x] 01.1-40-PLAN.md — R3-Z3: a double click or double tap on a latching control zooms and retracts the first actuation; PNL-15, ROADMAP and README wording

**Wave 34**
- [x] 01.1-41-PLAN.md — Documents (Round 5 and decisions R3-D1 to R3-D8), supersession notes, final gates, live rehearsal, one full WebKit run on four projects

### Phase 01.2: Circuit breakers, G1000 NXi shapes and avionics panels (INSERTED)

**Goal**: The panel is complete before scenarios start: every circuit breaker at its real position (pushed in by default, pulled out showing a white ring, tap toggles), the G1000 NXi PFD and MFD in their well-known shape with softkeys (the MFD engine page and page softkey work, the rest is inert), the audio panel and autopilot panel visible (buttons not functional), and the static backup EFIS and other fixed items. Nothing a pilot would find on the real panel is missing.
**Depends on**: Phase 01.1
**Requirements**: PNL-12, PNL-13
**Success Criteria** (what must be TRUE):
  1. All circuit breakers (Essential, Main and Avionics bus) sit at their real positions with legible labels and work as a new control kind with states in and out, all pushed in by default, a pulled breaker shown by a raised cap and a white ring and no state text (owner rule G-0.1, which supersedes the earlier wording; see the 01.2 UI-SPEC "Override and Decision Record").
  2. The PFD and MFD show the G1000 NXi shape with all softkeys; the MFD page softkey and the engine page still work.
  3. The audio panel, autopilot panel and backup EFIS are visible in their real positions and look like the real units; their buttons do nothing for now.
  4. The layout reference tests cover circuit breakers and avionics, and the live site serves the complete panel.

**Plans:** 9/9 plans executed (planned unattended; owner decision: panel space widened to 2180 x 1300)

Plans:
**Wave 1**
- [x] 01.2-01-PLAN.md — Widen the panel space to 2180 x 1300 (right side only), shell silhouette, width literals removed, owner decision recorded in the UI-SPEC

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01.2-02-PLAN.md — Circuit-breaker kind end to end with one breaker (cb.pitot), derived inventory gates, state-text wording amended

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01.2-03-PLAN.md — Bus panel geometry and art: breaker regions, bus plate, stair-step outlines, titles, plugs, pump boxes

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01.2-04-PLAN.md — All 51 breakers at their positions, independent layout reference, label-clearance and element-budget gates

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01.2-05-PLAN.md — PFD and MFD shape: bezel lip, 12 softkeys per display, glass header and legend rows

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01.2-06-PLAN.md — Avionics unit geometry: six regions, four plates, housings instead of placeholder outlines

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 01.2-07-PLAN.md — Knob and key columns beside both displays

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 01.2-08-PLAN.md — Audio panel, backup EFIS and autopilot panel

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 01.2-09-PLAN.md — Label and review documents, README, deferred-behaviour todo, final gates and morning-review list

### Phase 2: First Gradable Scenario

**Goal**: Users can start one real emergency (Oil Temp High), run the procedure by operating the panel, finish with "Procedure complete" and receive an objective PASS/FAIL debrief.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SCN-01, SCN-02, SCN-03, SCN-04, SCN-05, SCN-07, SCN-08, PNL-03, SES-01, SES-03, SES-04, PLT-03, PLT-04
**Success Criteria** (what must be TRUE):
  1. On first run the user must accept a training-aid acknowledgment (not shown again afterwards), and every scenario shows its source, revision and disclaimer in the briefing.
  2. User taps "New situation" (random or chosen), reads a short briefing, and the panel opens in the scenario's initial state with "OIL TEMP HIGH" showing in the alert area.
  3. User performs the procedure by operating controls, the app stays silent (Exam behaviour), and the user ends the run with "Procedure complete"; actions count by the resulting control state, not by raw clicks (toggling a switch back and forth does not change what is credited).
  4. The debrief shows PASS/FAIL (a missed critical step fails), a verdict per step (critical, standard, optional), order violations in ordered groups and harmful (forbidden) actions; replaying the same recorded run gives identical verdicts, and golden, do-nothing, wrong-order and forbidden-action replays each grade as expected.
  5. The scenario is a YAML file loaded only through the PackProvider/AccessPolicy seam (open in v1); the validate command reports a malformed file with line-numbered errors and rejects any control id not in the registry.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Reactive Scenarios and Initial Pack

**Goal**: Users can run all three initial emergencies (Oil Temp High, Electrical Failure, Engine Fire) and see each one react to what they do: gauges move, ignored failures escalate, handled failures recover.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SCN-06, PNL-04, PNL-07, CNT-01
**Success Criteria** (what must be TRUE):
  1. Engine gauges and displays move with the simulated aircraft state during a scenario (e.g. the oil temperature needle ramps up when the scenario starts and falls after the correct actions).
  2. If the user ignores a scenario or lets a value pass its red line, the scenario escalates to a named outcome (e.g. engine failure), and that outcome appears in the debrief.
  3. The "New situation" flow offers Oil Temp High, Electrical Failure and Engine Fire, each with its own initial state, annunciations and procedure, and each passes golden, do-nothing, wrong-order and forbidden-action replay tests and registry validation.
  4. User can enter a squawk code (e.g. 7700) in a simplified transponder section, and the entered code counts as graded panel state.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Training Mode, Further Actions and Repeat Loop

**Goal**: Users can learn from a scenario with a checklist and hints, make non-panel decisions such as MAYDAY and the landing choice, and retry or move on to improve their debrief; authors can add scenarios by following a guide.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SES-02, SES-05, SES-06, CNT-02
**Success Criteria** (what must be TRUE):
  1. In Training mode the user can show or hide the scenario checklist and ask for a hint during the scenario, while Exam mode stays silent.
  2. A "Further actions" section lets the user pick from a fixed list of non-panel actions (e.g. monitor oil pressure, declare MAYDAY, brief passengers) and choose a landing decision from the ladder (continue flight, safety landing on a suitable field, emergency landing on the next field, outlanding if necessary); both are graded in the debrief.
  3. From the debrief the user can retry the same scenario from a clean initial state or move straight to the next situation.
  4. Following only the authoring guide, a non-developer can add a new scenario YAML file, validate it and play it in the app without any code change.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Offline PWA and Real-Device Hardening

**Goal**: Users can install the trainer on their phone, tablet or desktop and run scenarios offline, with the full flow confirmed on real devices and surviving new deploys.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PLT-02
**Success Criteria** (what must be TRUE):
  1. User can install the app from real iOS/iPadOS Safari, Android Chrome and desktop Chrome/Edge, and it launches as a standalone app.
  2. After one online load, with the device in airplane mode, the user can start, play, finish and debrief every scenario.
  3. After a new version is deployed, a returning user gets the new version without a blank screen or stale-asset errors, and the installed app still resolves its assets under the GitHub Pages base path.
  4. The full flow (acknowledgment, new situation, operating the panel, debrief, retry) works by touch on a real iPhone, an iPad and an Android phone.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Deployed Playable Panel | 9/9 | Complete    | 2026-10-20 |
| 2. First Gradable Scenario | 0/TBD | Not started | - |
| 3. Reactive Scenarios and Initial Pack | 0/TBD | Not started | - |
| 4. Training Mode, Further Actions and Repeat Loop | 0/TBD | Not started | - |
| 5. Offline PWA and Real-Device Hardening | 0/TBD | Not started | - |
