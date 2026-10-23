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
    // Four direct click spots (R2-4.1, Table F1): each holds the printed mark of its position and
    // reaches the 44 px tap size at the region zoom. The footprint holds exactly the spots.
    hit: { w: 112, h: 86 },
    r: 14,
    spots: [
      { stop: 'f1', x: -37, y: -22, w: 37, h: 37 },
      { stop: 'f2', x: 0, y: -22, w: 37, h: 37 },
      { stop: 'f3', x: 37, y: -22, w: 37, h: 37 },
      { stop: 'off', x: 0, y: 24, w: 37, h: 37 },
    ],
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
  // FUEL selector (owner decision 2026-10-22, RESEARCH Open Question 3): an elongated red knob at
  // the bottom left of the pedestal, next to the throttle, with a small white line at its pointing
  // end. Forward is NORMAL (the in-flight default), 90 degrees clockwise EMERGENCY, 225 degrees
  // clockwise OFF. The real knob sits behind the throttle where the trim wheel is; it is drawn at
  // the bottom left of the pedestal by owner decision. The OFF angle 225 is owner-unverified
  // (docs/PANEL-LABELS.md, docs/PANEL-REVIEW.md). The three position words are static art of the
  // selector-bar look, so the knob is nameless. The real handle turns only clockwise (owner,
  // first live test; the AFM schematic shows NORMAL at the top, EMERGENCY at the right, OFF at the
  // bottom, the same clockwise order): `oneWay: 'cw'`. No click spots: a tap on the right half
  // steps one stop clockwise (OFF is followed by NORMAL), the left half does nothing, a drag
  // commits the nearest stop clockwise of its start and is clamped there.
  {
    id: 'sw.fuel_valve',
    kind: 'rotary',
    label: 'FUEL VALVE',
    nameless: true,
    region: 'pedestal',
    // Global 1005, 1258. A knob with three stops has a tap half on either side, and each half must
    // reach 44 px at the pedestal zoom of the phone (tests/zoom.test.ts): 86 wide. The footprint
    // lies on the pedestal plate (x 962 on the left, y 1288 at the bottom) and touches the footprint
    // of the cowl flap above it at y 1236.
    x: 48,
    y: 216,
    hit: { w: 86, h: 44 },
    r: 22,
    skin: 'selector-bar',
    scale: 'none',
    stops: [
      { id: 'normal', label: 'NORMAL', angle: 0 },
      { id: 'emergency', label: 'EMERGENCY', angle: 90 },
      { id: 'off', label: 'OFF', angle: 225 },
    ],
    default: 'normal',
    oneWay: 'cw',
  },
];
