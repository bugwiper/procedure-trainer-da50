# DA50 RG Procedure Trainer

## What This Is

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user sees an interactive panel (gauges, glass-display areas, annunciations, switches, levers, buttons). A "new situation" starts a quiz-style scenario (e.g. "OIL TEMP HIGH" annunciated like in the real aircraft), and the user must perform the correct checklist actions by operating the panel. Performance is graded against stored required, optional and ordered actions.

## Core Value

The user can run an emergency scenario by actually operating the panel controls, and gets accurate, objective feedback on whether they performed the AFM procedure correctly.

## Business Context

- **Customer**: DA50 RG pilots and students (flight schools, type-rating trainees)
- **Revenue model**: Undecided; v1 free. Later likely one-time unlock of scenario packs (license key/purchase). Subscription deferred.
- **Success metric**: Pilots completing scenarios and repeating them to improve debrief scores
- **Strategy notes**: Architecture must be gate-ready (access-check layer around scenario packs) without a v1 backend

## Requirements

### Validated

- Interactive 2D DA50 RG panel at the real control positions (Phase 1, 01.1, 01.2): 92 controls, 13 indicator lamps, 30 regions in a 2180 x 1300 space; switches, rockers, guarded switch, detent levers, knobs, momentary buttons and 51 circuit breakers respond to mouse and touch and update the pure store; no flight model (PNL-01, 02, 05, 06, 08, 10..14)
- Responsive panel with region zoom, pan and pinch on desktop, tablet and phone, double click or double tap contract (PNL-09, PNL-15); checked by the owner on a real iPhone
- G1000 NXi PFD and MFD shape with softkeys, audio panel, autopilot panel and standby EFIS drawn and inert, except the MFD page softkey (PNL-13)
- Gear and flap lamps derived from control state (PNL-14)
- Static hosting on GitHub Pages with base path from the environment (PLT-01); content policy for AFM-derived text decided (CNT-03)

### Active

- [ ] Engine gauges and the annunciator/alert area driven by scenario state (the panel itself, its controls and their input are validated above)
- [ ] Scenarios start via "new situation" quiz flow; random or selected scenario
- [ ] Scenario definitions in TOON files, validated by schema with line-numbered errors, extendable manually without code changes
- [ ] Scenario defines initial panel state, annunciations/alerts, and action checklist: required actions, optional actions, order-constrained groups, unordered actions, forbidden/harmful actions
- [ ] Scripted reactions: scenario-defined state changes triggered by user actions or timers (e.g. temperature falls after actions, escalates to engine failure if ignored or past redline)
- [ ] Checklist can be shown/hidden
- [ ] Training mode (checklist/hints, optionally immediate feedback) and Exam mode (silent, debrief at end)
- [ ] End-of-scenario debrief: missed required actions, order violations, harmful actions, optional actions done
- [ ] Initial scenario pack: Oil Temp High, Electrical Failure, Engine Fire
- [ ] Procedures sourced from the official DA50 RG AFM, entered by the user, with source/disclaimer field per scenario
- [ ] English-only UI and content
- [ ] Gate-ready architecture: scenario packs separable behind an access-check abstraction for later one-time unlock

### Out of Scope

- Flight model / flight physics — scenarios use scripted state changes only
- Pixel-accurate Garmin G1000 NXi replica or working menu structure — the displays are drawn in their well-known shape with inert softkeys (GO-AROUND brand mark, no maker names); avoids IP/effort
- User accounts, backend, payments in v1 — deferred; design must allow later
- Subscription model — one-time unlock more likely; needs backend
- Multi-language support — English matches real annunciations and AFM
- Official certification/approval as a training device — training aid only, not a substitute for AFM or instructor

## Context

- Aircraft: Diamond DA50 RG (glass cockpit, single-engine piston). Emergency procedures per AFM.
- User enters AFM-derived procedures; accuracy and licensing/copyright of AFM text is their responsibility, so scenario files should carry a source and disclaimer.
- Content extensibility through TOON scenario files is a core design driver; non-developers should be able to author scenarios.
- VS Code project, repo in /Users/pascalbetz/projects/procedure-trainer-da-50.
- **Current state (2026-10-21):** Phases 1, 1.1 and 1.2 are built and deployed (live site on GitHub Pages; owner live review passed, see the UAT files of 01.1 and 01.2). The engine is a pure panel store with an action log and retract; there is no scenario layer, clock, grading or reaction layer yet. Open follow-ups are in `.planning/todos/pending/` (review warnings, deferred engine behaviours, real iPad check, label and bus-membership revisit).
- **Next:** Phase 2, First Gradable Scenario (TOON scenario schema and validate command, virtual clock, matching on control state, briefing, Exam flow, PASS/FAIL debrief).

## Constraints

- **Tech stack**: TypeScript + Vite, SVG-rendered panel — static output suited to GitHub Pages, scalable graphics for all screen sizes
- **Hosting**: GitHub Pages (static only) — no server-side enforcement in v1
- **Devices**: desktop, tablet, phone — touch and mouse input, responsive scaling
- **Content format**: TOON scenario files with schema validation and line-numbered errors — manual extensibility
- **Safety/legal**: Clearly marked as training aid, not replacing AFM — liability

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Functional (not high-fidelity) panel | Faster, avoids IP issues, procedure focus | — Pending |
| Scripted reactions, no flight model | Meets training goal at low complexity | — Pending |
| Grading at end (Exam) plus Training mode | Supports learning and testing | — Pending |
| Free v1, gate-ready packs | Keeps GitHub Pages simple, allows later one-time unlock | — Pending |
| TypeScript + Vite + SVG | Static, responsive, testable | — Pending |
| AFM-sourced procedures entered by user | Accuracy; user owns content responsibility | — Pending |
| Phone support included | User requirement; affects panel layout design | Good: region zoom, pan and pinch checked on a real iPhone; real iPad check deferred |
| Real control positions beat tap size (Phase 1) | Position memory is the training value; touch sizing never relocates a control, zoom gives tap size instead | Good |
| Panel space 2180 x 1300 (01.2, owner decision) | The real breaker grid needs its true pitch (36 units); 180 units added on the right only, nothing left of x 1980 moved. Cost: about 8 percent smaller full-view scale on tablet and portrait phone | Good |
| Circuit breaker is a registry kind (in/out, flat `cb.*` ids); pulled shows a raised cap and a white ring, no state text (01.2, owner rule G-0.1) | Overrides the earlier IN/OUT text wording; matches the aircraft and keeps text static | Good |
| Static labels only; lamps only where the original has them; parts inside plates (owner rules G-0) | The panel must not teach text that is not on the aircraft; unknown labels are listed for owner review in docs/PANEL-LABELS.md | Good |
| Control kinds, skins, regions, plates and lamps are data in the registry | New controls and panels by data edit; counts derived from independent reference tables in tests | Good |
| Pointer arbitration and release actuation (01.1 round 3) | One pure press arbiter classifies background, latch, momentary and own targets; controls act on release, so a press that moves becomes a pan or pinch and a second finger never actuates | Good |
| Retract lives in the engine log (01.1-35, 01.1-40) | A double click on a latching control zooms and removes the first actuation from the action log (grading record stays truthful); the Phase 3 reaction layer must mark consumed events | Good; consumed-event rule pending Phase 3 |
| Behaviours deferred out of the panel phases (MAX run, ANNUN-TEST, spray, breaker effects, avionics functions, glass menus) | No engine clock or reaction layer exists yet; real timers are forbidden in engine and UI; building them early would be guessed and thrown away | Tracked as pending todos |
| Brand rule: GO-AROUND on the panel, no real maker names, no RUBIN mark, DA50RG kept | IP exposure; the airframe mark was removed on owner request | Good |
| Reference photos and AFM stay private (`.input/`, git-ignored) | Copyright; documents describe layout facts only | Good |
| Scenario files in TOON (phase 2, owner decision D-19) | Compact, readable by non-developers; `@toon-format/toon` pinned exactly because the spec is a Working Draft; schema errors carry file:line:col from an own path-to-line index | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-21 after phases 1, 1.1 and 1.2 (documentation catch-up before Phase 2)*
