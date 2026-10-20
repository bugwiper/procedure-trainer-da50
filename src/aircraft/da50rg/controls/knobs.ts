import type { ControlSpec, RotaryStopDef } from '../../../engine/registry';

// Round knobs of the centre stack and the environmental plate (D-07, D-10, UI-SPEC 8.4).
// Provenance: the two dimmers are read from P650, P807, P761 and SIM (layout facts only); FAN
// from PED and SIM. Stop counts and pointer angles are unconfirmed (UI-SPEC unconfirmed items 9);
// the dimmer stops have no visual effect on the panel in this phase (state only). FUEL TRANS is
// the fourth knob and lives in the switch row (switch-bank.ts).
//
// Pointer angles are degrees clockwise from 12 o'clock. The dimmers sweep 270 degrees over the
// top; FAN starts at 6 o'clock (OFF) and runs clockwise to about 2 o'clock, so its last stop
// (420) is the same direction as 60.

const DIMMER_STOPS: readonly RotaryStopDef[] = [
  { id: 'off', label: 'OFF', angle: -135 },
  { id: 's25', label: '25', angle: -67 },
  { id: 's50', label: '50', angle: 0 },
  { id: 's75', label: '75', angle: 67 },
  { id: 'max', label: 'MAX', angle: 135 },
];

/** Fields the two dimmers share; each knob below spells out its own id, label and position. */
const DIMMER = {
  kind: 'rotary',
  region: 'light_knobs',
  y: 51, // global 238; the region grew 3 upward so the captions fit (G-0.5)
  hit: { w: 60, h: 60 },
  r: 20,
  scale: 'arc',
  stops: DIMMER_STOPS,
  default: 'off',
} as const;

export const KNOB_CONTROLS: readonly ControlSpec[] = [
  { ...DIMMER, id: 'sw.instr_light', label: 'INSTRUMENT LIGHT', x: 37 },
  { ...DIMMER, id: 'sw.flood_light', label: 'FLOOD LIGHT', x: 116 },
  // FAN, below DIRECTION in the environmental plate (owner side-view photo, G-3). The group box
  // title FAN is static shell art, so the knob is nameless.
  {
    id: 'sw.env_fan',
    kind: 'rotary',
    label: 'FAN',
    nameless: true,
    region: 'env_control',
    // Global 1020, 932.
    x: 63,
    y: 182,
    hit: { w: 80, h: 40 },
    r: 14,
    // OFF at the bottom, then three fixed stops clockwise up to about 2 o'clock (owner photo,
    // G-3). Only OFF is printed; the three stops carry fan symbols from small to large.
    scale: 'fan',
    stops: [
      { id: 'off', label: 'OFF', angle: 180 },
      { id: 'f1', label: '1', angle: 300 },
      { id: 'f2', label: '2', angle: 360 },
      { id: 'f3', label: '3', angle: 420 },
    ],
    default: 'off',
  },
];
