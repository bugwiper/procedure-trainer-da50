import { useSignal } from '@preact/signals';
import type { CircuitBreakerDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';
import { BreakerBody } from '../skins/Breaker';
import { tapTarget } from './Toggle';

const TAP_SLOP_PX = 10;

interface PointerStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Circuit-breaker widget (PNL-12, D-02, D-03). A single tap toggles between in and out; there is
 * no confirmation and no animation. The state reads from the cap position and the white ring (and
 * the data-state and aria-label for tests and assistive technology), never from printed text
 * (G-0.1). Pointer contract copied from the toggle: only primary pointers, capture on pointerdown,
 * actuate on a pointerup within the tap slop, never listen to click (RESEARCH Pattern 5). Only the
 * hit rectangle is a control; the body is pointer-events none.
 */
export function CircuitBreaker({ def, bridge }: WidgetProps<CircuitBreakerDef>) {
  const pressed = useSignal(false);
  const start = useSignal<PointerStart | null>(null);

  const state = bridge.stateOf(def.id).value;
  const stateLabel = def.states.find((st) => st.id === state)?.label ?? '';

  const clear = () => {
    start.value = null;
    pressed.value = false;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone; the tap is still evaluated on pointerup.
    }
    start.value = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    pressed.value = true;
  };

  const onPointerUp = (e: PointerEvent) => {
    const s = start.value;
    if (!e.isPrimary || s === null || s.pointerId !== e.pointerId) return;
    clear();
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_SLOP_PX) return;
    const target = tapTarget(def.states, state, 0.5);
    if (target !== state) bridge.actuate(def.id, target);
  };

  return (
    <g
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      data-group={def.group}
      data-rating={def.rating}
      data-pressed={pressed.value ? 'true' : undefined}
      role="img"
      aria-label={`CIRCUIT BREAKER ${def.label}: ${stateLabel}`}
      transform={`translate(${def.x} ${def.y})`}
    >
      <BreakerBody def={def} state={state} pressed={pressed.value} />
      <rect
        data-hit={def.id}
        x={-def.hit.w / 2}
        y={-def.hit.h / 2}
        width={def.hit.w}
        height={def.hit.h}
        fill="transparent"
        pointer-events="all"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={clear}
        onLostPointerCapture={clear}
      />
    </g>
  );
}
