import { defineCurve } from '../../engine/curve';

// Propeller speed against POWER lever position (owner request, second live test 2026-10-23). The
// propeller is governed by the engine control unit, so its speed is a function of the lever
// position alone. Source: the propeller set curve chart of the type-rating material (owner's photo,
// kept private in .input/, never committed). The points are READ FROM A PHOTO and are approximate
// (about plus or minus 5 rpm and half a percent of lever); the owner may refine them. Data only: no
// wording of the chart is copied. x is the lever travel in percent (the `travelPercent` of
// `lv.power`), y is the propeller speed in rpm.
//
// The curve starts at 2150 rpm with the lever at idle, falls to a minimum of 1750 rpm at 25 %, and
// rises through about 1995 rpm at 70 % (the cruise lever of the registry default) to 2340 rpm at
// 100 %. The straight run from 70 % to 90 % has no vertex of its own at 80 %.
export const PROP_SPEED_CURVE = defineCurve('propeller speed', [
  { x: 0, y: 2150 },
  { x: 7, y: 1915 },
  { x: 13, y: 1780 },
  { x: 25, y: 1750 },
  { x: 35, y: 1785 },
  { x: 50, y: 1880 },
  { x: 64.5, y: 1945 },
  { x: 70, y: 1995 },
  { x: 90, y: 2300 },
  { x: 100, y: 2340 },
]);
