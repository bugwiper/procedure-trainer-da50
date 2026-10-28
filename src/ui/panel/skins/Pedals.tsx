import type { DetentLeverDef } from '../../../engine/registry';

// The toe brakes as two pedals side by side (Phase 5.1, P-01): the pilot's rudder pedals with a
// rubber toe pad each. Released they stand up; applied both pads are pressed, darker and a few
// units lower. One control, so both move together. Control-local units, origin at the centre of
// the 260 x 90 footprint. No text in either state (G-0).

/** The pressed ring: drawn only while a pointer is down, never a persistent state. */
const PRESSED_RING = '#8fb8e6';

/** How far a pressed pad and plate sit lower than a released one. */
export const PEDAL_PRESS = 5;

/** Centre x of the two pedals, control-local. */
export const PEDAL_CENTRES = [-70, 70] as const;

const PEDAL = {
  halfW: 44,
  top: -26,
  height: 56,
  armHalfW: 6,
  armTop: -45,
  padInset: 6,
  padHeight: 16,
} as const;

const TONE = {
  releasedPlate: '#3a4048',
  pressedPlate: '#24282d',
  edge: '#59626d',
  arm: '#2b3036',
  releasedPad: '#17191b',
  pressedPad: '#0a0b0c',
  padEdge: '#3a4048',
} as const;

export interface PedalsBodyProps {
  readonly def: Pick<DetentLeverDef, 'hit'>;
  /** The committed detent id: 'applied' presses both pedals, anything else leaves them up. */
  readonly state: string;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
}

/**
 * Pure body of the toe brakes: a plate, a rubber toe pad and an arm per pedal, and a thin ring
 * while a pointer is down. No hooks.
 */
export function PedalsBody({ state, pressed }: PedalsBodyProps) {
  const applied = state === 'applied';
  // Owner review 2026-10-28: the two looks are swapped against the first version; the pedals
  // stand lowered while the brake is released and up (pressed against the pads) while applied.
  const low = !applied;
  const drop = low ? PEDAL_PRESS : 0;
  return (
    <g data-pedals={applied ? 'applied' : 'released'} pointer-events="none">
      {PEDAL_CENTRES.map((cx) => (
        <g key={cx} data-pedal="" transform={`translate(${cx} ${drop})`}>
          <rect
            x={-PEDAL.armHalfW}
            y={PEDAL.armTop}
            width={PEDAL.armHalfW * 2}
            height={PEDAL.top - PEDAL.armTop + 4}
            fill={TONE.arm}
          />
          <rect
            data-pedal-plate=""
            x={-PEDAL.halfW}
            y={PEDAL.top}
            width={PEDAL.halfW * 2}
            height={PEDAL.height}
            rx={6}
            fill={low ? TONE.pressedPlate : TONE.releasedPlate}
            stroke={TONE.edge}
            stroke-width={1}
          />
          <rect
            data-pedal-pad=""
            x={-PEDAL.halfW + PEDAL.padInset}
            y={PEDAL.top + PEDAL.padInset}
            width={(PEDAL.halfW - PEDAL.padInset) * 2}
            height={PEDAL.padHeight}
            rx={3}
            fill={low ? TONE.pressedPad : TONE.releasedPad}
            stroke={TONE.padEdge}
            stroke-width={1}
          />
        </g>
      ))}
      {pressed ? (
        <rect
          x={-128}
          y={-44}
          width={256}
          height={88}
          rx={8}
          fill="none"
          stroke={PRESSED_RING}
          stroke-width={2}
        />
      ) : null}
    </g>
  );
}
