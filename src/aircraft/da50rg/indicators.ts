import { defineIndicators } from '../../engine/indicators';
import type { IndicatorInputs, IndicatorSpec } from '../../engine/indicators';
import type { StateId } from '../../engine/registry';
import { DA50RG } from './panel';

// Gear and flap lamps (PNL-14, D-11). Pure derive functions of lever state; no timers, no
// transition timing (Phase 3 sets the in-transit flag). Provenance: lamp count and colours of
// the gear cluster confirmed (P386, PED, SIM, owner D-11); lamp coordinates unconfirmed.

/**
 * Flag the engine phase sets while a de-ice MAX run is active (owner finding G-1). Nothing sets it
 * in this phase, exactly like GEAR_IN_TRANSIT: the bridge's flag record is empty, so the top
 * de-ice lamp never lights here.
 *
 * Deferred to the engine phase, with the reason: the run lasts 120 s, and there is no engine clock
 * in phase 01.1 (no timer or clock may live in the engine or the UI; the engine's virtual clock
 * arrives with the scenario engine). Intended behaviour: pressing btn.deice_max while
 * sw.deice_mode is high sets the flag for 120 s on the virtual clock, then clears it and ignores
 * further MAX presses until MAX is pressed again; leaving the high mode clears it.
 */
export const DEICE_MAX_ACTIVE = 'deice.max_active';

/** Flag Phase 3 sets while the gear moves or disagrees with the lever; always false now. */
export const GEAR_IN_TRANSIT = 'gear.in_transit';

export interface GearLamps {
  readonly nose: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly unsafe: boolean;
}

/** Control id of the spring-return STALL TEST / GEAR TEST toggle (owner finding G-2). */
export const GEAR_TEST_CONTROL = 'btn.stall_gear_test';

/**
 * Down and not in transit: three greens. In transit: only the red lamp. Up: nothing. The lamp
 * test (GEAR TEST held) lights all four lamps whatever the lever and the flag say (G-2).
 */
export function gearLamps(gear: StateId, inTransit: boolean, lampTest = false): GearLamps {
  if (lampTest) return { nose: true, left: true, right: true, unsafe: true };
  const downLocked = gear === 'down' && !inTransit;
  return { nose: downLocked, left: downLocked, right: downLocked, unsafe: inTransit };
}

export interface FlapLamps {
  readonly up: boolean;
  readonly to: boolean;
  readonly ldg: boolean;
}

/** Exactly the lamp that matches the FLAPS lever is lit. */
export function flapLamps(flaps: StateId): FlapLamps {
  return { up: flaps === 'up', to: flaps === 'to', ldg: flaps === 'ldg' };
}

function gearOf(inputs: IndicatorInputs): GearLamps {
  return gearLamps(
    inputs.controls['lv.gear'] ?? '',
    inputs.flags[GEAR_IN_TRANSIT] === true,
    inputs.controls[GEAR_TEST_CONTROL] === 'gear_test',
  );
}

const GEAR_READS = ['lv.gear', GEAR_TEST_CONTROL] as const;
const GEAR_FLAGS = [GEAR_IN_TRANSIT] as const;

const GEAR_LAMPS: readonly IndicatorSpec[] = [
  {
    id: 'lt.gear_nose',
    label: 'NOSE',
    region: 'landing_gear',
    x: 80,
    y: 107,
    r: 7,
    colour: 'green',
    caption: 'above',
    reads: GEAR_READS,
    flags: GEAR_FLAGS,
    lit: (inputs) => gearOf(inputs).nose,
  },
  {
    id: 'lt.gear_left',
    label: 'LEFT',
    region: 'landing_gear',
    x: 58,
    y: 139,
    r: 7,
    colour: 'green',
    caption: 'above',
    reads: GEAR_READS,
    flags: GEAR_FLAGS,
    lit: (inputs) => gearOf(inputs).left,
  },
  {
    id: 'lt.gear_right',
    label: 'RIGHT',
    region: 'landing_gear',
    x: 100,
    y: 139,
    r: 7,
    colour: 'green',
    caption: 'above',
    reads: GEAR_READS,
    flags: GEAR_FLAGS,
    lit: (inputs) => gearOf(inputs).right,
  },
  {
    id: 'lt.gear_unsafe',
    label: 'UNSAFE',
    region: 'landing_gear',
    x: 24,
    y: 139,
    r: 7,
    colour: 'red',
    caption: 'above',
    reads: GEAR_READS,
    flags: GEAR_FLAGS,
    lit: (inputs) => gearOf(inputs).unsafe,
  },
];

function flapsOf(inputs: IndicatorInputs): StateId {
  return inputs.controls['lv.flaps'] ?? '';
}

// T/O and LDG lit colour white is an assumption (UI-SPEC unconfirmed item 7); UP green confirmed.
const FLAP_LAMPS: readonly IndicatorSpec[] = [
  {
    id: 'lt.flap_up',
    label: 'UP',
    region: 'flaps',
    x: 88,
    y: 21,
    r: 7,
    colour: 'green',
    caption: 'right',
    reads: ['lv.flaps'],
    lit: (inputs) => flapLamps(flapsOf(inputs)).up,
  },
  {
    id: 'lt.flap_to',
    label: 'T/O 133 KIAS',
    region: 'flaps',
    x: 84,
    y: 52,
    r: 7,
    colour: 'white',
    caption: 'right',
    reads: ['lv.flaps'],
    lit: (inputs) => flapLamps(flapsOf(inputs)).to,
  },
  {
    id: 'lt.flap_ldg',
    label: 'LDG 121 KIAS',
    region: 'flaps',
    x: 73,
    y: 81,
    r: 7,
    colour: 'white',
    caption: 'right',
    reads: ['lv.flaps'],
    lit: (inputs) => flapLamps(flapsOf(inputs)).ldg,
  },
];

// ELT lamp (owner finding G-6, G-0.3): the original has a small red lamp left of the rocker,
// lit while the ELT is ON. It prints no name; the placards beside the rocker name the positions.
const ELT_LAMP: IndicatorSpec = {
  id: 'lt.elt',
  label: 'ELT',
  region: 'right_panel',
  x: 32,
  y: 43,
  r: 4,
  colour: 'red',
  caption: 'none',
  reads: ['sw.elt'],
  lit: (inputs) => inputs.controls['sw.elt'] === 'on',
};

// Cowl-flap position lamps (owner findings G-3, G-0.3): the original has a white lamp beside each
// position of the small lever, OPEN above and CLOSED below, lit by where the lever is. Their
// captions are the only text that names the positions; the lever itself prints nothing.
const COWL_LAMPS: readonly IndicatorSpec[] = [
  {
    id: 'lt.cowl_open',
    label: 'OPEN',
    region: 'pedestal',
    x: 65,
    y: 146,
    r: 5,
    colour: 'white',
    caption: 'above',
    reads: ['lv.cowl_flap'],
    lit: (inputs) => inputs.controls['lv.cowl_flap'] === 'open',
  },
  {
    id: 'lt.cowl_closed',
    label: 'CLOSED',
    region: 'pedestal',
    x: 65,
    y: 206,
    r: 5,
    colour: 'white',
    caption: 'above',
    reads: ['lv.cowl_flap'],
    lit: (inputs) => inputs.controls['lv.cowl_flap'] === 'closed',
  },
];

// De-ice mode lamps (owner finding G-1, G-0.3): three lamps right of the MODE toggle, top to bottom
// amber, amber, white, no captions. NORM lights the white lamp; HIGH lights the middle amber lamp;
// the top amber lamp lights only while a MAX run is active (flag DEICE_MAX_ACTIVE) and the mode is
// high. The lamps never read the MAX button: the press alone lights nothing.
const DEICE_MODE = 'sw.deice_mode';

/** The three lamps of Table I2 as a pure function of the mode and the MAX flag. */
export function deiceLamps(
  mode: StateId,
  maxActive: boolean,
): { readonly max: boolean; readonly high: boolean; readonly norm: boolean } {
  return { max: maxActive && mode === 'high', high: mode === 'high', norm: mode === 'norm' };
}

function deiceOf(inputs: IndicatorInputs) {
  return deiceLamps(inputs.controls[DEICE_MODE] ?? '', inputs.flags[DEICE_MAX_ACTIVE] === true);
}

const DEICE_LAMPS: readonly IndicatorSpec[] = [
  {
    id: 'lt.deice_max',
    label: 'DE-ICE MAX',
    region: 'deice',
    x: 79,
    y: 51,
    r: 15,
    colour: 'amber',
    caption: 'none',
    reads: [DEICE_MODE],
    flags: [DEICE_MAX_ACTIVE],
    lit: (inputs) => deiceOf(inputs).max,
  },
  {
    id: 'lt.deice_high',
    label: 'DE-ICE HIGH',
    region: 'deice',
    x: 79,
    y: 93,
    r: 15,
    colour: 'amber',
    caption: 'none',
    reads: [DEICE_MODE],
    lit: (inputs) => deiceOf(inputs).high,
  },
  {
    id: 'lt.deice_norm',
    label: 'DE-ICE NORM',
    region: 'deice',
    x: 79,
    y: 135,
    r: 15,
    colour: 'white',
    caption: 'none',
    reads: [DEICE_MODE],
    lit: (inputs) => deiceOf(inputs).norm,
  },
];

export const DA50RG_INDICATORS = defineIndicators(DA50RG, {
  indicators: [...GEAR_LAMPS, ...FLAP_LAMPS, ELT_LAMP, ...COWL_LAMPS, ...DEICE_LAMPS],
});
