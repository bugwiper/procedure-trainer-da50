# Roadmap: DA50 RG Procedure Trainer

## Overview

The journey runs in vertical slices, each of which ends with something a pilot can use. First a deployed, playable panel on every device, with the content-policy decision made before any procedure text exists. Then one real emergency (Oil Temp High) runs end to end, from "new situation" through operating the panel to an objective PASS/FAIL debrief. Next the scenarios come alive: scripted reactions, escalation, and the full initial pack of three emergencies. Then the learning loop (Training mode, non-panel "Further actions", retry) and the authoring guide. Finally the app becomes an installable, offline-capable PWA, checked on real devices. The core value (operate the panel, get accurate feedback on the AFM procedure) is demonstrable from Phase 2 onward.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Deployed Playable Panel** - Live GitHub Pages site where a responsive DA50 panel can be operated by mouse or touch; content policy decided
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

**Plans:** 9 plans

Plans:
**Wave 1**
- [ ] 01-01-PLAN.md — Walking skeleton shell: pinned toolchain, panel stage served at the Pages subpath on every device project, engine purity lint (wave 1)
- [ ] 01-02-PLAN.md — Content policy for AFM-derived text with the owner-decided verbatim limit, linked from README (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 01-03-PLAN.md — Registry-driven panel: ENGINE MASTER and MFD PAGE through the pure store; all plain toggles at their real positions with in-flight defaults; layout gate with the reference ordering table (PNL-08) (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-04-PLAN.md — CI and Deploy workflow, public repository, skeleton live on GitHub Pages (wave 3)
- [ ] 01-05-PLAN.md — Levers at their real positions: pedestal POWER (0-100 %) and COWL FLAP, front-panel GEAR and FLAPS, under-panel ALTERNATE STATIC, EMERGENCY GEAR EXTENSION (drag-only), ALTERNATE AIR (wave 3)
- [ ] 01-06-PLAN.md — PFD and two-page MFD frames, B612 fonts, About/content policy in app, responsive layout and rotate hint (wave 3)
- [ ] 01-08-PLAN.md — Registry and store contract pinned test-first for every control kind, incl. the guard interlock (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-09-PLAN.md — Phone region zoom (PNL-09): region tap, pinch, pan, Full panel; gestures never emit control events or hijack lever drags (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 01-07-PLAN.md — Guarded de-ice ALTERNATE switch, ENGINE START and FADEC TEST buttons, neutral-area guarantee, final publish and real-device UAT (wave 5)

**UI hint**: yes

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
| 1. Deployed Playable Panel | 0/9 | Planned | - |
| 2. First Gradable Scenario | 0/TBD | Not started | - |
| 3. Reactive Scenarios and Initial Pack | 0/TBD | Not started | - |
| 4. Training Mode, Further Actions and Repeat Loop | 0/TBD | Not started | - |
| 5. Offline PWA and Real-Device Hardening | 0/TBD | Not started | - |
