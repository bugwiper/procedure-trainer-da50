import type { ControlSpec, DetentDef } from '../../../engine/registry';

// Centre-console controls (D-05a, D-07c, D-07d, D-10). The environmental-control plate sits in
// region env_control (DIRECTION and TEMPERATURE sliders; the FAN knob is in knobs.ts) and in
// region env_circ (the CIRCULATING AIR slider); the THROTTLE (id lv.power), PARKING BRAKE and COWL FLAP sit in region pedestal.
// Control inventory: AFM section 7-23 and the private reference photos PED, COCK, SIM and DA50_virtual (layout facts
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
    // The plate says THROTTLE although the id stays lv.power (Q-04); the name is the plate
    // placard THROTTLE, so the widget draws none. Legends 0 %, 50 %, 100 % and MAX stay.
    label: 'THROTTLE',
    nameless: true,
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
  // Environmental-control plate (COCK, SIM, owner side-view photo, G-3). The group boxes with
  // their titles are static shell art (plates.ts), so the four controls are nameless. The slider
  // kinds and positions are layout facts; the pictogram meanings are unconfirmed (UI-SPEC
  // unconfirmed items 9 and 10).
  {
    // DIRECTION: air to the feet, the face or the windshield (DEFROST); pictograms only. Default FACE.
    id: 'lv.env_direction',
    kind: 'detent-lever',
    label: 'DIRECTION',
    nameless: true,
    legends: [],
    region: 'env_control',
    // Global 1004, 828. Handle square min(40, 120 - 80) = 40.
    x: 47,
    y: 78,
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
    // TEMPERATURE: continuous on the aircraft, modelled in five steps (UI-SPEC unconfirmed item
    // 9). Only WARM (top) and COLD (bottom) are printed; the three steps between print nothing.
    id: 'lv.env_temp',
    kind: 'detent-lever',
    label: 'TEMPERATURE',
    nameless: true,
    legends: ['cold', 'warm'],
    region: 'env_control',
    // Global 1100, 880. Handle square min(40, 200 - 160) = 40.
    x: 143,
    y: 130,
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
    // CIRCULATING AIR: the only horizontal slider, fresh air at the left, recirculation at the
    // right, pictograms only. Own region env_circ (plan 20). Default FRESH.
    id: 'lv.env_circ',
    kind: 'detent-lever',
    label: 'CIRCULATING AIR',
    nameless: true,
    legends: [],
    region: 'env_circ',
    // Global 1063, 1010. Handle square min(40, 80 - 40) = 40.
    x: 106,
    y: 20,
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
    // Parking brake, upper left of the pedestal (owner photo, G-3, R2-4.2): a small hinged flap
    // that lies flat when released (off) and stands up when pulled (set). Only the placard
    // PARKING / BRAKE names it; no legends, no state text. The track stays in the data but the
    // flap does not use it.
    id: 'lv.parking_brake',
    kind: 'detent-lever',
    label: 'PARKING BRAKE',
    nameless: true,
    legends: [],
    region: 'pedestal',
    // Global 1008, 1110. Handle square min(44, 88 - 44) = 44.
    x: 51,
    y: 68,
    hit: { w: 44, h: 88 },
    track: { length: 44, axis: 'v' },
    detents: [
      { id: 'off', label: 'OFF', pos: 0 },
      { id: 'set', label: 'SET', pos: 1 },
    ],
    default: 'off', // in flight the brake is released (D-07d)
    // A hinged flap in pseudo-perspective, toggled by a tap (R2-4.2, owner side-view photo).
    skin: 'parking-flap',
    tapToggle: true,
  },
];
