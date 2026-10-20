import type { ControlSpec, StateDef } from '../../../engine/registry';

// Glareshield exterior light switches (D-08), region `lights`, left to right LANDING, TAXI,
// POSITION, STROBE. Read as layout facts from the private photos P650, P761, P807 and SIM
// (numbers only, D-06); the positions are unconfirmed and flagged for owner review (D-03).
// ON is the upper end of the rocker. They are plain toggles; the white LIGHT rocker skin
// arrives with plan 01.1-08. In-flight defaults: POSITION and STROBE on, LANDING and TAXI
// off (D-07, P1 D-07d).

const OFF_ON: readonly [StateDef, StateDef] = [
  { id: 'off', label: 'OFF' },
  { id: 'on', label: 'ON' },
];

export const LIGHTS_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'sw.light_landing',
    kind: 'toggle',
    label: 'LANDING',
    region: 'lights',
    x: 117,
    y: 70,
    hit: { w: 36, h: 70 },
    states: OFF_ON,
    default: 'off',
  },
  {
    id: 'sw.light_taxi',
    kind: 'toggle',
    label: 'TAXI',
    region: 'lights',
    x: 165,
    y: 70,
    hit: { w: 36, h: 70 },
    states: OFF_ON,
    default: 'off',
  },
  {
    id: 'sw.light_position',
    kind: 'toggle',
    label: 'POSITION',
    region: 'lights',
    x: 213,
    y: 70,
    hit: { w: 36, h: 70 },
    states: OFF_ON,
    default: 'on',
  },
  {
    id: 'sw.light_strobe',
    kind: 'toggle',
    label: 'STROBE',
    region: 'lights',
    x: 261,
    y: 70,
    hit: { w: 36, h: 70 },
    states: OFF_ON,
    default: 'on',
  },
];
