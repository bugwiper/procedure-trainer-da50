import { useRef } from 'preact/hooks';
import type { MomentaryButtonDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';
import { PushButtonBody } from '../skins/PushButton';
import type { PressedSide } from '../skins/PushButton';

/**
 * Momentary push button (D-07c) and the spring-return three-position toggle (D-09). Pointer
 * contract: only primary pointers; pointerdown captures the pointer and actuates the pressed
 * state at once (for a three-state toggle the state of the half under the pointer); the first
 * of pointerup, pointercancel or lostpointercapture actuates the rest state exactly once (a
 * per-press flag, with the store's "unchanged" rejection as the backstop), so the part can
 * never stay stuck pressed (RESEARCH Pitfall 7). The held side is read back from the store
 * state, so a ring or a thrown bat can never outlive the press.
 */
export function MomentaryButton({ def, bridge }: WidgetProps<MomentaryButtonDef>) {
  const [released, pressed] = def.states;
  const activePointer = useRef<number | null>(null);
  const groupRef = useRef<SVGGElement>(null);

  const state = bridge.stateOf(def.id).value;
  const [, firstSide, secondSide] = def.states;
  const pressedSide: PressedSide =
    secondSide === undefined
      ? null
      : state === pressed.id
        ? 'left'
        : state === secondSide.id
          ? 'right'
          : null;

  const release = (e: PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    bridge.actuate(def.id, released.id);
  };

  /** True when the pointer is in the left half of the control (local x below 0). */
  const isLeftHalf = (e: PointerEvent): boolean => {
    const matrix = groupRef.current?.getScreenCTM();
    if (matrix) {
      return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()).x < 0;
    }
    const box = (e.currentTarget as Element).getBoundingClientRect();
    return e.clientX < box.left + box.width / 2;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary || activePointer.current !== null) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone; the release is still handled on pointerup.
    }
    activePointer.current = e.pointerId;
    const target = secondSide === undefined || isLeftHalf(e) ? firstSide : secondSide;
    bridge.actuate(def.id, target.id);
  };

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
        onPointerDown={onPointerDown}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      />
    </g>
  );
}
