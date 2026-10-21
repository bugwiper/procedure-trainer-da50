# DA50 RG Procedure Trainer

Live site: https://bugwiper.github.io/procedure-trainer-da50/

[![CI and Deploy](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml/badge.svg)](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml)

**Training aid only, not the AFM. Not approved or certified, and not affiliated with Diamond Aircraft or Garmin.**

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user operates an interactive panel and, in a quiz-style scenario, performs the checklist actions; performance is graded against stored required, optional and ordered actions.

## Demo controls

The panel has 92 controls and 13 indicator lamps in 30 regions, placed where they sit in the real DA50 RG (the PFD and MFD regions are display artwork with no controls):

- **LIGHTS**, glareshield: LANDING, TAXI, POSITION, STROBE
- **INSTRUMENT AND FLOOD LIGHT**, between the displays: INSTRUMENT LIGHT and FLOOD LIGHT knobs
- **DE ICE**, top far left: MAX (push button), the mode toggle (HIGH / NORM / OFF) with its three lamps, and ALTERNATE (the guarded switch)
- **DE-ICE SWITCHES**, below DE ICE: WIND SHIELD (push button), the ICE LIGHT / OFF / ANNUN-TEST toggle, the PUMP toggle (PUMP 1 / PUMP 2)
- **ENGINE**, left edge below DE-ICE: FADEC (AUTO / FORCE B), FADEC TEST (push button), ALTERNATOR 1, ALTERNATOR 2
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
- **ENVIRONMENTAL CONTROL**, top of the centre console: FAN, DIRECTION, TEMPERATURE and CIRCULATING AIR, each in its own box with pictograms instead of words
- **PEDESTAL**: PARKING BRAKE (pulled up to set), THROTTLE (0 to 100 % in 5 % steps), COWL FLAP (CLOSED / OPEN) with its two position lamps
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
- The softkeys other than the first MFD key, the knob and key columns, and every key, knob and button of the audio panel (including DISPLAY BACKUP), the backup EFIS and the autopilot panel do nothing: a tap on them only zooms into their region.
- ENGINE START, FADEC TEST, MAX, WIND SHIELD, LEVEL and the STALL TEST / GEAR TEST toggle are momentary: they act while held and return when you let go, also when you slide off the button first.
- The de-ice, lighting and environmental controls move and are recorded, but their systems are not simulated yet (spray, ice light, annunciator test and the MAX run belong to the engine phase).
- The panel keeps the true spacing and proportions of the aircraft, so some controls are small at the full view. On every device, a tap or click on a region's background zooms into it at full tap size; "Full panel" (or a double tap or double click) zooms out.
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
npm test               # unit tests
npm run e2e            # end-to-end tests
```

`BASE_PATH` sets the deploy base path (default "/").

## Stack

TypeScript 6.0, Vite 8, Preact 11 with signals, Vitest 5 and Playwright 1.64.
