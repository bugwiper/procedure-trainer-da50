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
    y: 39,
    hit: { w: 66, h: 70 },
    states: RELEASED_PRESSED,
    default: 'released',
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
  },
];
