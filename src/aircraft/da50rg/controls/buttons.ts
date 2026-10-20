import type { ControlSpec, StateDef } from '../../../engine/registry';

// Every momentary push button of the panel in one family file, so later plans can own button
// data (plan 01.1-06) separately from switch data (plan 01.1-08). Control inventory: AFM
// section 7-23 and the private reference photos (layout facts only, no AFM wording).

const RELEASED_PRESSED: readonly [StateDef, StateDef] = [
  { id: 'released', label: 'RELEASED' },
  { id: 'pressed', label: 'PRESSED' },
];

export const BUTTON_CONTROLS: readonly ControlSpec[] = [
  // Slot 3 (x 316) of the switch row: the ENGINE START push button between EMERG FUEL PUMP
  // and ENGINE MASTER.
  {
    id: 'btn.engine_start',
    kind: 'momentary-button',
    label: 'ENGINE START',
    region: 'switch_bank',
    x: 316,
    y: 43,
    hit: { w: 66, h: 70 },
    states: RELEASED_PRESSED,
    default: 'released',
    skin: 'chrome-round',
  },
  // FADEC TEST: right of the FADEC switch (D-07c).
  {
    id: 'btn.fadec_test',
    kind: 'momentary-button',
    label: 'FADEC TEST',
    region: 'engine_controls',
    x: 126,
    y: 36,
    // Narrower than FADEC (74): the engine area has no other free background, so the gap
    // between the two keeps a tap-to-zoom point that stays clear of both targets (PNL-09).
    hit: { w: 60, h: 60 },
    states: RELEASED_PRESSED,
    default: 'released',
    skin: 'small-black',
  },
  // ANNUN TEST of the de-ice panel (second row, between WIND SHIELD and PUMP 1 on the
  // lower row). It tests the de-ice annunciations; inert in this phase. Layout fact from the
  // private photos, kind and function unconfirmed (UI-SPEC unconfirmed item 8).
  {
    id: 'btn.deice_annun_test',
    kind: 'momentary-button',
    label: 'ANNUN TEST',
    region: 'deice_switches',
    x: 65,
    y: 57,
    hit: { w: 30, h: 36 },
    states: RELEASED_PRESSED,
    default: 'released',
    skin: 'small-black',
  },
  // LEVEL, between the GEAR lever and the FLAPS block. Believed to be the autopilot level
  // function; inert in this phase (UI-SPEC unconfirmed item 11).
  {
    id: 'btn.level',
    kind: 'momentary-button',
    label: 'LEVEL',
    region: 'level',
    x: 23,
    y: 39,
    hit: { w: 44, h: 44 },
    states: RELEASED_PRESSED,
    default: 'released',
    skin: 'blue-dome',
  },
  // STALL TEST / GEAR TEST: one spring-return three-position bat left of the gear lamps. Holding
  // the left half gives STALL TEST (caption left, as on the placard), the right half GEAR TEST;
  // release always returns to NEUTRAL. The UI-SPEC id sw.stall_gear_test is registered as
  // btn.stall_gear_test because a spring-return part is a momentary control (PD-04). Existence
  // confirmed (P386, PED, SIM); one three-position part versus two parts is unconfirmed
  // (UI-SPEC unconfirmed item 6). GEAR TEST lights all four gear lamps while held (G-2, see indicators.ts).
  {
    id: 'btn.stall_gear_test',
    kind: 'momentary-button',
    label: 'STALL/GEAR TEST',
    region: 'landing_gear',
    // Global 872, 686 (G-2): below the speed line under the LANDING GEAR heading, in the lamp
    // block; 7 units right of the UI-SPEC centre so the STALL TEST caption clears the bracket.
    x: 36,
    y: 111,
    hit: { w: 56, h: 30 },
    states: [
      { id: 'neutral', label: 'NEUTRAL' },
      { id: 'stall_test', label: 'STALL TEST' },
      { id: 'gear_test', label: 'GEAR TEST' },
    ],
    default: 'neutral',
    skin: 'spring-bat',
  },
];
