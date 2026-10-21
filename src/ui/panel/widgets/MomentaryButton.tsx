import { useRef } from 'preact/hooks';
import type { MomentaryButtonDef } from '../../../engine/registry';
import type { DispatchResult } from '../../../engine/store';
import type { WidgetProps } from '../ControlWidget';
import { registerPressTarget, seqOf } from '../press-targets';
import type { PressInfo, PressTarget } from '../press-targets';
import { PushButtonBody } from '../skins/PushButton';
import type { PressedSide } from '../skins/PushButton';

/** What the press target of a momentary control needs from its widget. */
export interface MomentaryPressDeps {
  readonly def: Pick<MomentaryButtonDef, 'id' | 'states'>;
  /** True when the down point of the press is in the left half of the control. */
  readonly isLeftHalf: (info: PressInfo) => boolean;
  readonly actuate: (id: string, value: string) => DispatchResult;
}

/**
 * The press target of a momentary control (R3-Z2, plan 39): a momentary target whose press
 * actuates the first pressed state, or for a three-state control the state of the half under the
 * down point (the left half is the first side), and whose release actuates the rest state. The
 * store rejects an unchanged state, so a repeated release is harmless. A discarded press never
 * changed anything, so discard does nothing. Pure and hook-free: the hold time and every timer
 * live in the gesture layer, the widget owns no pointer.
 */
export function makeMomentaryPress(deps: MomentaryPressDeps): PressTarget {
  const { def, isLeftHalf, actuate } = deps;
  const [rest, first, second] = def.states;
  return {
    cls: 'momentary',
    press(info) {
      const side = second === undefined || isLeftHalf(info) ? first : second;
      return seqOf(actuate(def.id, side.id));
    },
    release() {
      actuate(def.id, rest.id);
    },
    discard() {
      // A press that was taken away before its commit never changed anything.
    },
  };
}

/**
 * Momentary push button (D-07c) and the spring-return three-position toggle (D-09). Pointer
 * contract (R3-Z2): the widget owns no pointer. The hit rectangle registers a momentary press
 * target; the gesture layer commits the press after MOMENTARY_HOLD_MS held still (a quick tap is
 * a press and a release together), releases it on the lift or a cancel, and takes the pointer
 * away (a pan or a pinch) before the commit. The held side is read back from the store state, so
 * a ring or a thrown bat can never outlive the press (RESEARCH Pitfall 7).
 */
export function MomentaryButton({ def, bridge }: WidgetProps<MomentaryButtonDef>) {
  const [released, pressed] = def.states;
  const groupRef = useRef<SVGGElement>(null);

  const state = bridge.stateOf(def.id).value;
  const [, , secondSide] = def.states;
  const pressedSide: PressedSide =
    secondSide === undefined
      ? null
      : state === pressed.id
        ? 'left'
        : state === secondSide.id
          ? 'right'
          : null;

  /** True when the down point is in the left half of the control (local x below 0). */
  const isLeftHalf = (info: PressInfo): boolean => {
    const matrix = groupRef.current?.getScreenCTM();
    if (matrix) {
      return new DOMPoint(info.down.x, info.down.y).matrixTransform(matrix.inverse()).x < 0;
    }
    const box = info.hit.getBoundingClientRect();
    return info.down.x < box.left + box.width / 2;
  };

  // Built in the render body and registered by a ref callback on every render, so the target
  // never closes over stale props.
  const press = makeMomentaryPress({
    def,
    isLeftHalf,
    actuate: (id, value) => bridge.actuate(id, value),
  });

  const stateLabel = (def.states.find((s) => s.id === state) ?? released).label;

  return (
    <g
      ref={groupRef}
      data-control-id={def.id}
      data-kind={def.kind}
      data-skin={def.skin ?? 'plain'}
      data-state={state}
      role="img"
      aria-label={`${def.label}: ${stateLabel}`}
      transform={`translate(${def.x} ${def.y})`}
    >
      <PushButtonBody def={def} state={state} pressedSide={pressedSide} />
      <rect
        data-hit={def.id}
        x={-def.hit.w / 2}
        y={-def.hit.h / 2}
        width={def.hit.w}
        height={def.hit.h}
        fill="transparent"
        pointer-events="all"
        ref={(el: SVGRectElement | null) => registerPressTarget(el, press)}
      />
    </g>
  );
}
