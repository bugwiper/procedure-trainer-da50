// Static placards printed on a plate beside a control, as data (owner findings G-0.1, G-0.3, G-6).
// A placard names a position or a function; it never changes with state. Each one is positioned
// relative to a control id, so it follows the control when the control moves; the shell resolves
// the id against the registry and draws one text element per line. Pure data: no imports from
// the UI.

export interface PlacardDef {
  readonly id: string;
  /** Registry control id the placard stands beside. */
  readonly near: string;
  /** Offset in global units from the global centre of the control to the start of the first line. */
  readonly dx: number;
  /** Offset to the baseline of the first line. */
  readonly dy: number;
  /** ALL CAPS text, one entry per printed line. */
  readonly lines: readonly string[];
  readonly anchor: 'start' | 'middle' | 'end';
  /** On the font scale of the panel (UI-SPEC Typography): 6 or 8. */
  readonly size: 6 | 8;
  /** Baseline distance of the lines when it differs from the default of the size (stacked letters). */
  readonly pitch?: number;
}

/** Baseline distance of two printed lines of a placard, by size. */
const LINE_PITCH: Readonly<Record<PlacardDef['size'], number>> = { 6: 7, 8: 10 };

/** Offset from the control centre to the baseline of line `index` of a placard. */
export function placardLineY(placard: PlacardDef, index: number): number {
  return placard.dy + index * (placard.pitch ?? LINE_PITCH[placard.size]);
}

// ELT (sw.elt, global centre 1776, 656): the three positions of the rocker, printed on the right
// at the height of the three tap thirds of its 78-high hit rectangle (ON top, ARMED middle,
// RESET / TEST bottom as two lines). The lamp lt.elt sits on the left.
//
// Pedestal (plan 19): COWL FLAP centred above the group of the two lamp captions and the small
// lever, above the highest handle position of the lever.
export const PLACARDS: readonly PlacardDef[] = [
  { id: 'elt.on', near: 'sw.elt', dx: 22, dy: -26, lines: ['ON'], anchor: 'start', size: 6 },
  { id: 'elt.armed', near: 'sw.elt', dx: 22, dy: 0, lines: ['ARMED'], anchor: 'start', size: 6 },
  {
    id: 'elt.reset_test',
    near: 'sw.elt',
    dx: 22,
    dy: 23,
    lines: ['RESET /', 'TEST'],
    anchor: 'start',
    size: 6,
  },
  // PARKING / BRAKE (two lines) centred above the brake lever, above its top (SET) handle position.
  {
    id: 'parking_brake.name',
    near: 'lv.parking_brake',
    dx: 0,
    dy: -49,
    lines: ['PARKING', 'BRAKE'],
    anchor: 'middle',
    size: 6,
  },
  // THROTTLE centred above the slot of lv.power, above its 100 % handle position.
  {
    id: 'throttle.name',
    near: 'lv.power',
    dx: 0,
    dy: -96,
    lines: ['THROTTLE'],
    anchor: 'middle',
    size: 6,
  },
  // De-ice mode toggle (sw.deice_mode, global centre 120, 342; plan 21, owner finding G-1): HIGH
  // centred above the highest handle position, NORM end-anchored left of the middle one, OFF
  // centred below the lowest. The handle pivot sits 4.5 below the centre of the hit.
  {
    id: 'deice_mode.high',
    near: 'sw.deice_mode',
    dx: 0,
    dy: -24,
    lines: ['HIGH'],
    anchor: 'middle',
    size: 6,
  },
  {
    id: 'deice_mode.norm',
    near: 'sw.deice_mode',
    dx: -16,
    dy: 7,
    lines: ['NORM'],
    anchor: 'end',
    size: 6,
  },
  {
    id: 'deice_mode.off',
    near: 'sw.deice_mode',
    dx: 0,
    dy: 30,
    lines: ['OFF'],
    anchor: 'middle',
    size: 6,
  },
  // ICE LIGHT / ANNUN-TEST toggle (sw.deice_ice_light, global centre 171, 425; plan 22, owner finding
  // G-1): ICE LIGHT centred above the highest handle position, OFF right of the middle one,
  // ANNUN- and TEST as two lines centred below the lowest. The pivot sits 4.5 below the centre.
  {
    id: 'deice_ice_light.ice_light',
    near: 'sw.deice_ice_light',
    dx: 0,
    dy: -27,
    lines: ['ICE LIGHT'],
    anchor: 'middle',
    size: 6,
  },
  {
    id: 'deice_ice_light.off',
    near: 'sw.deice_ice_light',
    dx: 13,
    dy: 7,
    lines: ['OFF'],
    anchor: 'start',
    size: 6,
  },
  {
    id: 'deice_ice_light.annun_test',
    near: 'sw.deice_ice_light',
    dx: 0,
    dy: 28,
    lines: ['ANNUN-', 'TEST'],
    anchor: 'middle',
    size: 6,
  },
  // De-ice PUMP toggle (sw.deice_pump, global centre 227, 425; plan 22): PUMP 2 centred above the
  // highest handle position, PUMP 1 centred below the lowest.
  {
    id: 'deice_pump.pump2',
    near: 'sw.deice_pump',
    dx: 0,
    dy: -27,
    lines: ['PUMP 2'],
    anchor: 'middle',
    size: 6,
  },
  {
    id: 'deice_pump.pump1',
    near: 'sw.deice_pump',
    dx: 0,
    dy: 28,
    lines: ['PUMP 1'],
    anchor: 'middle',
    size: 6,
  },
  // ALTERNATE as nine stacked upright letters left of the red guard (sw.deice_alternate, global
  // centre 232, 296; plan 22): centred on x 194 and on the height of the switch, 7.2 apart.
  {
    id: 'deice_alternate.name',
    near: 'sw.deice_alternate',
    dx: -38,
    dy: -26.7,
    lines: ['A', 'L', 'T', 'E', 'R', 'N', 'A', 'T', 'E'],
    anchor: 'middle',
    size: 6,
    pitch: 7.2,
  },
  // FADEC group of the engine strip (plan 29, R2-5.2; sw.fadec global centre 126, 506, btn.fadec_test
  // 206, 506): AUTO centred above the switch (its upper position, the default), FORCE B centred
  // below it (the lower one), TEST centred above the button. The parts print no text of their own.
  {
    id: 'fadec.auto',
    near: 'sw.fadec',
    dx: 0,
    dy: -17,
    lines: ['AUTO'],
    anchor: 'middle',
    size: 6,
  },
  {
    id: 'fadec.force_b',
    near: 'sw.fadec',
    dx: 0,
    dy: 32,
    lines: ['FORCE B'],
    anchor: 'middle',
    size: 6,
  },
  {
    id: 'fadec.test',
    near: 'btn.fadec_test',
    dx: 0,
    dy: -15,
    lines: ['TEST'],
    anchor: 'middle',
    size: 6,
  },
  // ALTERNATOR switches (plan 29, R2-5.2; sw.alternator_1 global centre 134, 570, sw.alternator_2 210,
  // 570): ON above OFF, both centred midway between the two switches (x 172) at the heights of the
  // upper (ON, the second state) and the lower (OFF) handle position. The handle pivot sits 4.5
  // below the centre of the hit, the tip 14 above or below the pivot.
  {
    id: 'alternator.on',
    near: 'sw.alternator_1',
    dx: 38,
    dy: -4,
    lines: ['ON'],
    anchor: 'middle',
    size: 6,
  },
  {
    id: 'alternator.off',
    near: 'sw.alternator_1',
    dx: 38,
    dy: 24,
    lines: ['OFF'],
    anchor: 'middle',
    size: 6,
  },
  {
    id: 'cowl_flap.name',
    near: 'lv.cowl_flap',
    dx: -17,
    dy: -46,
    lines: ['COWL FLAP'],
    anchor: 'middle',
    size: 6,
  },
  // Glareshield light switches (plan 30, R2-1.1): the real panel prints ON above OFF once per side,
  // left of LANDING (sw.light_landing, global centre 1047, 90) and right of STROBE (sw.light_strobe,
  // 1191, 90), representative for all four rockers. ON is the upper rocker half (the second state),
  // so ON stands at the height of y 63 to 90 and OFF at the height of y 90 to 117. The rockers
  // themselves print no ON or OFF.
  {
    id: 'lights.left_on',
    near: 'sw.light_landing',
    dx: -26,
    dy: -11,
    lines: ['ON'],
    anchor: 'end',
    size: 6,
  },
  {
    id: 'lights.left_off',
    near: 'sw.light_landing',
    dx: -26,
    dy: 16,
    lines: ['OFF'],
    anchor: 'end',
    size: 6,
  },
  {
    id: 'lights.right_on',
    near: 'sw.light_strobe',
    dx: 26,
    dy: -11,
    lines: ['ON'],
    anchor: 'start',
    size: 6,
  },
  {
    id: 'lights.right_off',
    near: 'sw.light_strobe',
    dx: 26,
    dy: 16,
    lines: ['OFF'],
    anchor: 'start',
    size: 6,
  },
];
