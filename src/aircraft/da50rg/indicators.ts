import { defineIndicators } from '../../engine/indicators';
import type { IndicatorInputs, IndicatorSpec } from '../../engine/indicators';
import type { StateId } from '../../engine/registry';
import { DA50RG } from './panel';

// Gear and flap lamps (PNL-14, D-11). Pure derive functions of lever state; no timers, no
// transition timing (Phase 3 sets the in-transit flag). Provenance: lamp count and colours of
// the gear cluster confirmed (P386, PED, SIM, owner D-11); lamp coordinates unconfirmed.

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

export const DA50RG_INDICATORS = defineIndicators(DA50RG, {
  indicators: [...GEAR_LAMPS, ...FLAP_LAMPS, ELT_LAMP],
});
