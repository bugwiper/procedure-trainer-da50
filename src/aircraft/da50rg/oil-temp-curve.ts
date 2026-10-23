import { defineCurve } from '../../engine/curve';

// How fast the oil temperature climbs toward a hotter target, against the current reading (owner
// finding, acceptance test of plan 03-11, 2026-10-23). The oil temperature is a first-order lag
// (physics.ts); this curve multiplies its step while the temperature is rising: 1 is the compressed
// time constant (60 s), 3 is three times as fast, 0.175 is about a sixth of it. Aircraft behaviour,
// never a scenario fact: a scenario only degrades the cooling. Every value is an
// INSTRUCTOR-REVIEW value (RESEARCH A1), chosen so the ignored ENG OIL TEMP run of the shipped
// scenario takes the times the owner asked for; they are not measured. x is the oil temperature in
// degrees C, y the rate (a factor of the step, above 0). Read between the points by `interpolate`,
// held at the first and last value outside the table.
//
// Shape, by the bands of the oil temperature (quantities.ts):
// - up to 100: 1, the plain lag; the free panel and every normal run behave as before.
// - 100 to 112: rising to 3, so that the Realistic run, which starts at 114 degrees just below the
//   yellow band, is in yellow about a second after the onset.
// - 112 to 115, the top of the green: 3.
// - 116 to 125, the yellow band: 0.75, the time the pilot has to look at the other parameters and
//   ask what could raise the temperature (red about 20 s after the onset).
// - 125 to 128, the start of the red band: falling to 0.175.
// - 128 and above, red: 0.175, slow, so the pilot has time to get the checklist out (about 3
//   minutes from the start of red to the end of the ignored run).
//
// Falling temperature does not read this curve: the recovery is a constant of its own
// (OIL_TEMP_RECOVERY_RATE in physics.ts). The oil temperature carries a finer scale than the other
// readings (quantities.ts), because at 0.175 a step moves it by less than the default 0.01.
export const OIL_TEMP_RISE_RATE_CURVE = defineCurve('oil temperature rise rate', [
  { x: 100, y: 1 },
  { x: 112, y: 3 },
  { x: 115, y: 3 },
  { x: 116, y: 0.75 },
  { x: 125, y: 0.75 },
  { x: 128, y: 0.175 },
  { x: 150, y: 0.175 },
]);
