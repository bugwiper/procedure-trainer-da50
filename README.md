# DA50 RG Procedure Trainer

Live site: https://bugwiper.github.io/procedure-trainer-da50/

[![CI and Deploy](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml/badge.svg)](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml)

**Training aid only, not the AFM. Not approved or certified, and not affiliated with Diamond Aircraft or Garmin.**

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user operates an interactive panel and, in a quiz-style scenario, performs the checklist actions; performance is graded against stored required, optional and ordered actions.

## Demo controls

The panel has 95 controls and 13 indicator lamps in 33 regions, placed where they sit in the real DA50 RG (the PFD and MFD regions are display artwork and the session area is trainer content, both with no controls; the transponder in the pilot's legroom is a temporary trainer part with one control, its position is not a fidelity item):

- **LIGHTS**, glareshield: LANDING, TAXI, POSITION, STROBE (ON above OFF is printed once on each side of the four rockers, as on the aircraft)
- **INSTRUMENT AND FLOOD LIGHT**, between the displays: INSTRUMENT LIGHT and FLOOD LIGHT knobs
- **DE ICE**, top far left: MAX (push button), the mode toggle (HIGH / NORM / OFF) with its three lamps, and ALTERNATE (the guarded switch)
- **DE-ICE SWITCHES**, below DE ICE: WIND SHIELD (push button), the ICE LIGHT / OFF / ANNUN-TEST toggle, the PUMP toggle (PUMP 1 / PUMP 2)
- **ENGINE**, left edge below DE-ICE: the FADEC group (heading FADEC on a bracket over the switch and the button; AUTO above and FORCE B below the switch, TEST over the FADEC TEST push button) and the ALTERNATOR group (heading ALTERNATOR on a bracket over both switches; ON and OFF once between the switches, the numerals 1 and 2 in white frames beside them)
- **MFD SOFTKEYS**, under the MFD screen: a row of 12 triangle keys; the first one switches the MFD between the map page and the engine page (its legend, Engine, stands on the glass above it), the other 11 are art only
- **PFD SOFTKEYS**, under the PFD screen: a row of 12 triangle keys, art only
- **KNOB AND KEY COLUMNS**, beside both displays: the PFD left column (VOL, NAV, HDG and ALT knobs, swap button), the PFD right column and the MFD right column (VOL, COM, CRS/BARO and FMS knobs, swap button, RANGE joystick, six keys), all art only
- **AUDIO PANEL**, centre stack: 21 keys with lamp slivers, the volume knob and the red DISPLAY BACKUP button, art only
- **BACKUP EFIS**, centre stack: a small attitude display, a tape display and a knob, art only
- **AUTOPILOT PANEL**, between the displays: four knobs, a swap button and 12 keys, art only
- **SWITCH ROW**, under the PFD: PROP DE-ICE, FUEL TRANS, EMERG FUEL PUMP, ENGINE START (push button), ENGINE MASTER, ESS BUS, ELECT. MASTER, AV MASTER, PITOT/STALL HEAT
- **LANDING GEAR**: GEAR, the STALL TEST / GEAR TEST toggle, and the gear lamps (NOSE, LEFT, RIGHT, UNSAFE)
- **LEVEL**, between the gear and flap blocks: LEVEL (push button)
- **FLAPS**, below the MFD: FLAPS, and the flap lamps (UP, T/O, LDG)
- **RIGHT PANEL**, lower right: ELT (three positions: ON, ARMED, RESET / TEST) with its red lamp
- **UNDER PANEL L**: ALTERNATE STATIC
- **UNDER PANEL ECS**: ECS SHUTOFF (a pull knob with a white head: a tap on a position pulls it or pushes it in; pulled, it is drawn tilted down-left)
- **UNDER PANEL C**: EMERGENCY GEAR EXTENSION (drag-only: tapping does nothing, the handle must be dragged all the way)
- **ENVIRONMENTAL CONTROL**, top of the centre console: FAN (its four positions OFF and three fan stops are direct click spots: a tap on a position sets it at once), DIRECTION, TEMPERATURE and CIRCULATING AIR, each in its own box with pictograms instead of words
- **PEDESTAL**: PARKING BRAKE (a hinged flap: a tap pulls it up to set and a second tap releases it, no dragging), THROTTLE (0 to 100 % in 5 % steps), COWL FLAP (CLOSED / OPEN) with its two position lamps, and the FUEL selector at the bottom left (NORMAL, EMERGENCY, OFF along one arc: a tap on the right half turns it one stop clockwise, on the left half one back, and a tap past either end does nothing; a drag cannot be turned through the blocked sector between NORMAL and OFF, so NORMAL to OFF always passes EMERGENCY)
- **UNDER PANEL R**: ALTERNATE AIR
- **TRANSPONDER**, pilot's legroom (a temporary trainer part, replaced later by the transponder of the PFD): the keys 0 to 7 and CLR and a readout of the squawk code, 7000 at rest; typing four digits sets the code (for example 7700) as panel state, a key never zooms and a partial entry is dropped by CLR
- **BUS PANEL FRAME**, far right: the ESSENTIAL, MAIN and AVIONICS bus outlines with their titles, three blank plugs, three pump boxes and the lower-row panel (art only)
- **CIRCUIT BREAKERS**, bus panel at the far right: 51 breakers with their printed labels and ratings, 38 in the ESSENTIAL, MAIN and AVIONICS bus boxes (three blank plugs between them), 10 in the lower row and 3 on the flap strip under the MFD (STALL/AOA, PROP DE-ICE, DE-ICE); all start pushed in

How it behaves:

- The panel opens in the normal in-flight configuration.
- State is shown by position and lamp only: no text on the panel changes with a control state. Rockers show their position by their side perspective.
- ALTERNATE is the cockpit's only guarded switch, a normal toggle under a red guard: tap the guard to lift it, then tap the toggle; the guard stays up until you tap it closed. ELECT. MASTER and ELT are red but unguarded and flip with one tap.
- The gear and flap lamps follow the GEAR and FLAPS levers. Holding GEAR TEST lights all four gear lamps. Lamps are derived from the control states; nothing pulses.
- The de-ice mode lamps follow the mode toggle (HIGH amber, NORM white); pressing MAX with the mode on HIGH lights the top lamp for 120 s of a scenario run (leaving HIGH puts it out); on the free panel the lamp stays dark because nothing is simulated there.
- A tap on a circuit breaker pulls it out, showing a raised cap and a white ring (no text); a second tap pushes it back in. During a scenario run the breakers in a feed line of the electrical system take their own feed away. ALT 1, ALT 2, BATT, ESS TIE, MAIN TIE and MASTER CTRL change the alternator currents, the Volts reading and the battery; EMERG PUMP changes the fuel pressure and the Engine Fire feed. ECU A, ECU B, MAIN PUMP and AV BUS are in the model but change nothing yet. During a run the simulation can also pop ALT 1 or ALT 2 itself (ALTN 1 FAIL, ALTN 2 FAIL) and, with a shorted alternator, pops it again about 2 s after you push it in; no other breaker has an effect yet.
- The softkeys other than the first MFD key, the knob and key columns, and every key, knob and button of the audio panel (including DISPLAY BACKUP), the backup EFIS and the autopilot panel do nothing: a single tap on them does nothing and a double tap only zooms into their region.
- ENGINE START, FADEC TEST, MAX, WIND SHIELD, LEVEL and the STALL TEST / GEAR TEST toggle are momentary: they act after about 0.1 s of being held still (a quick tap is a press and a release), return when you let go, also when you slide off the button first, and a press that moves or gains a second finger first is dropped.
- A press on a switch, rocker, bat, breaker, flap or FAN position acts when you lift; moving more than 10 px (mouse 5 px) or a second finger turns it into a pan or a pinch of the view, also when it started on a control; drag controls (throttle, levers, knobs) keep their gesture.
- The de-ice, lighting and environmental controls move and are recorded, but their systems are not simulated yet (the spray, the ice light and the annunciator test are not built yet; the MAX run works during a scenario run only).
- The panel keeps the true spacing and proportions of the aircraft, so some controls are small at the full view. On every device, a single click or tap never zooms; a double click or double tap zooms on the background and on a switch into that region at full tap size and, while zoomed, zooms fully out again, as do pinch and the "Full panel" button. On a switch the first tap actuates at once and the recognised pair retracts it from the action log, so the switch stays unchanged; two quick taps on one switch are therefore a zoom, and flipping it twice needs a short pause. Momentary buttons and drag controls (lever handles, knob bodies) stay two presses and never zoom, and a press that moves or gains a second finger pans or pinches the view instead of operating the control. The "Full panel" button moves between three corners so it never covers a control.
- Tapping a neutral area (panel background, display artwork, gaps between controls) never changes anything.
- The default positions and step sizes flagged as assumptions in the plans are still to be confirmed against the aircraft.

## Running a situation

The session pad sits in the lower right of the panel, in the co-pilot legroom; zoom in with a double tap to use its buttons at full size.

- **NEW SITUATION** picks a situation at random and opens its briefing; **CHOOSE SITUATION** lists the situations and a row opens its briefing. There are four situations: ENG OIL TEMP (with the oil pressure in the green range), ALTN 1 FAIL and ALTN 2 FAIL (the alternator failures; each run draws one of four causes and the debrief names it) and ENGINE FIRE in flight. A run ends by itself at 30 minutes.
- The **briefing** shows the situation, the training-aid disclaimer, and the source record at the bottom. Before the briefing a **Choose a level** card asks for the level: **Easy** (the situation and the checklist with the panel steps), **Medium** (the situation only, no checklist) or **Realistic** (no briefing at all: the panel starts in normal flight with nothing said, the failure begins by itself after a few seconds, and the debrief reveals which situation it was and how long after the onset your first action came). The level is asked every time a situation is opened. The run is an exam: nothing gives hints. **Start run** puts the panel into the initial state of the scenario and shows the annunciation on the PFD (the red ENG OIL TEMP message).
- During the run the panel reacts: the gauges on the MFD engine page move (the Electrical box shows one Amps bar with a pointer for each alternator, 1 above the bar and 2 below it, and the Volts bar), an ignored failure gets worse and an ignored failure that goes far enough ends the run by itself with a named outcome (for example "Engine failure from overheating", the debrief opens as FAIL), while the right actions bring the readings back. The transponder below the panel on the pilot's side takes a squawk code (for example 7700 in ENGINE FIRE). The simulation runs only during a scenario run; the free panel shows fixed cruise readings. Nothing says whether an action was right. When you are done, press **Procedure complete** in the footer.
- The **debrief** shows PASS or FAIL first, one line per reason, the level of the run, the checklist outline with a verdict for every graded step (always, on every level), the order of ordered groups and the harmful actions by name, without a time (for example "Increase power"). In ENG OIL TEMP a power increase fails the run. The level never changes the grade. There is no score. Back to panel keeps the end state of the panel. The grading rules are written down in [docs/GRADING.md](docs/GRADING.md); the same recorded run always gives the same verdicts.

## Scenario files

Scenarios are hand-written TOON text files under `scenarios/<pack>/`, with one `pack.toon` manifest per pack. `npm run validate` checks every file against the schema and the control registry of the panel and prints each problem as `file:line:col: message`; the CI runs it, so a bad file fails the build. Read the [Content policy](docs/CONTENT-POLICY.md) before adding any scenario text.

## Content policy

Read the [Content policy](docs/CONTENT-POLICY.md) before adding any scenario, procedure text or artwork. It exists to keep AFM-derived material out of this public repository beyond a well-defined limit: checklist text is reproduced exactly as printed (owner decision 2026-10-23), while photographs, scans, the AFM files and the manual's prose stay out and all other text is in own words.

The [Panel review list](docs/PANEL-REVIEW.md) lists every label, position, colour and default of the panel that is still an assumption, so the owner and contributors can check and correct them after a render. The [Panel label table](docs/PANEL-LABELS.md) lists the static placard text of every control and lamp with the open questions.

## Development

```
npm ci                 # install dependencies
npm run dev            # start the dev server
npm run build          # production build
npm run typecheck      # type-check
npm run lint           # lint
npm run validate       # check every scenario file (file:line:col)
npm run format:check   # check formatting
npm test               # unit tests (Vitest: layout, reference-table and static-text gates)
npm run e2e            # end-to-end tests (Playwright; builds dist-e2e with the test hook and serves it)
```

`BASE_PATH` sets the deploy base path (default "/"). The e2e run uses the base `/procedure-trainer-da-50/` on port 4173; set `PW_PORT` to use another port (parallel worktrees). Playwright projects: desktop-chromium, desktop-webkit, phone-chromium, phone-webkit, tablet-chromium, tablet-webkit and phone-portrait (run one with `npx playwright test --project=tablet-chromium`). Specs titled `@hooks` read the test-only `window.__panel` hook and are skipped when `PW_BASE_URL` points the run at a deployed site.

The panel is a data-driven registry (`src/aircraft/da50rg`) rendered by Preact widgets (`src/ui`) over a pure store with an action log (`src/engine`). Scenarios (`src/scenario`) are TOON files validated by a Zod schema and graded by a pure replay of the action log (`src/engine/grading.ts`).

## Stack

TypeScript 6.0, Vite 8, Preact 11 with signals, Vitest 5 and Playwright 1.64.
