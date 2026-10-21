import { useSignal } from '@preact/signals';
import type { StateDef, StateId, ToggleDef, TogglePosition } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';
import { BatBody } from '../skins/Bat';
import { RockerBody } from '../skins/Rocker';
import { SoftkeyCap } from '../frames/SoftkeysFrame';

const TAP_SLOP_PX = 10;

interface PointerStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  /** Where the pointer went down inside the hit rectangle: 0 is the top edge, 1 the bottom edge. */
  readonly fraction: number;
}

/**
 * Drawn position of the state at `index`: a two-state toggle draws low and high, a three-state
 * one low, mid and high (bottom, middle, top; plan 18, Table T2).
 */
export function togglePosition(index: number, count: number): TogglePosition {
  if (index <= 0) return 'low';
  return index >= count - 1 ? 'high' : 'mid';
}

/** The data-pressed-half value of a rocker for a position. */
export function pressedHalfOf(position: TogglePosition): 'upper' | 'level' | 'lower' {
  return position === 'high' ? 'upper' : position === 'mid' ? 'level' : 'lower';
}

/**
 * The state a tap at `fraction` of the hit height (0 top, 1 bottom) selects on a three-state
 * toggle: the top third the last state, the middle third the middle one, the bottom third the
 * first. Anything outside 0..1 (or not a number) clamps to an end, so the result is always one of
 * the declared states.
 */
export function stateAtFraction(states: readonly StateDef[], fraction: number): StateDef {
  const count = states.length;
  const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0.5;
  const fromTop = Math.min(count - 1, Math.floor(clamped * count));
  const picked = states[count - 1 - fromTop];
  return picked ?? states[0] ?? { id: '', label: '' };
}

/**
 * The state a tap sets: a two-state toggle flips whatever the position, a three-state toggle goes
 * to the third that was tapped (possibly the state it is already in, which records no event).
 */
export function tapTarget(
  states: readonly StateDef[],
  current: StateId,
  fraction: number,
): StateId {
  if (states.length === 3) return stateAtFraction(states, fraction).id;
  const other = states.find((st) => st.id !== current) ?? states[0];
  return other?.id ?? current;
}

/**
 * Toggle widget (switch and softkey skins). State reads from the graphic position (and the
 * data-state and aria-label for tests and assistive technology), never from colour alone and never
 * from printed text (G-0.1). Pointer contract: only primary
 * pointers, capture on pointerdown, actuate on a pointerup within the tap slop, never
 * listen to click (RESEARCH Pattern 5).
 */
export function Toggle({ def, bridge }: WidgetProps<ToggleDef>) {
  const pressed = useSignal(false);
  const start = useSignal<PointerStart | null>(null);

  const state = bridge.stateOf(def.id).value;
  const index = Math.max(
    0,
    def.states.findIndex((st) => st.id === state),
  );
  const isSecond = index > 0;
  const position = togglePosition(index, def.states.length);
  const stateLabel = def.states[index]?.label ?? '';

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
    // The hit element's own rectangle, so the thirds follow the scale and the zoom.
    const box = (e.currentTarget as Element).getBoundingClientRect();
    const fraction = box.height > 0 ? (e.clientY - box.top) / box.height : 0.5;
    start.value = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, fraction };
    pressed.value = true;
  };

  const onPointerUp = (e: PointerEvent) => {
    const s = start.value;
    if (!e.isPrimary || s === null || s.pointerId !== e.pointerId) return;
    clear();
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_SLOP_PX) return;
    const target = tapTarget(def.states, state, s.fraction);
    if (target !== state) bridge.actuate(def.id, target);
  };

  const skin = def.skin ?? 'bat';

  return (
    <g
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      data-skin={skin}
      data-size={def.size}
      data-colour={def.colour}
      data-pressed-half={skin === 'rocker' ? pressedHalfOf(position) : undefined}
      data-pressed={pressed.value ? 'true' : undefined}
      role="img"
      aria-label={`${def.label}: ${stateLabel}`}
      transform={`translate(${def.x} ${def.y})`}
    >
      {skin === 'rocker' ? (
        <RockerBody def={def} position={position} pressed={pressed.value} />
      ) : skin === 'bat' ? (
        <BatBody def={def} position={position} pressed={pressed.value} />
      ) : (
        <SoftkeyBody isSecond={isSecond} pressed={pressed.value} />
      )}
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

export interface BodyProps {
  readonly isSecond: boolean;
  readonly pressed: boolean;
}

/**
 * Softkey skin: the same key cap as the inert keys (a dark rounded key with an up-triangle), the
 * selected state a 2.5-unit white stroke (Color 5). The key prints no word at all: the legend
 * stands on the glass above it and the state is never printed (G-0.1, G-0.2).
 */
export function SoftkeyBody({ isSecond, pressed }: BodyProps) {
  return (
    <g pointer-events="none">
      <SoftkeyCap cx={0} cy={0} selected={isSecond} pressed={pressed} />
    </g>
  );
}
