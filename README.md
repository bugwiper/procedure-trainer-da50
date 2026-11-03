# DA50 RG Procedure Trainer

Live site: https://bugwiper.github.io/procedure-trainer-da50/

[![CI and Deploy](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml/badge.svg)](https://github.com/bugwiper/procedure-trainer-da50/actions/workflows/deploy.yml)

**Training aid only, not the AFM. Not approved or certified, and not affiliated with Diamond Aircraft or Garmin.**

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user operates an interactive panel and, in a quiz-style scenario, performs the checklist actions; performance is graded against stored required, optional and ordered actions.

## Demo controls

The panel has 98 controls and 13 indicator lamps in 38 regions, placed where they sit in the real DA50 RG (the PFD and MFD regions are display artwork, the windscreen above the panel is art only and the session area and the nine further-action buttons in the pilot's footwell are trainer content, all with no controls; the transponder beside the session buttons is a temporary trainer part with one control, its position is not a fidelity item; the toe brakes in the pilot's footwell are one latching control drawn as two pedals; the red door lock lever and the emergency window oval above it, both labelled, in the left strip below the under-panel pulls are two more single controls):

- **WINDSCREEN**, above the glare shield: the view out of the cockpit (a canopy frame, the cowl and the scene; no text), art only; the full view shows it above the panel, which makes the panel a little smaller on screen; a double tap on it zooms to it. Four scenes (parked, take-off roll with scrolling runway marks, cruise, cloud) and the failure cues drawn from the simulation: engine fire flames, cabin smoke over the panel (never blocks a press), windscreen ice with warm air and the WIND SHIELD spray, a stopped propeller and oil streaks. A scenario names its scene and its onset cues in its file; on the free panel `?scene=<id>`, `?q=<quantity>:<value>` and `?flags=<name>` show them (see the [grading notes](docs/GRADING.md))
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
- **TRANSPONDER**, co-pilot footwell right of the session buttons (a temporary trainer part, replaced later by the transponder of the PFD): the keys 0 to 7 and CLR and a readout of the squawk code, 7000 at rest; typing four digits sets the code (for example 7700) as panel state, a key never zooms and a partial entry is dropped by CLR
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
- The de-ice, lighting and environmental controls move and are recorded, but their systems are mostly not simulated yet (the ice light and the annunciator test are not built yet; the MAX run and the WIND SHIELD spray work during a scenario run only).
- The panel keeps the true spacing and proportions of the aircraft, so some controls are small at the full view. On every device, a single click or tap never zooms; a double click or double tap zooms on the background and on a switch into that region at full tap size and, while zoomed, zooms fully out again, as do pinch and the "Full panel" button. On a switch the first tap actuates at once and the recognised pair retracts it from the action log, so the switch stays unchanged; two quick taps on one switch are therefore a zoom, and flipping it twice needs a short pause. Momentary buttons and drag controls (lever handles, knob bodies) stay two presses and never zoom, and a press that moves or gains a second finger pans or pinches the view instead of operating the control. The "Full panel" button moves between three corners so it never covers a control.
- **Sound**, in the footer beside About: off at first and remembered once you turn it on. With it on, during a run only, a caution makes one short tone, a warning a three-pulse tone that repeats, and the engine a low drone that follows the rpm; nothing sounds on the free panel, while a window is open or in a hidden tab. The tones never tell right from wrong.
- Tapping a neutral area (panel background, display artwork, gaps between controls) never changes anything.
- The default positions and step sizes flagged as assumptions in the plans are still to be confirmed against the aircraft.

## Running a situation

The session pad sits in the lower right of the panel, in the co-pilot legroom; zoom in with a double tap to use its buttons at full size.

- **NEW SITUATION** picks a situation at random and opens its briefing; **CHOOSE SITUATION** lists the situations and a row opens its briefing. There are ten situations. The list has three tabs, the three printed groups of the checklist booklet (WARNINGS, CAUTIONS and EMERGENCY, short for ANNUNCIATED WARNINGS, ANNUNCIATED CAUTIONS and NON-ANNUNCIATED EMERGENCY PROCEDURES), and shows three situations to a page of the selected tab (NEXT PAGE turns the page and wraps inside the tab); the order is the order of the booklet's contents pages, which is also the order of Next situation. WARNINGS holds ENG OIL TEMP (with the oil pressure in the green range); CAUTIONS holds ALTN 1 FAIL and ALTN 2 FAIL (the alternator failures; the debrief names the cause); EMERGENCY holds ENGINE FIRE in flight, the fire and smoke pack ENGINE FIRE GROUND, ELEC FIRE GROUND (one list of five rows, the engine runs), T/O FIRE ABORT and T/O FIRE NO ABORT, ELEC FIRE FLIGHT (cabin smoke over the panel, clearing after the right actions) and ICING CONDITIONS (ice on both halves of the windscreen; the icing area ends after three minutes and a WIND SHIELD press keeps the pilot half clear for ten minutes). The checklists of the ground, take-off and icing situations are shown as the checklist booklet (edition 4.1) prints them, with number marks, the comment lines and the boxed reference. The parked situations read 0 knots on the PFD and the take-off roll follows the POWER and the toe brakes. A run ends by itself at 30 minutes.
- The **briefing** shows the situation, the training-aid disclaimer, and the source record at the bottom. One card comes before the briefing, asked every time a situation is opened: the **Choose a level** card, the only card. It asks for the level: **Easy** (the situation and the checklist with the panel steps), **Medium** (the situation only, no checklist) or **Realistic** (no briefing at all: the panel starts in normal flight with nothing said, the failure begins by itself after a few seconds, and the debrief reveals which situation it was and how long after the onset your first action came). The level is not an input of the grade. The briefing ends with the note that you press Procedure complete when you are done. **Start run** puts the panel into the initial state of the scenario and shows the annunciation on the PFD (the red ENG OIL TEMP message).
- During the run the panel reacts: the gauges on the MFD engine page move (the engine page has the layout of the real one: the Load and RPM arcs, Oil Pres, Oil Temp, Coolant and Gearbox bars, the fuel box with the two tanks as one bar with an L and an R pointer, the fuel flow and the fuel calculator, the Electrical box with one Amps bar and a pointer for each alternator, the oxygen, de-ice and total service boxes; the oil pressure falls with hot oil and rises with a cold engine and with POWER; the PFD is live in a situation, with a rolling horizon, speed and altitude tapes and the vertical speed, while the free panel stays static), an ignored failure gets worse and an ignored failure that goes far enough ends the run by itself with a named outcome (for example "Engine failure from overheating", the debrief opens as FAIL), while the right actions bring the readings back. The transponder below the panel on the pilot's side takes a squawk code (for example 7700 in ENGINE FIRE). The PITOT/STALL HEAT switch off shows the yellow messages PITOT HT OFF and STALL HT OFF on the PFD, and on the ground STALL HT OFF returns a few seconds after the heat is on (in the air it does not). The simulation runs only during a scenario run; the free panel shows fixed cruise readings. Nothing says whether an action was right (the checklist sheet marks a step as done, it never says that something was wrong). While a run is live the session pad shows only what the run needs: **SHOW CHECKLIST**, **HINT** (Realistic only) and a small **LEAVE**; NEW SITUATION, CHOOSE SITUATION and RESET are on the free panel only. **SHOW CHECKLIST** shows or hides a sheet beside the panel with the checklist of the situation (on Easy and Medium, a real pilot always has the checklist); the steps you have already done are marked green with the word Done, updated as you work, and a step not done carries no mark. The clock keeps running and the panel stays usable while the sheet is shown. On Realistic the first press of **SHOW CHECKLIST** opens the same sheet at a list of the checklist headings of all situations, none of them marked as the right one; choosing one shows that checklist, afterwards the same button shows or hides the chosen checklist, a button inside the sheet leads back to the list, and the steps are marked green only when the chosen checklist is the one of the situation. The last choice is named in the debrief ("Checklist used: ...", or none) and never changes PASS or FAIL. **HINT** (Realistic, from the onset) shows or hides a box over the windscreen with the situation name and the situation text of the briefing; it gives no steps. **LEAVE** ends the run without a result after a question (Keep going or Leave run) and brings the free panel back. The decisions beyond the panel are six buttons in the pilot footwell, between the under-panel pulls and the toe brakes, under the headline FURTHER ACTIONS, all visible at once and with no dialog. Top row, the further flight conduct: **CONTINUE TO DESTINATION**, **ALTERNATE LANDING** and **EMERGENCY LANDING**; bottom row: **Brief passengers (if time permits)**, **ATC: MAYDAY** and **ATC notify (PAN PAN PAN)**. Each shows highlighted while it is on. The two calls and the passengers are independent toggles; the three landings are a group with always exactly one selection: Continue to destination is preselected when the run starts (highlighted without a press), another press switches, and pressing the selected one changes nothing (a flight decision cannot be cleared). The preselection counts as your decision, so in a situation that calls for a landing you must press the right landing button. The plate and its headline stand on the free panel and the buttons appear in a run; in a situation on the ground, or one without a flight decision, the three landing buttons are not drawn (the top row stays empty) and nothing is preselected. They are graded together with your panel actions when you press Procedure complete, by the state they are in then; they never end the run, the run clock does not wait for them, and on Realistic a press before the failure begins is ignored. When you are done, press **Procedure complete** in the footer.
- The **debrief** shows PASS or FAIL first, one line per reason, the level of the run, the checklist outline with a verdict for every graded step (always, on every level), the order of ordered groups and the harmful actions by name, without a time (for example "Increase power"). In ENG OIL TEMP a power increase fails the run. A section "Further actions" lists what the situation asks of the calls and the flight decision, with the buttons you switched on in the order made. Where a situation allows continuing to the destination under VFR (the two ALTN cautions), the debrief adds a yellow hint outside the verdict that says when an alternate landing is necessary and names the Avoid buttons (Avoid IMC, Avoid NVFR, Avoid icing) you did not choose, or a green line when you chose all three; on Realistic, when you looked at the checklist of another situation, it says which situation it really was. The level and the checklist choice never change the grade. There is no score. **Retry** starts the same situation again from a clean start at the same level, with the same cause and, on Realistic, the same onset, so a better result comes from you and not from the draw; **Next situation** opens the next one in the order of CHOOSE SITUATION (after the last it wraps to the first) with the level kept, as its briefing on Easy and Medium and as a started run on Realistic; **Back to panel** keeps the end state of the panel. The grading rules are written down in [docs/GRADING.md](docs/GRADING.md); the same recorded run always gives the same verdicts.

## Writing a scenario

This section is for a developer who wants to add a situation without reading the code. A scenario is one hand-written TOON text file; the rules for what a file may contain are checked by `npm run validate`, the CI and the unit tests, so a bad file fails the build and never reaches a pilot. Read the [Content policy](docs/CONTENT-POLICY.md) before adding any scenario text: checklist text copied from a printed page is reproduced exactly as printed, everything else (briefing, labels, debrief lines) is in your own words. The text of the example below is own wording and is not an AFM page.

### 1. Where the files go

- A pack is a folder `scenarios/<pack>/` with one manifest `pack.toon` and one file per scenario. The manifest lists the scenarios without loading them; the file name is the entry's `file` plus `.toon`.
- The title of a scenario is at most 18 characters and is shown in CHOOSE SITUATION; `free: true` marks a pack everybody may open.
- A new pack needs no code change: `src/scenario/packs-vite.ts` globs `scenarios/*/pack.toon` and `scenarios/*/*.toon`, so a new folder with a manifest is found by the next `npm run dev` or `npm run build` and gets its own chunk. The chooser lists the packs in folder-name order and each pack in manifest order.

```toon fragment
# scenarios/engine/pack.toon (the manifest of an existing pack)
format: 1
title: Engine
free: true
scenarios[2]:
  - id: eng-oil-temp-green
    title: ENG OIL TEMP
    file: eng-oil-temp-green
  - id: eng-fire-in-flight
    title: ENGINE FIRE
    file: eng-fire-in-flight
```

### 2. The TOON rules of this project

- Hand-write the files and never run them through the library encoder: it drops comments, and the comments carry the reasons for the numbers. A comment line starts with `#`.
- A list is written as `name[n]:` with `n` items, each item an object after `- `; the decoder checks `n`. No tabular rows, no root arrays.
- Quote a text that looks like a number or a switch word (`"018"`, `"OFF"`, `"ON"`), and a text with a colon.
- Ids are lower case with underscores (`reduce_power`), checked by the schema, which is strict: an unknown field is an error, not ignored.

### 3. A complete worked example

This is a small scenario, a toy built from the shipped ENG OIL TEMP file with own-wording text. `tests/readme-guide.test.ts` parses this very block and runs the same check as `npm run validate` against the DA50 RG, so it cannot go stale.

```toon example
# A toy scenario for the README guide: own wording throughout, not an AFM page.
format: 1
id: toy-hot-oil
title: HOT OIL TOY
source:
  document: "Own exercise for the authoring guide"
  issue: "none"
  section: "none"
  verified: "2026-11-01"
disclaimer: training-aid
scene: cruise
briefing:
  situation: "You are in cruise flight when the red ENG OIL TEMP message appears. The oil temperature reads high and a thin film of oil is running back over the windscreen."
initial:
  controls:
    lv.power: p75
    lv.cowl_flap: closed
  quantities:
    altitude_ft: 4500
    oil_temp_c: 128
    oil_pressure_bar: 4.16
parameters:
  oil_cooling: 0.55
profile:
  flight_speed_kt: 120
annunciations[1]: eng_oil_temp
checklist:
  form: table
  heading: HOT OIL TOY
  message: OIL TEMPERATURE HIGH
procedure[3]:
  - kind: group
    id: cool_down
    ordered: true
    steps[2]:
      - id: reduce_power
        severity: critical
        number: 1
        text: Power lever
        action: REDUCE
        done:
          check: travel_rel
          control: lv.power
          op: lte
          delta: -10
      - id: open_cowl_flap
        severity: critical
        number: 2
        text: Cowl flap
        action: OPEN
        done:
          check: state
          control: lv.cowl_flap
          is: open
  - kind: group
    id: extras
    ordered: false
    steps[1]:
      - id: landing_light
        severity: optional
        number: 3
        text: Landing light
        action: "ON"
        done:
          check: state
          control: sw.light_landing
          is: "on"
  - kind: comment
    text: Land at the nearest suitable airfield if the temperature does not fall.
forbidden[1]:
  - id: power_increased
    text: Increase power
    fails_run: true
    trigger:
      check: travel_rel
      control: lv.power
      op: gt
      delta: 0
outcomes[1]:
  - id: engine_failure
    text: Engine failure from overheating
    hold_s: 15
    when:
      check: quantity
      quantity: oil_temp_c
      op: gte
      value: 140
onset:
  window_s[2]: 2,6
  quantities:
    altitude_ft: 4500
    oil_temp_c: 114
  parameters:
    oil_leak: 0.6
  message_within_s: 22
  cues[1]: oil_streaks
further:
  actions[2]:
    - id: atc_pan_pan
      role: recommended
    - id: brief_passengers
      role: optional
  conduct:
    accept[1]: conduct_precautionary
```

Walk through it from the top:

- **`source`, `disclaimer`, `briefing`.** Where the checklist comes from, the training-aid marker (the only value) and the situation text of the briefing. The situation says what the pilot sees and never names the cause or the right action.
- **`initial`.** The panel at the start of the run (`controls`: an id and a legal position; everything not listed stays at the registry default, the in-flight configuration) and the start `quantities` (the readings the simulation starts from). `parameters` switch hidden failure effects on (`oil_cooling` makes the oil run hot); `profile` scripts the flight itself, see section 5.
- **`annunciations`.** The cautions and warnings that show at the start (`eng_oil_temp` is a rule of the aircraft's annunciation table in `src/aircraft/da50rg/cas.ts`).
- **`checklist` and `procedure`.** The heading and message of the printed checklist, then its rows in printed order. `form: table` is the numbered booklet form with `number` marks and an `action` column; `form: outline` has markers, decisions and branches instead (see `scenarios/engine/eng-oil-temp-green.toon`). A `group` holds graded steps: `ordered: true` says the declared order is the right order and the debrief reports a swap; the order fails the run only with `order_critical: true`, and `false` accepts any order. A step has an `id`, a `severity` (`critical` fails the run when missed, `standard` and `optional` do not) and a `done` predicate. A `line` is shown but not graded, a `comment` is a plain printed row.
- **`forbidden`.** An action that is harmful, with `fails_run: true` when it fails the run by itself; its `trigger` is a predicate as well.
- **`outcomes`.** What happens when the failure is ignored: the run ends as FAIL with this name once the predicate has held for `hold_s` seconds of run time.
- **`onset`.** The level Realistic: the failure begins at a random second inside `window_s`, from the `quantities` given there, with the effects of `onset.parameters`; the listed messages and cues must show within `message_within_s`.
- **`further`.** The decisions beyond the panel, see section 5.

#### The predicates

Every `done`, `trigger`, `when` and `outcomes` condition is one of six checks. They are data: nothing in a scenario file is ever evaluated as code, and there are no expression strings.

| Check        | Fields                    | True when                                                                                                 |
| ------------ | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `state`      | `control`, `is`           | the control is in this position                                                                           |
| `state_in`   | `control`, `in[n]`        | the control is in one of these positions                                                                  |
| `travel`     | `control`, `op`, `value`  | a lever's position, 0 to 100 per cent of its travel, compares to `value`                                  |
| `travel_rel` | `control`, `op`, `delta`  | a lever's change from its position at the start, in per cent of travel (-10 is ten down), compares to `delta` |
| `quantity`   | `quantity`, `op`, `value` | a simulated reading compares to `value`                                                                   |
| `band`       | `quantity`, `in[n]`       | a reading lies in one of these colour bands (`low_red`, `low_yellow`, `green`, `high_yellow`, `high_red`) |

`op` is `lt`, `lte`, `gt` or `gte`. The ids come from the aircraft data, never from the scenario layer: controls from `src/aircraft/da50rg/controls/*.ts` (the id prefix names the kind, `sw.`, `lv.`, `kn.`, `cb.` and so on, and the legal positions are those of the control), quantities and their bands from `src/aircraft/da50rg/quantities.ts`, messages from `cas.ts`. `npm run validate` names the id it does not know, for example `unknown control "lv.cowl"`.

### 4. Validate it

```
npm run validate     # checks every file under scenarios/
```

Every problem is printed as `file:line:col: path: message`, and the exit code is 1 when there is any. A step that asks for a position the control does not have reads:

```text
scenarios/toy/toy-hot-oil.toon:54:11: procedure.0.steps.1.done.is: "opened" is not a state of control "lv.cowl_flap"
1 scenario files checked, 1 problems
```

Besides the schema and the registry, `npm run validate` applies the lint rules (the header of `src/scenario/lint.ts` lists them): among others, a run that does nothing must fail, every message that appears in such a run must be declared, a Realistic start must begin clean, the row marks must run 1, 2, 3 (or A, B, C), and the variants and the further actions must be consistent. The CI runs the same check and the unit tests load every shipped file, so a rule that fails here also fails the build.

### 5. The optional sections

The format is 1 and every section below is optional; the rules and their reasons are in [docs/GRADING.md](docs/GRADING.md) ("Variants for authors", "Scenes and cues for authors", "Flight profile for authors", "Further actions for authors").

**Variants** are several causes behind one failure message. A run draws one by seed and records it; `applies` says which steps and forbidden items count for that cause, and the debrief names the cause afterwards:

```toon fragment
variants[2]:
  - id: alternator_dead
    weight: 60
    applies[2]: alt1_off,ess_bus_on
    debrief: The breaker was in and alternator 1 had failed.
  - id: breaker_popped
    weight: 40
    controls:
      cb.alt1: out
    parameters:
      alt1_output: 1
    applies[1]: alt1_breaker_in
    debrief: The alternator 1 circuit breaker had popped. Pushing it in cleared the message.
```

**Scene and cues** are the view out of the windscreen and what the failure looks like there. A cue is drawn from a simulated quantity, never from the pilot's actions:

```toon fragment
scene: cruise
onset:
  window_s[2]: 2,6
  cues[1]: flames
```

- **Scenes:** `parked`, `takeoff_roll`, `cruise`, `cloud`.
- **Cues:** `flames`, `cabin_smoke`, `ice_pilot_side`, `ice_copilot_side`, `prop_stopped`, `oil_streaks`, `roll_speed`.

An onset needs at least one annunciation or one cue, and a cue must not be visible at the Realistic start.

**The flight profile** scripts the PFD of the situation (speed, climb or descent, bank, the glide values, the terrain height) from the first second at every level; the free panel stays static and nothing in it is graded:

```toon fragment
initial:
  quantities:
    altitude_ft: 1450
profile:
  flight_speed_kt: 70
  flight_vs_fpm: 500
onset:
  window_s[2]: 2,6
  quantities:
    altitude_ft: 1450
```

Start values for the Realistic run go in `onset.quantities`, because that start is the base values with only the onset block laid over them. A situation on the ground sets `ground_roll: 1` in the profile.

**The further section** grades the decisions that are not panel actions. The aircraft owns the fixed list; the scenario gives each its role (`required`, `recommended`, `optional` or `harmful`, an unlisted one is `optional`) and the flight conduct that is right. Put it last in the file:

```toon fragment
# The roles are instructor-review values.
further:
  actions[3]:
    - id: atc_mayday
      role: required
    - id: atc_pan_pan
      role: optional
    - id: brief_passengers
      role: recommended
  conduct:
    accept[1]: conduct_emergency
```

A scenario that accepts continuing to the destination can add the note the debrief shows (own words, at most 50 words, `conduct_note` after `conduct`):

```toon fragment
further:
  actions[1]:
    - id: atc_pan_pan
      role: optional
  conduct:
    accept[2]: conduct_destination,conduct_precautionary
  conduct_note: "Continuing is fine under VFR only. In IMC, at night under NVFR or in icing conditions an alternate landing is necessary."
```

- **Further options:** `atc_mayday`, `atc_pan_pan`, `brief_passengers`, `avoid_imc`, `avoid_nvfr`, `avoid_icing`, `conduct_destination`, `conduct_precautionary`, `conduct_emergency`.

The conduct rule: a scenario with a `further` section writes `conduct` with `accept` (the right options; at least one, never all three, and the option selected at the end of the run must be one of them), except a scenario on the ground, which writes `conduct: none` and is never graded on it. The ground rule is checked: `none` exactly when the profile puts the aircraft on the ground. A scenario without a `further` section grades no further action, and every shipped scenario has one. In a run the pilot sees these as nine toggle buttons in the footwell: the three landing buttons (Continue to destination is preselected) are a group, the calls and the passengers are three toggles, and the three Avoid buttons (Avoid IMC, Avoid NVFR, Avoid icing) are unrated toggles that are never required and never fail; the landing buttons and the Avoid buttons are not drawn where the scenario has no flight decision, and the grade counts the state the buttons are in when Procedure complete is pressed. A scenario that accepts continuing to the destination can carry a `conduct_note` (own words, at most 50 words, rule L31) that the debrief shows as a hint outside the verdict.

### 6. What the checklist sheet and the hint show

There is no hint text in a scenario file. The CHECKLIST sheet prints the checklist of the file as written (heading, message, row marks, text and desired action) and marks a step Done by the same grade the debrief uses: the sheet grades the recording so far, so a mark can never disagree with the debrief, and a step that is already true at the onset and not done again stays unmarked (rule R12). The order in which you declare the checklist is the order of the sheet. On Realistic the HINT box shows the `title` and the `briefing.situation` of the file itself (never the cause a variant picked), so write the situation text to say what the pilot sees and never why. The list that SHOW CHECKLIST opens on Realistic shows the three printed groups of the booklet as tabs with every entry of the catalog, greyed where no scenario is shipped. A new scenario therefore needs an entry in the checklist catalog (`src/aircraft/da50rg/checklist-catalog.ts`): a `ref` `{ pack, scenario }` on the entry whose tag is the `checklist.heading` of the file (or a new entry in the group of the non-annunciated procedures); `npm run validate` says `L29: scenario "pack/id" is not the link of any entry of the checklist catalog` when it is missing and `L30` when the tag differs from the heading, and the independent table `tests/checklist-catalog-reference.ts` follows. At run time a scenario without an entry is still listed, after the last group. Rows of the sheet the program does not check (the plain action lines, and panel steps while nothing is marked) can be ticked by tapping them, which is display only; after the onset the chosen checklist is marked from what the pilot really did on the panel, also a foreign one.

### 7. Play it

Run `npm run dev`, open CHOOSE SITUATION (zoom into the session pad with a double tap), choose the tab of its group and pick the new row; the new situation appears at once, the manifest title in the list and the file's own title in the briefing. Answer the level card (Realistic is offered only when the file has an `onset`), operate the panel and press Procedure complete. In the debrief **Retry** restarts the same situation with the same cause and onset, which makes it a quick loop while tuning a file, and **Next situation** moves on in the order of the catalog.

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
