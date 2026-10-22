import { MAX_CAS_CHIPS } from '../../../engine/cas';
import type { ActiveCas, CasLevel } from '../../../engine/cas';

// CAS chips on the PFD (PNL-03, D-06, D-06a; UI-SPEC "CAS Chip on the PFD"). Region-local units of
// the 495 x 367 PFD. Static: no flashing, no animation, no sound, no border, no live region. The
// message, level and trigger come from the aircraft rule table; this file only draws them.

const CHIP_W = 100;
const CHIP_H = 20;
const ROW0_Y = 236;
const ROW_STEP = 24;
const RIGHT_X = 294;
const LEFT_X = 190;
const TEXT_BASELINE = 14;
const LEVEL_FILL: Readonly<Record<CasLevel, string>> = { warning: '#f0443c', caution: '#f2c230' };
const LEVEL_NAME: Readonly<Record<CasLevel, string>> = { warning: 'Warning', caution: 'Caution' };

export interface ChipSlot {
  readonly x: number;
  readonly y: number;
}

/**
 * Slot of each chip: two per row from row 0 upward, right slot first, at most 3 rows. A count above
 * the maximum yields only the slots that exist (further chips are not drawn).
 */
export function casChipSlots(count: number): ChipSlot[] {
  const slots: ChipSlot[] = [];
  for (let n = 0; n < Math.min(count, MAX_CAS_CHIPS); n += 1) {
    slots.push({ x: n % 2 === 0 ? RIGHT_X : LEFT_X, y: ROW0_Y - ROW_STEP * Math.floor(n / 2) });
  }
  return slots;
}

export function CasChips({ active }: { readonly active: readonly ActiveCas[] }) {
  const slots = casChipSlots(active.length);
  return (
    <g data-testid="cas-chips" pointer-events="none">
      {slots.map((slot, i) => {
        const message = active[i];
        if (message === undefined) return null;
        return (
          <g
            key={message.id}
            data-testid="cas-chip"
            data-cas-id={message.id}
            data-level={message.level}
            role="img"
            aria-label={`${LEVEL_NAME[message.level]}: ${message.text}`}
          >
            <rect x={slot.x} y={slot.y} width={CHIP_W} height={CHIP_H} rx={2} fill="#000000" />
            <text
              x={slot.x + CHIP_W / 2}
              y={slot.y + TEXT_BASELINE}
              text-anchor="middle"
              font-size={10}
              font-weight={700}
              fill={LEVEL_FILL[message.level]}
            >
              {message.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
