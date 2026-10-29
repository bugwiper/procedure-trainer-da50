import { defineCurve } from '../../engine/curve';

// The oil pressure against the oil temperature and the POWER lever (Phase 6, plan 04, O-01; owner
// description of 2026-10-28, D-10). The pressure falls with hot oil and rises with cold oil and with
// POWER: hot oil at the cruise setting reads in the lower third of the green band, hot oil at ground
// idle may fall into the low yellow band, a cold engine at idle is already in the high yellow band
// and any power added on a cold engine drives it into the high red band. The target pressure is
//
//   idle(oil temperature) + slope(oil temperature) * lever travel in percent
//
// read with `interpolate` (physics.ts), 0 with the engine stopped. Every point is an
// INSTRUCTOR-REVIEW value chosen to realise that description and the cruise anchor (91 degrees C and
// the lever at 70 give the base value, 5.0 bar, so the free panel and C-09 hold); none is measured or
// taken from a document. The bands (where yellow and red begin) live in the quantity data, not here:
// this file holds no band number. Data only: no wording of a document.
//
// x of both curves is the oil temperature in degrees C (the live oil_temp_c reading), held at the
// first and last value outside the table.

/** Pressure in bar with the POWER lever at idle (travel 0 percent), by oil temperature. */
export const OIL_PRESSURE_IDLE_CURVE = defineCurve('oil pressure at idle', [
  { x: -25, y: 8.0 },
  { x: 15, y: 7.2 },
  { x: 30, y: 7.2 },
  { x: 50, y: 6.2 },
  { x: 70, y: 5.2 },
  { x: 91, y: 4.3 },
  { x: 115, y: 3.7 },
  { x: 125, y: 3.45 },
  { x: 150, y: 3.1 },
]);

/** Pressure added per percent of POWER lever travel, bar, by oil temperature (always above 0). */
export const OIL_PRESSURE_SLOPE_CURVE = defineCurve('oil pressure per percent of lever', [
  { x: -25, y: 0.06 },
  { x: 15, y: 0.05 },
  { x: 30, y: 0.04 },
  { x: 50, y: 0.03 },
  { x: 70, y: 0.02 },
  { x: 91, y: 0.01 },
  { x: 150, y: 0.01 },
]);
