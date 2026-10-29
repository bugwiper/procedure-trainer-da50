---
phase: 06-fuel-tank-and-engine-fidelity-and-the-engine-page
reviewed: 2026-10-29T10:30:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - scenarios/electrical/elec-altn1-fail.toon
  - scenarios/electrical/elec-altn2-fail.toon
  - scenarios/engine/eng-fire-in-flight.toon
  - scenarios/engine/eng-oil-temp-green.toon
  - scenarios/fire/elec-fire-flight.toon
  - scenarios/fire/elec-fire-ground.toon
  - scenarios/fire/eng-fire-ground.toon
  - scenarios/fire/takeoff-fire-abort.toon
  - scenarios/fire/takeoff-fire-no-abort.toon
  - scenarios/icing/icing-unintentional.toon
  - src/aircraft/da50rg/avionics.ts
  - src/aircraft/da50rg/cas.ts
  - src/aircraft/da50rg/controls/deice.ts
  - src/aircraft/da50rg/deice-endurance.ts
  - src/aircraft/da50rg/engine-page.ts
  - src/aircraft/da50rg/fuel-calculator.ts
  - src/aircraft/da50rg/indicators.ts
  - src/aircraft/da50rg/oil-pressure-curve.ts
  - src/aircraft/da50rg/physics.ts
  - src/aircraft/da50rg/quantities.ts
  - src/engine/cas.ts
  - src/engine/physics.ts
  - src/engine/sim.ts
  - src/scenario/lint.ts
  - src/scenario/schema.ts
  - src/ui/panel/frames/ArcGauge.tsx
  - src/ui/panel/frames/BarGauge.tsx
  - src/ui/panel/frames/BoxFrame.tsx
  - src/ui/panel/frames/CasChips.tsx
  - src/ui/panel/frames/DualGauge.tsx
  - src/ui/panel/frames/MfdFrame.tsx
  - src/ui/panel/frames/PfdFrame.tsx
  - src/ui/panel/frames/pointer.ts
  - src/ui/stage.css
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-29
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Phase 6 adds the fuel model (two tanks, supply, burn, return to the left tank, transfer, starvation), the fuel calculator, the engine page, the de-ice fluid model, the oil pressure tables, the pitot and stall heat cautions, the flight profile and the live PFD.

Checks run: `tsc --noEmit`, `eslint src`, `npm run validate` (10 files, 0 problems) and the full vitest suite (3599 passed) are all clean. In addition I stepped the simulation directly for the fuel and ground cases (scratch harness outside the repo, no source touched).

What holds up:

- The fuel model is internally consistent. The supply (30 gph) always exceeds the maximum burn (14.63 gph at 100 % POWER), so the return flow is never negative. The sum of both tanks falls by the burn alone on NORMAL and EMERGENCY. An empty drawn tank cuts the engine, and FUEL TRANS revives it at once, as documented.
- There is no division by zero or NaN path in the calculator (the flow floor of 1 gph guards the division), in the endurance (constant flows), or in the pitch formula (the divisor is floored at 40 kt).
- Only `+ - * /`, clamping and `quantise` are used in the aircraft physics; there is no `Math.exp`, `Math.pow` or `Math.random`.
- No scenario fact leaks into `src/engine` or `src/ui`: the new ids live in `src/aircraft`.
- Static-label rule G-0 and the brand rule hold in the new gauge code. The VS readout text changes with a quantity, never with a control state.

The defects are in the interaction of the new stall-heat ground cut-out with the shipped ground scenarios, in the design of the `ground_roll` parameter against the new flight profile, and in holes of the new L25 lint. There are no blockers.

## Warnings

### WR-01: Ground scenarios tell the pilot "No message is shown" but a STALL HEAT caution appears after about 5 s

**File:** `scenarios/fire/takeoff-fire-abort.toon:13`, `scenarios/fire/eng-fire-ground.toon:13`, `scenarios/fire/elec-fire-ground.toon:13` (with `src/aircraft/da50rg/cas.ts:66`, `src/aircraft/da50rg/physics.ts:514-519`)
**Issue:** These three scenarios set `ground_roll: 1` in `parameters` with PITOT/STALL HEAT at its default `on`. The stall-heat timer counts on the ground, so the rule `stall_heat_ground` fires. I simulated a do-nothing run of each. On Easy and Medium the STALL HEAT chip is active from t = 6 s. On Realistic it appears about 5 s after the onset (active from t = 8 s with onset at 2 s). Each scenario has `annunciations[0]:` and a briefing line "No message is shown on the primary flight display". D-12 explicitly wants the cut-out in the ground situations, so the behaviour is intended, but the scenario text now contradicts what the pilot sees: a caution (with a caution tone) appears in the middle of a fire checklist that claims none. No lint catches it. L10 only compares the start state with `annunciations`, and L14/L15 only check messages that are listed, so a message that appears later and is not listed is invisible to the lint.
**Fix:** Either reword the briefing sentence of the three ground scenarios (own text, not checklist text), for example "No message is shown at first; the yellow STALL HEAT message may appear a few seconds later", or switch the stall heat off in the baseline. Prefer a lint that closes the hole. In `checkRealisticStart` and for the Easy/Medium form, run the do-nothing simulation for the lookahead and add an issue for any message that becomes active and is neither listed in `annunciations` nor declared as an expected late message, for example:

```ts
// L26: a message that appears in a do-nothing run must be listed (or declared in onset.late_messages)
```

### WR-02: Ground state hangs on the failure parameter `ground_roll`, so a Realistic ground scenario is airborne until the onset

**File:** `src/aircraft/da50rg/physics.ts:566-569, 515-518, 733`; `scenarios/fire/eng-fire-ground.toon:24-28`, `scenarios/fire/elec-fire-ground.toon:21-25`, `scenarios/fire/takeoff-fire-abort.toon:23-27`
**Issue:** `flightRegime`, the stall-heat ground rule and the ground-speed model all read `ground_roll`. It is declared as a plain parameter (not `profile: true`), so it is only in force from the onset. Before the onset of the Realistic level the aircraft is in the 'powered' flight regime, the stall timer does not run, and the ground-speed model is off. The shipped ground scenarios hide this by hand-carrying a `profile` that zeroes the flight and glide speeds. I confirmed in simulation that on Realistic the timer starts 2 s late (onset) while on Easy it starts at 0. A new ground scenario that omits that profile block would show 140 kt on the PFD on the apron before the onset; nothing in L25 requires the block. The roll of `takeoff-fire-abort` also does not accelerate before the onset although the briefing says full power.
**Fix:** Make the situation property a profile parameter and put it in the profile of the three scenarios.

```ts
{ id: 'ground_roll', min: 0, max: 1, normal: 0, profile: true },
```

Then move `ground_roll: 1` from `parameters` to `profile` in the three files and drop the speed workaround. Alternatively keep it a failure parameter and add a lint that rejects `parameters.ground_roll > 0` without a matching `profile` entry.

### WR-03: Lint L25 does not cover profile conflicts or an altitude below the terrain; the model then teleports the aircraft

**File:** `src/scenario/lint.ts:182-196`; `src/aircraft/da50rg/physics.ts:614-620`
**Issue:** L25 only checks that each profile key is a profile parameter and in range. Three holes:

1. A key set both in `profile` and in `parameters` or `onset.parameters` is silently overridden from the onset on (`simSetup` layers normal, then profile, then parameters, then onset). The author gets a mid-run step change with no message.
2. A profile parameter placed under `parameters` is accepted. It then only applies from the onset, contradicting the rule's own message "set it under parameters" for failure parameters and the schema comment "in force from the first second".
3. `terrain_ft` is a profile parameter (0 to 10000) but no rule compares it with the start altitude. In `altitudePerMinute`, when `altitude_ft < terrain_ft` then `above` is negative, `reach` is large and positive, and `rate < reach` returns `reach`. The altitude jumps to the terrain height in one step (about 1400 ft is the base altitude, so a scenario with `terrain_ft: 2000` and no `altitude_ft` start would jump on the first step). The PFD tape and readout snap.

**Fix:** In the L25 loop add:

```ts
for (const id of Object.keys(scenario.profile)) {
  if (id in scenario.parameters || id in (scenario.onset?.parameters ?? {})) {
    add(['profile', id], `"${id}" is set in the profile and again in parameters; the later layer silently wins`);
  }
}
// and for terrain: compare initial altitude (initialQuantities) with profile.terrain_ft
```

Also reject a profile parameter under `parameters` (L12), or document that it is allowed.

### WR-04: Two rules with the identical text STALL HEAT can show together and sound a second tone

**File:** `src/aircraft/da50rg/cas.ts:52-66`; `src/ui/bridge.ts:132-146`; `src/ui/audio/aural.ts:43-64`
**Issue:** The comment on `stall_heat` says it is "never together" with `stall_heat_ground`. The CAS in the bridge mixes the live control state with the quantities of the last simulation step (up to 100 ms of run time old). If the pilot switches the heat off after the ground cut-out, the control reads `off` at once (`stall_heat` fires) while the timer quantity still sits in the `cut` band for that step (`stall_heat_ground` fires), so two chips with the same text STALL HEAT are drawn for that moment. Because the two rules have different ids, `auralStep` also treats `stall_heat` as a fresh message and plays the caution tone a second time for a message that was already on the screen.
**Fix:** Give the second rule a way to be exclusive of the first at the CAS level, for example by also requiring the switch to be on:

```ts
when: { check: 'all', of: [
  { check: 'state', control: 'sw.pitot_stall_heat', is: 'on' },
  { check: 'band', quantity: 'stall_heat_timer_s', in: ['cut'] },
] },
```

(use whichever combinator the predicate vocabulary offers), or dedupe by `text` in `RuleSet.active`. Then the comment becomes true by construction. This also removes the second tone: the pilot switching off turns the message from one rule into the other without a visible change.

## Info

### IN-01: The fuel temperature minimum clamp lands in the red band; the claim "never enters a red zone" holds only by quantisation stall

**File:** `src/aircraft/da50rg/physics.ts:413-421`; `src/aircraft/da50rg/quantities.ts:40-46`
**Issue:** `FUEL_TEMP_MIN_C = bandTop('fuel_temp_lh_c', 'low_red')` is -25. By the band rule of the project (a value on a bound belongs to the lower band) -25 is in `low_red`, while the maximum clamp 60 is in `high_yellow`. The two limits are not symmetric. Today the lag only stalls at about -24.9997 (scale 1e-6 swallows the last step), so the reading stays yellow, but a scenario that starts the quantity at -25, or a change of the scale, makes it red. The comment "A derived fuel temperature never enters a red zone by itself" is true by luck.
**Fix:** Clamp to the first value above the red band, or document that the minimum limit itself is red.

### IN-02: Airspeed keeps the glide speed after the aircraft reached the terrain

**File:** `src/aircraft/da50rg/physics.ts:584-593, 599-602`
**Issue:** With the engine stopped the glide airspeed target stays at `glide_speed_kt` for the rest of the run. After `altitude_ft` reaches `terrain_ft` the altitude, vertical speed and pitch go to rest but the PFD airspeed stays at 70 or 90 kt indefinitely (for example `takeoff-fire-no-abort` after the engine is stopped: terrain reached in about 10 s). Simulated: the airspeed holds. This is the part the emergency-landing continuation (Phase 7) will have to own, but the PFD is wrong until then.
**Fix:** When `atTerrain` and not climbing, return a decaying target (ground speed, or 0) in `airspeedTarget`, or record the gap as a Phase 7 todo.

### IN-03: Start oil pressure of the engine scenarios is not at the model equilibrium

**File:** `scenarios/engine/eng-fire-in-flight.toon:14-25`; `src/aircraft/da50rg/oil-pressure-curve.ts`
**Issue:** `eng-oil-temp-green.toon` was re-anchored (`oil_pressure_bar: 4.16`, "equilibrium at oil 128 and lever 75"), but `eng-fire-in-flight.toon` starts the oil temperature at 103 with the pressure at the base 5. The new tables give 4.0 + 0.01 * 70 = 4.7 bar there, so the pressure needle creeps by about 0.3 bar in the first seconds of the run (C-09 anchoring is not kept). The fire scenarios that set `oil_temp_c: 103` on the ground (`eng-fire-ground`) have the same pattern.
**Fix:** Set `oil_pressure_bar` in those initial blocks to the table equilibrium (4.7 for in-flight cruise at 103 degrees).

### IN-04: Dead exports and coupled magic numbers in the gauge and heat code

**File:** `src/ui/panel/frames/DualGauge.tsx:41-47, 63`; `src/aircraft/da50rg/physics.ts:159-160`
**Issue:** `dualGaugeHeight`, `DUAL_SCALE_H` and `DUAL_GAUGE_H` are exported but used nowhere outside the file (`dualGaugeHeight` is not used at all). `SCALE_TICK_TOP = 42` repeats `DUAL_GAUGE_H`, so a change to one silently breaks the scale placement. `STALL_HEAT_RESET_PER_MIN` hard-codes 60 (the timer maximum from `quantities.ts`), so raising the quantity maximum would leave the reset too slow to clear in one step.
**Fix:** Drop the unused exports, derive `SCALE_TICK_TOP` from `DUAL_GAUGE_H`, and compute the reset rate from `DA50RG_QUANTITIES.get('stall_heat_timer_s').max`.

### IN-05: The engine page font rule depends on a `data-testid` attribute

**File:** `src/ui/stage.css:64-69`; `src/ui/panel/frames/MfdFrame.tsx:528`
**Issue:** `.panel-svg [data-testid='mfd-engine-page'] text:not(.glass-digits)` uses a test id as a styling hook. It works today because the attribute is rendered in every build, but a later change that strips test ids from production (which is common) would silently turn the page back to the bold cut with no failing test (the unit tests do not read the CSS).
**Fix:** Use a dedicated class or data attribute such as `data-glass-page="engine"` for styling and keep the test id for tests.

## Fixes applied

Warnings WR-01 to WR-04 fixed on 2026-10-29 (Info items IN-01 to IN-05 left open on purpose). One commit per finding, explicit paths, nothing pushed. `tests/fixtures/recordings.json` is unchanged.

- **WR-04: fixed** in `6e85f36`. `RuleSet.active` shows a message text once (the first rule in display order stands for all) and the aural rules know a message by its text, so the instant after the rocker goes off, while the timer still sits in the cut band, shows one STALL HEAT chip and sounds the caution tone once.
- **WR-02: fixed** in `aefb98a`. `ground_roll` is a profile parameter (`profile: true`); the three ground situations carry `ground_roll: 1` in their `profile` and the hand-carried speed script is gone. The Realistic run is on the ground from the first second (ground speed model, PFD speed, stall heat timer), starts clean, and T/O FIRE ABORT accelerates before the onset as Easy does.
- **WR-03: fixed** in `2e39c63`. L25 now reports, with line and column, a profile parameter under `parameters`, a key in the profile and again in `parameters`, `onset.parameters` or a variant, and a start value below a floor parameter (new `ParameterDef.floorOf`, set on `terrain_ft` for `altitude_ft`), for Easy and Medium and for Realistic separately.
- **WR-01: fixed** in `b307a81`. The content side as the owner decided (STALL HEAT on the ground stays): the briefings of `takeoff-fire-abort`, `eng-fire-ground` and `elec-fire-ground` no longer claim that no message is shown, and the messages are declared in the new optional `late_annunciations`. New lint rule L26 rejects a message that a do-nothing run (Easy, Medium, both Realistic ends) produces after the start and the file does not list, and a late annunciation that never appears. L26 found one more genuine case, ENG OIL TEMP about 72 s into a do-nothing run of the two take-off fire situations, declared in both files (`takeoff-fire-no-abort` got the same briefing change).

**Owner change of 2026-10-29 (supersedes the 5.1 s chip of WR-01/WR-02), commit `7949533`.** A situation begins after the take-off checklist, so the stall heat is already ON and a grounded start shows the STALL HEAT chip from the first step at every level. Every shipped situation starts with the switch on (the icing variant `heat_off` is the only exception, checked by a test). The three grounded files start with `stall_heat_timer_s` 60 in `initial.quantities` and `onset.quantities`, list `stall_heat_ground` under `annunciations` (no longer `late_annunciations`; `eng_oil_temp` stays late in the two take-off fire files) and their briefings say the chip is showing. L14 is reconciled without weakening it: the CAS rule `stall_heat_ground` is flagged `ambient` in the aircraft data (a message of the situation, not of a failure); L14 skips only ambient messages at the Realistic start and L24 does not count them as what the onset reveals, so any other message at the Realistic start is still rejected. The reset is kept: switching the heat off clears the chip for the two off cautions, on again on the ground brings the chip back after the 5 s count.

---

_Reviewed: 2026-10-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
