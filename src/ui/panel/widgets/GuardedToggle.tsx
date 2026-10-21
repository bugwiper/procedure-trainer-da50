import { useSignal } from '@preact/signals';
import { guardIdFor } from '../../../engine/registry';
import type { GuardedToggleDef, StateId } from '../../../engine/registry';
import type { DispatchResult } from '../../../engine/store';
import type { WidgetProps } from '../ControlWidget';
import { paint } from '../Defs';
import { registerPressTarget, seqOf } from '../press-targets';
import type { PressTarget } from '../press-targets';
import { BatBody } from '../skins/Bat';
import { RockerBody } from '../skins/Rocker';

export interface GuardCoverPressDeps {
  readonly guardId: string;
  /** The id of the guarded toggle: the key a double-tap pair is matched on (plan 40). */
  readonly guardedId: string;
  readonly isOpen: () => boolean;
  readonly actuate: (id: string, value: StateId) => DispatchResult;
}

/** The press target of the guard cover (R3-Z2): a tap lifts it, or closes it again. */
export function makeGuardCoverPress(deps: GuardCoverPressDeps): PressTarget {
  const { guardId, guardedId, isOpen, actuate } = deps;
  return {
    cls: 'latch',
    // The hit under the pointer changes when the guard opens: pairs match on the guarded toggle.
    pairKey: guardedId,
    tap() {
      return seqOf(actuate(guardId, isOpen() ? 'closed' : 'open'));
    },
  };
}

export interface GuardedSwitchPressDeps {
  readonly def: Pick<GuardedToggleDef, 'id' | 'states'>;
  readonly stateOf: () => StateId;
  readonly actuate: (id: string, value: StateId) => DispatchResult;
  readonly setPending: (on: boolean) => void;
}

/**
 * The press target of the guarded switch (R3-Z2): a tap flips it. The store interlock rejects the
 * request as blocked while the guard is closed, which gives null.
 */
export function makeGuardedSwitchPress(deps: GuardedSwitchPressDeps): PressTarget {
  const { def, stateOf, actuate, setPending } = deps;
  const [first, second] = def.states;
  return {
    cls: 'latch',
    setPending,
    pairKey: def.id,
    tap() {
      return seqOf(actuate(def.id, stateOf() === second.id ? first.id : second.id));
    },
  };
}

/**
 * Guarded switch (D-06, D-07b). Pointer contract (R3-Z2): the cover and the switch own no pointer;
 * each hit rectangle registers a latch press target and the gesture layer acts on the lift. The guard is a separate control with its own state: tap it
 * to lift, then tap the switch; the guard stays up until it is tapped again. While the guard
 * is closed no switch tap target is rendered, so a tap on the covered switch can only lift
 * the guard; the store interlock rejects the switch as "blocked" as defence in depth.
 */
export function GuardedToggle({ def, bridge }: WidgetProps<GuardedToggleDef>) {
  const guardId = guardIdFor(def.id);
  const guardDef = bridge.registry.get(guardId);
  const guardLabels = guardDef?.kind === 'guard' ? guardDef.states : null;

  const [first, second] = def.states;
  const state = bridge.stateOf(def.id).value;
  const isSecond = state === second.id;
  const stateLabel = (isSecond ? second : first).label;

  const guardState = bridge.stateOf(guardId).value;
  const guardOpen = guardState === 'open';
  const guardLabel =
    guardLabels === null ? guardState.toUpperCase() : guardLabels[guardOpen ? 1 : 0].label;

  const switchPressed = useSignal(false);
  const coverPress = makeGuardCoverPress({
    guardId,
    guardedId: def.id,
    isOpen: () => bridge.stateOf(guardId).peek() === 'open',
    actuate: (id, value) => bridge.actuate(id, value),
  });
  const switchPress = makeGuardedSwitchPress({
    def,
    stateOf: () => bridge.stateOf(def.id).peek(),
    actuate: (id, value) => bridge.actuate(id, value),
    setPending: (on) => {
      switchPressed.value = on;
    },
  });

  const open = def.guardOpenHit;
  // The registry rule: size and colour together draw a rocker under the guard, neither draws the
  // normal bat toggle (the de-ice ALTERNATE switch, owner finding G-1).
  const rocker = def.size !== undefined;
  const position = isSecond ? 'high' : 'low';

  return (
    <>
      <g
        data-control-id={def.id}
        data-kind={def.kind}
        data-state={state}
        data-skin={rocker ? 'rocker' : 'bat'}
        data-size={def.size}
        data-colour={def.colour}
        data-pressed-half={isSecond ? 'upper' : 'lower'}
        data-pressed={switchPressed.value ? 'true' : undefined}
        role="img"
        aria-label={`${def.label}: ${stateLabel}`}
        transform={`translate(${def.x} ${def.y})`}
      >
        {rocker ? (
          <RockerBody def={def} position={position} pressed={switchPressed.value} />
        ) : (
          <BatBody def={def} position={position} pressed={switchPressed.value} />
        )}
        {guardOpen ? (
          <rect
            data-hit={def.id}
            x={-def.hit.w / 2}
            y={-def.hit.h / 2}
            width={def.hit.w}
            height={def.hit.h}
            fill="transparent"
            pointer-events="all"
            ref={(el: SVGRectElement | null) => registerPressTarget(el, switchPress)}
          />
        ) : null}
      </g>
      <g
        data-control-id={guardId}
        data-kind="guard"
        data-state={guardState}
        role="img"
        aria-label={`${def.label} guard: ${guardLabel}`}
        transform={`translate(${def.x} ${def.y})`}
      >
        <GuardCover def={def} guardOpen={guardOpen} />
        <rect
          data-hit={guardId}
          x={guardOpen ? open.x : -def.hit.w / 2}
          y={guardOpen ? open.y : -def.hit.h / 2}
          width={guardOpen ? open.w : def.hit.w}
          height={guardOpen ? open.h : def.hit.h}
          fill="transparent"
          pointer-events="all"
          ref={(el: SVGRectElement | null) => registerPressTarget(el, coverPress)}
        />
      </g>
    </>
  );
}

export interface GuardCoverProps {
  readonly def: Pick<GuardedToggleDef, 'hit' | 'guardOpenHit'>;
  readonly guardOpen: boolean;
}

/** Distance of the first hatch bar from the top of the closed cover, and the bar pitch. */
const COVER_BAR_TOP = 10;
const COVER_BAR_PITCH = 7;
const COVER_BARS = 3;

/**
 * Pure art of the translucent red guard cover (UI-SPEC 8.6, rebuilt for the bat toggle by plan 22):
 * closed it is a block over the whole footprint (the hit rectangle inset 2, rx 4, #c43030 at 35
 * percent, border #e04040 1.5) with three hatch bars from the shared p-hatch near its top edge;
 * open it is drawn as a flap above the footprint (the lifted-guard rectangle) with the hinge line
 * at the top edge of the footprint, so the toggle is fully visible. It is the only red part of the
 * switch and draws no text at all (G-0.1); the guard state is in data-state and the aria-label of
 * its group.
 */
export function GuardCover({ def, guardOpen }: GuardCoverProps) {
  const open = def.guardOpenHit;
  const tint = { fill: '#c43030', 'fill-opacity': 0.35, stroke: '#e04040', 'stroke-width': 1.5 };
  const bars = Array.from({ length: COVER_BARS }, (_, i) => i);
  return (
    <g pointer-events="none">
      {guardOpen ? (
        <>
          {/* Lifted cover: hinge line at the top of the switch footprint, flap above it. */}
          <rect
            x={open.x + 2}
            y={open.y + 2}
            width={open.w - 4}
            height={open.h - 4}
            rx={3}
            {...tint}
          />
          {bars.map((i) => (
            <rect
              key={i}
              x={open.x + 8}
              y={open.y + 7 + i * 7}
              width={open.w - 16}
              height={3}
              fill={paint('p-hatch')}
            />
          ))}
          <line
            x1={open.x + 2}
            y1={open.y + open.h}
            x2={open.x + open.w - 2}
            y2={open.y + open.h}
            stroke="#8a929c"
            stroke-width={2}
          />
        </>
      ) : (
        <>
          <rect
            x={-def.hit.w / 2 + 2}
            y={-def.hit.h / 2 + 2}
            width={def.hit.w - 4}
            height={def.hit.h - 4}
            rx={4}
            {...tint}
          />
          {bars.map((i) => (
            <rect
              key={i}
              x={-def.hit.w / 2 + 8}
              y={-def.hit.h / 2 + COVER_BAR_TOP + i * COVER_BAR_PITCH}
              width={def.hit.w - 16}
              height={3}
              fill={paint('p-hatch')}
            />
          ))}
        </>
      )}
    </g>
  );
}
