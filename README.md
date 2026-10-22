# DA50 RG Procedure Trainer

Live site: https://bugwiper.github.io/procedure-trainer-da50/

[![CI and Deploy](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml/badge.svg)](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml)

**Training aid only, not the AFM. Not approved or certified, and not affiliated with Diamond Aircraft or Garmin.**

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user operates an interactive panel and, in a quiz-style scenario, performs the checklist actions; performance is graded against stored required, optional and ordered actions.

## Demo controls

The panel has 92 controls and 13 indicator lamps in 31 regions, placed where they sit in the real DA50 RG (the PFD and MFD regions are display artwork and the session area is trainer content, both with no controls):

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
- **UNDER PANEL C**: EMERGENCY GEAR EXTENSION (drag-only: tapping does nothing, the handle must be dragged all the way)
- **ENVIRONMENTAL CONTROL**, top of the centre console: FAN (its four positions OFF and three fan stops are direct click spots: a tap on a position sets it at once), DIRECTION, TEMPERATURE and CIRCULATING AIR, each in its own box with pictograms instead of words
- **PEDESTAL**: PARKING BRAKE (a hinged flap: a tap pulls it up to set and a second tap releases it, no dragging), THROTTLE (0 to 100 % in 5 % steps), COWL FLAP (CLOSED / OPEN) with its two position lamps
- **UNDER PANEL R**: ALTERNATE AIR
- **BUS PANEL FRAME**, far right: the ESSENTIAL, MAIN and AVIONICS bus outlines with their titles, three blank plugs, three pump boxes and the lower-row panel (art only)
- **CIRCUIT BREAKERS**, bus panel at the far right: 51 breakers with their printed labels and ratings, 38 in the ESSENTIAL, MAIN and AVIONICS bus boxes (three blank plugs between them), 10 in the lower row and 3 on the flap strip under the MFD (STALL/AOA, PROP DE-ICE, DE-ICE); all start pushed in

How it behaves:

- The panel opens in the normal in-flight configuration.
- State is shown by position and lamp only: no text on the panel changes with a control state. Rockers show their position by their side perspective.
- ALTERNATE is the cockpit's only guarded switch, a normal toggle under a red guard: tap the guard to lift it, then tap the toggle; the guard stays up until you tap it closed. ELECT. MASTER and ELT are red but unguarded and flip with one tap.
- The gear and flap lamps follow the GEAR and FLAPS levers. Holding GEAR TEST lights all four gear lamps. Lamps are derived from the control states; nothing pulses.
- The de-ice mode lamps follow the mode toggle (HIGH amber, NORM white); the MAX lamp stays dark until the 120 s run exists in the engine phase.
- A tap on a circuit breaker pulls it out, showing a raised cap and a white ring (no text); a second tap pushes it back in. Nothing else in the cockpit reacts to a pulled breaker yet.
- The softkeys other than the first MFD key, the knob and key columns, and every key, knob and button of the audio panel (including DISPLAY BACKUP), the backup EFIS and the autopilot panel do nothing: a single tap on them does nothing and a double tap only zooms into their region.
- ENGINE START, FADEC TEST, MAX, WIND SHIELD, LEVEL and the STALL TEST / GEAR TEST toggle are momentary: they act after about 0.1 s of being held still (a quick tap is a press and a release), return when you let go, also when you slide off the button first, and a press that moves or gains a second finger first is dropped.
- A press on a switch, rocker, bat, breaker, flap or FAN position acts when you lift; moving more than 10 px (mouse 5 px) or a second finger turns it into a pan or a pinch of the view, also when it started on a control; drag controls (throttle, levers, knobs) keep their gesture.
- The de-ice, lighting and environmental controls move and are recorded, but their systems are not simulated yet (spray, ice light, annunciator test and the MAX run belong to the engine phase).
- The panel keeps the true spacing and proportions of the aircraft, so some controls are small at the full view. On every device, a single click or tap never zooms; a double click or double tap zooms on the background and on a switch into that region at full tap size and, while zoomed, zooms fully out again, as do pinch and the "Full panel" button. On a switch the first tap actuates at once and the recognised pair retracts it from the action log, so the switch stays unchanged; two quick taps on one switch are therefore a zoom, and flipping it twice needs a short pause. Momentary buttons and drag controls (lever handles, knob bodies) stay two presses and never zoom, and a press that moves or gains a second finger pans or pinches the view instead of operating the control. The "Full panel" button moves between three corners so it never covers a control.
- Tapping a neutral area (panel background, display artwork, gaps between controls) never changes anything.
- The default positions and step sizes flagged as assumptions in the plans are still to be confirmed against the aircraft.

## Content policy

Read the [Content policy](docs/CONTENT-POLICY.md) before adding any scenario, procedure text or artwork. It exists to keep AFM-derived material out of this public repository beyond a small, well-defined limit.

The [Panel review list](docs/PANEL-REVIEW.md) lists every label, position, colour and default of the panel that is still an assumption, so the owner and contributors can check and correct them after a render. The [Panel label table](docs/PANEL-LABELS.md) lists the static placard text of every control and lamp with the open questions.

## Development

```
npm ci                 # install dependencies
npm run dev            # start the dev server
npm run build          # production build
npm run typecheck      # type-check
npm run lint           # lint
npm run format:check   # check formatting
npm test               # unit tests (Vitest: layout, reference-table and static-text gates)
npm run e2e            # end-to-end tests (Playwright; builds dist-e2e with the test hook and serves it)
```

`BASE_PATH` sets the deploy base path (default "/"). The e2e run uses the base `/procedure-trainer-da-50/` on port 4173; set `PW_PORT` to use another port (parallel worktrees). Playwright projects: desktop-chromium, desktop-webkit, phone-chromium, phone-webkit, tablet-chromium, tablet-webkit and phone-portrait (run one with `npx playwright test --project=tablet-chromium`). Specs titled `@hooks` read the test-only `window.__panel` hook and are skipped when `PW_BASE_URL` points the run at a deployed site.

The panel is a data-driven registry (`src/aircraft/da50rg`) rendered by Preact widgets (`src/ui`) over a pure store with an action log (`src/engine`). There are no scenarios yet.

## Stack

TypeScript 6.0, Vite 8, Preact 11 with signals, Vitest 5 and Playwright 1.64.
