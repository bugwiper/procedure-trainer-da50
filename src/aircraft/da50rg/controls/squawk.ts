import type { CodeEntryKeyDef, ControlSpec } from '../../../engine/registry';

// The simplified transponder (D-11, PNL-07): a TRAINER PART, temporary. It will be replaced later by
// the transponder of the PFD, so its position (the pilot's legroom, by owner decision) is
// not a fidelity item. One control whose state is the committed four-digit code, keys 0 to 7 and a
// clear key; the partial entry lives in the widget and never reaches the store. Nothing here is
// read from the aircraft: cb.xpdr is the breaker of the real unit, this is the squawk entry.

/** Key side in units: 44 units are about 63 px on the phone zoom of the region (>= 44 px). */
const KEY = 44;
/** Gap between two keys; at least 6 units. */
const GAP = 8;
const PITCH = KEY + GAP;
/** Row centres, control-local; the readout sits above them. */
const ROW_1 = -4;
const ROW_2 = ROW_1 + PITCH;

function digitKey(digit: string, column: number, row: number): CodeEntryKeyDef {
  return { key: digit, label: digit, x: (column - 2) * PITCH, y: row, w: KEY, h: KEY };
}

export const SQUAWK_CONTROLS: readonly ControlSpec[] = [
  // Digits 0 to 3 on the upper row, 4 to 7 on the lower row, CLR tall at the right of both rows.
  {
    id: 'kp.squawk',
    kind: 'code-entry',
    label: 'TRANSPONDER',
    region: 'transponder',
    x: 180,
    y: 100,
    // Tight around the readout and the keys: the rest of the region stays background for the zoom tap (PNL-09).
    hit: { w: 252, h: 140 },
    digits: 4,
    alphabet: '01234567',
    default: '7000',
    keys: [
      digitKey('0', 0, ROW_1),
      digitKey('1', 1, ROW_1),
      digitKey('2', 2, ROW_1),
      digitKey('3', 3, ROW_1),
      digitKey('4', 0, ROW_2),
      digitKey('5', 1, ROW_2),
      digitKey('6', 2, ROW_2),
      digitKey('7', 3, ROW_2),
      {
        key: 'clr',
        label: 'CLR',
        x: 2 * PITCH,
        y: (ROW_1 + ROW_2) / 2,
        w: KEY,
        h: PITCH + KEY,
      },
    ],
    // Readout window above the keys; 240 wide holds four glass digits.
    display: { x: 0, y: -52, w: 240, h: 36 },
  },
];
