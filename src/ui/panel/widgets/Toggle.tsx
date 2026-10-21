import { useSignal } from '@preact/signals';
import type { StateDef, StateId, ToggleDef, TogglePosition } from '../../../engine/registry';
import type { DispatchResult } from '../../../engine/store';
import type { WidgetProps } from '../ControlWidget';
import { registerPressTarget, seqOf } from '../press-targets';
import type { PressTarget } from '../press-targets';
import { BatBody } from '../skins/Bat';
import { RockerBody } from '../skins/Rocker';
import { SoftkeyCap } from '../frames/SoftkeysFrame';

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

/** What a press target needs from its widget; everything is read at call time. */
export interface TogglePressDeps {
  readonly def: Pick<ToggleDef, 'id' | 'states'>;
  readonly stateOf: () => StateId;
  readonly actuate: (id: string, value: StateId) => DispatchResult;
  readonly setPending: (on: boolean) => void;
}

/**
 * The press target of a toggle (R3-Z2): a latch target that acts on the tap only. A two-state
 * toggle flips, a three-state toggle goes to the third of the hit rectangle that the down point
 * was in (measured on the hit element, so the thirds follow the scale and the zoom); the current
 * third records nothing. Pure and hook-free: the pending visual is driven by the gesture layer
 * through setPending, never by the factory itself.
 */
export function makeTogglePress(deps: TogglePressDeps): PressTarget {
  const { def, stateOf, actuate, setPending } = deps;
  return {
    cls: 'latch',
    setPending,
    tap(info) {
      const box = info.hit.getBoundingClientRect();
      const fraction = box.height > 0 ? (info.down.y - box.top) / box.height : 0.5;
      const current = stateOf();
      const target = tapTarget(def.states, current, fraction);
      return target === current ? null : seqOf(actuate(def.id, target));
    },
  };
}

/**
 * Toggle widget (switch and softkey skins). State reads from the graphic position (and the
 * data-state and aria-label for tests and assistive technology), never from colour alone and never
 * from printed text (G-0.1). Pointer contract (R3-Z2): the widget owns no pointer. The hit
 * rectangle registers a latch press target; the gesture layer shows the pressed ring while the
 * press is pending, calls the target on a lift within the slop, and takes the pointer away when
 * it moves beyond the slop or a second pointer lands. Never listens to click (RESEARCH Pattern 5).
 */
export function Toggle({ def, bridge }: WidgetProps<ToggleDef>) {
  const pressed = useSignal(false);

  const state = bridge.stateOf(def.id).value;
  const index = Math.max(
    0,
    def.states.findIndex((st) => st.id === state),
  );
  const isSecond = index > 0;
  const position = togglePosition(index, def.states.length);
  const stateLabel = def.states[index]?.label ?? '';

  // Built in the render body and registered by a ref callback on every render, so the target
  // never closes over stale props; it reads the state at call time.
  const press = makeTogglePress({
    def,
    stateOf: () => bridge.stateOf(def.id).peek(),
    actuate: (id, value) => bridge.actuate(id, value),
    setPending: (on) => {
      pressed.value = on;
    },
  });

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
        ref={(el: SVGRectElement | null) => registerPressTarget(el, press)}
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
