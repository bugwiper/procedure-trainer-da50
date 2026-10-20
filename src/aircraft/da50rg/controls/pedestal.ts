import type { ControlSpec, DetentDef } from '../../../engine/registry';

// Centre-console controls (D-05a, D-07c, D-07d, D-10). The environmental-control plate sits in
// region env_control (DIRECTION, TEMPERATURE, CIRCULATING AIR sliders; the FAN knob is in
// knobs.ts); POWER, PARKING BRAKE and COWL FLAP sit in region pedestal. Control inventory: AFM
// section 7-23 and the private reference photos PED, COCK, SIM and DA50_virtual (layout facts
// only, no AFM wording, D-04b). The DA50 RG has one power lever: the ECU governs engine and
// propeller speed, so there is no propeller or mixture lever (P1 D-05a), and the POWER range
// is a plain 0 to 100 % load with no ground-idle gate.

/** POWER snaps in 5 % steps (planner choice under D-07d; data only, reversible). */
const POWER_STEPS: readonly DetentDef[] = Array.from({ length: 21 }, (_, i) => ({
  id: `p${i * 5}`,
  label: `${i * 5} %`,
  pos: (i * 5) / 100,
}));

export const PEDESTAL_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'lv.power',
    kind: 'detent-lever',
    label: 'POWER',
    region: 'pedestal',
    // Global 1115, 1160 in the 2000 x 1300 space. Handle square min(60, 200 - 154) = 46.
    x: 158,
    y: 118,
    hit: { w: 60, h: 200 },
    track: { length: 154, axis: 'v' },
    detents: POWER_STEPS,
    // Tap targets only at 0, 50 and 100 %; every 5 % step stays a snap position.
    markers: ['p0', 'p50', 'p100'],
    default: 'p70', // cruise load, D-07d in-flight default
    // Carbon-hatched palm grip, no emblem (PED, COCK, SIM; D-05).
    skin: 'power-grip',
  },
  {
    // Below the parking brake, left of POWER; OPEN is the upper position (owner photo, G-3).
    id: 'lv.cowl_flap',
    kind: 'detent-lever',
    label: 'COWL FLAP',
    region: 'pedestal',
    // Global 1058, 1218. Handle square min(50, 104 - 60) = 44. The placard COWL FLAP and the
    // lamps lt.cowl_open / lt.cowl_closed name the two positions, so the lever prints nothing.
    x: 101,
    y: 176,
    hit: { w: 50, h: 104 },
    track: { length: 60, axis: 'v' },
    nameless: true,
    legends: [],
    detents: [
      { id: 'closed', label: 'CLOSED', pos: 0 },
      { id: 'open', label: 'OPEN', pos: 1 },
    ],
    default: 'closed', // cruise setting assumed (D-07d)
    // Black handle in a slot (PED, SIM).
    skin: 'cowl-slider',
  },
  // Environmental-control plate (COCK, SIM). The slider kinds and their positions are layout
  // facts; the end-icon meanings are unconfirmed (UI-SPEC unconfirmed items 9 and 10).
  {
    // DIRECTION: air to the feet, the face or the windshield (DEFROST). Default FACE.
    id: 'lv.env_direction',
    kind: 'detent-lever',
    label: 'DIRECTION',
    region: 'env_control',
    // Global 1020, 816. Handle square min(40, 120 - 80) = 40.
    x: 63,
    y: 66,
    hit: { w: 40, h: 120 },
    track: { length: 80, axis: 'v' },
    detents: [
      { id: 'feet', label: 'FEET', pos: 0 },
      { id: 'face', label: 'FACE', pos: 0.5 },
      { id: 'defrost', label: 'DEFROST', pos: 1 },
    ],
    default: 'face',
    skin: 'env-slider', // black handle in a slot with original icons (COCK, SIM)
  },
  {
    // TEMPERATURE: continuous on the aircraft, modelled in five steps COLD, 25, 50, 75, WARM
    // (UI-SPEC unconfirmed item 9). PD-05: centred 4 units right of the UI-SPEC position
    // (global 1092) so its footprint clears the FAN knob of plan 01.1-03.
    id: 'lv.env_temp',
    kind: 'detent-lever',
    label: 'TEMPERATURE',
    region: 'env_control',
    // Global 1096, 862. Handle square min(40, 200 - 160) = 40.
    x: 139,
    y: 112,
    hit: { w: 40, h: 200 },
    track: { length: 160, axis: 'v' },
    detents: [
      { id: 'cold', label: 'COLD', pos: 0 },
      { id: 't25', label: '25', pos: 0.25 },
      { id: 't50', label: '50', pos: 0.5 },
      { id: 't75', label: '75', pos: 0.75 },
      { id: 'warm', label: 'WARM', pos: 1 },
    ],
    default: 't50',
    skin: 'env-slider',
  },
  {
    // CIRCULATING AIR: the only horizontal slider, FRESH at the left, RECIRC at the right. The
    // end-icon meaning is unconfirmed (UI-SPEC unconfirmed item 9). Default FRESH.
    id: 'lv.env_circ',
    kind: 'detent-lever',
    label: 'CIRCULATING AIR',
    region: 'env_control',
    // Global 1062, 990. Handle square min(40, 80 - 40) = 40.
    x: 105,
    y: 240,
    hit: { w: 80, h: 40 },
    track: { length: 40, axis: 'h' },
    detents: [
      { id: 'fresh', label: 'FRESH', pos: 0 },
      { id: 'recirc', label: 'RECIRC', pos: 1 },
    ],
    default: 'fresh',
    skin: 'env-slider', // horizontal; COCK, SIM
  },
  {
    // Parking brake between COWL FLAP and POWER (PED, SIM). SET is the aft/lower end here;
    // how the real lever is actuated (pull, rotate) is unconfirmed (UI-SPEC unconfirmed item 10).
    id: 'lv.parking_brake',
    kind: 'detent-lever',
    label: 'PARKING BRAKE',
    region: 'pedestal',
    // Global 1008, 1110. Handle square min(44, 88 - 44) = 44.
    x: 51,
    y: 68,
    hit: { w: 44, h: 88 },
    track: { length: 44, axis: 'v' },
    detents: [
      { id: 'set', label: 'SET', pos: 0 },
      { id: 'off', label: 'OFF', pos: 1 },
    ],
    default: 'off', // in flight the brake is released (D-07d)
    // Black wedge latch with two stops (PED, SIM); how it is actuated is unconfirmed.
    skin: 'parking-lever',
  },
];
