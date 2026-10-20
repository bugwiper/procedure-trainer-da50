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

/** Down and not in transit: three greens. In transit: only the red lamp. Up: nothing. */
export function gearLamps(gear: StateId, inTransit: boolean): GearLamps {
  const downLocked = gear === 'down' && !inTransit;
  return { nose: downLocked, left: downLocked, right: downLocked, unsafe: inTransit };
}

function gearOf(inputs: IndicatorInputs): { gear: StateId; inTransit: boolean } {
  return {
    gear: inputs.controls['lv.gear'] ?? '',
    inTransit: inputs.flags[GEAR_IN_TRANSIT] === true,
  };
}

const GEAR_READS = ['lv.gear'] as const;
const GEAR_FLAGS = [GEAR_IN_TRANSIT] as const;

const GEAR_LAMPS: readonly IndicatorSpec[] = [
  {
    id: 'lt.gear_nose',
    label: 'NOSE',
    region: 'landing_gear',
    x: 80,
    y: 85,
    r: 7,
    colour: 'green',
    caption: 'above',
    reads: GEAR_READS,
    flags: GEAR_FLAGS,
    lit: (inputs) => {
      const { gear, inTransit } = gearOf(inputs);
      return gearLamps(gear, inTransit).nose;
    },
  },
  {
    id: 'lt.gear_left',
    label: 'LEFT',
    region: 'landing_gear',
    x: 58,
    y: 114,
    r: 7,
    colour: 'green',
    caption: 'above',
    reads: GEAR_READS,
    flags: GEAR_FLAGS,
    lit: (inputs) => {
      const { gear, inTransit } = gearOf(inputs);
      return gearLamps(gear, inTransit).left;
    },
  },
  {
    id: 'lt.gear_right',
    label: 'RIGHT',
    region: 'landing_gear',
    x: 100,
    y: 115,
    r: 7,
    colour: 'green',
    caption: 'above',
    reads: GEAR_READS,
    flags: GEAR_FLAGS,
    lit: (inputs) => {
      const { gear, inTransit } = gearOf(inputs);
      return gearLamps(gear, inTransit).right;
    },
  },
  {
    id: 'lt.gear_unsafe',
    label: 'UNSAFE',
    region: 'landing_gear',
    x: 24,
    y: 113,
    r: 7,
    colour: 'red',
    caption: 'above',
    reads: GEAR_READS,
    flags: GEAR_FLAGS,
    lit: (inputs) => {
      const { gear, inTransit } = gearOf(inputs);
      return gearLamps(gear, inTransit).unsafe;
    },
  },
];

export const DA50RG_INDICATORS = defineIndicators(DA50RG, {
  indicators: GEAR_LAMPS,
  groups: [],
});
